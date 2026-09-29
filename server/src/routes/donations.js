import { Router } from 'express';
import { ObjectId } from 'mongodb';

import { users, donations, counters } from '../config/db.js';
import { authenticateUser, authenticateAdmin } from '../middleware/auth.js';
import { callGeminiVision } from '../utils/gemini.js';

const router = Router();

// In-memory stats cache (60s TTL)
let donationStatsCache = { data: null, ts: 0 };

import { generatePaymentLink } from '../utils/paymongo.js';

const INVALID_SENDER_KEYWORDS = [
  'account', 'easy account', 'savings', 'current', 'checking', 'payroll',
  'wallet', 'gcash', 'maya', 'paymaya', 'bank', 'pesonet', 'instapay',
  'debit', 'credit', 'card', 'transfer', 'fund', 'funds', 'balance', 'source',
  'deposit', 'express', 'online', 'unibank', 'universal', 'bdo', 'bpi',
  'unionbank', 'metrobank', 'landbank', 'rcbc', 'security bank', 'pnb',
  'chinabank', 'load', 'cash-in', 'cash in', 'cash out', 'payment', 'receipt',
  'ref', 'reference', 'transaction', 'customer', 'merchant', 'from', 'to',
  'puac', 'pacific union', 'faithly', 'church'
];

