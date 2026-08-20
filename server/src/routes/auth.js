import { Router } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

import { users, admins, otps, pendingRegistrations, branches } from '../config/db.js';
import { validate } from '../middleware/validate.js';
import { loginLimiter, registerLimiter, otpLimiter, resendOtpLimiter } from '../middleware/rateLimiter.js';
import { authenticateUser } from '../middleware/auth.js';
import { generateOTP, sendOTP } from '../utils/email.js';

const router = Router();

/* ================== PUBLIC BRANCHES LIST ================== */
router.get('/public/branches', async (req, res) => {
  try {
    const list = await branches.find({ status: { $ne: 'Inactive' } }).sort({ name: 1 }).toArray();
    
    // Get member counts
    const userStats = await users.aggregate([
      { $group: { _id: "$branch", count: { $sum: 1 } } }
    ]).toArray();
    const statsMap = {};
    userStats.forEach(s => { if (s._id) statsMap[s._id] = s.count; });

    // Get officer counts
    const officerStats = await users.aggregate([
      { $match: { position: { $regex: /^(?!member$)/i } } },
      { $group: { _id: "$branch", count: { $sum: 1 } } }
    ]).toArray();
    const officerMap = {};
    officerStats.forEach(s => { if (s._id) officerMap[s._id] = s.count; });

    const enrichedList = list.map(b => ({
      ...b,
      members: statsMap[b.name] || 0,
      officers: officerMap[b.name] || 0
    }));

    res.json({ success: true, branches: enrichedList });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch branch list' });
  }
});
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}
const DUMMY_HASH = bcrypt.hashSync('dummy_secure_password_salt_xyz', 10);

/* ================== REGISTER ================== */
router.post('/register',
  registerLimiter,
  validate([
    body('fullName').trim().notEmpty().withMessage('Full name is required')
      .isLength({ max: 50 }).withMessage('Name too long')
      .matches(/^[A-Za-z\s]+$/).withMessage('Name must contain letters only'),
    body('email').trim().toLowerCase().notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .isLength({ max: 100 }).withMessage('Email too long'),
    body('phone').trim().notEmpty().withMessage('Phone is required')
      .matches(/^\+63\d{10}$/).withMessage('Phone must be in format +63XXXXXXXXXX'),
    body('password').notEmpty().withMessage('Password is required')
      .isLength({ min: 8, max: 64 }).withMessage('Password must be 8–64 characters')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a number')
      .matches(/[^A-Za-z0-9]/).withMessage('Password must contain a symbol'),
    body('birthday').notEmpty().withMessage('Birthday is required')
      .isISO8601().withMessage('Invalid date format'),
    body('churchId').optional().trim().isLength({ max: 20 }).withMessage('Church ID too long')
      .matches(/^[a-zA-Z0-9\-]*$/).withMessage('Church ID contains invalid characters'),
    body('branch').optional().trim().isLength({ max: 50 }),
    body('position').optional().trim().isLength({ max: 50 }),
    body('gender').optional().isIn(['male', 'female']).withMessage('Invalid gender value'),
  ]),
  async (req, res) => {
    try {
      console.log('📝 Registration payload:', req.body);
      const { email, password, fullName, phone, branch, position, gender, birthday, role, churchId } = req.body;

      // All new users start as Member — admin will assign officer positions manually
      const finalPosition = 'Member';

      const existingUser = await users.findOne({ email });
      if (existingUser) {
        console.log('ℹ️ Registration attempted on existing email. Returning generic success message.');
        return res.json({ message: 'Registration received. If your email is valid, you will receive an OTP shortly.' });
      }

      console.log('✅ Duplicate check passed.');

      // Check if there's an existing pending registration
      await pendingRegistrations.deleteOne({ email });
      console.log('✅ Old pending registration cleared.');

      const passwordHash = await bcrypt.hash(password, 10);
      await pendingRegistrations.insertOne({
        email, passwordHash, fullName, phone, branch, position: finalPosition,
        churchId: churchId || null, gender, birthday,
        isVerified: false, failedLoginAttempts: 0, lockUntil: null,
        isPermanentlyLocked: false, createdAt: new Date()
      });
      console.log('✅ New pending registration saved.');

      const otp = generateOTP();
      await otps.deleteMany({ email, type: 'verify' });
      await otps.insertOne({ email, otp, type: 'verify', expiresAt: new Date(Date.now() + 15 * 60 * 1000) });
      console.log('✅ OTP record saved.');

      // Send email asynchronously so it doesn't block the response.
      // If Render's free tier blocks the SMTP connection, the user can still proceed 
      // if the admin shares the fallback OTP logged in the console.
      sendOTP(email, otp).then(() => {
        console.log('✅ OTP email sent successfully.');
      }).catch(err => {
        console.error('❌ BACKGROUND EMAIL ERROR:', err.message);
      });

      res.json({ message: 'Registration received. If your email is valid, you will receive an OTP shortly.' });
    } catch (err) {
      console.error('❌ SIGNUP ERROR:', err.message);
      res.status(500).json({
        message: 'Server error during signup'
      });
    }
  }
);

