import { Router } from 'express';
import { users, donations, attendance, loans, savingsTransactions } from '../config/db.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

/* ================== GET ALL NOTIFICATIONS ================== */
// Builds a unified notification feed from donations, members, attendance, loans, savings
router.get('/notifications', authenticateAdmin, async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 50);

    const role = req.admin.role;

    // Fetch recent events in parallel, ONLY if the admin role requires them
    const promises = [
      role === 'admin' ? donations.find({}).sort({ createdAt: -1 }).limit(limit).toArray() : Promise.resolve([]),
      role === 'admin' ? users.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(limit).toArray() : Promise.resolve([]),
      role === 'admin' ? attendance.find({}).sort({ createdAt: -1 }).limit(limit).toArray() : Promise.resolve([]),
      role !== 'admin' ? loans.find({}).project({ loanId: 1, memberName: 1, amount: 1, purpose: 1, status: 1, statusHistory: 1, appliedDate: 1, approvedDate: 1, updatedAt: 1, rejectedDate: 1 }).sort({ appliedDate: -1 }).limit(limit).toArray() : Promise.resolve([]),
      role === 'loanAdmin' ? savingsTransactions.find({ type: 'deposit' }).sort({ date: -1 }).limit(limit).toArray() : Promise.resolve([]),
    ];

    const [recentDonations, recentMembers, recentAttendance, recentLoans, recentSavings] = await Promise.all(promises);

    const notifications = [];

    // Savings deposits → notification (Only for Loan Admin)
    if (req.admin.role === 'loanAdmin') {
      recentSavings.forEach(s => {
        notifications.push({
          id:        `savings-${s._id}`,
          type:      'savings',
          title:     'Savings deposit received',
          message:   `A deposit of ₱${Number(s.amount).toLocaleString()} was added to ${s.goalName || 'Savings Account'}.`,
          timestamp: s.date,
          isRead:    false,
          meta: {
            member: s.email,
            amount: s.amount,
          }
        });
      });
    }

    // Donations → notification (Only for Super Admin)
    if (req.admin.role === 'admin') {
      recentDonations.forEach(d => {
        const donorName = (d.member && d.member !== 'Member') ? d.member : d.email;
        notifications.push({
          id:        `donation-${d._id}`,
          type:      'donation',
          title:     'Donation received',
          message:   `${donorName} donated ₱${Number(d.amount).toLocaleString()} to ${d.category}.`,
          timestamp: d.createdAt || d.date,
          isRead:    false,
          meta: {
            donationId: d.donationId,
            member:     d.member,
            amount:     d.amount,
            category:   d.category,
            method:     d.method,
          }
        });
      });
    }

    // Members → notification (Only for Super Admin)
    if (req.admin.role === 'admin') {
      recentMembers.forEach(m => {
        notifications.push({
          id:        `member-${m._id}`,
          type:      'member',
          title:     'New member registered',
          message:   `${m.fullName} has been successfully registered as a new member.`,
          timestamp: m.createdAt,
          isRead:    false,
          meta: {
            memberId: m.memberId,
            name:     m.fullName,
            branch:   m.branch,
            position: m.position,
          }
        });
      });
    }

    // Attendance → notification (Only for Super Admin)
    if (req.admin.role === 'admin') {
      recentAttendance.forEach(a => {
        notifications.push({
          id:        `attendance-${a._id}`,
          type:      'attendance',
          title:     'Attendance check-in recorded',
          message:   `${a.member} checked in to ${a.service} at ${a.branch}.`,
          timestamp: a.createdAt,
          isRead:    false,
          meta: {
            recordId: a.recordId,
            member:   a.member,
            service:  a.service,
            branch:   a.branch,
            method:   a.method,
          }
        });
      });
    }

    // Loans → notification
    if (req.admin.role !== 'admin') {
      recentLoans.forEach(l => {
        const base = {
          type:      'loan',
          isRead:    false,
          meta: {
            loanId:     l.loanId,
            memberName: l.memberName,
            amount:     l.amount,
            purpose:    l.purpose,
            status:     l.status,
          }
        };

        if (l.statusHistory && l.statusHistory.length > 0) {
          l.statusHistory.forEach(history => {
            const hBase = { ...base, timestamp: history.date };
            let title, message;
            
            if (req.admin.role === 'loanAdmin') {
              if (history.status === 'pending') {
                title   = 'New loan application submitted';
                message = `${l.memberName} has submitted a loan application for ₱${Number(l.amount).toLocaleString()} for ${l.purpose} purposes.`;
                notifications.push({ ...hBase, id: `loan-pending-${l._id}`, title, message });
              } else if (history.status === 'approved') {
                title   = 'Loan application approved';
                message = `Loan ${l.loanId} for ${l.memberName} (₱${Number(l.amount).toLocaleString()}) has been approved.`;
                notifications.push({ ...hBase, id: `loan-approved-${l._id}`, title, message });
              } else if (history.status === 'rejected') {
                title   = 'Loan application rejected';
                message = `Loan ${l.loanId} for ${l.memberName} has been rejected.${history.reason ? ' Reason: ' + history.reason : ''}`;
                notifications.push({ ...hBase, id: `loan-rejected-${l._id}`, title, message });
              } else if (history.status === 'processed') {
                title   = 'Loan application processed';
                message = `Loan ${l.loanId} for ${l.memberName} has been disbursed by the secretary.`;
                notifications.push({ ...hBase, id: `loan-processed-${l._id}`, title, message });
              } else if (history.status === 'member_agreed') {
                title   = 'Proposed loan terms accepted';
                message = `${l.memberName} has accepted the proposed terms for loan ${l.loanId} (₱${Number(l.amount).toLocaleString()}).`;
                notifications.push({ ...hBase, id: `loan-agreed-${l._id}-${new Date(history.date).getTime()}`, title, message });
              } else if (history.status === 'member_declined') {
                title   = 'Proposed loan terms declined';
                message = `${l.memberName} declined the proposed terms for loan ${l.loanId}.${history.reason ? ' Reason: "' + history.reason + '"' : ''}`;
                notifications.push({ ...hBase, id: `loan-declined-${l._id}-${new Date(history.date).getTime()}`, title, message });
              }
            } else if (req.admin.role === 'secretaryAdmin') {
              if (history.status === 'approved') {
                title   = 'Loan approved and ready for processing';
                message = `Loan ${l.loanId} for ${l.memberName} (₱${Number(l.amount).toLocaleString()}) has been approved by the loan officer and is ready for disbursement.`;
                notifications.push({ ...hBase, id: `loan-approved-${l._id}`, title, message });
              } else if (history.status === 'processed') {
                title   = 'Loan disbursement completed';
                message = `Loan ${l.loanId} for ${l.memberName} (₱${Number(l.amount).toLocaleString()}) has been disbursed.`;
                notifications.push({ ...hBase, id: `loan-processed-${l._id}`, title, message });
              }
            }
          });
        } else {
          // Fallback for older loans without statusHistory array
          let title, message;
          if (l.status === 'pending' && req.admin.role === 'loanAdmin') {
            title   = 'New loan application submitted';
            message = `${l.memberName} has submitted a loan application for ₱${Number(l.amount).toLocaleString()}.`;
            notifications.push({ ...base, id: `loan-pending-${l._id}`, title, message, timestamp: l.appliedDate });
          } else if ((l.status === 'active' || l.status === 'completed') && (req.admin.role === 'loanAdmin' || req.admin.role === 'secretaryAdmin')) {
            title   = req.admin.role === 'secretaryAdmin' ? 'Loan approved and ready for processing' : 'Loan application approved';
            message = `Loan ${l.loanId} for ${l.memberName} has been approved.`;
            notifications.push({ ...base, id: `loan-approved-${l._id}`, title, message, timestamp: l.approvedDate || l.updatedAt });
          } else if (l.status === 'rejected' && req.admin.role === 'loanAdmin') {
            title   = 'Loan application rejected';
            message = `Loan ${l.loanId} for ${l.memberName} has been rejected.`;
            notifications.push({ ...base, id: `loan-rejected-${l._id}`, title, message, timestamp: l.rejectedDate || l.updatedAt });
          }
        }
      });
    }

    // Sort all by most recent
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json({
      success: true,
      notifications,
      readIds: req.admin.readNotifications || [],
      total: notifications.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

/* ================== MARK ADMIN NOTIFICATIONS AS READ ================== */
router.post('/notifications/read', authenticateAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    
    // Admins are stored in admins collection, and req.admin contains the auth
    const { admins } = await import('../config/db.js');
    await admins.updateOne(
      { email: req.admin.email },
      { $addToSet: { readNotifications: { $each: ids } } }
    );
    res.json({ success: true, message: 'Read state updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update read status' });
  }
});

export default router;