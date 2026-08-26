import { Router } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

import { users, admins, otps, announcements, savingsTransactions, savingsGoals, loans, loanPayments, attendance, branches, attendanceSessions, donations } from '../config/db.js';
import { validate } from '../middleware/validate.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { callGemini } from '../utils/gemini.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

/* ================== ADMIN LOGIN ================== */
router.post('/login',
  loginLimiter,
  validate([
    body('email').trim().notEmpty().withMessage('Email required'),
    body('password').notEmpty().withMessage('Password required'),
    body('role').optional().trim()
  ]),
  async (req, res) => {
    try {
      const { email, password, role } = req.body;
      const admin = await admins.findOne({ email });
      if (!admin) return res.status(400).json({ message: 'Invalid credentials' });

      // If a role was specified from the frontend, ensure it matches
      if (role && admin.role !== role) {
        return res.status(400).json({ message: 'Invalid credentials for this role' });
      }

      const match = await bcrypt.compare(password, admin.passwordHash);
      if (!match) return res.status(400).json({ message: 'Invalid credentials' });

      const token = jwt.sign(
        { email: admin.email, role: admin.role },
        JWT_SECRET,
        { expiresIn: '2h', issuer: 'faithly-api', audience: 'faithly-admin' }
      );

      res.status(200).json({
        message: 'Admin login successful',
        token,
        admin: { email: admin.email, role: admin.role }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Admin login failed' });
    }
  }
);

/* ================== GET SIDEBAR BADGE COUNTS ================== */
router.get('/sidebar-counts', authenticateAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pendingLoansCount, pendingLoanPaymentsCount, pendingSavingsCount, activeLoans, newMembersCount, pendingDonationsCount] = await Promise.all([
      loans.countDocuments({ status: { $in: ['pending', 'awaiting_member_approval'] } }),
      loanPayments.countDocuments({ status: 'pending' }),
      savingsTransactions.countDocuments({ status: 'pending' }),
      loans.find({ status: 'active' }).project({ nextPaymentDate: 1, nextDueDate: 1, approvedDate: 1, disbursementDate: 1 }).toArray(),
      users.countDocuments({ createdAt: { $gte: startOfMonth }, isDeleted: { $ne: true } }),
      donations.countDocuments({ $or: [{ status: 'pending' }, { status: { $exists: false } }] })
    ]);

    const flaggedAccountsCount = activeLoans.filter(l => {
      let dueDate = l.nextPaymentDate || l.nextDueDate;
      if (!dueDate) {
        // No due date set — first payment due 1 month after disbursement/approval
        const baseDate = new Date(l.disbursementDate || l.approvedDate);
        baseDate.setMonth(baseDate.getMonth() + 1);
        dueDate = baseDate;
      }
      if (!dueDate) return false;
      const diff = Math.floor((now - new Date(dueDate)) / (1000 * 60 * 60 * 24));
      return diff >= 1;
    }).length;

    res.json({
      success: true,
      counts: {
        pendingLoans: pendingLoansCount,
        pendingLoanPayments: pendingLoanPaymentsCount,
        pendingSavings: pendingSavingsCount,
        flaggedAccounts: flaggedAccountsCount,
        newMembers: newMembersCount,
        pendingDonations: pendingDonationsCount
      }
    });
  } catch (err) {
    console.error('Error fetching sidebar counts:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sidebar counts' });
  }
});

/* ================== GET ALL MEMBERS ================== */
router.get('/members', authenticateAdmin, async (req, res) => {
  try {
    const { search, status, branch, isOfficer } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(10000, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const baseQuery = {};
    if (search) {
      baseQuery.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { memberId: { $regex: search, $options: 'i' } }
      ];
    }
    if (branch && branch !== 'all') baseQuery.branch = branch;
    
    // Officers = members with position other than 'Member'
    if (isOfficer === 'true') baseQuery.position = { $regex: /^(?!member$)/i };
    if (isOfficer === 'false') baseQuery.position = { $regex: /^member$/i };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Apply status and isNew filters directly to the database query
    if (status === 'deactivated') {
      baseQuery.isDeleted = true;
    } else if (status === 'inactive') {
      baseQuery.isDeleted = { $ne: true };
      baseQuery.$or = [{ lastLoginAt: { $exists: false } }, { lastLoginAt: { $lt: oneWeekAgo } }];
    } else if (status === 'active') {
      baseQuery.isDeleted = { $ne: true };
      baseQuery.lastLoginAt = { $gte: oneWeekAgo };
    }

    if (req.query.isNew === 'true') {
      baseQuery.createdAt = { $gte: startOfMonth };
    }

    // Parallel execution of total count, paginated members, and overall stats
    const [totalMembers, rawMembers, statsResult] = await Promise.all([
      users.countDocuments(baseQuery),
      users.find(baseQuery).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      users.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            deactivated: [{ $match: { isDeleted: true } }, { $count: "count" }],
            inactive: [
              { $match: { isDeleted: { $ne: true }, $or: [{ lastLoginAt: { $exists: false } }, { lastLoginAt: { $lt: oneWeekAgo } }] } },
              { $count: "count" }
            ],
            active: [
              { $match: { isDeleted: { $ne: true }, lastLoginAt: { $gte: oneWeekAgo } } },
              { $count: "count" }
            ],
            officers: [
              { $match: { position: { $exists: true, $not: { $regex: /^member$/i } } } },
              { $count: "count" }
            ],
            newThisMonth: [
              { $match: { createdAt: { $gte: startOfMonth } } },
              { $count: "count" }
            ]
          }
        }
      ]).toArray()
    ]);

    const pageMembers = rawMembers.map(user => {
      let userStatus = 'active';
      if (user.isDeleted) {
        userStatus = 'deactivated';
      } else if (!user.lastLoginAt || new Date(user.lastLoginAt) < oneWeekAgo) {
        userStatus = 'inactive';
      }
      const { passwordHash, failedLoginAttempts, lockUntil, dailyResetOtpCount, ...safeUser } = user;
      return { ...safeUser, status: userStatus, memberId: user.memberId || `M-${user._id.toString().slice(-5).toUpperCase()}` };
    });

    const sr = statsResult[0] || {};
    const stats = {
      total: sr.total?.[0]?.count || 0,
      active: sr.active?.[0]?.count || 0,
      inactive: sr.inactive?.[0]?.count || 0,
      deactivated: sr.deactivated?.[0]?.count || 0,
      officers: sr.officers?.[0]?.count || 0,
      newThisMonth: sr.newThisMonth?.[0]?.count || 0
    };

    const totalPages = Math.ceil(totalMembers / limit) || 1;

    res.status(200).json({
      success: true,
      members: pageMembers,
      stats,
      pagination: { page, limit, totalMembers, totalPages, hasNext: page < totalPages, hasPrev: page > 1 }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch members' });
  }
});