/* ================== VERIFY EMAIL OTP ================== */
router.post('/verify-otp',
  otpLimiter,
  validate([
    body('email').trim().isEmail().withMessage('Invalid email'),
    body('otp').trim().matches(/^\d{6}$/).withMessage('OTP must be 6 digits'),
  ]),
  async (req, res) => {
    try {
      const { email, otp } = req.body;
      const record = await otps.findOne({ email, otp, type: 'verify', expiresAt: { $gt: new Date() } });

      if (!record) return res.status(400).json({ message: 'Invalid or expired OTP' });

      // Find from pending
      const pendingData = await pendingRegistrations.findOne({ email });
      if (!pendingData) {
        // Double check if already verified moved to users
        const alreadyVerified = await users.findOne({ email });
        if (alreadyVerified) return res.json({ message: 'Email already verified' });
        return res.status(400).json({ message: 'No registration data found for this email' });
      }

      // Move to users
      await users.insertOne({
        ...pendingData,
        isVerified: true,
        verifiedAt: new Date()
      });

      // Cleanup
      await pendingRegistrations.deleteOne({ email });
      await otps.deleteMany({ email, type: 'verify' });

      res.json({ message: 'Email verified successfully' });
    } catch (err) {
      console.error('[AUTH_ERROR] Verify OTP:', err.message);
      res.status(500).json({ message: 'Verification failed' });
    }
  }
);

/* ================== RESEND OTP ================== */
router.post('/resend-otp',
  resendOtpLimiter,
  validate([
    body('email').trim().isEmail().withMessage('Invalid email')
  ]),
  async (req, res) => {
    try {
      const { email } = req.body;

      const user = await users.findOne({ email });
      if (user && user.isVerified) return res.status(400).json({ message: 'Email already verified' });

      const pending = await pendingRegistrations.findOne({ email });
      if (!pending && !user) return res.status(400).json({ message: 'Invalid request or registration expired' });

      const targetData = user || pending;
      const phoneNumber = targetData.phone;

      const otp = generateOTP();
      await otps.deleteMany({ email, type: 'verify' });
      await otps.insertOne({ email, otp, type: 'verify', expiresAt: new Date(Date.now() + 15 * 60 * 1000) });

      // Send Email
      sendOTP(email, otp).then(() => {
        console.log('✅ Email OTP resent successfully.');
      }).catch(err => {
        console.error('❌ BACKGROUND EMAIL ERROR:', err.message);
      });

      res.json({ message: 'OTP resent successfully. Check your email.' });
    } catch (err) {
      console.error('[AUTH_ERROR] Resend OTP:', err.message);
      res.status(500).json({ message: 'Failed to resend OTP' });
    }
  }
);

