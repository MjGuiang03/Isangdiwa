import { Router } from 'express';
import { ObjectId } from 'mongodb';

import { users, donations, counters } from '../config/db.js';
import { authenticateUser, authenticateAdmin } from '../middleware/auth.js';
import { callGeminiVision } from '../utils/gemini.js';

const router = Router();

// In-memory stats cache (60s TTL)
let donationStatsCache = { data: null, ts: 0 };

import { generatePaymentLink } from '../utils/paymongo.js';

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

    const systemPrompt = `You are a payment receipt validator. Your job is to analyze images and determine if they are legitimate payment receipts or transaction confirmations.

A VALID receipt/proof of payment includes:
- GCash transaction confirmations or receipts
- Maya/PayMaya transaction confirmations
- Bank transfer confirmations (BPI, BDO, PNB, Metrobank, Unionbank, RCBC, etc.)
- Online banking transaction screenshots showing amount, date, and reference number
- Official deposit slips
- Payment gateway confirmations
- Any screenshot showing a completed financial transaction with transaction details

An INVALID image (NOT a receipt) includes:
- Selfies, portraits, or photos of people
- Memes, jokes, or social media screenshots
- Landscape or nature photos
- Screenshots of non-payment apps (games, social media, messaging)
- Blank, solid color, or mostly empty images
- Random documents that are not payment-related
- Edited or obviously fake receipts with no coherent transaction details

Respond with a JSON object only:
{
  "isReceipt": true or false,
  "confidence": 0-100,
  "reason": "brief explanation in 1 sentence"
}`;

    const textPrompt = 'Analyze this image. Is it a legitimate payment receipt, transaction confirmation, or proof of payment? Respond with JSON only.';

    const aiResponse = await callGeminiVision(systemPrompt, textPrompt, base64Data, mimeType);

    // Handle rate limiting — allow the image through (Option A: graceful fallback)
    if (aiResponse === '__RATE_LIMITED__') {
      console.warn('[Receipt Validation] Rate limited — allowing image through');
      return res.json({
        success: true,
        isReceipt: true,
        confidence: 0,
        reason: 'Validation service is temporarily busy. Image accepted for manual review.',
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
        fallback: true,
      });
    }

    return res.json({
      success: true,
      isReceipt: !!result.isReceipt,
      confidence: result.confidence || 0,
      reason: result.reason || '',
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
    const acknowledgedDonations = await donations
      .aggregate([
        { $match: { acknowledged: true, status: 'confirmed' } },
        { $sort: { createdAt: -1 } },
        { $limit: 20 },
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
        { member:     { $regex: search, $options: 'i' } },
        { donationId: { $regex: search, $options: 'i' } },
        { email:      { $regex: search, $options: 'i' } }
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