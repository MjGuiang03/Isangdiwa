import { Router } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

import { users, otps } from '../config/db.js';
import { validate } from '../middleware/validate.js';
import { resetRequestLimiter, resetVerifyLimiter, resetUpdateLimiter } from '../middleware/rateLimiter.js';
import { sendOTP, generateOTP } from '../utils/email.js';

const router = Router();

/* ── Daily limit constants ────────────────────────────────────────────── */
const DAILY_OTP_LIMIT = 3;          // max OTP send requests per email per day
const DAILY_RESET_LIMIT = 1;        // max successful password changes per email per day

/* ── Helper: get start of today (server time) ─────────────────────────── */
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ── Helper: check daily OTP send limit for an email ──────────────────── */
async function checkDailyOtpLimit(email) {
  const user = await users.findOne({ email });
  if (!user) return { allowed: true, remaining: DAILY_OTP_LIMIT };

  const today = startOfToday();
  const count = user.dailyResetOtpCount || 0;
  const lastDate = user.dailyResetOtpDate ? new Date(user.dailyResetOtpDate) : null;

  // If the stored date is before today, the counter has expired → reset
  if (!lastDate || lastDate < today) {
    return { allowed: true, remaining: DAILY_OTP_LIMIT };
  }

  // Same day — check the count
  if (count >= DAILY_OTP_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: DAILY_OTP_LIMIT - count };
}

/* ── Helper: increment daily OTP counter ──────────────────────────────── */
async function incrementDailyOtpCount(email) {
  const today = startOfToday();
  const user = await users.findOne({ email });
  const lastDate = user?.dailyResetOtpDate ? new Date(user.dailyResetOtpDate) : null;

  if (!lastDate || lastDate < today) {
    // New day → reset counter to 1
    await users.updateOne({ email }, {
      $set: { dailyResetOtpCount: 1, dailyResetOtpDate: new Date() }
    });
  } else {
    // Same day → increment
    await users.updateOne({ email }, {
      $inc: { dailyResetOtpCount: 1 },
      $set: { dailyResetOtpDate: new Date() }
    });
  }
}

/* ── Helper: check daily password change limit ────────────────────────── */
async function checkDailyResetLimit(email) {
  const user = await users.findOne({ email });
  if (!user) return { allowed: true };

  const today = startOfToday();
  const lastChange = user.lastPasswordChangeAt ? new Date(user.lastPasswordChangeAt) : null;

  if (lastChange && lastChange >= today) {
    return { allowed: false };
  }

  return { allowed: true };
}


/* ================== REQUEST OTP ================== */
router.post('/reset-password-request',
  resetRequestLimiter,                // Layer 1: IP-based rate limit (5 per 15 min)
  validate([body('email').trim().isEmail().withMessage('Invalid email')]),
  async (req, res) => {
    try {
      const { email } = req.body;
      const user = await users.findOne({ email });
      if (!user) return res.status(400).json({ message: 'Invalid credentials' });

      // Layer 2: Per-email daily limit
      const { allowed, remaining } = await checkDailyOtpLimit(email);
      if (!allowed) {
        return res.status(429).json({
          message: 'For security reasons, password reset requests are limited. Please try again tomorrow.',
          dailyLimitReached: true
        });
      }

      const otp = generateOTP();
      await otps.deleteMany({ email, type: 'reset-password' });
      await otps.insertOne({ email, otp, type: 'reset-password', expiresAt: new Date(Date.now() + 15 * 60 * 1000) });

      await sendOTP(email, otp, 'Password Reset Code', 'Password Reset OTP');

      // Increment the daily counter after successful send
      await incrementDailyOtpCount(email);

      res.json({
        message: 'OTP sent to your email',
        remainingAttempts: remaining - 1
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Failed to send OTP' });
    }
  }
);

/* ================== VERIFY OTP ================== */
router.post('/reset-password-verify-otp',
  resetVerifyLimiter,                 // Layer 1: IP-based rate limit (10 per 15 min)
  validate([
    body('email').trim().isEmail().withMessage('Invalid email'),
    body('otp').trim().matches(/^\d{6}$/).withMessage('OTP must be 6 digits'),
  ]),
  async (req, res) => {
    try {
      const { email, otp } = req.body;
      const record = await otps.findOne({ email, otp, type: 'reset-password', expiresAt: { $gt: new Date() } });
      if (!record) return res.status(400).json({ message: 'Invalid or expired OTP' });

      res.json({ message: 'OTP verified successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Verification failed' });
    }
  }
);

/* ================== UPDATE PASSWORD ================== */
router.post('/reset-password-update',
  resetUpdateLimiter,                 // Layer 1: IP-based rate limit (10 per 15 min)
  validate([
    body('email').trim().isEmail().withMessage('Invalid email'),
    body('otp').trim().matches(/^\d{6}$/).withMessage('OTP must be 6 digits'),
    body('newPassword')
      .isLength({ min: 8, max: 64 }).withMessage('Password must be 8–64 characters')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a number')
      .matches(/[^A-Za-z0-9]/).withMessage('Password must contain a symbol'),
  ]),
  async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;

      // Layer 2: Per-email daily password change limit
      const { allowed } = await checkDailyResetLimit(email);
      if (!allowed) {
        return res.status(429).json({
          message: 'For security reasons, password updates are limited to once per day. Please try again tomorrow.',
          dailyLimitReached: true
        });
      }

      const record = await otps.findOne({ email, otp, type: 'reset-password', expiresAt: { $gt: new Date() } });
      if (!record) return res.status(400).json({ message: 'Invalid or expired OTP' });

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await users.updateOne({ email }, {
        $set: {
          passwordHash,
          failedLoginAttempts: 0,
          lockUntil: null,
          isPermanentlyLocked: false,
          lastPasswordChangeAt: new Date()    // Track for daily limit
        }
      });
      await otps.deleteMany({ email, type: 'reset-password' });

      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Failed to update password' });
    }
  }
);

export default router;