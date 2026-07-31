import { Router } from 'express';
import { ObjectId } from 'mongodb';

import { users, savingsGoals, savingsTransactions, loans, counters } from '../config/db.js';
import { authenticateUser } from '../middleware/auth.js';
import { generatePaymentLink } from '../utils/paymongo.js';

const router = Router();

/* ================== GET SAVINGS OVERVIEW (Unified) ================== */
router.get('/savings/overview', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const { txnLimit = 5 } = req.query;

    const goalPage = parseInt(req.query.goalPage) || 1;
    const goalLimit = parseInt(req.query.goalLimit) || 5;
    const skipGoals = (goalPage - 1) * goalLimit;

    // Aggregation for stats instead of finding all goals
    const goalStats = await savingsGoals.aggregate([
      { $match: { email } },
      { $group: { 
          _id: null, 
          totalSavings: { $sum: "$savedAmount" },
          activeGoals: { $sum: { $cond: [{ $ne: ["$status", "completed"] }, 1, 0] } },
          completedGoals: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          totalCount: { $sum: 1 }
      }}
    ]).toArray();

    const statsData = goalStats[0] || { totalSavings: 0, activeGoals: 0, completedGoals: 0, totalCount: 0 };
    const totalSavings = statsData.totalSavings || 0;

    // Fetch Paginated Goals
    const goals = await savingsGoals.find({ email }).sort({ createdAt: -1 }).skip(skipGoals).limit(goalLimit).toArray();

    // 2. This month's deposits
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthDeposits = await savingsTransactions.aggregate([
      { $match: { email, type: 'deposit', status: 'confirmed', date: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray();
    const thisMonth = monthDeposits[0]?.total || 0;

    // 3. Active Loans (for max loanable calculation)
    const activeLoans = await loans.find({ email, status: 'active' }).toArray();
    const existingBalance = activeLoans.reduce((sum, l) => sum + (l.remainingBalance || l.amount || 0), 0);
    const maxLoanable = Math.max(0, totalSavings * 2 - existingBalance);

    // 4. Recent Transactions
    const transactions = await savingsTransactions
      .find({ email, status: { $ne: 'pending' } })
      .sort({ date: -1 })
      .limit(parseInt(txnLimit))
      .toArray();
    
    const txnTotal = await savingsTransactions.countDocuments({ email, status: { $ne: 'pending' } });

    res.json({
      success: true,
      stats: {
        totalSavings,
        thisMonth,
        activeGoals: statsData.activeGoals,
        completedGoals: statsData.completedGoals,
        maxLoanable,
        totalGoalCount: statsData.totalCount
      },
      goals,
      transactions,
      txnTotal
    });
  } catch (err) {
    console.error('Savings overview error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch savings overview' });
  }
});

/* ================== GET SAVINGS STATS ================== */
router.get('/savings/stats', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;

    // All goals aggregate
    const goalStats = await savingsGoals.aggregate([
      { $match: { email } },
      { $group: { 
          _id: null, 
          totalSavings: { $sum: "$savedAmount" },
          activeGoals: { $sum: { $cond: [{ $ne: ["$status", "completed"] }, 1, 0] } },
          completedGoals: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }
      } }
    ]).toArray();
    const statsData = goalStats[0] || { totalSavings: 0, activeGoals: 0, completedGoals: 0 };
    const totalSavings = statsData.totalSavings || 0;
    const activeGoals = statsData.activeGoals || 0;
    const completedGoals = statsData.completedGoals || 0;

    // This month's deposits
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthDeposits = await savingsTransactions.aggregate([
      { $match: { email, type: 'deposit', status: 'confirmed', date: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray();
    const thisMonth = monthDeposits[0]?.total || 0;

    // Pending savings calculation
    const pendingDeposits = await savingsTransactions.aggregate([
      { $match: { email, type: 'deposit', status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray();
    const pendingSavings = pendingDeposits[0]?.total || 0;

    // Max loanable (2x savings)
    const activeLoans = await loans.find({ email, status: 'active' }).toArray();
    const existingBalance = activeLoans.reduce((sum, l) => sum + (l.remainingBalance || l.amount || 0), 0);
    const maxLoanable = Math.max(0, totalSavings * 2 - existingBalance);

    res.json({
      success: true,
      stats: { totalSavings, pendingSavings, thisMonth, activeGoals, completedGoals, maxLoanable },
    });
  } catch (err) {
    console.error('Savings stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch savings stats' });
  }
});

/* ================== GET SAVINGS GOALS ================== */
router.get('/savings/goals', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    
    if (req.query.all === 'true') {
        const goals = await savingsGoals.find({ email }).sort({ createdAt: -1 }).toArray();
        return res.json({ success: true, goals, totalCount: goals.length });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const goals = await savingsGoals.find({ email }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
    const totalCount = await savingsGoals.countDocuments({ email });
    
    res.json({ success: true, goals, totalCount });
  } catch (err) {
    console.error('Savings goals error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch savings goals' });
  }
});

/* ================== CREATE SAVINGS GOAL ================== */
router.post('/savings/goals', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const { name, targetAmount, color, iconType } = req.body;

    if (!name || !targetAmount) {
      return res.status(400).json({ success: false, message: 'Name and target amount are required' });
    }

    const user = await users.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const goal = {
      email,
      memberName: user.fullName,
      name,
      targetAmount: Number(targetAmount),
      savedAmount: 0,
      color: color || 'blue',
      iconType: iconType || 'default',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await savingsGoals.insertOne(goal);
    res.status(201).json({ success: true, message: 'Goal created', goalId: result.insertedId });
  } catch (err) {
    console.error('Create goal error:', err);
    res.status(500).json({ success: false, message: 'Failed to create goal' });
  }
});

/* ================== UPDATE SAVINGS GOAL ================== */
router.put('/savings/goals/:id', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const { id } = req.params;
    const { name, targetAmount, monthlyContribution, targetDate, color, iconType } = req.body;

    const goal = await savingsGoals.findOne({ _id: new ObjectId(id), email });
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (targetAmount !== undefined) updates.targetAmount = Number(targetAmount);
    if (monthlyContribution !== undefined) updates.monthlyContribution = Number(monthlyContribution);
    if (targetDate !== undefined) updates.targetDate = targetDate ? new Date(targetDate) : null;
    if (color !== undefined) updates.color = color;
    if (iconType !== undefined) updates.iconType = iconType;
    updates.updatedAt = new Date();

    // Check if goal is now completed
    const saved = goal.savedAmount || 0;
    if (updates.targetAmount && saved >= updates.targetAmount) {
      updates.status = 'completed';
    }

    await savingsGoals.updateOne({ _id: new ObjectId(id) }, { $set: updates });
    res.json({ success: true, message: 'Goal updated' });
  } catch (err) {
    console.error('Update goal error:', err);
    res.status(500).json({ success: false, message: 'Failed to update goal' });
  }
});

/* ================== DELETE SAVINGS GOAL ================== */
router.delete('/savings/goals/:id', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const { id } = req.params;

    const result = await savingsGoals.deleteOne({ _id: new ObjectId(id), email });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }
    res.json({ success: true, message: 'Goal deleted' });
  } catch (err) {
    console.error('Delete goal error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete goal' });
  }
});

