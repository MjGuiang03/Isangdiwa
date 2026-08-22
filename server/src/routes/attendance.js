import { Router } from 'express';

import { users, attendance, attendanceSessions } from '../config/db.js';
import { authenticateUser } from '../middleware/auth.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

/* ================== ADMIN - SESSIONS ================== */

// Start a new session
router.post('/admin/attendance/sessions/start', authenticateAdmin, async (req, res) => {
  try {
    const { branch, serviceType, date, time, gracePeriod } = req.body;
    
    if (!branch || !serviceType || !date || !time) {
      return res.status(400).json({ success: false, message: 'Branch, Service Type, Date, and Time are required' });
    }

    // Check if there is already an active session for this branch/service
    const active = await attendanceSessions.findOne({ branch, serviceType, status: 'active' });
    if (active) {
       return res.status(400).json({ success: false, message: 'There is already an active session for this branch and service type.' });
    }

    // Generate a unique session ID using timestamp (avoids slow countDocuments on cold connections)
    const now = new Date();
    const ts = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    const sessionId = `SESS-${now.getFullYear()}-${ts.slice(4)}`;
    
    // Parse the start time properly to compute grace period exactly.
    // Assuming date is YYYY-MM-DD and time is HH:mm
    const startDateTimeStr = `${date}T${time}:00`;
    const startDateTime = new Date(startDateTimeStr);

    if (isNaN(startDateTime.getTime())) {
         return res.status(400).json({ success: false, message: 'Invalid Date/Time format provided.' });
    }

    const grace = parseInt(gracePeriod) || 0; // standard 0 grace minutes
    
    const newSession = {
      sessionId,
      branch,
      serviceType,
      date,
      time,
      startDateTime,
      gracePeriodMinutes: grace,
      status: 'active',
      startedAt: now,
      startedBy: req.admin.email,
      endedAt: null,
      stats: { total: 0, present: 0, late: 0, absent: 0 }
    };

    const run = await attendanceSessions.insertOne(newSession);

    res.status(201).json({ success: true, message: 'Session started successfully', session: { ...newSession, _id: run.insertedId } });
  } catch (err) {
    console.error('[Session Start Error]:', err.name, err.message, err.stack);
    res.status(500).json({ success: false, message: 'Failed to start session: ' + (err.message || 'Unknown error') });
  }
});

