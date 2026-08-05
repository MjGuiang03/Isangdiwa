import { Router } from 'express';
import { ObjectId } from 'mongodb';

import { users, admins, loans, savingsGoals, loanPayments, savingsTransactions, counters } from '../config/db.js';
import { authenticateUser } from '../middleware/auth.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { generatePaymentLink, sendPaymongoTransfer } from '../utils/paymongo.js';
import { notifyUser } from '../utils/notifyHelpers.js';
import { callGeminiVision } from '../utils/gemini.js';

const router = Router();

/* ================== ADMIN - GET MEMBER SAVINGS ================== */
router.get('/admin/member-savings', authenticateAdmin, async (req, res) => {
  try {
    const { email } = req.query;
    let query = {};
    if (email) {
      query.email = email;
    }
    const goals = await savingsGoals.find(query).toArray();
    const totalSavings = goals.reduce((sum, g) => sum + (g.savedAmount || 0), 0);

    let transactions = [];
    let monthlyTrend = [];
    let communitySavings = [];
    let savingsSummary = {};
    if (!email) {
      // Aggregate monthly trend on the server instead of sending all raw transactions
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear + 1, 0, 1);
      
      monthlyTrend = await savingsTransactions.aggregate([
        { $match: { type: 'deposit', date: { $gte: yearStart, $lt: yearEnd } } },
        { $group: { 
          _id: { $month: "$date" }, 
          savings: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } }
        }},
        { $sort: { _id: 1 } }
      ]).toArray();

      // Community/Branch savings breakdown
      // Get all unique saver emails
      const saverEmails = [...new Set(goals.map(g => g.email))];
      
      // Fetch branch info for all savers
      const saverUsers = saverEmails.length > 0
        ? await users.find(
            { email: { $in: saverEmails }, isDeleted: { $ne: true } },
            { projection: { email: 1, branch: 1 } }
          ).toArray()
        : [];
      
      // Build email-to-branch map
      const emailToBranch = {};
      saverUsers.forEach(u => { emailToBranch[u.email] = u.branch || 'Unassigned'; });

      // Aggregate savings by community
      const communityMap = {};
      goals.forEach(g => {
        const branch = emailToBranch[g.email] || 'Unassigned';
        if (!communityMap[branch]) {
          communityMap[branch] = { community: branch, totalSavings: 0, members: new Set() };
        }
        communityMap[branch].totalSavings += (g.savedAmount || 0);
        communityMap[branch].members.add(g.email);
      });

      communitySavings = Object.values(communityMap)
        .map(c => ({
          community: c.community,
          totalSavings: c.totalSavings,
          memberCount: c.members.size,
          avgPerMember: c.members.size > 0 ? Math.round(c.totalSavings / c.members.size) : 0,
        }))
        .sort((a, b) => b.totalSavings - a.totalSavings);

      // Summary stats
      const totalSavers = saverEmails.length;
      const avgPerSaver = totalSavers > 0 ? Math.round(totalSavings / totalSavers) : 0;
      savingsSummary = { totalSavers, avgPerSaver };
    }

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const formattedTrend = months.map((m, i) => {
      const found = monthlyTrend.find(t => t._id === i + 1);
      return { month: m, savings: found ? found.savings : 0 };
    });

    // Find highest month
    const highestMonth = formattedTrend.reduce((best, curr) => curr.savings > best.savings ? curr : best, { month: '—', savings: 0 });

    res.json({ success: true, totalSavings, transactions, monthlyTrend: formattedTrend, communitySavings, savingsSummary: { ...savingsSummary, highestMonth: highestMonth.month, highestMonthAmount: highestMonth.savings } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch member savings' });
  }
});

/* ── Helper: compute nextPaymentDate for an active loan ── */
function enrichLoanWithNextPayment(loan) {
  if (loan.status !== 'active') return loan;
  const term = loan.termMonths || 12;
  const paidMonths = loan.paidMonths || 0;
  if (paidMonths >= term) return loan; // fully paid

  if (!loan.disbursementDate) return loan;

  // Next payment is due (paidMonths + 1) months after disbursement
  const startDate = new Date(loan.disbursementDate);
  const nextDue = new Date(startDate);
  nextDue.setMonth(startDate.getMonth() + paidMonths + 1);

  // Late Penalty Check: > 3 days past due date exactly
  const cutoffDate = new Date(nextDue);
  cutoffDate.setDate(nextDue.getDate() + 3);
  // Give them until the end of the 3rd day exactly 
  cutoffDate.setHours(23, 59, 59, 999);

  let upcomingPaymentAmount = loan.monthlyPayment;
  let isLate = false;

  if (Date.now() > cutoffDate.getTime()) {
      isLate = true;
      const principalPerMonth = (loan.amount || 0) / term;
      let interestPerMonth;
      if (loan.totalInterest != null && loan.totalInterest > 0) {
        interestPerMonth = loan.totalInterest / term;
      } else {
        let rate = loan.interestRate || 0.02;
        if (rate > 1) rate = rate / 100;
        interestPerMonth = (loan.amount || 0) * rate;
      }
      
      // 3% flat interest applied strictly to this late month payment
      const penaltyInterestPerMonth = (loan.amount || 0) * 0.03;
      upcomingPaymentAmount = principalPerMonth + penaltyInterestPerMonth;
  }

  return { ...loan, nextPaymentDate: nextDue, upcomingPaymentAmount, isLate };
}


/* ================== USER - VERIFY ID FRAME (Gemini Vision) ================== */
router.post('/loans/verify-id-frame', authenticateUser, async (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) {
      return res.status(400).json({ success: false, detected: false, message: 'No image data provided' });
    }

    // Strip the data URI prefix to get raw base64
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

    const systemPrompt = `You are a document verification system. Your ONLY job is to determine whether the image contains a valid government-issued identification card or document.

Valid Philippine government IDs include: SSS ID, PhilHealth ID, UMID, Driver's License, Passport, PRC ID, Voter's ID, Postal ID, TIN ID, Senior Citizen ID, PWD ID, NBI Clearance, Police Clearance, Barangay ID, Company ID, School ID, or any similar official identification card.

Also accept government IDs from other countries (passport, driver's license, national ID, etc.).

Respond ONLY with a JSON object. No other text.`;

    const textPrompt = `Analyze this image and determine if it shows a government-issued ID card or official identification document.

Rules:
- The ID must be clearly visible (not just a corner or edge)
- Text on the ID should be at least partially readable
- The image should show the FRONT of an ID card
- Random objects, faces without ID, blank surfaces, or non-ID documents should return detected: false

Respond with: { "detected": true/false, "confidence": "high"/"medium"/"low", "reason": "brief reason" }`;

    const aiResult = await callGeminiVision(systemPrompt, textPrompt, base64Data);

    if (aiResult === '__RATE_LIMITED__') {
      return res.json({ success: true, detected: false, confidence: 'low', reason: 'Rate limited — please wait', rateLimited: true });
    }

    if (!aiResult) {
      return res.json({ success: true, detected: false, confidence: 'low', reason: 'AI service unavailable' });
    }

    let parsed;
    try {
      const cleaned = aiResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.json({ success: true, detected: false, confidence: 'low', reason: 'Could not parse response' });
    }

    return res.json({
      success: true,
      detected: !!parsed.detected,
      confidence: parsed.confidence || 'low',
      reason: parsed.reason || '',
    });
  } catch (err) {
    console.error('[ID Verify Error]:', err);
    res.json({ success: true, detected: false, confidence: 'low', reason: 'Verification failed' });
  }
});


