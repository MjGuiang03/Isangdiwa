import { Router } from 'express';
import { ObjectId } from 'mongodb';

import { users, verifications } from '../config/db.js';
import { authenticateUser } from '../middleware/auth.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

/* ================== USER - SUBMIT VERIFICATION ================== */
router.post('/verification/submit', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const { position } = req.body;

    if (!position) {
      return res.status(400).json({ success: false, message: 'Position is required' });
    }

    const user = await users.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.verificationStatus === 'verified') {
      return res.status(400).json({ success: false, message: 'You are already verified' });
    }

    const existing = await verifications.findOne({ email, status: 'pending' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You already have a pending verification request' });
    }

    await verifications.insertOne({
      email, memberName: user.fullName, position,
      status: 'pending',
      submittedAt: new Date(), updatedAt: new Date()
    });

    await users.updateOne({ email }, { $set: { verificationStatus: 'pending' } });
    res.status(201).json({ success: true, message: 'Verification request submitted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to submit verification' });
  }
});

/* ================== USER - GET VERIFICATION STATUS ================== */
const OFFICER_POSITIONS = [
  'Deacon','Local Evangelist','District Evangelist','National Evangelist',
  'Assistant Priest','Priest','Elder','District Elder',
  'Bishop','District Bishop','National Bishop','Apostle',
];

router.get('/verification/status', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const user  = await users.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Derive officer status from position field (single source of truth)
    const pos = (user.position || '').trim();
    const isOfficer = OFFICER_POSITIONS.some(p => p.toLowerCase() === pos.toLowerCase());
    const verificationStatus = isOfficer ? 'verified' : 'unverified';

    res.status(200).json({ success: true, verificationStatus, verification: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch verification status' });
  }
});

/* ================== ADMIN - GET ALL VERIFICATIONS ================== */
router.get('/admin/verifications', authenticateAdmin, async (req, res) => {
  try {
    const { status, position } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (position && position !== 'all') query.position = position;

    const allVerifications = await verifications.find(query).sort({ submittedAt: -1 }).toArray();
    const stats = {
      pending:  await verifications.countDocuments({ status: 'pending' }),
      approved: await verifications.countDocuments({ status: 'approved' }),
      rejected: await verifications.countDocuments({ status: 'rejected' }),
    };

    res.status(200).json({ success: true, verifications: allVerifications, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch verifications' });
  }
});

/* ================== ADMIN - APPROVE VERIFICATION ================== */
router.put('/admin/verifications/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const verification = await verifications.findOne({ _id: new ObjectId(id) });
    if (!verification) return res.status(404).json({ success: false, message: 'Verification not found' });

    await verifications.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'approved', reviewedAt: new Date(), updatedAt: new Date() } }
    );
    await users.updateOne(
      { email: verification.email }, 
      { $set: { verificationStatus: 'verified', position: verification.position } }
    );

    res.status(200).json({ success: true, message: 'Verification approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to approve verification' });
  }
});

/* ================== ADMIN - REJECT VERIFICATION ================== */
router.put('/admin/verifications/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const verification = await verifications.findOne({ _id: new ObjectId(id) });
    if (!verification) return res.status(404).json({ success: false, message: 'Verification not found' });

    await verifications.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'rejected', rejectionReason: reason || '', reviewedAt: new Date(), updatedAt: new Date() } }
    );
    await users.updateOne({ email: verification.email }, { $set: { verificationStatus: 'rejected' } });

    res.status(200).json({ success: true, message: 'Verification rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to reject verification' });
  }
});

export default router;