// End an active session
router.post('/admin/attendance/sessions/:id/end', authenticateAdmin, async (req, res) => {
  try {
    const { ObjectId } = await import('mongodb');
    const sessionId = req.params.id; // Expecting the friendly SESS- id or Object ID

    let query = {};
    if (sessionId.startsWith('SESS-')) {
       query = { sessionId, status: 'active' };
    } else {
       query = { _id: new ObjectId(sessionId), status: 'active' };
    }

    const session = await attendanceSessions.findOne(query);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Active session not found' });
    }

    // 1. End the session
    await attendanceSessions.updateOne(
       { _id: session._id },
       { $set: { status: 'ended', endedAt: new Date() } }
    );

    // 2. Mark all other registered members of this branch as ABSENT
    // Get all members for this branch
    const branchMembers = await users.find({ branch: session.branch, isDeleted: { $ne: true } }).toArray();
    
    // Get all who checked in this session
    const checkedIn = await attendance.find({ sessionId: session.sessionId }).toArray();
    const checkedInEmails = new Set(checkedIn.map(a => a.email));

    const absentees = branchMembers.filter(m => !checkedInEmails.has(m.email));
    
    const now = new Date();
    // Use the session's configured date for the attendance record
    const sessionDate = session.startDateTime || new Date(`${session.date}T${session.time || '00:00'}:00`);
    const count = await attendance.countDocuments();
    let absRecords = [];
    
    absentees.forEach((m, idx) => {
        absRecords.push({
            recordId: `A-${now.getFullYear()}-${String(count + idx + 1).padStart(5, '0')}`,
            sessionId: session.sessionId,
            email: m.email,
            member: m.fullName || m.name,
            service: session.serviceType,
            branch: session.branch,
            method: 'None',
            status: 'Absent',
            date: sessionDate.toLocaleDateString('en-US'),
            time: '--:--',
            createdAt: sessionDate,
            rfidCardId: m.rfidCardId || null
        });
    });

    if (absRecords.length > 0) {
        await attendance.insertMany(absRecords);
    }
    
    // Update session stats
    const updatedPres = await attendance.countDocuments({ sessionId: session.sessionId, status: 'Present' });
    const updatedLate = await attendance.countDocuments({ sessionId: session.sessionId, status: 'Late' });
    const updatedAbs = await attendance.countDocuments({ sessionId: session.sessionId, status: 'Absent' });

    await attendanceSessions.updateOne(
        { _id: session._id },
        { $set: { stats: { total: updatedPres + updatedLate + updatedAbs, present: updatedPres, late: updatedLate, absent: updatedAbs } } }
    );

    res.status(200).json({ success: true, message: 'Session ended successfully', stats: { total: updatedPres + updatedLate + updatedAbs, present: updatedPres, late: updatedLate, absent: updatedAbs } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to end session' });
  }
});

// Get active sessions
router.get('/admin/attendance/sessions/active', authenticateAdmin, async (req, res) => {
    try {
       const sessions = await attendanceSessions.find({ status: 'active' }).toArray();
       res.status(200).json({ success: true, sessions });
    } catch (err) {
       console.error(err);
       res.status(500).json({ success: false, message: 'Failed to fetch active sessions' });
    }
});

// Get historical sessions (ended)
router.get('/admin/attendance/sessions/history', authenticateAdmin, async (req, res) => {
    try {
       const page = parseInt(req.query.page) || 1;
       const limit = parseInt(req.query.limit) || 10;
       const skip = (page - 1) * limit;

       const query = { status: 'ended' };
       const totalCount = await attendanceSessions.countDocuments(query);
       const sessions = await attendanceSessions.find(query)
           .sort({ startedAt: -1 }) // Newest first
           .skip(skip)
           .limit(limit)
           .toArray();

       res.status(200).json({ 
           success: true, 
           sessions, 
           totalCount, 
           totalPages: Math.ceil(totalCount / limit), 
           currentPage: page 
       });
    } catch (err) {
       console.error(err);
       res.status(500).json({ success: false, message: 'Failed to fetch session history' });
    }
});


/* ================== RECORD / LOG TAP ================== */
router.post('/admin/attendance/log-tap', authenticateAdmin, async (req, res) => {
  try {
     const { cardId, minLevelSessionId, method } = req.body;
     
     if (!cardId && method !== 'Manual') {
         return res.status(400).json({ success: false, message: 'RFID Data required' });
     }

     if (!minLevelSessionId) {
         return res.status(400).json({ success: false, message: 'Session required to log attendance' });
     }

     // Find the session
     const session = await attendanceSessions.findOne({ sessionId: minLevelSessionId, status: 'active' });
     if (!session) {
         return res.status(404).json({ success: false, message: 'Active session not found' });
     }

     // Find user
     let user = null;
     let resolvedMethod = method || 'RFID';
     if (method === 'Manual') {
        const { memberId } = req.body;
        if (!memberId) return res.status(400).json({ success: false, message: 'Member ID required for manual entry' });
        user = await users.findOne({ memberId });
     } else if (cardId && typeof cardId === 'string' && cardId.includes('@')) {
        // Mobile QR code contains user's email address
        user = await users.findOne({ email: cardId.trim().toLowerCase() });
        resolvedMethod = 'QR Scan';
     } else {
        user = await users.findOne({ rfidCardId: cardId });
     }

     if (!user) {
         return res.status(404).json({ success: false, message: 'User not found / Unregistered Card' });
     }

     // Check if they already checked in to THIS session
     const existing = await attendance.findOne({ sessionId: session.sessionId, email: user.email });
     if (existing) {
          // Send back green success still, but message "already clocked in"
         return res.status(200).json({ success: true, alreadyLogged: true, message: 'Already recorded for this session', user: { name: user.fullName || user.name, branch: user.branch, profilePicture: user.profilePicture } });
     }

     const now = new Date();
      // Use the session's configured date for the attendance record
      const sessionDate = session.startDateTime || new Date(`${session.date}T${session.time || '00:00'}:00`);
      
      // Determine Present vs Late
      // If the check-in is past the start time + grace period
      const startPlusGrace = new Date(session.startDateTime.getTime() + (session.gracePeriodMinutes * 60000));
      const isLate = now > startPlusGrace;
      const status = isLate ? 'Late' : 'Present';

     const count = await attendance.countDocuments();
      const recordId = `A-${now.getFullYear()}-${String(count + 1).padStart(5, '0')}`;

     const newRecord = {
          recordId, 
          sessionId: session.sessionId,
          email: user.email, 
          member: user.fullName || user.name, 
          service: session.serviceType, 
          branch: session.branch, // record the session's branch, even if user is from another
          userBranch: user.branch,
          method: resolvedMethod,
          rfidCardId: user.rfidCardId || cardId || null,
          status,
          date: sessionDate.toLocaleDateString('en-US'),
          time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          createdAt: sessionDate
      };

     await attendance.insertOne(newRecord);

     res.status(201).json({ success: true, message: `Checked in as ${status}`, record: newRecord, user: { name: user.fullName || user.name, branch: user.branch, profilePicture: user.profilePicture, status: status } });

  } catch(err) {
     console.error(err);
     res.status(500).json({ success: false, message: 'Failed to record tap' });
  }
});


/* ================== ADMIN - GET ALL ATTENDANCE W/ STATS ================== */
router.get('/admin/attendance', authenticateAdmin, async (req, res) => {
  try {
    const { search, service, branch, status, session } = req.query;
    const page  = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const query = {};
    if (service) query.service = service;
    if (branch && branch !== 'all')  query.branch  = branch;
    if (status && status !== 'all')  query.status  = status;
    if (session) query.sessionId = session;
    if (search) {
      query.$or = [
        { member:   { $regex: search, $options: 'i' } },
        { recordId: { $regex: search, $options: 'i' } },
        { rfidCardId: { $regex: search, $options: 'i'} }
      ];
    }

    const totalCount = await attendance.countDocuments(query);
    const allAttendance = await attendance.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-US');

    // Stats calculations
    // 1. Total attendance today (Pres + Late)
    const totalToday = await attendance.countDocuments({ 
        date: todayStr, 
        status: { $in: ['Present', 'Late'] } 
    });

    const lateToday = await attendance.countDocuments({
        date: todayStr,
        status: 'Late'
    });

    // 2. Services this week (Sessions started this week)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const servicesThisWeek = await attendanceSessions.countDocuments({
        startedAt: { $gte: oneWeekAgo }
    });

    // 3. Average Attendance per Session (from stats, over past 30 days)
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentSessions = await attendanceSessions.find({
        startedAt: { $gte: oneMonthAgo },
        status: 'ended' // Only ended sessions have final valid stats
    }).toArray();

    let totalRecentAttenders = 0;
    recentSessions.forEach(s => {
        totalRecentAttenders += (s.stats.present + s.stats.late);
    });

    const avgAttendance = recentSessions.length > 0 ? Math.round(totalRecentAttenders / recentSessions.length) : 0;

    res.status(200).json({
      success: true,
      attendance: allAttendance,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      stats: { 
          totalToday, 
          servicesThisWeek,
          avgAttendance,
          lateToday
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch attendance' });
  }
});

/* ================== CHECK USER RFID EXISTS ================== */
router.post('/admin/attendance/check-card', authenticateAdmin, async (req, res) => {
     try {
         const { cardId } = req.body;
         const user = await users.findOne({ rfidCardId: cardId });
         if (user) {
              return res.status(200).json({ success: true, user: { name: user.fullName, memberId: user.memberId } });
         } else {
              return res.status(200).json({ success: false, message: 'Card not registered' });
         }
     } catch (err) {
         res.status(500).json({ success: false });
     }
});

/* ================== USER - SCAN QR TO CHECK IN ================== */
router.post('/attendance/scan-qr', authenticateUser, async (req, res) => {
  try {
     const { sessionId } = req.body;
     
     if (!sessionId) {
         return res.status(400).json({ success: false, message: 'Session ID is required.' });
     }

     // Find the active session
     const session = await attendanceSessions.findOne({ sessionId: sessionId, status: 'active' });
     if (!session) {
         return res.status(404).json({ success: false, message: 'Active session not found or has ended.' });
     }

     let user = await users.findOne({ email: req.user.email });
     if (!user) {
         // Also check admins collection in case an admin is testing the feature
         const { admins } = await import('../config/db.js');
         user = await admins.findOne({ email: req.user.email });
         if (!user) {
             return res.status(404).json({ success: false, message: 'User not found.' });
         }
     }

     // Check if they already checked in to THIS session
     const existing = await attendance.findOne({ sessionId: session.sessionId, email: user.email });
     if (existing) {
         return res.status(200).json({ success: true, alreadyLogged: true, message: 'You have already checked in for this session.' });
     }

      const now = new Date();
      // Use the session's configured date for the attendance record
      const sessionDate = session.startDateTime || new Date(`${session.date}T${session.time || '00:00'}:00`);
      
      // Determine Present vs Late
      const startPlusGrace = new Date(session.startDateTime.getTime() + (session.gracePeriodMinutes * 60000));
      const isLate = now > startPlusGrace;
      const status = isLate ? 'Late' : 'Present';

     const count = await attendance.countDocuments();
      const recordId = `A-${now.getFullYear()}-${String(count + 1).padStart(5, '0')}`;

     const newRecord = {
          recordId, 
          sessionId: session.sessionId,
          email: user.email, 
          member: user.fullName || user.name, 
          service: session.serviceType, 
          branch: session.branch,
          userBranch: user.branch,
          method: 'QR Scan',
          rfidCardId: user.rfidCardId || null,
          status,
          date: sessionDate.toLocaleDateString('en-US'),
          time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          createdAt: sessionDate
      };

     await attendance.insertOne(newRecord);

     // Update stats dynamically if needed, but the admin end-session script calculates totals at the end.
     res.status(201).json({ success: true, message: `Checked in as ${status} successfully!` });

  } catch(err) {
     console.error(err);
     res.status(500).json({ success: false, message: 'Failed to record check-in.' });
  }
});

/* ================== USER - GET MY ATTENDANCE ================== */
router.get('/attendance/my-attendance', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const page  = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const query = { email };

    const totalCount = await attendance.countDocuments(query);
    const myAttendance = await attendance.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Stats
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const allMyAttendance = await attendance.find(query).toArray();
    
    let thisMonthCount = 0;
    allMyAttendance.forEach(record => {
      const d = record.createdAt ? new Date(record.createdAt) : new Date(record.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        thisMonthCount++;
      }
    });

    res.status(200).json({
      success: true,
      attendance: myAttendance,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      stats: { 
          total: totalCount, 
          thisMonth: thisMonthCount 
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance' });
  }
});

/* ================== USER - GET VISITED BRANCHES STATS ================== */
router.get('/attendance/visited-stats', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const records = await attendance.find({
      email,
      status: { $in: ['Present', 'Late'] }
    }).toArray();

    const visited = {};
    records.forEach(r => {
      const bName = r.branch;
      if (!bName) return;
      if (!visited[bName]) {
        visited[bName] = {
          count: 0,
          lastVisited: null,
          lastVisitedRaw: null,
          history: []
        };
      }
      visited[bName].count += 1;
      
      const recordDate = r.createdAt ? new Date(r.createdAt) : new Date(r.date);
      if (!visited[bName].lastVisitedRaw || recordDate > visited[bName].lastVisitedRaw) {
        visited[bName].lastVisitedRaw = recordDate;
        visited[bName].lastVisited = r.date || recordDate.toLocaleDateString('en-US');
      }

      visited[bName].history.push({
        date: r.date,
        time: r.time || '--:--',
        service: r.service || 'Service',
        method: r.method || 'None',
        status: r.status,
        timestamp: recordDate.getTime()
      });
    });

    // Sort history by date/timestamp descending and clean up
    Object.keys(visited).forEach(bName => {
      delete visited[bName].lastVisitedRaw;
      visited[bName].history.sort((a, b) => b.timestamp - a.timestamp);
      visited[bName].history.forEach(item => {
        delete item.timestamp;
      });
    });

    res.status(200).json({
      success: true,
      visited
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch visited stats' });
  }
});

export default router;