function sanitizeSenderName(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 70) return null;
  // If it has digits, it is NOT a human person's name (e.g. "EASY ACCOUNT 2", "Account 123")
  if (/\d/.test(trimmed)) return null;
  // Check against blacklisted keywords (boundary match)
  const lower = trimmed.toLowerCase();
  for (const kw of INVALID_SENDER_KEYWORDS) {
    const regex = new RegExp(`(^|\\b)${kw}(\\b|$)`, 'i');
    if (regex.test(lower)) return null;
  }
  // Must only contain letters, spaces, dots, hyphens, or apostrophes
  if (!/^[a-zA-ZñÑ\s.,'-]+$/.test(trimmed)) return null;
  // Must contain at least one letter
  if (!/[a-zA-ZñÑ]/.test(trimmed)) return null;
  return trimmed;
}

/* ================== VALIDATE RECEIPT IMAGE (AI) ================== */
router.post('/donations/validate-receipt', authenticateUser, async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ success: false, message: 'A valid image is required.' });
    }

    // Extract base64 data and mime type from the Data URL
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Invalid image format.' });
    }

    const mimeType = match[1];
    const base64Data = match[2];

    const systemPrompt = `You are a financial receipt auditor and data extraction engine for a Philippine church portal.
Your job is to examine an uploaded image, verify if it is a legitimate payment receipt, and extract all transaction details.

VALID RECEIPTS:
- GCash transaction receipts or confirmations
- Maya (PayMaya) receipts or confirmations
- Philippine bank & digital bank transfer screenshots (BDO, BPI, Metrobank, UnionBank, Landbank, Maya Bank, GoTyme, SeaBank, Tonik, CIMB, etc.)
- Bank deposit slips or ATM transfer slips
- Online banking payment confirmations showing amount and reference/transaction number

INVALID IMAGES:
- Selfies, portraits, memes, animals, landscapes, screenshots of chats without payment proof, blank images, or unrelated documents.

EXTRACT THE FOLLOWING FIELDS PRECISELY (if not visible or uncertain, set to null):
- amount: Numeric value only (e.g. 500, 1000.50). Remove commas, currency symbols (₱, PHP).
- referenceNumber: Clean string of the transaction/reference number (e.g. "902412345678" or "UB12345678"). Remove spaces or hyphens.
- paymentMethod: Either "E-Wallet" (for GCash, Maya, GrabPay, ShopeePay) or "Bank" (for BDO, BPI, GoTyme, SeaBank, Maya Bank, Tonik, CIMB, etc.) or null.
- subMethod: Specific provider: "GCash", "Maya", "Maya Bank", "GoTyme Bank", "SeaBank", "Tonik Bank", "CIMB Bank", "UNO Digital Bank", "UnionDigital Bank", "BDO", "BPI", "UnionBank", "Metrobank", "Landbank", "Security Bank", "RCBC", "PNB", "China Bank", "EastWest Bank", "GrabPay", "ShopeePay", "Coins.ph", or exact name shown on receipt.
- senderName: The actual HUMAN PERSON name of the sender/payer (e.g. "Juan Dela Cruz", "Maria Santos").
  CRITICAL RULES FOR senderName:
  * MUST be a real human person's name.
  * DO NOT extract bank account product types, tiers, or labels such as "EASY ACCOUNT", "EASY ACCOUNT 2", "SAVINGS ACCOUNT", "CURRENT ACCOUNT", "CHECKING", "MY WALLET", "GCASH WALLET", "DEBIT CARD", "PAYROLL", "PESONET", "INSTAPAY", or any name containing numbers or words like "ACCOUNT", "SAVINGS", "WALLET", "CARD".
  * If the receipt only displays an account type, nickname, or generic label and DOES NOT display the sender's real human name, set senderName to null.
- senderNumber: Mobile number or bank account number of the sender (digits only). If it is a mobile number, extract the 11 digits (e.g. "09171234567"). If masked (e.g. "••••1234" or "0917***1234"), return null.
- recipientName: Name of recipient/merchant as shown on receipt (e.g. "PACIFIC UNION ASSOC", "PUAC", "FAITHLY"), or null.
- date: Date of transaction in YYYY-MM-DD format if readable, or null.
- time: Time of transaction (e.g. "14:30" or "02:30 PM"), or null.

RESPOND ONLY WITH VALID JSON:
{
  "isReceipt": true or false,
  "confidence": 0 to 100,
  "reason": "1-sentence description or failure reason",
  "extracted": {
    "amount": null,
    "referenceNumber": null,
    "paymentMethod": null,
    "subMethod": null,
    "senderName": null,
    "senderNumber": null,
    "recipientName": null,
    "date": null,
    "time": null
  }
}`;

    const textPrompt = 'Analyze this image. Is it a legitimate payment receipt, transaction confirmation, or proof of payment? Extract all fields into JSON.';

    const aiResponse = await callGeminiVision(systemPrompt, textPrompt, base64Data, mimeType);

    // Handle rate limiting — allow the image through (Option A: graceful fallback)
    if (aiResponse === '__RATE_LIMITED__') {
      console.warn('[Receipt Validation] Rate limited — allowing image through');
      return res.json({
        success: true,
        isReceipt: true,
        confidence: 0,
        reason: 'Validation service is temporarily busy. Image accepted for manual review.',
        extracted: null,
        isDuplicate: false,
        fallback: true,
      });
    }

    // Handle Gemini failure — allow through with warning
    if (!aiResponse) {
      console.warn('[Receipt Validation] Gemini returned null — allowing image through');
      return res.json({
        success: true,
        isReceipt: true,
        confidence: 0,
        reason: 'Validation service is temporarily unavailable. Image accepted for manual review.',
        extracted: null,
        isDuplicate: false,
        fallback: true,
      });
    }

    // Parse the AI response
    let result;
    try {
      const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[Receipt Validation] Failed to parse AI response:', aiResponse);
      // Graceful fallback — allow through
      return res.json({
        success: true,
        isReceipt: true,
        confidence: 0,
        reason: 'Could not verify image. Accepted for manual review.',
        extracted: null,
        isDuplicate: false,
        fallback: true,
      });
    }

    const isReceipt = !!result.isReceipt;
    let extracted = result.extracted || null;

    if (extracted) {
      if (extracted.senderName) {
        extracted.senderName = sanitizeSenderName(extracted.senderName);
      }
      if (extracted.senderNumber) {
        const numStr = String(extracted.senderNumber).replace(/\D/g, '');
        if (numStr.length < 8 || numStr.length > 20) {
          extracted.senderNumber = null;
        } else {
          extracted.senderNumber = numStr;
        }
      }
    }

    // Check for duplicate reference number in MongoDB if extracted
    let isDuplicate = false;
    let duplicateInfo = null;

    if (isReceipt && extracted?.referenceNumber) {
      const cleanRef = String(extracted.referenceNumber).replace(/[\s-]/g, '').trim();
      if (cleanRef.length >= 6) {
        try {
          const { savingsTransactions } = await import('../config/db.js');
          const [dupDonation, dupSavings] = await Promise.all([
            donations.findOne({
              $or: [
                { referenceNumber: cleanRef },
                { referenceNumber: extracted.referenceNumber }
              ],
              status: { $ne: 'rejected' }
            }),
            savingsTransactions.findOne({
              $or: [
                { referenceNumber: cleanRef },
                { referenceNumber: extracted.referenceNumber }
              ],
              status: { $ne: 'rejected' }
            })
          ]);

          const matchDoc = dupDonation || dupSavings;
          if (matchDoc) {
            isDuplicate = true;
            duplicateInfo = {
              refNumber: cleanRef,
              type: dupDonation ? 'Donation' : 'Savings Deposit',
              date: matchDoc.date || matchDoc.createdAt,
              amount: matchDoc.amount,
            };
          }
        } catch (dbErr) {
          console.warn('[Receipt Validation] Duplicate check non-fatal error:', dbErr.message);
        }
      }
    }

    return res.json({
      success: true,
      isReceipt,
      confidence: result.confidence || 0,
      reason: result.reason || '',
      extracted,
      isDuplicate,
      duplicateInfo,
      fallback: false,
    });
  } catch (err) {
    console.error('[Receipt Validation Error]:', err.message);
    // Graceful fallback — never block donations due to AI errors
    return res.json({
      success: true,
      isReceipt: true,
      confidence: 0,
      reason: 'Validation service encountered an error. Image accepted for manual review.',
      extracted: null,
      isDuplicate: false,
      fallback: true,
    });
  }
});