/* ================== UNIFIED LOGIN (Users + Admins) ================== */
router.post('/login',
  loginLimiter,
  validate([
    body('email').trim().isEmail().withMessage('Invalid email'),
    body('password').notEmpty().withMessage('Password is required')
  ]),
  async (req, res) => {
    try {
      const email = req.body.email?.trim().toLowerCase();
      const { password } = req.body;

      /* ---- 1. Fetch Concurrently (Timing Mitigation) ---- */
      // Use case-insensitive regex to handle legacy accounts with mixed-case emails
      const emailRegex = new RegExp(`^${email}$`, 'i');
      const [admin, user] = await Promise.all([
        admins.findOne({ email: emailRegex }),
        users.findOne({ email: emailRegex })
      ]);
      const account = admin || user;
      const isAdminType = !!admin;

      /* ---- 2. Timing-Safe Password Check ---- */
      const targetHash = account ? account.passwordHash : DUMMY_HASH;
      const match = await bcrypt.compare(password, targetHash);

      /* ---- 3. Normalize Failure Responses ---- */
      if (!account || !match || account.isDeleted) {
        if (account && !isAdminType) {
          const now = new Date();
          // Only increment/lock if not actively locked
          if (!account.lockUntil || account.lockUntil < now) {
            const attempts = (account.failedLoginAttempts || 0) + 1;
            const updateData = { failedLoginAttempts: attempts };

            if (attempts >= 8) updateData.lockUntil = new Date(now.getTime() + 5 * 60 * 60 * 1000); // 5h
            else if (attempts === 7) updateData.lockUntil = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2h
            else if (attempts === 6) updateData.lockUntil = new Date(now.getTime() + 30 * 60 * 1000); // 30m
            else if (attempts === 3) updateData.lockUntil = new Date(now.getTime() + 5 * 60 * 1000); // 5m

            await users.updateOne({ email }, { $set: updateData });
          }
        }
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      /* ---- 4. Check Statuses for Valid Authenticated Users ---- */
      const now = new Date();
      if (!isAdminType) {
        if (account.lockUntil && account.lockUntil > now) {
          const remainingMinutes = Math.ceil((account.lockUntil - now) / 60000);
          return res.status(401).json({
            message: `Account is temporarily locked due to previous failed attempts. Try again in ${remainingMinutes} minute(s). We strongly recommend resetting your password.`
          });
        }
      } // End of if (!isAdminType)

      // Reset tracking on successful clean login for user, and reset for admin too just in case
      if (isAdminType) {
        await admins.updateOne({ email }, {
          $set: { lastLoginAt: now, failedLoginAttempts: 0, lockUntil: null }
        });
      } else {
        await users.updateOne({ email }, {
          $set: { lastLoginAt: now, failedLoginAttempts: 0, lockUntil: null, isPermanentlyLocked: false }
        });
      }

      /* ---- 5. Issue Token & Normalize Roles ---- */
      let role = isAdminType ? account.role : 'user';

      // Normalize internal role names to match frontend expectations
      if (role === 'loan') role = 'loanAdmin';
      if (role === 'secretary') role = 'secretaryAdmin';

      const audience = isAdminType ? 'faithly-admin' : 'faithly-users';

      const token = jwt.sign(
        { email: account.email, role },
        JWT_SECRET,
        { expiresIn: isAdminType ? '2h' : '1h', issuer: 'faithly-api', audience }
      );

      res.status(200).json({
        message: 'Login successful',
        token,
        user: isAdminType
          ? {
              email: account.email, role: account.role,
              fullName: account.fullName || account.email.split('@')[0]
            }
          : {
              email: account.email, fullName: account.fullName, full_name: account.fullName,
              phone: account.phone, branch: account.branch, position: account.position,
              churchId: account.churchId || null,
              gender: account.gender, birthday: account.birthday, created_at: account.createdAt,
              role: 'user'
            }
      });
    } catch (err) {
      console.error('[AUTH_ERROR] Login:', err.message);
      res.status(500).json({ message: 'Login failed' });
    }
  }
);

/* ================== DELETE ACCOUNT (SOFT DELETE) ================== */
router.delete('/delete-account', authenticateUser, async (req, res) => {
  try {
    const email = req.user.email;
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const user = await users.findOne({ email });
    const targetHash = user ? user.passwordHash : DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(password, targetHash);

    if (!user || user.isDeleted || !isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid request or credentials' });
    }

    await users.updateOne({ email }, { $set: { isDeleted: true, deletedAt: new Date() } });
    res.status(200).json({ success: true, message: 'Account deactivated successfully' });
  } catch (err) {
    console.error('[AUTH_ERROR] Delete Account:', err.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
});

export default router;