/* ================== DEPOSIT TO SAVINGS ================== */
router.post('/savings/deposit', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const { goalId, amount, description, source, paymentMethod } = req.body;

    if (!goalId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Goal and a positive amount are required' });
    }

    const goal = await savingsGoals.findOne({ _id: new ObjectId(goalId), email });
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

    const depositAmount = Number(amount);

    // Fetch user to get memberName for the admin views
    const user = await users.findOne({ email });

    const txnId = new ObjectId();

    // Generate human-readable reference number (atomic to prevent duplicates)
    const year = new Date().getFullYear();
    const counterDoc = await counters.findOneAndUpdate(
      { _id: `savings-${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const savingsRefId = `SV-${year}-${String(counterDoc.seq).padStart(3, '0')}`;
    
    const { settings } = await import('../config/db.js');
    const config = await settings.findOne({ _id: 'global' });
    const isManual = config?.paymentApprovalMethod === 'manual';

    if (isManual) {
      const { proofOfPayment, subMethod, accountName, accountNumber } = req.body;
      if (!proofOfPayment) {
        return res.status(400).json({ success: false, message: 'Proof of payment is required for manual approval' });
      }

      const txn = {
        _id: txnId,
        savingsRefId,
        email,
        memberName: user?.fullName || 'Unknown Member',
        goalId: new ObjectId(goalId),
        goalName: goal.name,
        type: 'deposit',
        amount: depositAmount,
        description: description || 'Deposit',
        source: source || 'Manual',
        paymentMethod: paymentMethod || 'Manual',
        subMethod: subMethod || '',
        accountName: accountName || '',
        accountNumber: accountNumber || '',
        proofOfPayment, // Store base64 string
        status: 'pending',
        date: new Date(),
      };
      await savingsTransactions.insertOne(txn);

      return res.json({
        success: true,
        message: 'Deposit submitted and pending approval.',
      });
    }

    // Generate PayMongo Checkout Session
    const paymentDesc = `Savings Deposit to ${goal.name} by ${req.user.fullName}`;
    const billing = { name: user?.fullName || req.user.fullName, email, phone: user?.phone || null };
    const paymentLinkData = await generatePaymentLink(
      depositAmount, 
      paymentDesc, 
      txnId.toString(), 
      paymentMethod,
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/savings`, // successUrl
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/savings`, // cancelUrl
      billing
    );

    // Create transaction record
    const txn = {
      _id: txnId,
      savingsRefId,
      email,
      memberName: user?.fullName || 'Unknown Member',
      goalId: new ObjectId(goalId),
      goalName: goal.name,
      type: 'deposit',
      amount: depositAmount,
      description: description || 'Deposit',
      source: source || 'Manual',
      paymentMethod: paymentMethod || 'PayMongo',
      paymongoLinkId: paymentLinkData.id,
      checkoutUrl: paymentLinkData.attributes.checkout_url,
      status: 'pending',
      date: new Date(),
    };
    await savingsTransactions.insertOne(txn);

    res.json({
      success: true,
      message: 'Redirecting to payment...',
      checkoutUrl: paymentLinkData.attributes.checkout_url,
    });
  } catch (err) {
    console.error('Deposit error:', err);
    res.status(500).json({ success: false, message: 'Failed to process deposit' });
  }
});

/* ================== WITHDRAW FROM SAVINGS ================== */
router.post('/savings/withdraw', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const { goalId, amount, reason, sendMethod, accountNumber, accountName } = req.body;

    if (!goalId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Goal and a positive amount are required' });
    }

    const goal = await savingsGoals.findOne({ _id: new ObjectId(goalId), email });
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

    const withdrawAmount = Number(amount);

    if ((goal.savedAmount || 0) < withdrawAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient savings balance for this withdrawal' });
    }

    const user = await users.findOne({ email });

    // Immediately deduct from goal balance
    const newSaved = Math.max(0, (goal.savedAmount || 0) - withdrawAmount);
    const goalUpdates = { savedAmount: newSaved, updatedAt: new Date() };
    // If deducting brings it below target, mark as active again
    if (goal.status === 'completed' && newSaved < goal.targetAmount) {
      goalUpdates.status = 'active';
    }
    await savingsGoals.updateOne({ _id: new ObjectId(goalId) }, { $set: goalUpdates });

    // Create withdrawal transaction (immediately confirmed)
    const txn = {
      email,
      memberName: user?.fullName || 'Unknown Member',
      goalId: new ObjectId(goalId),
      goalName: goal.name,
      type: 'withdrawal',
      amount: withdrawAmount,
      description: reason || 'Withdrawal',
      sendMethod: sendMethod || 'e-wallet',
      accountNumber: accountNumber || '',
      accountName: accountName || user?.fullName || '',
      source: 'Manual',
      status: 'confirmed',
      date: new Date(),
      confirmedAt: new Date(),
    };
    await savingsTransactions.insertOne(txn);

    res.json({
      success: true,
      message: `₱${withdrawAmount.toLocaleString()} withdrawn successfully from ${goal.name}`,
    });
  } catch (err) {
    console.error('Withdraw error:', err);
    res.status(500).json({ success: false, message: 'Failed to process withdrawal' });
  }
});

/* ================== GET SAVINGS TRANSACTIONS ================== */
router.get('/savings/transactions', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const { page = 1, limit = 10, goalId } = req.query;
    const p = parseInt(page);
    const l = parseInt(limit);
    const skip = (p - 1) * l;

    const query = { email, status: { $ne: 'pending' } };
    if (goalId && ObjectId.isValid(goalId)) {
      query.goalId = new ObjectId(goalId);
    }

    const totalCount = await savingsTransactions.countDocuments(query);
    const transactions = await savingsTransactions
      .find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(l)
      .toArray();

    res.json({ success: true, transactions, totalCount, currentPage: p });
  } catch (err) {
    console.error('Savings transactions error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
});

/* ================== TRANSFER BETWEEN GOALS ================== */
router.post('/savings/transfer', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const { fromGoalId, toGoalId, amount, note } = req.body;

    if (!fromGoalId || !toGoalId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Source, destination, and a positive amount are required' });
    }
    if (fromGoalId === toGoalId) {
      return res.status(400).json({ success: false, message: 'Source and destination must be different goals' });
    }

    const fromGoal = await savingsGoals.findOne({ _id: new ObjectId(fromGoalId), email });
    const toGoal = await savingsGoals.findOne({ _id: new ObjectId(toGoalId), email });

    if (!fromGoal) return res.status(404).json({ success: false, message: 'Source goal not found' });
    if (!toGoal) return res.status(404).json({ success: false, message: 'Destination goal not found' });

    const transferAmount = Number(amount);
    if ((fromGoal.savedAmount || 0) < transferAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance in source goal' });
    }

    // Deduct from source
    const fromNewSaved = (fromGoal.savedAmount || 0) - transferAmount;
    const fromUpdates = { savedAmount: fromNewSaved, updatedAt: new Date() };
    if (fromGoal.status === 'completed' && fromNewSaved < fromGoal.targetAmount) {
      fromUpdates.status = 'active';
    }
    await savingsGoals.updateOne({ _id: new ObjectId(fromGoalId) }, { $set: fromUpdates });

    // Add to destination
    const toNewSaved = (toGoal.savedAmount || 0) + transferAmount;
    const toUpdates = { savedAmount: toNewSaved, updatedAt: new Date() };
    if (toNewSaved >= toGoal.targetAmount) toUpdates.status = 'completed';
    await savingsGoals.updateOne({ _id: new ObjectId(toGoalId) }, { $set: toUpdates });

    // Create two transaction records
    const now = new Date();
    const desc = note || `Transfer from ${fromGoal.name} to ${toGoal.name}`;
    await savingsTransactions.insertMany([
      {
        email, goalId: new ObjectId(fromGoalId), goalName: fromGoal.name,
        type: 'withdrawal', amount: transferAmount,
        description: desc, source: 'Transfer', date: now,
        status: 'confirmed', confirmedAt: now
      },
      {
        email, goalId: new ObjectId(toGoalId), goalName: toGoal.name,
        type: 'deposit', amount: transferAmount,
        description: desc, source: 'Transfer', date: now,
        status: 'confirmed', confirmedAt: now
      },
    ]);

    res.json({
      success: true,
      message: `₱${transferAmount.toLocaleString()} transferred from ${fromGoal.name} to ${toGoal.name}`,
    });
  } catch (err) {
    console.error('Transfer error:', err);
    res.status(500).json({ success: false, message: 'Failed to process transfer' });
  }
});

export default router;