/* ================== USER - APPLY FOR LOAN ================== */
router.post('/loans/apply', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const {
      amount, loanType, purpose, termMonths,
      interestRate, totalInterest, totalRepayment, monthlyPayment,
      disbursementMethod, disbursementAccount,
      selfieFileName, idFileName,
      selfieData, idData,
      coeData, coeFileName,
      itrData, itrFileName,
      payslipData, payslipFileName,
      hasActiveLoan, activeLoanScreenshotData, activeLoanScreenshotFileName
    } = req.body;

    if (!amount || (!loanType && !purpose)) {
      return res.status(400).json({ success: false, message: 'Amount and loan type are required' });
    }

    const user = await users.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const now = new Date();
    const year = now.getFullYear();
    const counterDoc = await counters.findOneAndUpdate(
      { _id: `loans-${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const loanId = `LN-${year}-${String(counterDoc.seq).padStart(3, '0')}`;

    const newLoan = {
      loanId, email, memberName: user.fullName, amount: Number(amount),
      loanType: loanType || 'personal',
      purpose: purpose || loanType || 'Personal Loan',
      termMonths: Number(termMonths) || 12,
      interestRate: Number(interestRate) || 0,
      totalInterest: Number(totalInterest) || 0,
      totalRepayment: Number(totalRepayment) || Number(amount),
      monthlyPayment: Number(monthlyPayment) || 0,
      remainingBalance: Number(totalRepayment) || Number(amount),
      paidMonths: 0,
      status: 'pending',
      disbursementMethod: disbursementMethod || null,
      disbursementAccount: disbursementAccount || null,
      selfieFileName: selfieFileName || null,
      idFileName: idFileName || null,
      selfieData: selfieData || null,
      idData: idData || null,
      coeData: coeData || null,
      coeFileName: coeFileName || null,
      itrData: itrData || null,
      itrFileName: itrFileName || null,
      payslipData: payslipData || null,
      payslipFileName: payslipFileName || null,
      hasActiveLoan: hasActiveLoan || false,
      activeLoanScreenshotData: activeLoanScreenshotData || null,
      activeLoanScreenshotFileName: activeLoanScreenshotFileName || null,
      appliedDate: new Date(), updatedAt: new Date(),
      statusHistory: [{ status: 'pending', date: new Date() }]
    };

    await loans.insertOne(newLoan);
    res.status(201).json({ success: true, message: 'Loan application submitted', loanId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to apply for loan' });
  }
});


/* ================== USER - GET MY LOANS ================== */
router.get('/loans/my-loans', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const { search } = req.query;
    const page  = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const findQuery = { email };
    if (search) {
      findQuery.$or = [
        { loanId:  { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } },
        { status:  { $regex: search, $options: 'i' } }
      ];
    }

    const totalCount = await loans.countDocuments(findQuery);
    const userLoans = await loans.find(findQuery)
      .sort({ appliedDate: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Stats still need all loans to calculate totals accurately
    const allUserLoans = await loans.find(findQuery).toArray();
    const totalBorrowed    = allUserLoans
      .filter(l => l.disbursed || l.status === 'completed')
      .reduce((sum, l) => sum + l.amount, 0);
    const activeLoans      = allUserLoans.filter(l => l.status === 'active');
    const remainingBalance = activeLoans.reduce((sum, l) => sum + (l.remainingBalance || l.amount), 0);

    res.status(200).json({
      success: true,
      loans: userLoans.map(enrichLoanWithNextPayment),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      stats: { totalBorrowed, remainingBalance, activeCount: activeLoans.length }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch loans' });
  }
});

/* ================== ADMIN - GET ALL LOANS ================== */
router.get('/admin/loans', authenticateAdmin, async (req, res) => {
  try {
    const { search, status, page: qPage, limit: qLimit } = req.query;
    const page  = parseInt(qPage)  || 1;
    const limit = parseInt(qLimit) || 10;
    const skip  = (page - 1) * limit;

    const query = {};
    if (status === 'non_completed') {
      query.status = { $nin: ['completed', 'cancelled'] };
    } else if (status === 'ongoing') {
      query.status = 'active';
    } else if (status && status !== 'all') {
      query.status = status;
    } else {
      query.status = { $ne: 'cancelled' };
    }

    if (search) {
      query.$or = [
        { memberName: { $regex: search, $options: 'i' } },
        { loanId:     { $regex: search, $options: 'i' } },
        { email:      { $regex: search, $options: 'i' } }
      ];
    }

    const totalCount = await loans.countDocuments(query);
    const allLoans = await loans.find(query)
      .project({
        selfieData: 0,
        idData: 0,
        coeData: 0,
        itrData: 0,
        payslipData: 0,
        activeLoanScreenshotData: 0
      })
      .sort({ appliedDate: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Count loans applied this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const statsPipeline = [
      {
        $facet: {
          pending: [{ $match: { status: 'pending' } }, { $count: "count" }],
          approved: [{ $match: { status: 'approved' } }, { $count: "count" }],
          active: [{ $match: { status: 'active' } }, { $count: "count" }],
          completed: [{ $match: { status: 'completed' } }, { $count: "count" }],
          rejected: [{ $match: { status: 'rejected' } }, { $count: "count" }],
          totalThisMonth: [
            { $match: { appliedDate: { $gte: monthStart }, status: { $ne: 'cancelled' } } },
            { $count: "count" }
          ],
          totalDisbursed: [
            { $match: { disbursed: true } },
            { $group: { _id: null, total: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } } } }
          ]
        }
      }
    ];

    const statsResultArr = await loans.aggregate(statsPipeline).toArray();
    const sr = statsResultArr[0] || {};

    const stats = {
      pending: sr.pending[0]?.count || 0,
      approved: sr.approved[0]?.count || 0,
      active: sr.active[0]?.count || 0,
      completed: sr.completed[0]?.count || 0,
      rejected: sr.rejected[0]?.count || 0,
      totalThisMonth: sr.totalThisMonth[0]?.count || 0,
      totalDisbursed: sr.totalDisbursed[0]?.total || 0
    };

    // Fetch branch/community for all member emails in this batch
    const emailsInBatch = [...new Set(allLoans.map(l => l.email).filter(Boolean))];
    const batchUsers = emailsInBatch.length > 0
      ? await users.find(
          { email: { $in: emailsInBatch } },
          { projection: { email: 1, branch: 1 } }
        ).toArray()
      : [];
    const emailToBranch = {};
    batchUsers.forEach(u => { emailToBranch[u.email] = u.branch || 'Unassigned'; });

    const enrichedLoans = allLoans.map(l => {
      const enriched = enrichLoanWithNextPayment(l);
      return {
        ...enriched,
        branchName: emailToBranch[l.email] || 'Unassigned',
        community: emailToBranch[l.email] || 'Unassigned'
      };
    });

    res.status(200).json({ 
      success: true, 
      loans: enrichedLoans, 
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      stats 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch loans' });
  }
});

/* ================== ADMIN - GET SINGLE LOAN ================== */
router.get('/admin/loans/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let query = { loanId: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ loanId: id }, { _id: new ObjectId(id) }] };
    }

    const loan = await loans.findOne(query);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    res.status(200).json({ success: true, loan: enrichLoanWithNextPayment(loan) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch loan details' });
  }
});

/* ================== ADMIN - PROPOSE MODIFIED TERMS ================== */
router.put('/admin/loans/:id/propose-terms', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedAmount, repaymentTerm, monthlyPayment, totalInterest, totalRepayment } = req.body;

    const loan = await loans.findOne({ _id: new ObjectId(id) });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending loans can have terms proposed' });
    }

    const modifiedTerms = {
      approvedAmount: Number(approvedAmount),
      repaymentTerm: Number(repaymentTerm),
      monthlyPayment: Number(monthlyPayment),
      totalInterest: Number(totalInterest),
      totalRepayment: Number(totalRepayment),
      proposedDate: new Date(),
    };

    await loans.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          modifiedTerms,
          status: 'awaiting_member_approval',
          updatedAt: new Date(),
        },
        $push: { statusHistory: { status: 'awaiting_member_approval', date: new Date() } }
      }
    );

    res.status(200).json({ success: true, message: 'Modified terms sent to member for approval' });

    // Notify member about proposed modified terms
    await notifyUser(
      loan.email,
      'loan',
      'Modified Loan Terms Proposed',
      `<h2>Updated Loan Terms Proposed</h2><p>The Loan Admin has proposed updated terms for your loan request (ID: <strong>${loan.loanId}</strong>):</p><ul><li><strong>Approved Amount:</strong> ₱${Number(approvedAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</li><li><strong>Repayment Term:</strong> ${repaymentTerm} months</li><li><strong>Monthly Repayment:</strong> ₱${Number(monthlyPayment).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</li></ul><p>Please review and accept/decline these updated terms in your account portal.</p>`,
      `The Loan Admin proposed updated terms for loan ${loan.loanId}. Please review in your portal.`
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to propose terms' });
  }
});

/* ================== ADMIN - APPROVE LOAN ================== */
router.put('/admin/loans/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const loan = await loans.findOne({ _id: new ObjectId(id) });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    // Allow approve if pending, or if member approved the modified terms
    const canApprove = loan.status === 'pending' || (loan.status === 'pending' && loan.memberApprovedTerms);
    if (!canApprove) {
      return res.status(400).json({ success: false, message: 'Only pending loans can be approved' });
    }

    await loans.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { status: 'approved', approvedDate: new Date(), updatedAt: new Date() },
        $push: { statusHistory: { status: 'approved', date: new Date() } }
      }
    );

    res.status(200).json({ success: true, message: 'Loan approved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to approve loan' });
  }
});

/* ================== ADMIN - REJECT LOAN ================== */
router.put('/admin/loans/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const loan = await loans.findOne({ _id: new ObjectId(id) });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending loans can be rejected' });
    }

    await loans.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { status: 'rejected', rejectionReason: rejectionReason || '', rejectedDate: new Date(), updatedAt: new Date() },
        $push: { statusHistory: { status: 'rejected', date: new Date(), reason: rejectionReason || '' } }
      }
    );

    res.status(200).json({ success: true, message: 'Loan rejected successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to reject loan' });
  }
});

/* ================== USER - RESPOND TO MODIFIED TERMS ================== */
router.put('/loans/:id/respond-terms', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { accepted, reason } = req.body;
    const email = req.user.email;

    const loan = await loans.findOne({ _id: new ObjectId(id) });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.email !== email) return res.status(403).json({ success: false, message: 'Unauthorized' });
    if (loan.status !== 'awaiting_member_approval') {
      return res.status(400).json({ success: false, message: 'This loan is not awaiting your approval' });
    }

    if (accepted) {
      // Apply the modified terms as the new loan values
      const mt = loan.modifiedTerms;
      await loans.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            amount: mt.approvedAmount,
            termMonths: mt.repaymentTerm,
            monthlyPayment: mt.monthlyPayment,
            totalInterest: mt.totalInterest,
            totalRepayment: mt.totalRepayment,
            remainingBalance: mt.totalRepayment,
            memberApprovedTerms: true,
            status: 'pending',
            updatedAt: new Date(),
          },
          $push: { statusHistory: { status: 'member_agreed', date: new Date() } }
        }
      );

      res.json({ success: true, message: 'You have agreed to the modified terms' });

      // Notify admins that member accepted
      try {
        const adminList = await admins.find({ role: { $in: ['loan', 'loanAdmin', 'superadmin', 'admin'] } }).toArray();
        for (const admin of adminList) {
          await notifyUser(
            admin.email,
            'loan',
            `Member Accepted Proposed Terms — ${loan.loanId}`,
            `<h2>Member Accepted Proposed Loan Terms</h2><p>Member <strong>${loan.memberName || loan.email}</strong> has accepted the proposed terms for loan request <strong>${loan.loanId}</strong>.</p><p>Approved Amount: ₱${Number(mt.approvedAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} for ${mt.repaymentTerm} months.</p>`,
            `Member ${loan.memberName || loan.email} accepted proposed terms for loan ${loan.loanId}.`
          );
        }
      } catch (err) {
        console.error('Failed to notify admins of agreement:', err);
      }
    } else {
      // Decline — revert to pending with original terms and record decline reason
      const declineReason = (reason && reason.trim()) ? reason.trim() : 'No specific reason provided';
      await loans.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'pending',
            declineReason,
            updatedAt: new Date(),
          },
          $unset: { modifiedTerms: '', memberApprovedTerms: '' },
          $push: { statusHistory: { status: 'member_declined', date: new Date(), reason: declineReason } }
        }
      );

      res.json({ success: true, message: 'You have declined the modified terms' });

      // Notify loan admins with reason
      try {
        const adminList = await admins.find({ role: { $in: ['loan', 'loanAdmin', 'superadmin', 'admin'] } }).toArray();
        for (const admin of adminList) {
          await notifyUser(
            admin.email,
            'loan',
            `Member Declined Proposed Terms — ${loan.loanId}`,
            `<h2>Member Declined Proposed Loan Terms</h2><p>Member <strong>${loan.memberName || loan.email}</strong> (${loan.email}) has declined the proposed terms for loan request (ID: <strong>${loan.loanId}</strong>).</p><p><strong>Reason for Declining:</strong> ${declineReason}</p><p>The loan has reverted to Pending status in your Loan Admin dashboard.</p>`,
            `Member ${loan.memberName || loan.email} declined proposed terms for loan ${loan.loanId}. Reason: ${declineReason}`
          );
        }
      } catch (err) {
        console.error('Failed to notify admins of decline:', err);
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to process response' });
  }
});

/* ================== USER - CANCEL LOAN ================== */
router.put('/loans/:id/cancel', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const email = req.user.email;

    const loan = await loans.findOne({ _id: new ObjectId(id) });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.email !== email) return res.status(403).json({ success: false, message: 'Unauthorized' });
    
    if (loan.status !== 'pending' && loan.status !== 'awaiting_member_approval' && loan.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Only pending or approved loans can be cancelled' });
    }

    const cancelReason = reason || 'Cancelled by user';

    await loans.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { status: 'cancelled', cancelledDate: new Date(), updatedAt: new Date(), cancellationReason: cancelReason },
        $push: { statusHistory: { status: 'cancelled', date: new Date(), reason: cancelReason } }
      }
    );

    res.status(200).json({ success: true, message: 'Loan cancelled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to cancel loan' });
  }
});

/* ================== ADMIN - PROCESS LOAN DISBURSEMENT ================== */
router.put('/admin/loans/:id/process', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, processReason } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Payment method is required' });
    }

    const loan = await loans.findOne({ _id: new ObjectId(id) });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    // Ensure the loan is approved and hasn't already been disbursed
    if (loan.status !== 'approved' && loan.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Only approved loans can be processed for disbursement' });
    }
    if (loan.disbursed) {
      return res.status(400).json({ success: false, message: 'This loan has already been disbursed' });
    }

    let transferResult = null;

    // For E-Wallet/Bank: send via PayMongo
    if (paymentMethod === 'e-wallet' || paymentMethod === 'bank') {
      // Parse account info from the disbursement account string
      const accountInfo = loan.disbursementAccount || '';
      // Try to extract account name and number from "Name - Number" format
      const parts = accountInfo.split(' - ');
      const accountName = parts.length > 1 ? parts.slice(0, -1).join(' - ').trim() : accountInfo;
      const accountNumber = parts.length > 1 ? parts[parts.length - 1].trim() : accountInfo;

      transferResult = await sendPaymongoTransfer({
        amount: loan.amount,
        accountNumber,
        accountName,
        method: paymentMethod,
        referenceId: loan.loanId || id,
      });

      if (!transferResult.success) {
        return res.status(500).json({
          success: false,
          message: `PayMongo transfer failed: ${transferResult.error || 'Unknown error'}. Please try again or use cash disbursement.`
        });
      }
    }

    // Calculate first payment due date: 1 month after disbursement
    const disbursementDate = new Date();
    const firstDueDate = new Date(disbursementDate);
    firstDueDate.setMonth(firstDueDate.getMonth() + 1);

    await loans.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status: 'active',
          disbursed: true, 
          disbursementDate, 
          nextDueDate: firstDueDate,
          paymentMethod,
          processReason: processReason || null,
          transferResult: transferResult?.data || null,
          updatedAt: new Date() 
        },
        $push: { statusHistory: { status: 'processed', date: new Date() } }
      }
    );

    res.status(200).json({ success: true, message: 'Loan disbursed successfully' });

    // Send notifications
    await notifyUser(
      loan.email,
      'loan',
      'Loan Disbursed',
      `<h2>Loan Disbursed</h2><p>Your loan of ₱${loan.amount.toLocaleString()} has been disbursed via ${paymentMethod}.</p>`,
      `Your loan of ₱${loan.amount.toLocaleString()} has been disbursed.`
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to process loan disbursement' });
  }
});


/* ================== USER - MY PENDING PAYMENTS ================== */
router.get('/loans/my-pending-payments', authenticateUser, async (req, res) => {
    try {
        const email = req.user.email;
        const payments = await loanPayments
            .find({ email, status: 'pending' })
            .sort({ submittedAt: -1 })
            .toArray();
        res.json({ success: true, payments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch pending payments' });
    }
});

/* ================== USER - MY PAYMENTS ================== */
router.get('/loans/my-payments', authenticateUser, async (req, res) => {
    try {
        const email = req.user.email;
        const limit = parseInt(req.query.limit) || 50;
        const payments = await loanPayments
            .find({ email })
            .sort({ submittedAt: -1 })
            .limit(limit)
            .toArray();
        res.json({ success: true, payments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
});

/* ================== USER - GET SINGLE LOAN ================== */
router.get('/loans/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.user.email;

    // Try finding by loanId first, then by _id
    let query = { loanId: id, email };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ loanId: id }, { _id: new ObjectId(id) }], email };
    }

    const loan = await loans.findOne(query);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    res.status(200).json({ success: true, loan: enrichLoanWithNextPayment(loan) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch loan details' });
  }
});

/* ================== USER - GET LOAN SCHEDULE ================== */
router.get('/loans/:id/schedule', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.user.email;

    let query = { loanId: id, email };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ loanId: id }, { _id: new ObjectId(id) }], email };
    }

    const loan = await loans.findOne(query);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    // Simple schedule generation if not stored
    const schedule = [];
    const term = loan.termMonths || 12;
    const startDate = loan.disbursementDate ? new Date(loan.disbursementDate) : null;
    
    // Calculate using exact saved values if available, fallback to manual math
    const principalPerMonth = loan.amount / term;
    let interestPerMonth;
    if (loan.totalInterest != null && loan.totalInterest > 0) {
      interestPerMonth = loan.totalInterest / term;
    } else {
      let rate = loan.interestRate || 0.02;
      if (rate > 1) rate = rate / 100; // handle 2 vs 0.02 format
      interestPerMonth = loan.amount * rate;
    }
    const paymentPerMonth = loan.monthlyPayment || (principalPerMonth + interestPerMonth);

    for (let i = 1; i <= term; i++) {
        let dueDate = null;
        if (startDate) {
            dueDate = new Date(startDate);
            dueDate.setMonth(startDate.getMonth() + i);
        }
        
        let currentInterest = interestPerMonth;
        let currentPayment = paymentPerMonth;

        const isNext = i === (loan.paidMonths || 0) + 1;
        let isLate = false;
        
        if (isNext && dueDate) {
            const cutoffDate = new Date(dueDate);
            cutoffDate.setDate(dueDate.getDate() + 3);
            cutoffDate.setHours(23, 59, 59, 999);
            if (Date.now() > cutoffDate.getTime()) {
                isLate = true;
                currentInterest = (loan.amount || 0) * 0.03;
                currentPayment = principalPerMonth + currentInterest;
            }
        }
        
        schedule.push({
            dueDate,
            principal: principalPerMonth,
            interest: currentInterest,
            payment: currentPayment,
            status: i <= (loan.paidMonths || 0) ? 'paid' : 'upcoming',
            isNext,
            isLate
        });
    }

    res.status(200).json({ success: true, schedule });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch schedule' });
  }
});

/* ================== USER - PAY LOAN ================== */
router.post('/loans/:id/pay', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentMethod, paymentType: pType = 'regular', amount: reqAmount, monthsCovered: reqMonths, subMethod, accountName, accountNumber, proofData, proofFileName, successUrl, cancelUrl } = req.body;
        const email = req.user.email;

        let query = { loanId: id, email };
        if (ObjectId.isValid(id)) {
            query = { $or: [{ loanId: id }, { _id: new ObjectId(id) }], email };
        }

        const dbLoan = await loans.findOne(query);
        if (!dbLoan) return res.status(404).json({ success: false, message: 'Loan not found' });
        if (dbLoan.status !== 'active') return res.status(400).json({ success: false, message: 'Only active loans can receive payments' });

        const loan = enrichLoanWithNextPayment(dbLoan);
        const defaultAmt = loan.upcomingPaymentAmount || loan.monthlyPayment || 0;
        const remaining = loan.remainingBalance || loan.totalRepayment || loan.amount || 0;

        let amountToPay = defaultAmt;
        let monthsCovered = 1;

        if (pType === 'regular') {
            amountToPay = defaultAmt;
            monthsCovered = 1;
        } else if (pType === 'full') {
            amountToPay = remaining;
            monthsCovered = (loan.termMonths || 12) - (loan.paidMonths || 0);
        } else if (pType === 'advance' || pType === 'open') {
            amountToPay = Number(reqAmount) || 0;
            if (amountToPay < 500) return res.status(400).json({ success: false, message: 'Minimum payment is ₱500.' });
            if (amountToPay > remaining) amountToPay = remaining;
            monthsCovered = Math.min(Math.floor(amountToPay / (loan.monthlyPayment || 1)), (loan.termMonths || 12) - (loan.paidMonths || 0));
        }

        const { settings } = await import('../config/db.js');
        const config = await settings.findOne({ _id: 'global' });
        const isManual = config?.paymentApprovalMethod === 'manual';

        if (paymentMethod === 'cash' || isManual) {
            if (isManual && paymentMethod !== 'cash') {
                if (!proofData) {
                    return res.status(400).json({ success: false, message: 'Proof of payment is required for manual approval' });
                }

                // Security Validation: Strict MIME type check (PNG, JPG, JPEG, WEBP, PDF)
                if (typeof proofData !== 'string' || !/^data:(image\/(png|jpeg|jpg|webp)|application\/pdf);base64,/.test(proofData)) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Security Alert: Invalid file format. Only PNG, JPG, JPEG, WEBP, and PDF files are allowed.' 
                    });
                }

                // Security Validation: File size limit (5MB max = ~7,000,000 base64 chars)
                if (proofData.length > 7000000) {
                    return res.status(400).json({
                        success: false,
                        message: 'File size exceeds maximum allowed limit of 5MB.'
                    });
                }
            }

            const safeProofFileName = proofFileName 
                ? String(proofFileName).replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 100) 
                : null;

            const payment = {
                loanId: loan.loanId, loanObjectId: loan._id, email,
                memberName: loan.memberName, amount: amountToPay,
                paymentType: pType, monthsCovered,
                paymentMethod: isManual ? paymentMethod : 'cash',
                subMethod: isManual && paymentMethod !== 'cash' ? subMethod : null,
                accountName: isManual && paymentMethod !== 'cash' ? accountName : null,
                accountNumber: isManual && paymentMethod !== 'cash' ? accountNumber : null,
                proofData: proofData || null, proofFileName: safeProofFileName,
                status: 'pending', submittedAt: new Date(),
                monthNumber: (loan.paidMonths || 0) + 1,
                isLate: loan.isLate || false, interestMultiplier: loan.interestMultiplier || 1
            };
            await loanPayments.insertOne(payment);
            return res.status(201).json({ success: true, message: 'Payment submitted for verification' });
        }

        // --- DIGITAL PAYMENT VIA PAYMONGO ---
        const monthNum = (loan.paidMonths || 0) + 1;
        const description = `FaithLy Loan Repayment - ${loan.loanId} (${pType === 'full' ? 'Full Payment' : pType === 'advance' ? `${monthsCovered} months` : `Month ${monthNum}`})`;
        const sUrl = successUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/loans/${loan.loanId}?pay_success=true`;
        const cUrl = cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/loans/${loan.loanId}?pay_cancelled=true`;
        const user = await users.findOne({ email });
        const billing = { name: user?.fullName || loan.memberName, email, phone: user?.phone || null };
        const checkoutSession = await generatePaymentLink(amountToPay, description, `LOAN-${loan.loanId}-${monthNum}-${Date.now()}`, paymentMethod, sUrl, cUrl, billing);

        const payment = {
            loanId: loan.loanId, loanObjectId: loan._id, email,
            memberName: loan.memberName, amount: amountToPay,
            paymentType: pType, monthsCovered,
            paymentMethod,
            paymongoLinkId: checkoutSession.id,
            checkoutUrl: checkoutSession.attributes.checkout_url,
            status: 'pending', submittedAt: new Date(),
            monthNumber: monthNum,
            isLate: loan.isLate || false, interestMultiplier: loan.interestMultiplier || 1
        };
        await loanPayments.insertOne(payment);
        res.status(201).json({ success: true, message: 'Checkout session created', checkoutUrl: checkoutSession.attributes.checkout_url });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to submit payment' });
    }
});

/* ================== ADMIN - GET LOAN PAYMENTS ================== */
router.get('/admin/loan-payments', authenticateAdmin, async (req, res) => {
    try {
        const { status: qStatus, page: qPage, limit: qLimit, search } = req.query;
        const page = parseInt(qPage) || 1;
        const limit = parseInt(qLimit) || 100;
        const skip = (page - 1) * limit;

        const filter = {};
        if (qStatus && qStatus !== 'all') {
            if (qStatus === 'history') {
                filter.status = { $ne: 'pending' };
            } else {
                filter.status = qStatus;
            }
        }

        if (search) {
            filter.$or = [
                { memberName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { loanId: { $regex: search, $options: 'i' } }
            ];
        }

        const totalCount = await loanPayments.countDocuments(filter);
        const payments = await loanPayments.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit).toArray();
        
        res.json({ 
            success: true, 
            payments,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
});

/* ================== ADMIN - CONFIRM PAYMENT ================== */
router.put('/admin/loan-payments/:id/confirm', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const payment = await loanPayments.findOne({ _id: new ObjectId(id) });
        if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
        if (payment.status !== 'pending') return res.status(400).json({ success: false, message: 'Payment already processed' });

        const loan = await loans.findOne({ _id: payment.loanObjectId });
        if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

        const paymentAmount = payment.amount || loan.monthlyPayment || 0;
        const pType = payment.paymentType || 'regular';
        const pMonths = payment.monthsCovered != null ? payment.monthsCovered : (pType === 'regular' ? 1 : 0);

        let newPaidMonths;
        let newBalance;
        if (pType === 'full') {
            newPaidMonths = loan.termMonths || 12;
            newBalance = 0;
        } else if (pType === 'open') {
            // Open payments just reduce balance, don't increment months
            newPaidMonths = loan.paidMonths || 0;
            newBalance = Math.max(0, (loan.remainingBalance || loan.totalRepayment || loan.amount) - paymentAmount);
        } else {
            // regular or advance
            const months = pType === 'advance' ? pMonths : 1;
            newPaidMonths = Math.min((loan.paidMonths || 0) + months, loan.termMonths || 12);
            newBalance = Math.max(0, (loan.remainingBalance || loan.totalRepayment || loan.amount) - paymentAmount);
        }

        // Only complete if balance is actually 0, OR if all months are paid AND balance is also 0
        const isComplete = newBalance <= 0;
        if (isComplete) { newPaidMonths = loan.termMonths || 12; newBalance = 0; }

        const startDate = new Date(loan.disbursementDate || loan.approvedDate || loan.appliedDate);
        const nextDue = new Date(startDate);
        nextDue.setMonth(startDate.getMonth() + newPaidMonths + 1);

        await loans.updateOne(
            { _id: payment.loanObjectId },
            {
                $set: {
                    paidMonths: newPaidMonths,
                    remainingBalance: newBalance,
                    status: isComplete ? 'completed' : 'active',
                    nextDueDate: isComplete ? null : nextDue,
                    updatedAt: new Date(),
                },
                $push: {
                    statusHistory: {
                        status: 'payment_confirmed',
                        date: new Date(),
                        monthNumber: newPaidMonths,
                        amount: paymentAmount,
                        paymentType: pType,
                        monthsCovered: pMonths,
                        paymentMethod: payment.paymentMethod || 'cash',
                    }
                }
            }
        );

        await loanPayments.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: 'confirmed', confirmedAt: new Date() } }
        );

        res.json({ success: true, message: 'Payment confirmed', newBalance, newPaidMonths });

        // Send notifications
        await notifyUser(
          loan.email,
          'loan',
          'Loan Payment Confirmed',
          `<h2>Payment Confirmed</h2><p>Your ${pType} payment of ₱${paymentAmount.toLocaleString()} has been confirmed. Your remaining balance is ₱${newBalance.toLocaleString()}.</p>`,
          `Payment of ₱${paymentAmount.toLocaleString()} confirmed. Remaining balance: ₱${newBalance.toLocaleString()}.`
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to confirm payment' });
    }
});

/* ================== ADMIN - REJECT PAYMENT ================== */
router.put('/admin/loan-payments/:id/reject', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const payment = await loanPayments.findOne({ _id: new ObjectId(id) });
        if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
        if (payment.status !== 'pending') return res.status(400).json({ success: false, message: 'Payment already processed' });

        await loanPayments.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: 'rejected', rejectedAt: new Date(), rejectionReason: reason || '' } }
        );

        res.json({ success: true, message: 'Payment rejected' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to reject payment' });
    }
});

/* ================== USER - PAYMENT HISTORY ================== */
router.get('/loans/:id/payment-history', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const email = req.user.email;

        // Resolve loanId for the filter
        let loanIdStr = id;
        if (ObjectId.isValid(id)) {
            const loan = await loans.findOne({ _id: new ObjectId(id), email });
            if (loan) loanIdStr = loan.loanId;
        }

        const payments = await loanPayments
            .find({ loanId: loanIdStr, email, status: 'confirmed' })
            .sort({ confirmedAt: -1 })
            .toArray();

        res.json({ success: true, payments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch payment history' });
    }
});



/* ================== ADMIN - LOAN REPORTS ================== */
router.get('/admin/loan-reports', authenticateAdmin, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    // All loans that were applied within the selected year
    const allLoansInYear = await loans.find({
      appliedDate: { $gte: yearStart, $lt: yearEnd }
    }).project({ status: 1, totalInterest: 1 }).toArray();

    // Disbursed loans (money released) in the selected year
    const disbursedLoans = await loans.find({
      disbursed: true,
      disbursementDate: { $gte: yearStart, $lt: yearEnd }
    }).project({ amount: 1, loanType: 1, disbursementDate: 1 }).toArray();

    // Active/completed loans (money to be received) in the selected year
    const activeCompletedLoans = allLoansInYear.filter(
      l => l.status === 'active' || l.status === 'completed'
    );

    // Actual payments received in the selected year
    const confirmedPayments = await loanPayments.find({
      status: 'confirmed',
      submittedAt: { $gte: yearStart, $lt: yearEnd }
    }).toArray();

    // ── Summary cards ──
    const totalReceived = confirmedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalReleased = disbursedLoans.reduce((sum, l) => sum + (l.amount || 0), 0);
    const totalInterest = activeCompletedLoans.reduce((sum, l) => sum + (l.totalInterest || 0), 0);

    // ── Monthly chart data (Money In vs Money Out) ──
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = months.map((month, idx) => {
      const monthPayments = confirmedPayments.filter(p => {
        const d = new Date(p.submittedAt);
        return d.getMonth() === idx;
      });
      const monthLoansDisbursed = disbursedLoans.filter(l => {
        const d = new Date(l.disbursementDate);
        return d.getMonth() === idx;
      });

      return {
        month,
        received: monthPayments.reduce((s, p) => s + (p.amount || 0), 0),
        disbursed: monthLoansDisbursed.reduce((s, l) => s + (l.amount || 0), 0),
      };
    });

    // ── Loans by type (only secretary-processed / disbursed loans) ──
    const LOAN_TYPE_LABELS = {
      'personal': 'Personal Loan',
      'emergency': 'Emergency Loan',
      'short-term': 'Short-Term Loan',
    };
    const loanTypeKeys = ['personal', 'emergency', 'short-term'];
    const byType = loanTypeKeys.map(key => {
      const matched = disbursedLoans.filter(l => (l.loanType || 'personal') === key);
      const totalAmount = matched.reduce((s, l) => s + (l.amount || 0), 0);
      return {
        type: key,
        label: LOAN_TYPE_LABELS[key] || key,
        count: matched.length,
        amount: totalAmount,
        average: matched.length > 0 ? totalAmount / matched.length : 0,
      };
    });

    // Disbursement chart data by type
    const disbursementByType = loanTypeKeys.map(key => ({
      type: LOAN_TYPE_LABELS[key] || key,
      amount: disbursedLoans
        .filter(l => (l.loanType || 'personal') === key)
        .reduce((s, l) => s + (l.amount || 0), 0),
    }));

    // ── NEW: Loan Status Distribution (Donut Chart) ──
    const allLoansEver = await loans.find({}).project({ status: 1 }).toArray();
    const statusCounts = {};
    allLoansEver.forEach(l => {
      const s = l.status || 'pending';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const STATUS_LABELS = {
      pending: 'Pending', approved: 'Approved', active: 'Active',
      completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled',
      awaiting_member_approval: 'Awaiting Approval'
    };
    const statusDistribution = Object.entries(statusCounts).map(([key, value]) => ({
      name: STATUS_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1),
      value,
      key,
    })).sort((a, b) => b.value - a.value);

    // ── NEW: Repayment Performance (On-Time vs Late) ──
    const allConfirmedPayments = await loanPayments.find({
      status: 'confirmed',
      confirmedAt: { $gte: yearStart, $lt: yearEnd }
    }).toArray();

    // Include active loans that are currently past due
    const activeLoans = await loans.find({ status: 'active' }).toArray();
    const currentlyLateLoans = activeLoans.filter(l => {
      let dueDate = l.nextDueDate;
      if (!dueDate) {
        const baseDate = new Date(l.disbursementDate || l.approvedDate);
        baseDate.setMonth(baseDate.getMonth() + 1);
        dueDate = baseDate;
      }
      if (!dueDate) return false;
      const daysLate = Math.floor((new Date() - new Date(dueDate)) / (1000 * 60 * 60 * 24));
      return daysLate >= 1;
    });

    const onTimePayments = allConfirmedPayments.filter(p => !p.isLate).length;
    const latePayments = allConfirmedPayments.filter(p => p.isLate).length + currentlyLateLoans.length;
    const repaymentPerformance = [
      { name: 'On-Time', value: onTimePayments },
      { name: 'Late', value: latePayments },
    ];

    // ── NEW: Monthly Loan Applications Trend ──
    const allApplicationsInYear = await loans.find({
      appliedDate: { $gte: yearStart, $lt: yearEnd }
    }).project({ appliedDate: 1, status: 1 }).toArray();
    const monthlyApplications = months.map((month, idx) => {
      const monthApps = allApplicationsInYear.filter(l => {
        const d = new Date(l.appliedDate);
        return d.getMonth() === idx;
      });
      return {
        month,
        applications: monthApps.length,
        approved: monthApps.filter(l => ['approved', 'active', 'completed'].includes(l.status)).length,
        rejected: monthApps.filter(l => l.status === 'rejected').length,
      };
    });

    // ── NEW: Delinquency Rate (monthly) ──
    const delinquencyRate = months.map((month, idx) => {
      const monthPayments = allConfirmedPayments.filter(p => {
        const d = new Date(p.confirmedAt || p.submittedAt);
        return d.getMonth() === idx;
      });
      
      // Add currently late loans to the current month's stats
      const isCurrentMonth = new Date().getMonth() === idx && new Date().getFullYear() === year;
      const additionalLate = isCurrentMonth ? currentlyLateLoans.length : 0;

      const total = monthPayments.length + additionalLate;
      const late = monthPayments.filter(p => p.isLate).length + additionalLate;
      return {
        month,
        rate: total > 0 ? Math.round((late / total) * 100) : 0,
        total,
        late,
      };
    });

    // ── Available years (for the dropdown) ──
    const oldestLoan = await loans.find().sort({ appliedDate: 1 }).limit(1).toArray();
    const startYear = oldestLoan.length > 0 ? new Date(oldestLoan[0].appliedDate).getFullYear() : year;
    const currentYear = new Date().getFullYear();
    const availableYears = [];
    for (let y = currentYear; y >= startYear; y--) availableYears.push(y);

    // ── BRANCH-LEVEL AGGREGATIONS ──
    // Build email → branch map from all relevant emails
    const allEmails = new Set();
    allLoansEver.forEach(l => allEmails.add(l.email));
    allApplicationsInYear.forEach(l => allEmails.add(l.email));
    allConfirmedPayments.forEach(p => allEmails.add(p.email));

    const branchUsers = allEmails.size > 0
      ? await users.find(
          { email: { $in: [...allEmails] } },
          { projection: { email: 1, branch: 1 } }
        ).toArray()
      : [];
    const emailToBranch = {};
    branchUsers.forEach(u => { emailToBranch[u.email] = u.branch || 'Unassigned'; });

    // 1. Status distribution by branch (all loans ever - need email field)
    const allLoansWithEmail = await loans.find({}).project({ status: 1, email: 1 }).toArray();
    const branchStatusMap = {};
    allLoansWithEmail.forEach(l => {
      const branch = emailToBranch[l.email] || 'Unassigned';
      if (!branchStatusMap[branch]) branchStatusMap[branch] = { branch, total: 0, active: 0, completed: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
      branchStatusMap[branch].total++;
      const s = l.status || 'pending';
      if (s === 'active') branchStatusMap[branch].active++;
      else if (s === 'completed') branchStatusMap[branch].completed++;
      else if (s === 'pending' || s === 'awaiting_member_approval') branchStatusMap[branch].pending++;
      else if (s === 'approved') branchStatusMap[branch].approved++;
      else if (s === 'rejected') branchStatusMap[branch].rejected++;
      else if (s === 'cancelled') branchStatusMap[branch].cancelled++;
    });
    const branchStatusData = Object.values(branchStatusMap).map(b => ({
      ...b,
      rejectionRate: b.total > 0 ? Math.round((b.rejected / b.total) * 100 * 10) / 10 : 0,
    })).sort((a, b) => b.rejectionRate - a.rejectionRate);

    // 2. Repayment performance by branch
    const branchRepaymentMap = {};
    allConfirmedPayments.forEach(p => {
      const branch = emailToBranch[p.email] || 'Unassigned';
      if (!branchRepaymentMap[branch]) branchRepaymentMap[branch] = { branch, onTime: 0, late: 0, total: 0, penalties: 0 };
      branchRepaymentMap[branch].total++;
      if (p.isLate) {
        branchRepaymentMap[branch].late++;
        branchRepaymentMap[branch].penalties += Math.round((p.amount || 0) * 0.03);
      } else {
        branchRepaymentMap[branch].onTime++;
      }
    });
    const branchRepaymentData = Object.values(branchRepaymentMap).map(b => ({
      ...b,
      onTimeRate: b.total > 0 ? Math.round((b.onTime / b.total) * 100 * 10) / 10 : 100,
    })).sort((a, b) => a.onTimeRate - b.onTimeRate);

    // Monthly repayment trend (on-time vs late by month)
    const monthlyRepayment = months.map((month, idx) => {
      const mp = allConfirmedPayments.filter(p => new Date(p.confirmedAt || p.submittedAt).getMonth() === idx);
      return { month, onTime: mp.filter(p => !p.isLate).length, late: mp.filter(p => p.isLate).length };
    });

    // Total penalties
    const totalPenalties = allConfirmedPayments.filter(p => p.isLate).reduce((s, p) => s + Math.round((p.amount || 0) * 0.03), 0);

    // 3. Applications by branch
    const allAppsWithEmail = await loans.find({
      appliedDate: { $gte: yearStart, $lt: yearEnd }
    }).project({ appliedDate: 1, status: 1, email: 1, loanType: 1 }).toArray();
    const branchAppMap = {};
    allAppsWithEmail.forEach(l => {
      const branch = emailToBranch[l.email] || 'Unassigned';
      if (!branchAppMap[branch]) branchAppMap[branch] = { branch, total: 0, approved: 0, rejected: 0, pending: 0, loanTypes: {} };
      branchAppMap[branch].total++;
      if (['approved', 'active', 'completed'].includes(l.status)) branchAppMap[branch].approved++;
      else if (l.status === 'rejected') branchAppMap[branch].rejected++;
      else branchAppMap[branch].pending++;
      const lt = l.loanType || 'personal';
      branchAppMap[branch].loanTypes[lt] = (branchAppMap[branch].loanTypes[lt] || 0) + 1;
    });
    const branchAppData = Object.values(branchAppMap).map(b => {
      const topType = Object.entries(b.loanTypes).sort((a, c) => c[1] - a[1])[0];
      // Cap approved at total to prevent >100% rates from edge cases
      const safeApproved = Math.min(b.approved, b.total);
      return {
        ...b,
        approved: safeApproved,
        approvalRate: b.total > 0 ? Math.min(Math.round((safeApproved / b.total) * 100 * 10) / 10, 100) : 0,
        topLoanType: topType ? (LOAN_TYPE_LABELS[topType[0]] || topType[0]) : '—',
        loanTypes: undefined,
      };
    }).sort((a, b) => b.total - a.total);

    // 4. Delinquency by branch
    const branchDelinquencyData = Object.values(branchRepaymentMap).map(b => ({
      branch: b.branch,
      total: b.total,
      onTime: b.onTime,
      late: b.late,
      delinquencyRate: b.total > 0 ? Math.round((b.late / b.total) * 100 * 10) / 10 : 0,
      status: b.total > 0 ? (b.late / b.total > 0.15 ? 'Critical' : b.late / b.total > 0.10 ? 'At Risk' : 'Healthy') : 'Healthy',
    })).sort((a, b) => b.delinquencyRate - a.delinquencyRate);
    const branchesAtRisk = branchDelinquencyData.filter(b => b.delinquencyRate > 15).length;

    // Monthly status trend
    const allLoansMonthlyStatus = await loans.find({
      appliedDate: { $gte: yearStart, $lt: yearEnd }
    }).project({ appliedDate: 1, status: 1 }).toArray();
    const monthlyStatusTrend = months.map((month, idx) => {
      const ml = allLoansMonthlyStatus.filter(l => new Date(l.appliedDate).getMonth() === idx);
      return {
        month,
        active: ml.filter(l => l.status === 'active').length,
        completed: ml.filter(l => l.status === 'completed').length,
        rejected: ml.filter(l => l.status === 'rejected').length,
        cancelled: ml.filter(l => l.status === 'cancelled').length,
        pending: ml.filter(l => ['pending', 'awaiting_member_approval', 'approved'].includes(l.status)).length,
      };
    });

    res.json({
      success: true,
      year,
      availableYears,
      summary: { totalReceived, totalReleased, totalInterest },
      monthlyData,
      byType,
      disbursementByType,
      statusDistribution,
      repaymentPerformance,
      monthlyApplications,
      delinquencyRate,
      // Branch-level data
      branchStatusData,
      branchRepaymentData,
      branchAppData,
      branchDelinquencyData,
      monthlyRepayment,
      monthlyStatusTrend,
      totalPenalties,
      branchesAtRisk,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to generate loan reports' });
  }
});

export default router;