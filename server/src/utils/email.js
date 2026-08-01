import { Resend } from 'resend';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Resend with the API Key
const resend = new Resend(process.env.RESEND_API_KEY);

// Resend requires a verified sender domain. If you haven't verified a domain yet,
// 'onboarding@resend.dev' works for testing but ONLY to your own registered email address.
// If you have a verified domain, set RESEND_SENDER_EMAIL in your .env (e.g., info@yourdomain.com).
const senderEmail = process.env.RESEND_SENDER_EMAIL || 'noreply@puacfaithly.com';

export const generateOTP = () =>
  crypto.randomInt(100000, 1000000).toString();

export const sendOTP = async (email, otp, subject = 'Your Email Verification Code', title = 'Your OTP Code') => {
  // Console logging fallback (Only active in non-production environments to avoid leaking OTPs in prod logs)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n📧 ================================== 📧`);
    console.log(`✉️ DEV FALLBACK EMAIL OTP FOR ${email}: [ ${otp} ]`);
    console.log(`📧 ================================== 📧\n`);
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `FaithLy <${senderEmail}>`,
      to: [email],
      subject: subject,
      html: `<h2>${title}</h2><h1>${otp}</h1><p>Expires in 15 minutes</p>`,
    });

    if (error) {
      console.error('❌ Resend API Error:', error);
      return;
    }
    console.log(`✅ Email [${subject}] sent successfully: %s`, data.id);
  } catch (err) {
    console.error('❌ Email Exception:', err);
  }
};

export const sendEmailNotification = async (email, subject, htmlContent) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `FaithLy <${senderEmail}>`,
      to: [email],
      subject: subject,
      html: htmlContent,
    });
    
    if (error) {
      console.error('❌ Notification Email Error (Resend API):', error);
      return { success: false, error };
    }
    console.log(`✅ Notification Email [${subject}] sent successfully: %s`, data.id);
    return { success: true };
  } catch (err) {
    console.error('❌ Notification Email Exception:', err);
    return { success: false, error: err };
  }
};