/* ================== UPDATE MEMBER ================== */
router.put('/update-member', authenticateAdmin, async (req, res) => {
  try {
    const { originalEmail, email, adminPassword, fullName, phone, branch, position, newPassword } = req.body;

    const targetEmail = originalEmail || email;
    if (!targetEmail) return res.status(400).json({ success: false, message: 'Email is required' });
    if (!adminPassword) return res.status(400).json({ success: false, message: 'Admin password is required' });

    const admin = await admins.findOne({ email: req.admin.email });
    if (!admin) return res.status(403).json({ success: false, message: 'Admin not found' });

    const passwordMatch = await bcrypt.compare(adminPassword, admin.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, wrongPassword: true, message: 'Incorrect admin password' });
    }

    const user = await users.findOne({ email: targetEmail });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // If changing email, ensure new email is not already taken
    if (email && email !== targetEmail) {
      const existing = await users.findOne({ email });
      if (existing) {
        return res.status(400).json({ success: false, message: 'New email is already in use by another user' });
      }
    }

    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (fullName !== undefined) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;
    if (branch !== undefined) updateData.branch = branch;
    if (position !== undefined) updateData.position = position;


    if (newPassword && newPassword.trim() !== '') {
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await users.updateOne({ email: targetEmail }, { $set: updateData });
    const updated = await users.findOne({ email: email || targetEmail });

    res.status(200).json({
      success: true,
      message: 'Member updated successfully',
      user: { email: updated.email, fullName: updated.fullName, phone: updated.phone, branch: updated.branch, position: updated.position }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update member' });
  }
});

/* ================== UPDATE MEMBER RFID ================== */
router.post('/update-member-rfid', authenticateAdmin, async (req, res) => {
  try {
    const { email, rfidCardId } = req.body;

    if (!email || !rfidCardId) {
      return res.status(400).json({ success: false, message: 'Email and RFID Card ID are required' });
    }

    const user = await users.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Check if this card ID is already registered to someone else
    const owner = await users.findOne({ rfidCardId, email: { $ne: email } });
    if (owner) {
      return res.status(400).json({
        success: false,
        message: `This card is already linked to ${owner.fullName || owner.email}.`
      });
    }

    await users.updateOne({ email }, { $set: { rfidCardId, updatedAt: new Date() } });

    res.status(200).json({
      success: true,
      message: `Successfully linked RFID card to ${user.fullName || user.email}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update RFID card' });
  }
});


/* ================== DELETE MEMBER (PERMANENT) ================== */
router.delete('/delete-member-permanent', authenticateAdmin, async (req, res) => {
  try {
    const { email, adminPassword } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    if (!adminPassword) return res.status(400).json({ success: false, message: 'Admin password is required' });

    const admin = await admins.findOne({ email: req.admin.email });
    if (!admin) return res.status(403).json({ success: false, message: 'Admin not found' });

    const passwordMatch = await bcrypt.compare(adminPassword, admin.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, wrongPassword: true, message: 'Incorrect admin password' });
    }

    const result = await users.deleteOne({ email });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'User not found' });

    await otps.deleteMany({ email });

    res.status(200).json({ success: true, message: 'Member permanently deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete member' });
  }
});

/* ================== GET BRANCHES ================== */
router.get('/branches', authenticateAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(10000, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Build search query
    const query = {};
    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: 'i' };
    }

    const startOfYear = new Date(now.getFullYear(), 0, 1);
    startOfYear.setHours(0,0,0,0);

    // Run ALL queries in parallel for maximum speed
    const [
      totalServices,
      currentMonthUsers,
      prevMonthTotalUsers,
      dbBranches,
      userStats,
      branchDonations,
      branchAttendance
    ] = await Promise.all([
      attendanceSessions.countDocuments({}),
      users.countDocuments({ createdAt: { $gte: startOfCurrentMonth }, isDeleted: { $ne: true } }),
      users.countDocuments({ createdAt: { $lt: startOfCurrentMonth }, isDeleted: { $ne: true } }),
      branches.find(query).sort({ name: 1 }).toArray(),
      users.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: "$branch", count: { $sum: 1 } } }
      ]).toArray(),
      donations.aggregate([
        { $match: { status: 'confirmed' } },
        { $lookup: { from: 'users', localField: 'email', foreignField: 'email', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $addFields: { targetBranch: { $cond: [{ $ifNull: ['$community', false] }, '$community', '$user.branch'] } } },
        { $group: {
            _id: '$targetBranch',
            totalAmount: { $sum: '$amount' },
            sameCommunityAmount: { $sum: { $cond: [{ $eq: ['$targetBranch', '$user.branch'] }, '$amount', 0] } },
            otherCommunityAmount: { $sum: { $cond: [{ $ne: ['$targetBranch', '$user.branch'] }, '$amount', 0] } }
        }}
      ]).toArray(),
      attendance.aggregate([
        { $match: { status: { $regex: /^(present|late)$/i } } },
        { $addFields: { targetBranch: { $ifNull: ['$community', { $ifNull: ['$branch', '$userBranch'] }] }, actualDate: { $ifNull: ['$date', '$createdAt'] } } },
        { $match: { actualDate: { $gte: startOfYear } } },
        { $group: { _id: { branch: '$targetBranch', month: { $month: '$actualDate' }, year: { $year: '$actualDate' } }, count: { $sum: 1 } } }
      ]).toArray()
    ]);

    // Calculate growth rate
    const growthRate = prevMonthTotalUsers > 0 ? ((currentMonthUsers / prevMonthTotalUsers) * 100).toFixed(1) : (currentMonthUsers > 0 ? 100 : 0);

    // Build lookup maps
    const statsMap = {};
    userStats.forEach(s => { if (s._id) statsMap[s._id] = s.count; });

    const donationStatsMap = {};
    branchDonations.forEach(d => { 
      if (d._id) {
        donationStatsMap[d._id] = {
          totalAmount: d.totalAmount,
          sameCommunityAmount: d.sameCommunityAmount,
          otherCommunityAmount: d.otherCommunityAmount
        };
      }
    });

    const attendanceStatsMap = {};
    branchAttendance.forEach(a => {
      const bName = a._id.branch;
      if (bName) {
        if (!attendanceStatsMap[bName]) attendanceStatsMap[bName] = [];
        attendanceStatsMap[bName].push({ month: a._id.month, year: a._id.year, count: a.count });
      }
    });

    // 3. Merge
    const merged = dbBranches.map(b => {
      const members = statsMap[b.name] || 0;
      const donStats = donationStatsMap[b.name] || { totalAmount: 0, sameCommunityAmount: 0, otherCommunityAmount: 0 };
      const attData = attendanceStatsMap[b.name] || [];
      return {
        ...b,
        province: b.province || (b.address ? b.address.split(',')[0].trim() : 'Unknown'),
        members,
        totalDonations: donStats.totalAmount,
        sameCommunityAmount: donStats.sameCommunityAmount,
        otherCommunityAmount: donStats.otherCommunityAmount,
        attendanceHistory: attData,
        status: members > 0 ? 'Active' : 'Idle'
      };
    });

    const totalCount = merged.length;
    const paged = merged.slice(skip, skip + limit);

    res.status(200).json({ 
      success: true, 
      branches: paged, 
      totalCount,
      totalServices,
      growthRate
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch branches' });
  }
});

/* ================== ADD BRANCH ================== */
router.post('/branches', authenticateAdmin, async (req, res) => {
  try {
    const { name, address, pastor } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Branch name is required' });

    const exists = await branches.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
    if (exists) return res.status(400).json({ success: false, message: 'Branch already exists' });

    const newBranch = {
      name,
      address: address || '',
      pastor: pastor || '',
      status: 'Active',
      createdAt: new Date()
    };

    await branches.insertOne(newBranch);
    res.status(201).json({ success: true, message: 'Branch added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to add branch' });
  }
});

/* ================== DELETE BRANCH ================== */
router.delete('/branches/:id', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { id } = req.params;
    
    const result = await branches.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'Branch not found' });

    res.status(200).json({ success: true, message: 'Branch removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete branch' });
  }
});

/* ================== EDIT BRANCH ================== */
router.put('/branches/:id', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { id } = req.params;
    const { name, address, pastor } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Branch name is required' });

    const updateData = {
      name,
      address: address || '',
      pastor: pastor || '',
      updatedAt: new Date()
    };

    const result = await branches.updateOne({ _id: new ObjectId(id) }, { $set: updateData });
    if (result.matchedCount === 0) return res.status(404).json({ success: false, message: 'Branch not found' });

    res.status(200).json({ success: true, message: 'Branch updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update branch' });
  }
});

/* ================== ADMIN - CREATE NEW ADMIN/OFFICER ================== */
router.post('/create-admin', authenticateAdmin, async (req, res) => {
  try {
    // Only the main admin can create other admins/officers
    if (req.admin.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only Main Admin can create accounts' });
    }

    const { email, password, role, adminPassword } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (!adminPassword) {
      return res.status(400).json({ success: false, message: 'Admin password is required' });
    }

    // Verify admin password
    const currentAdmin = await admins.findOne({ email: req.admin.email });
    const passwordMatch = await bcrypt.compare(adminPassword, currentAdmin.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, wrongPassword: true, message: 'Incorrect admin password' });
    }

    // Role validation
    const validRoles = ['admin', 'loanAdmin', 'secretaryAdmin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const existingAdmin = await admins.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newAdmin = {
      email,
      passwordHash,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await admins.insertOne(newAdmin);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      admin: { email, role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create account' });
  }
});

/* ================== GET ALL ADMINS ================== */
router.get('/admins', authenticateAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only Main Admin can view admin list' });
    }

    const { search } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(10000, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.email = { $regex: search, $options: 'i' };
    }

    const allAdmins = await admins.find(query).sort({ createdAt: -1 }).toArray();
    const total = allAdmins.length;
    const paged = allAdmins.slice(skip, skip + limit);

    // Remove passwordHash from response
    const safe = paged.map(a => {
      const { passwordHash, ...rest } = a;
      return rest;
    });

    const stats = {
      total: await admins.countDocuments(),
      admins: await admins.countDocuments({ role: 'admin' }),
      loanAdmins: await admins.countDocuments({ role: 'loanAdmin' }),
      secretaryAdmins: await admins.countDocuments({ role: 'secretaryAdmin' }),
    };

    res.status(200).json({
      success: true,
      admins: safe,
      stats,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch admins' });
  }
});

/* ================== UPDATE ADMIN ROLE / PASSWORD ================== */
router.put('/update-admin', authenticateAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only Main Admin can update accounts' });
    }

    const { email, role, newPassword, adminPassword, newEmail } = req.body;
    if (!email || !role) {
      return res.status(400).json({ success: false, message: 'Email and role are required' });
    }
    if (!adminPassword) {
      return res.status(400).json({ success: false, message: 'Admin password is required' });
    }

    // Verify admin password
    const currentAdmin = await admins.findOne({ email: req.admin.email });
    const passwordMatch = await bcrypt.compare(adminPassword, currentAdmin.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, wrongPassword: true, message: 'Incorrect admin password' });
    }

    // Protect the seed super admin from being modified by others
    const superAdminEmail = process.env.ADMIN_EMAIL;
    if (email === superAdminEmail && req.admin.email !== superAdminEmail) {
      return res.status(403).json({ success: false, message: 'Cannot modify the Main Super Admin account' });
    }

    // Prevent changing the super admin's role
    if (email === superAdminEmail && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot change the role of the Main Super Admin account' });
    }

    const validRoles = ['admin', 'loanAdmin', 'secretaryAdmin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const target = await admins.findOne({ email });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const updateFields = { role, updatedAt: new Date() };
    if (newPassword && newPassword.trim() !== '') {
      updateFields.passwordHash = await bcrypt.hash(newPassword, 12);
    }
    
    // Handle email change
    if (newEmail && newEmail !== email) {
      // Check if new email is already taken
      const existing = await admins.findOne({ email: newEmail });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email is already in use by another admin' });
      }
      updateFields.email = newEmail;
    }

    await admins.updateOne({ email }, { $set: updateFields });

    let newToken = null;
    if (newEmail && newEmail !== email && req.admin.email === email) {
       // If they changed their own email, their token will become invalid. Issue a new one.
       const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
       newToken = jwt.sign(
         { email: newEmail, role },
         JWT_SECRET,
         { expiresIn: '2h', issuer: 'faithly-api', audience: 'faithly-admin' }
       );
    }

    res.status(200).json({ success: true, message: `Account updated successfully`, newToken, newEmail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update admin' });
  }
});

/* ================== DELETE ADMIN ================== */
router.delete('/delete-admin', authenticateAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only Main Admin can delete accounts' });
    }

    const { email, adminPassword } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    if (!adminPassword) {
      return res.status(400).json({ success: false, message: 'Admin password is required' });
    }

    // Verify admin password
    const currentAdmin = await admins.findOne({ email: req.admin.email });
    const passwordMatch = await bcrypt.compare(adminPassword, currentAdmin.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, wrongPassword: true, message: 'Incorrect admin password' });
    }

    // Protect the seed super admin
    const superAdminEmail = process.env.ADMIN_EMAIL;
    if (email === superAdminEmail) {
      return res.status(403).json({ success: false, message: 'Cannot delete the Main Super Admin account' });
    }

    // Cannot delete yourself
    if (email === req.admin.email) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    const result = await admins.deleteOne({ email });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    res.status(200).json({ success: true, message: 'Admin account deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete admin' });
  }
});

/* ================== ANNOUNCEMENTS - GET ALL ================== */
router.get('/announcements', async (req, res) => {
  try {
    const { branch } = req.query;
    let isAdmin = false;

    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (['admin', 'loanAdmin', 'secretaryAdmin'].includes(decoded?.role)) {
          isAdmin = true;
        }
      } catch (e) {
        // Token invalid or unverified, treat as non-admin visitor
      }
    }

    const query = {};

    // For non-admin user-facing requests, filter by branch visibility and expiration
    if (!isAdmin) {
      query.$and = [
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
          ]
        },
        {
          $or: [
            { visibility: 'all' },
            { visibility: { $exists: false } },
            { visibility: null },
            { targetBranches: branch }
          ]
        }
      ];
    }

    const announcementsList = await announcements.find(query).sort({ createdAt: -1 }).toArray();
    res.status(200).json({ success: true, announcements: announcementsList });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
});

/* ================== ANNOUNCEMENTS - CREATE (ADMIN) ================== */
router.post('/announcements', authenticateAdmin, async (req, res) => {
  try {
    const { title, body, category, eventDate, expiresAt, visibility, targetBranches, imageBase64, images, template } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }
    const doc = {
      title,
      body,
      category: category || 'General',
      eventDate: eventDate ? new Date(eventDate) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      visibility: visibility || 'all',
      targetBranches: Array.isArray(targetBranches) ? targetBranches : [],
      image: imageBase64 || (images && images.length > 0 ? images[0] : null), // Legacy support
      images: Array.isArray(images) ? images : (imageBase64 ? [imageBase64] : []),
      template: template || 'banner',
      createdBy: req.admin.email,
      createdAt: new Date(),
    };
    const result = await announcements.insertOne(doc);
    res.status(201).json({ success: true, message: 'Announcement created', id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
});

/* ================== ANNOUNCEMENTS - UPDATE (ADMIN) ================== */
router.put('/announcements/:id', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { id } = req.params;
    const { title, body, category, eventDate, expiresAt, visibility, targetBranches, imageBase64, images, template } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }
    const updateDoc = {
      title,
      body,
      category: category || 'General',
      eventDate: eventDate ? new Date(eventDate) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      visibility: visibility || 'all',
      targetBranches: Array.isArray(targetBranches) ? targetBranches : [],
      image: imageBase64 || (images && images.length > 0 ? images[0] : null), // Legacy support
      images: Array.isArray(images) ? images : (imageBase64 ? [imageBase64] : []),
      template: template || 'banner',
      updatedAt: new Date(),
      updatedBy: req.admin.email,
    };
    const result = await announcements.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    res.status(200).json({ success: true, message: 'Announcement updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update announcement' });
  }
});

/* ================== ANNOUNCEMENTS - DELETE (ADMIN) ================== */
router.delete('/announcements/:id', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { id } = req.params;
    const result = await announcements.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    res.status(200).json({ success: true, message: 'Announcement deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete announcement' });
  }
});

/* ================== SAVINGS TRANSACTIONS (ADMIN) ================== */
router.get('/savings/deposits', authenticateAdmin, async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = { type: { $in: ['deposit', 'withdrawal'] } };

    if (status) query.status = status;

    // Filter: Only show manual/proof-based payments for pending approval.
    // Exclude PayMongo automated payments from the pending list.
    if (status === 'pending') {
      query.paymongoLinkId = { $exists: false };
    }

    if (search) {
      query.$or = [
        { memberName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const rawDeposits = await savingsTransactions.find(query).sort({ date: -1 }).toArray();
    
    // Enrich with user positions and roles
    const emails = [...new Set(rawDeposits.map(d => d.email).filter(Boolean))];
    const userDocs = await users.find({ email: { $in: emails } }).project({ email: 1, position: 1, role: 1 }).toArray();
    const userMap = userDocs.reduce((acc, user) => {
      acc[user.email] = user.position || (user.role === 'officer' ? 'officer' : 'member');
      return acc;
    }, {});

    const deposits = rawDeposits.map(d => ({
      ...d,
      position: userMap[d.email] || 'member'
    }));

    res.json({ success: true, deposits });
  } catch (err) {
    console.error('Failed to fetch savings transactions:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch savings transactions' });
  }
});



/* ================== SAVINGS WITHDRAWALS (ADMIN) ================== */
router.get('/savings/withdrawals', authenticateAdmin, async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = { type: 'withdrawal' };

    if (status) query.status = status;

    if (search) {
      query.$or = [
        { memberName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const withdrawals = await savingsTransactions.find(query).sort({ date: -1 }).toArray();
    res.json({ success: true, withdrawals });
  } catch (err) {
    console.error('Failed to fetch savings withdrawals:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch savings withdrawals' });
  }
});

router.put('/savings/withdrawals/:id/confirm', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { id } = req.params;

    const txn = await savingsTransactions.findOne({ _id: new ObjectId(id) });
    if (!txn) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (txn.type !== 'withdrawal') return res.status(400).json({ success: false, message: 'Transaction is not a withdrawal' });
    if (txn.status === 'confirmed') return res.status(400).json({ success: false, message: 'Already confirmed' });

    // Update Transaction
    await savingsTransactions.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'confirmed', confirmedAt: new Date(), confirmedBy: req.admin.email } });

    // Update Goal - deduct saved amount
    const goal = await savingsGoals.findOne({ _id: txn.goalId });
    if (goal) {
      const newSaved = Math.max(0, (goal.savedAmount || 0) - txn.amount);
      const updates = { savedAmount: newSaved, updatedAt: new Date() };
      // If deducting brings it below target, mark as active again
      if (goal.status === 'completed' && newSaved < goal.targetAmount) {
        updates.status = 'active';
      }
      await savingsGoals.updateOne({ _id: txn.goalId }, { $set: updates });
    }

    res.json({ success: true, message: `Withdrawal of ₱${txn.amount.toLocaleString()} confirmed and deducted from savings.` });
  } catch (err) {
    console.error('Failed to confirm withdrawal:', err);
    res.status(500).json({ success: false, message: 'Failed to confirm withdrawal' });
  }
});

router.put('/savings/withdrawals/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { id } = req.params;
    const { reason } = req.body;

    const txn = await savingsTransactions.findOne({ _id: new ObjectId(id) });
    if (!txn) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (txn.type !== 'withdrawal') return res.status(400).json({ success: false, message: 'Transaction is not a withdrawal' });
    if (txn.status === 'confirmed') return res.status(400).json({ success: false, message: 'Cannot reject confirmed withdrawal' });

    await savingsTransactions.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'rejected', rejectReason: reason || '', rejectedAt: new Date(), rejectedBy: req.admin.email } });

    res.json({ success: true, message: 'Withdrawal request rejected.' });
  } catch (err) {
    console.error('Failed to reject withdrawal:', err);
    res.status(500).json({ success: false, message: 'Failed to reject withdrawal' });
  }
});

/* ================== ADMIN - GET SAVINGS GOALS BY EMAIL ================== */
router.get('/user-savings-goals/:email', authenticateAdmin, async (req, res) => {
  try {
    const email = req.params.email;
    const goals = await savingsGoals.find({ email, status: { $ne: 'completed' } }).toArray();
    res.json({ success: true, goals });
  } catch (err) {
    console.error('Failed to fetch user goals:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch user goals' });
  }
});

/* ================== ADMIN - PROCESS WALK-IN SAVINGS DEPOSIT ================== */
router.post('/process-savings-deposit', authenticateAdmin, async (req, res) => {
  try {
    const { email, goalId, amount, paymentMethod, referenceNumber } = req.body;
    if (!email || !goalId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Email, Goal ID, and positive amount are required' });
    }

    const { ObjectId } = await import('mongodb');
    const goal = await savingsGoals.findOne({ _id: new ObjectId(goalId), email });
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

    // Validate that amount doesn't exceed limit
    const currentSaved = goal.savedAmount || 0;
    const maxAllowed = Math.max(0, goal.targetAmount - currentSaved);
    if (amount > maxAllowed) {
      return res.status(400).json({ success: false, message: `Amount exceeds goal target. Maximum allowed deposit is ₱${maxAllowed.toLocaleString()}` });
    }

    const user = await users.findOne({ email });
    const dt = new Date();

    // 1. Create confirmed transaction
    const txn = {
      email,
      memberName: user?.fullName || 'Unknown Member',
      goalId: new ObjectId(goalId),
      goalName: goal.name,
      type: 'deposit',
      amount: Number(amount),
      description: 'Admin Walk-in Deposit',
      source: 'walk-in',
      paymentMethod: paymentMethod || 'cash',
      referenceNumber: referenceNumber || '',
      proofOfPayment: null,
      status: 'confirmed',
      confirmedAt: dt,
      confirmedBy: req.admin.email,
      date: dt,
    };
    await savingsTransactions.insertOne(txn);

    // 2. Update goal balance
    const newSaved = currentSaved + Number(amount);
    const updates = { savedAmount: newSaved, updatedAt: dt };
    if (newSaved >= goal.targetAmount) updates.status = 'completed';
    await savingsGoals.updateOne({ _id: new ObjectId(goalId) }, { $set: updates });

    res.json({ success: true, message: `Walk-in deposit of ₱${Number(amount).toLocaleString()} processed successfully.` });
  } catch (err) {
    console.error('Process walk-in deposit error:', err);
    res.status(500).json({ success: false, message: 'Failed to process walk-in deposit' });
  }
});

/* ================== ADMIN - PROCESS WALK-IN LOAN PAYMENT ================== */
router.post('/process-loan-payment', authenticateAdmin, async (req, res) => {
  try {
    const { loanId, amount, paymentMethod, referenceNumber } = req.body;
    if (!loanId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Loan ID and positive amount are required' });
    }

    const { ObjectId } = await import('mongodb');
    const loan = await loans.findOne({ _id: new ObjectId(loanId) });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status !== 'active') return res.status(400).json({ success: false, message: 'Only active loans can receive payments' });

    const dt = new Date();

    // 1. Create confirmed payment record
    const payment = {
      loanId: loan.loanId,
      loanObjectId: loan._id,
      email: loan.email,
      memberName: loan.memberName,
      amount: Number(amount),
      paymentMethod: paymentMethod || 'cash',
      referenceNumber: referenceNumber || '',
      proofData: null,
      proofFileName: null,
      status: 'confirmed',
      submittedAt: dt,
      confirmedAt: dt,
      confirmedBy: req.admin.email,
      monthNumber: (loan.paidMonths || 0) + 1,
    };
    await loanPayments.insertOne(payment);

    // 2. Update Loan balance
    const newPaidMonths = (loan.paidMonths || 0) + 1;
    const newBalance = Math.max(0, (loan.remainingBalance || loan.totalRepayment || loan.amount) - Number(amount));
    const isComplete = newPaidMonths >= (loan.termMonths || 12);

    const startDate = new Date(loan.disbursementDate || loan.approvedDate || loan.appliedDate);
    const nextDue = new Date(startDate);
    nextDue.setMonth(startDate.getMonth() + newPaidMonths + 1);

    await loans.updateOne(
      { _id: loan._id },
      {
        $set: {
          remainingBalance: newBalance,
          paidMonths: newPaidMonths,
          status: isComplete ? 'completed' : 'active',
          nextPaymentDate: nextDue,
          nextDueDate: nextDue
        }
      }
    );

    res.json({ success: true, message: `Walk-in payment of ₱${Number(amount).toLocaleString()} processed successfully.` });
  } catch (err) {
    console.error('Process walk-in payment error:', err);
    res.status(500).json({ success: false, message: 'Failed to process walk-in loan payment' });
  }
});
/* ================== ADMIN - CREATE NEW MEMBER DIRECTLY ================== */
router.post('/create-member', authenticateAdmin, async (req, res) => {
  try {
    const { email, password, fullName, phone, branch, position } = req.body;

    if (!email || !password || !fullName || !phone) {
      return res.status(400).json({ success: false, message: 'Email, Default Password, Full Name, and Phone are required' });
    }

    // Check if user already exists
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Hash the password securely
    const passwordHash = await bcrypt.hash(password, 10);

    // Create the active, verified user directly
    const newUser = {
      email,
      passwordHash,
      fullName,
      phone,
      branch: branch || 'Bulacan Main',
      position: position || 'member',

      gender: null,
      birthday: null,
      isVerified: true,
      verifiedAt: new Date(),
      createdAt: new Date(),
      failedLoginAttempts: 0,
      lockUntil: null,
      isPermanentlyLocked: false,
    };

    const result = await users.insertOne(newUser);

    // Just in case there is a leftover pending registration or OTP, clear it
    await import('../config/db.js').then(async ({ pendingRegistrations }) => {
      await pendingRegistrations.deleteOne({ email });
    }).catch(() => { });
    await otps.deleteMany({ email });

    res.status(201).json({
      success: true,
      message: 'Member registered successfully',
      user: { _id: result.insertedId, email, fullName, phone, branch, position }
    });
  } catch (err) {
    console.error('Create member error:', err);
    res.status(500).json({ success: false, message: 'Failed to create member' });
  }
});


/* ================== ADMIN - GET DSS ANALYSIS ================== */
router.get('/loans/:id/dss-analysis', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Loan ID' });
    }

    const loan = await loans.findOne({ _id: new ObjectId(id) });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    if (req.query.refresh !== 'true' && loan.dssAnalysis && !loan.dssAnalysis.recommendation?.includes('5,000')) {
      return res.json({ success: true, analysis: loan.dssAnalysis, cached: true });
    }

    const user = await users.findOne({ email: loan.email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // 1. Eligibility Check
    // - Active Member (Attendance)
    const presentAttendanceCount = await attendance.countDocuments({ email: loan.email, status: { $in: ['Present', 'Late'] } });
    const absentCount = await attendance.countDocuments({ email: loan.email, status: 'Absent' });
    const isActiveMember = presentAttendanceCount > 0;

    // - Savings >= ₱1,000
    const userGoals = await savingsGoals.find({ email: loan.email }).toArray();
    const totalSavings = userGoals.reduce((sum, g) => sum + (g.savedAmount || 0), 0);
    const savingsOk = totalSavings >= 1000;

    // - No Active Loans (One at a time)
    const otherLoans = await loans.find({ email: loan.email, _id: { $ne: new ObjectId(id) } }).toArray();
    const unpaidLoans = otherLoans.filter(l => l.status === 'active');
    const noActiveLoan = unpaidLoans.length === 0;

    // - Information is valid (Selfie + ID) -- Using the files metadata or path
    const infoValid = !!(loan.selfieData || loan.selfieFileName) && !!(loan.idData || loan.idFileName);

    // 2. Loan Capacity
    const LOAN_CONFIG = {
      'personal': { multiplier: 2, min: 1000 },
      'emergency': { multiplier: 1.5, min: 1000 },
      'short-term': { multiplier: 1, min: 1000 }
    };
    const config = LOAN_CONFIG[loan.loanType] || LOAN_CONFIG['personal'];

    // Formula: Savings * Multiplier
    const maxLoanable = Math.max(0, totalSavings * config.multiplier);
    const requestedOk = loan.amount <= maxLoanable && loan.amount >= config.min;

    // 3. Risk Level
    const payments = await loanPayments.find({ email: loan.email, status: 'confirmed' }).toArray();
    const historyLate = payments.some(p => p.isLate);
    const currentlyLate = loan.isLate || otherLoans.some(l => l.isLate === true);

    let riskTier = 'Low Risk';
    let riskColor = 'green';
    let riskLevel = 1;

    if (currentlyLate) {
      riskTier = 'High Risk';
      riskColor = 'red';
      riskLevel = 3;
    } else if (historyLate || absentCount > presentAttendanceCount) {
      riskTier = 'Moderate Risk';
      riskColor = 'yellow';
      riskLevel = 2;
    }

    // 4. Recommendation
    const eligible = isActiveMember && noActiveLoan && savingsOk && infoValid && requestedOk;
    let recommendationText = "";

    if (eligible) {
      recommendationText = "Based on the member's savings and repayment history, this application appears eligible for approval.";
    } else if (!isActiveMember) {
      recommendationText = "This application may be declined: Applicant has no active attendance records.";
    } else if (!savingsOk) {
      recommendationText = "This application may be declined: Insufficient savings (below ₱1,000).";
    } else if (!noActiveLoan) {
      recommendationText = "The system recommends declining this application — the member already has an active loan.";
    } else if (!requestedOk) {
      if (loan.amount < config.min) {
        recommendationText = `Minimum loan amount is ₱${config.min.toLocaleString()}.`;
      } else {
        recommendationText = "Amount exceeds calculated loan capacity based on savings multiplier.";
      }
    } else {
      recommendationText = "The system recommends reviewing missing documentation or historical profile.";
    }

    // === AI-Enhanced Summary ===
    let aiSummary = null;
    try {
      const aiPrompt = `You are a loan risk assessment advisor for a church credit program.
Given this analysis, write a 2-3 sentence narrative summary explaining the risk level and your recommendation in plain, professional language.
Note: The strict church policy is one loan at a time. Do not recommend approval if there is an existing active loan.

Applicant: ${loan.memberName}
Amount Requested: ₱${loan.amount?.toLocaleString()}
Loan Type: ${loan.loanType || 'personal'}
Attendance Profile: ${presentAttendanceCount} Present/Late, ${absentCount} Absent
Savings: ₱${totalSavings.toLocaleString()}
Max Loanable: ₱${maxLoanable.toLocaleString()}
Existing Active Loans: ${unpaidLoans.length}
Late Payment History: ${historyLate ? 'Yes' : 'No'}
Currently Overdue: ${currentlyLate ? 'Yes' : 'No'}
Documents Submitted: ${infoValid ? 'Complete' : 'Incomplete'}
Risk Level: ${riskTier}
Eligible: ${eligible ? 'Yes' : 'No'}
Rule-based Recommendation: ${recommendationText}`;

      aiSummary = await callGemini(
        'You are a concise loan assessment advisor. Provide a brief 2-3 sentence analysis. Do not use markdown formatting.',
        aiPrompt,
        { maxTokens: 200, temperature: 0.4 }
      );
    } catch (aiErr) {
      console.error('[DSS AI Summary] Error:', aiErr.message);
    }

    const finalAnalysis = {
      eligibility: {
        isActiveMember,
        savingsOk,
        noActiveLoan,
        infoValid
      },
      capacity: {
        totalSavings,
        multiplier: config.multiplier,
        maxLoanable,
        requestedOk,
        requestedAmount: loan.amount
      },
      risk: {
        tier: riskTier,
        color: riskColor,
        level: riskLevel,
        hasHistoryLate: historyLate
      },
      recommendation: recommendationText,
      isEligible: eligible,
      aiSummary
    };

    // Cache the result in the DB
    await loans.updateOne({ _id: new ObjectId(id) }, { $set: { dssAnalysis: finalAnalysis } });

    res.json({
      success: true,
      analysis: finalAnalysis
    });

  } catch (err) {
    console.error('DSS Analysis Error:', err);
    res.status(500).json({ success: false, message: 'DSS Analysis failed' });
  }
});

/* ================== ADMIN - GET LOAN PAYMENTS ================== */
router.get('/loans/payments', authenticateAdmin, async (req, res) => {
  try {
    const { loanPayments, loans, users } = await import('../config/db.js');
    const { status, limit: qLimit, page: qPage, search } = req.query;
    
    const page = parseInt(qPage) || 1;
    const limit = parseInt(qLimit) || 10;
    const skip = (page - 1) * limit;

    let query = {};
    if (status === 'history') {
      query.status = { $ne: 'pending' };
    } else if (status) {
      query.status = status;
    }
    
    // Filter: Only show manual/proof-based payments for pending approval.
    // Exclude PayMongo automated payments from the pending list.
    if (status === 'pending') {
      query.paymongoLinkId = { $exists: false };
    }

    if (search) {
      // Need to find matching emails or loanIds first if we want to search by memberName or purpose
      // For simplicity in a single query, we just search by loanId or email natively
      query.$or = [
        { loanId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    const totalCount = await loanPayments.countDocuments(query);
    const payments = await loanPayments.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const emails = [...new Set(payments.map(p => p.email).filter(Boolean))];
    const loanIds = [...new Set(payments.map(p => p.loanId).filter(Boolean))];

    const [userDocs, loanDocs] = await Promise.all([
      users.find({ email: { $in: emails } }).project({ email: 1, fullName: 1 }).toArray(),
      loans.find({ loanId: { $in: loanIds } }).project({ loanId: 1, purpose: 1 }).toArray()
    ]);

    const userMap = userDocs.reduce((acc, user) => { 
      acc[user.email] = user.fullName; 
      return acc; 
    }, {});
    
    const loanMap = loanDocs.reduce((acc, loan) => { 
      acc[loan.loanId] = loan.purpose; 
      return acc; 
    }, {});

    const enriched = payments.map(p => ({
        ...p,
        memberName: userMap[p.email] || 'Unknown',
        loanPurpose: loanMap[p.loanId] || 'Unknown'
    }));

    res.json({ 
      success: true, 
      payments: enriched,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      currentPage: page
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch loan payments' });
  }
});

/* ================== SETTINGS (ADMIN) ================== */
router.get('/settings', authenticateAdmin, async (req, res) => {
  try {
    const { settings } = await import('../config/db.js');
    const config = await settings.findOne({ _id: 'global' });
    res.json({ success: true, settings: config });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

router.post('/settings', authenticateAdmin, async (req, res) => {
  try {
    const { settings } = await import('../config/db.js');
    const { 
      paymentApprovalMethod, 
      orgName, 
      orgContact, 
      orgAddress, 
      maintenanceMode, 
      notifNewUser, 
      notifDonation, 
      notifLoan,
      notifNewLoan,
      notifPayment,
      notifDelinquent
    } = req.body;
    
    const updateObj = { updatedAt: new Date() };
    if (paymentApprovalMethod !== undefined) updateObj.paymentApprovalMethod = paymentApprovalMethod;
    if (orgName !== undefined) updateObj.orgName = orgName;
    if (orgContact !== undefined) updateObj.orgContact = orgContact;
    if (orgAddress !== undefined) updateObj.orgAddress = orgAddress;
    if (maintenanceMode !== undefined) updateObj.maintenanceMode = maintenanceMode;
    if (notifNewUser !== undefined) updateObj.notifNewUser = notifNewUser;
    if (notifDonation !== undefined) updateObj.notifDonation = notifDonation;
    if (notifLoan !== undefined) updateObj.notifLoan = notifLoan;
    if (notifNewLoan !== undefined) updateObj.notifNewLoan = notifNewLoan;
    if (notifPayment !== undefined) updateObj.notifPayment = notifPayment;
    if (notifDelinquent !== undefined) updateObj.notifDelinquent = notifDelinquent;

    await settings.updateOne(
      { _id: 'global' },
      { $set: updateObj },
      { upsert: true }
    );
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

/* ================== ADMIN PROFILE MANAGEMENT ================== */
router.get('/profile/me', authenticateAdmin, async (req, res) => {
  try {
    const admin = await admins.findOne({ email: req.admin.email });
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    res.json({ 
      success: true, 
      admin: { 
        email: admin.email, 
        fullName: admin.fullName || 'Admin User', 
        role: admin.role 
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

router.post('/profile/update', authenticateAdmin, async (req, res) => {
  try {
    const { fullName } = req.body;
    if (!fullName) return res.status(400).json({ success: false, message: 'Full name is required' });

    const result = await admins.updateOne(
      { email: req.admin.email },
      { $set: { fullName, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

router.post('/profile/change-password', authenticateAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    }

    const admin = await admins.findOne({ email: req.admin.email });
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await admins.updateOne(
      { email: req.admin.email },
      { $set: { passwordHash: hashed, updatedAt: new Date() } }
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update password' });
  }
});

/* ================== MANUAL APPROVAL - DONATIONS ================== */
router.put('/donations/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { donations } = await import('../config/db.js');
    const result = await donations.updateOne(
      { _id: new ObjectId(req.params.id), status: 'pending' },
      { $set: { status: 'confirmed', confirmedAt: new Date(), confirmedBy: req.admin.email } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ success: false, message: 'Donation not found or not pending' });
    res.json({ success: true, message: 'Donation approved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to approve donation' });
  }
});

router.put('/donations/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { donations } = await import('../config/db.js');
    const { reason } = req.body;
    const result = await donations.updateOne(
      { _id: new ObjectId(req.params.id), status: 'pending' },
      { $set: { status: 'rejected', rejectReason: reason || 'Admin review', rejectedAt: new Date(), rejectedBy: req.admin.email } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ success: false, message: 'Donation not found or not pending' });
    res.json({ success: true, message: 'Donation rejected successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reject donation' });
  }
});

/* ================== MANUAL APPROVAL - SAVINGS DEPOSITS & WITHDRAWALS ================== */
router.put('/savings/deposits/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { savingsTransactions, savingsGoals } = await import('../config/db.js');
    const txn = await savingsTransactions.findOne({ _id: new ObjectId(req.params.id), status: 'pending' });
    if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found or not pending' });

    // Update Transaction
    await savingsTransactions.updateOne(
      { _id: txn._id },
      { $set: { status: 'confirmed', confirmedAt: new Date(), confirmedBy: req.admin.email } }
    );

    // Update Goal Balance according to transaction type
    const goal = await savingsGoals.findOne({ _id: txn.goalId });
    if (goal) {
      let newSaved;
      const updates = { updatedAt: new Date() };

      if (txn.type === 'withdrawal') {
        newSaved = Math.max(0, (goal.savedAmount || 0) - txn.amount);
        if (goal.status === 'completed' && newSaved < goal.targetAmount) {
          updates.status = 'active';
        }
      } else { // deposit
        newSaved = (goal.savedAmount || 0) + txn.amount;
        if (newSaved >= goal.targetAmount) {
          updates.status = 'completed';
        }
      }

      updates.savedAmount = newSaved;
      await savingsGoals.updateOne({ _id: txn.goalId }, { $set: updates });
    }

    res.json({
      success: true,
      message: `${txn.type === 'withdrawal' ? 'Withdrawal' : 'Deposit'} approved successfully`
    });
  } catch (err) {
    console.error('Approve savings error:', err);
    res.status(500).json({ success: false, message: 'Failed to approve transaction' });
  }
});

router.put('/savings/deposits/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { savingsTransactions } = await import('../config/db.js');
    const { reason } = req.body;
    const result = await savingsTransactions.updateOne(
      { _id: new ObjectId(req.params.id), status: 'pending' },
      { $set: { status: 'rejected', rejectReason: reason || 'Admin review', rejectedAt: new Date(), rejectedBy: req.admin.email } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ success: false, message: 'Transaction not found or not pending' });
    res.json({ success: true, message: 'Transaction rejected successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reject transaction' });
  }
});

/* ================== MANUAL APPROVAL - LOAN PAYMENTS ================== */
router.put('/loans/payments/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { loanPayments, loans } = await import('../config/db.js');
    const payment = await loanPayments.findOne({ _id: new ObjectId(req.params.id), status: 'pending' });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found or not pending' });

    await loanPayments.updateOne(
      { _id: payment._id },
      { $set: { status: 'confirmed', confirmedAt: new Date(), confirmedBy: req.admin.email } }
    );

    // Update Loan balance
    const loanObjectId = payment.loanObjectId ? new ObjectId(payment.loanObjectId) : payment.loanId; // fallback
    const loan = await loans.findOne({ _id: loanObjectId });
    if (loan) {
      const pType = payment.paymentType || 'regular';
      const pMonths = payment.monthsCovered != null ? payment.monthsCovered : (pType === 'regular' ? 1 : 0);
      let newPaidMonths;
      let newBalance;

      if (pType === 'full') {
          newPaidMonths = loan.termMonths || 12;
          newBalance = 0;
      } else if (pType === 'open' || pType === 'custom') {
          newBalance = Math.max(0, (loan.remainingBalance || loan.totalRepayment || loan.amount) - Number(payment.amount));
          const totalPaid = (loan.totalRepayment || loan.amount) - newBalance;
          const monthlyInstallment = loan.monthlyInstallment || ((loan.totalRepayment || loan.amount) / (loan.termMonths || 12));
          newPaidMonths = Math.floor(totalPaid / monthlyInstallment);
      } else {
          const months = pType === 'advance' ? pMonths : 1;
          newPaidMonths = Math.min((loan.paidMonths || 0) + months, loan.termMonths || 12);
          newBalance = Math.max(0, (loan.remainingBalance || loan.totalRepayment || loan.amount) - Number(payment.amount));
      }

      // Only complete if balance is actually 0
      const isComplete = newBalance <= 0;
      if (isComplete) { newPaidMonths = loan.termMonths || 12; newBalance = 0; }

      const startDate = new Date(loan.disbursementDate || loan.approvedDate || loan.appliedDate || new Date());
      const nextDue = new Date(startDate);
      nextDue.setMonth(startDate.getMonth() + newPaidMonths + 1);

      await loans.updateOne(
        { _id: loan._id },
        {
          $set: {
            remainingBalance: newBalance,
            paidMonths: newPaidMonths,
            status: isComplete ? 'completed' : 'active',
            nextPaymentDate: isComplete ? null : nextDue,
            nextDueDate: isComplete ? null : nextDue
          }
        }
      );
    }
    res.json({ success: true, message: 'Loan payment approved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to approve loan payment' });
  }
});

router.put('/loans/payments/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const { loanPayments } = await import('../config/db.js');
    const { reason } = req.body;
    const result = await loanPayments.updateOne(
      { _id: new ObjectId(req.params.id), status: 'pending' },
      { $set: { status: 'rejected', rejectReason: reason || 'Admin review', rejectedAt: new Date(), rejectedBy: req.admin.email } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ success: false, message: 'Payment not found or not pending' });
    res.json({ success: true, message: 'Loan payment rejected successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reject loan payment' });
  }
});

export default router;