/* ================== USER - MAKE A DONATION ================== */
router.post('/donations', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const { amount, category, community, isRecurring, paymentMethod, acknowledged } = req.body;

    const parsedAmount = Number(amount);
    if (!amount || !category || isNaN(parsedAmount) || !Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive whole number and category is required' });
    }

    const user = await users.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const resolvedCommunity = community || user.branch || 'General';

    const year = new Date().getFullYear();
    const counterDoc = await counters.findOneAndUpdate(
      { _id: `donations-${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const donationId = `D-${year}-${String(counterDoc.seq).padStart(3, '0')}`;

    const { settings } = await import('../config/db.js');
    const config = await settings.findOne({ _id: 'global' });
    const isManual = config?.paymentApprovalMethod === 'manual';

    if (isManual) {
      const { proofOfPayment, subMethod, accountName, accountNumber } = req.body;
      if (!proofOfPayment) {
        return res.status(400).json({ success: false, message: 'Proof of payment is required for manual approval' });
      }

      // Backend validation: proofOfPayment must be a valid image Data URL
      if (typeof proofOfPayment !== 'string' || !proofOfPayment.startsWith('data:image/')) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid proof of payment. Only image files (PNG, JPG, JPEG, WEBP) are allowed.' 
        });
      }

      const newDonation = {
        donationId,
        email,
        member: user.fullName,
        amount: parsedAmount,
        category,
        community: resolvedCommunity,
        method: paymentMethod || 'Manual',
        subMethod: subMethod || '',
        accountName: accountName || '',
        accountNumber: accountNumber || '',
        referenceNumber: req.body.referenceNumber || '',
        type: isRecurring ? 'Recurring' : 'One-time',
        status: 'pending',
        proofOfPayment, // Store base64 string
        acknowledged: !!acknowledged,
        photoUrl: user.photoUrl || null,
        date: new Date(),
        createdAt: new Date(),
      };

      await donations.insertOne(newDonation);
      return res.status(201).json({ success: true, message: 'Donation submitted and pending approval.' });
    }

    // Generate PayMongo Link and pre-select the method
    const description = `Donation for ${category} by ${user.fullName}`;
    const billing = { name: user.fullName, email: user.email, phone: user.phone || null };
    const paymentLinkData = await generatePaymentLink(
      amount, 
      description, 
      donationId, 
      paymentMethod,
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/donation`, // successUrl
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/donation`, // cancelUrl
      billing
    );

    const newDonation = {
      donationId,
      email,
      member: user.fullName,
      amount: Number(amount),
      category,
      community: resolvedCommunity,
      method: paymentMethod || 'PayMongo', // Store the specific method chosen
      type: isRecurring ? 'Recurring' : 'One-time',
      status: 'pending',
      paymongoLinkId: paymentLinkData.id,
      checkoutUrl: paymentLinkData.attributes.checkout_url,
      acknowledged: !!acknowledged,
      photoUrl: user.photoUrl || null,
      date: new Date(),
      createdAt: new Date(),
    };

    await donations.insertOne(newDonation);
    res.status(201).json({ success: true, message: 'Redirecting to payment...', checkoutUrl: paymentLinkData.attributes.checkout_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to initialize payment' });
  }
});

/* ================== USER - GET MY DONATIONS ================== */
router.get('/donations/my-donations', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const { category } = req.query;
    const page  = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const findQuery = { email };
    if (category) findQuery.category = category;
    if (req.query.paymentMethod) findQuery.method = req.query.paymentMethod;

    const totalCount    = await donations.countDocuments(findQuery);
    const userDonations = await donations.find(findQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Stats: only count confirmed donations in totalDonated
    const allUserDonations = await donations.find(findQuery).toArray();
    const totalDonated = allUserDonations
      .filter(d => d.status === 'confirmed')
      .reduce((sum, d) => sum + d.amount, 0);

    const now = new Date();
    const confirmedDonations = allUserDonations.filter(d => d.status === 'confirmed');
    const thisYearTotal = confirmedDonations
      .filter(d => new Date(d.createdAt).getFullYear() === now.getFullYear())
      .reduce((sum, d) => sum + d.amount, 0);

    const categoryBreakdown = {};
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthlyData = months.map(m => ({ month: m, amount: 0 }));

    allUserDonations
      .filter(d => d.status === 'confirmed')
      .forEach(d => {
        const cat = d.category || 'Other';
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (Number(d.amount) || 0);
        
        const date = new Date(d.createdAt || d.date);
        if (date.getFullYear() === now.getFullYear()) {
          monthlyData[date.getMonth()].amount += Number(d.amount) || 0;
        }
      });

    res.status(200).json({
      success: true,
      donations: userDonations,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      stats: { totalDonated, thisYearTotal, totalCount: confirmedDonations.length, categoryBreakdown, monthlyData }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch donations' });
  }
});

/* ================== USER - GET ACKNOWLEDGED DONATIONS ================== */
router.get('/donations/acknowledged', authenticateUser, async (req, res) => {
  try {
    // 7-day expiration: only show acknowledged donations made within the past 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const acknowledgedDonations = await donations
      .aggregate([
        {
          $match: {
            acknowledged: true,
            status: 'confirmed',
            $or: [
              { createdAt: { $gte: sevenDaysAgo } },
              { createdAt: { $gte: sevenDaysAgo.toISOString() } },
            ]
          }
        },
        { $sort: { createdAt: -1 } },
        { $limit: 30 },
        {
          $lookup: {
            from: 'users',
            let: { donorEmail: '$email' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [
                      { $toLower: { $ifNull: ['$email', ''] } },
                      { $toLower: { $ifNull: ['$$donorEmail', ''] } }
                    ]
                  }
                }
              },
              { $project: { photoUrl: 1 } }
            ],
            as: 'userInfo'
          }
        },
        {
          $project: {
            member: 1,
            amount: 1,
            category: 1,
            community: 1,
            createdAt: 1,
            photoUrl: {
              $ifNull: [
                '$photoUrl',
                { $arrayElemAt: ['$userInfo.photoUrl', 0] },
                null
              ]
            }
          }
        }
      ])
      .toArray();

    res.json({ success: true, donors: acknowledgedDonations });
  } catch (err) {
    console.error('❌ GET /donations/acknowledged error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch acknowledged donations' });
  }
});

/* ================== ADMIN - GET ALL DONATIONS ================== */
router.get('/admin/donations', authenticateAdmin, async (req, res) => {
  try {
    const { search, status, page: qPage, limit: qLimit } = req.query;
    const page  = parseInt(qPage)  || 1;
    const limit = parseInt(qLimit) || 10;
    const skip  = (page - 1) * limit;

    const query = {};
    if (status && status !== 'all') {
      if (status === 'active') {
        query.status = { $nin: ['rejected', 'pending'] };
      } else {
        query.status = status; // 'confirmed' | 'rejected'
      }
    }

    if (search) {
      query.$or = [
        { member:          { $regex: search, $options: 'i' } },
        { donationId:      { $regex: search, $options: 'i' } },
        { email:           { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const startOfWeek  = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const safeAmount = { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } };

    const statsPipeline = [
      {
        $facet: {
          totals: [
            { $match: { status: 'confirmed' } },
            {
              $group: {
                _id: null,
                totalAmount: { $sum: safeAmount },
                count: { $sum: 1 },
                uniqueEmails: { $addToSet: "$email" }
              }
            }
          ],
          thisMonth: [
            { $match: { status: 'confirmed', createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: safeAmount } } }
          ],
          lastMonth: [
            { $match: { status: 'confirmed', createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
            { $group: { _id: null, total: { $sum: safeAmount } } }
          ],
          thisWeek: [
            { $match: { status: 'confirmed', createdAt: { $gte: startOfWeek } } },
            { $group: { _id: null, total: { $sum: safeAmount } } }
          ],
          pendingCount: [
            { $match: { $or: [{ status: 'pending' }, { status: { $exists: false } }] } },
            { $count: "count" }
          ],
          rejectedCount: [
            { $match: { status: 'rejected' } },
            { $count: "count" }
          ],
          communityBreakdown: [
            { $match: { status: 'confirmed', community: { $exists: true, $ne: null } } },
            { $group: { _id: "$community", total: { $sum: safeAmount } } }
          ],
          categoryBreakdown: [
            { $match: { status: 'confirmed' } },
            { $group: { _id: { $ifNull: ["$category", "General Fund"] }, total: { $sum: safeAmount } } }
          ],
          donorsByCategory: [
            { $match: { status: 'confirmed' } },
            { $group: { _id: { $ifNull: ["$category", "General Fund"] }, donors: { $addToSet: "$email" } } }
          ],
          donorsByCommunity: [
            { $match: { status: 'confirmed', community: { $exists: true, $ne: null } } },
            { $group: { _id: "$community", donors: { $addToSet: "$email" } } }
          ],
          topCategoryByCommunity: [
            { $match: { status: 'confirmed', community: { $exists: true, $ne: null } } },
            { $group: { _id: { community: "$community", category: { $ifNull: ["$category", "General Fund"] } }, total: { $sum: safeAmount } } },
            { $sort: { total: -1 } },
            { $group: { _id: "$_id.community", topCategory: { $first: "$_id.category" }, topAmount: { $first: "$total" } } }
          ]
        }
      }
    ];

    // Use cached stats if fresh (within 60s), otherwise recompute
    const STATS_TTL = 60000;
    const useCache = donationStatsCache.data && (Date.now() - donationStatsCache.ts < STATS_TTL);

    const [totalCount, allDonations, statsResultArr] = await Promise.all([
      donations.countDocuments(query),
      donations.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      useCache ? Promise.resolve(null) : donations.aggregate(statsPipeline).toArray()
    ]);

    if (statsResultArr) {
      donationStatsCache.data = statsResultArr;
      donationStatsCache.ts = Date.now();
    }

    const cachedOrFresh = statsResultArr || donationStatsCache.data;
    const sr = cachedOrFresh[0];
    
    const totals = sr.totals[0] || { totalAmount: 0, count: 0, uniqueEmails: [] };
    const thisMonth = sr.thisMonth[0]?.total || 0;
    const lastMonth = sr.lastMonth[0]?.total || 0;
    const thisWeek = sr.thisWeek[0]?.total || 0;
    const pendingCount = sr.pendingCount[0]?.count || 0;
    const rejectedCount = sr.rejectedCount[0]?.count || 0;

    let percentageChange = 0;
    if (lastMonth === 0) {
      percentageChange = thisMonth > 0 ? 100 : 0;
    } else {
      percentageChange = ((thisMonth - lastMonth) / lastMonth) * 100;
    }
    const formattedPercentage = (percentageChange > 0 ? '+' : '') + Math.round(percentageChange) + '%';
    const avgDonation = totals.count > 0 ? Math.round(totals.totalAmount / totals.count) : 0;

    const communityBreakdown = {};
    sr.communityBreakdown.forEach(item => {
      if (item._id) communityBreakdown[item._id] = item.total;
    });

    const categoryBreakdown = {};
    sr.categoryBreakdown.forEach(item => {
      if (item._id) categoryBreakdown[item._id] = item.total;
    });

    const donorsByCategory = {};
    (sr.donorsByCategory || []).forEach(item => {
      if (item._id) donorsByCategory[item._id] = (item.donors || []).length;
    });

    const donorsByCommunity = {};
    (sr.donorsByCommunity || []).forEach(item => {
      if (item._id) donorsByCommunity[item._id] = (item.donors || []).length;
    });

    const topCategoryByCommunity = {};
    (sr.topCategoryByCommunity || []).forEach(item => {
      if (item._id) topCategoryByCommunity[item._id] = item.topCategory;
    });

    const stats = {
      totalCount: totals.count,
      total: totals.totalAmount,
      thisMonth,
      thisWeek,
      percentageChange: formattedPercentage,
      totalDonors: totals.uniqueEmails.length,
      avgDonation,
      pendingCount,
      rejectedCount,
      communityBreakdown,
      categoryBreakdown,
      donorsByCategory,
      donorsByCommunity,
      topCategoryByCommunity,
    };

    res.status(200).json({
      success: true,
      donations: allDonations,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      stats
    });
  } catch (err) {
    console.error('❌ GET /admin/donations error:', err.message);
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Failed to fetch donations' });
  }
});

export default router;