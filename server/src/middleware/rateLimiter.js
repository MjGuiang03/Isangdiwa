import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Increased for verification
  message: { message: 'Too many requests. Please slow down.' }
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Increased from 5 to avoid blocking user testing
  message: { message: 'Too many login attempts. Try again in 15 minutes.' }
});

export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many registration attempts. Please try again later.' }
});

export const emailCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many requests. Please try again later.' }
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip + '_' + (req.body.email ? req.body.email.toLowerCase() : ''),
  message: { message: 'Too many OTP attempts. Please try again later.' },
  validate: { keyGeneratorIpFallback: false }
});

export const resendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.ip + '_' + (req.body.email ? req.body.email.toLowerCase() : ''),
  message: { message: 'Too many resend requests. Please wait before trying again.' },
  validate: { keyGeneratorIpFallback: false }
});

export const resetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json({
      message: 'Too many requests. Please wait 15 minutes before trying again.',
      retryAfter: options.windowMs / 1000
    });
  }
});

export const resetVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json({
      message: 'Too many OTP attempts. Please wait 15 minutes before trying again.',
      retryAfter: options.windowMs / 1000
    });
  }
});

export const resetUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json({
      message: 'Too many password update attempts. Please wait 15 minutes before trying again.',
      retryAfter: options.windowMs / 1000
    });
  }
});