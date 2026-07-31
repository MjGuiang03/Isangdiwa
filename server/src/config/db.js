import { MongoClient } from 'mongodb';
import dns from 'dns';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

// Force Google DNS to resolve MongoDB SRV records (fixes Render ETIMEOUT issues)
if (process.env.RENDER) {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}
dns.setDefaultResultOrder('ipv4first'); // Fixes Node 18+ IPv6 timeout issues

// Validate environment variables
const requiredEnv = ['MONGODB_URL', 'DB_NAME', 'JWT_SECRET'];
requiredEnv.forEach(env => {
  if (!process.env[env]) {
    console.error(`❌ CRITICAL ERROR: Environment variable "${env}" is missing.`);
    process.exit(1);
  }
});

let client;
const MAX_RETRIES = 3;
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    const options = process.env.RENDER ? {
      serverSelectionTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      socketTimeoutMS: 300000, // 5 minutes (prevent premature timeout on large queries)
      maxPoolSize: 50,
      minPoolSize: 5,
      maxIdleTimeMS: 10000, // Proactively close idle connections to prevent Render LB from silently dropping them
      family: 4,
      retryReads: true,
      retryWrites: true,
    } : {};
    client = new MongoClient(process.env.MONGODB_URL, options);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    break;
  } catch (error) {
    console.error(`❌ MongoDB Connection Attempt ${attempt}/${MAX_RETRIES} failed:`, error.message);
    if (attempt === MAX_RETRIES) {
      console.error('❌ All connection attempts exhausted. Exiting.');
      process.exit(1);
    }
    console.log(`⏳ Retrying in 3 seconds...`);
    await new Promise(r => setTimeout(r, 3000));
  }
}

const db = client.db(process.env.DB_NAME);

export const users         = db.collection('users');
export const otps          = db.collection('otps');
export const admins        = db.collection('admins');
export const loans         = db.collection('loans');
export const donations     = db.collection('donations');
export const attendance    = db.collection('attendance');
export const verifications       = db.collection('verifications');
export const pendingRegistrations = db.collection('pending_registrations');
export const announcements      = db.collection('announcements');
export const savingsGoals       = db.collection('savings_goals');
export const savingsTransactions = db.collection('savings_transactions');
export const loanPayments        = db.collection('loan_payments');
export const attendanceSessions  = db.collection('attendance_sessions');
export const prayers             = db.collection('prayers');
export const settings            = db.collection('settings');
export const reportCache         = db.collection('reportCache');
export const branches            = db.collection('branches');
export const counters            = db.collection('counters');


/* ================== DATABASE INDEXES (non-fatal) ================== */
try {
  await Promise.allSettled([
    users.createIndex({ email: 1 }, { unique: true }),
    users.createIndex({ fullName: 1 }),
    users.createIndex({ memberId: 1 }),
    users.createIndex({ rfidCardId: 1 }, { sparse: true }),
    users.createIndex({ createdAt: -1 }),
    otps.createIndex({ email: 1 }),
    otps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    loans.createIndex({ email: 1 }),
    loans.createIndex({ loanId: 1 }),
    loans.createIndex({ memberName: 1 }),
    loans.createIndex({ appliedDate: -1 }),
    attendance.createIndex({ email: 1 }),
    attendance.createIndex({ member: 1 }),
    attendance.createIndex({ recordId: 1 }),
    attendance.createIndex({ service: 1 }),
    attendance.createIndex({ sessionId: 1 }),
    attendance.createIndex({ createdAt: -1 }),
    attendanceSessions.createIndex({ branch: 1, status: 1 }),
    verifications.createIndex({ email: 1 }),
    donations.createIndex({ email: 1 }),
    donations.createIndex({ member: 1 }),
    donations.createIndex({ donationId: 1 }),
    donations.createIndex({ category: 1 }),
    donations.createIndex({ createdAt: -1 }),
    pendingRegistrations.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 }),
    pendingRegistrations.createIndex({ email: 1 }, { unique: true }),
    announcements.createIndex({ createdAt: -1 }),
    savingsGoals.createIndex({ email: 1 }),
    savingsTransactions.createIndex({ email: 1 }),
    savingsTransactions.createIndex({ date: -1 }),
    savingsTransactions.createIndex({ email: 1, type: 1, status: 1, date: -1 }),
    prayers.createIndex({ createdAt: 1 }, { expireAfterSeconds: 604800 }),
  ]);
  console.log('✅ Database indexes ensured');
} catch (err) {
  console.warn('⚠️ Some indexes may not have been created:', err.message);
}


/* ================== CREATE DEFAULT ADMINS (non-fatal) ================== */
try {
  const adminSeeds = [
    { email: process.env.ADMIN_EMAIL,           password: process.env.ADMIN_PASS,           role: 'admin' },
    { email: process.env.LOAN_ADMIN_EMAIL,      password: process.env.LOAN_ADMIN_PASS,      role: 'loanAdmin' },
    { email: process.env.SECRETARY_ADMIN_EMAIL, password: process.env.SECRETARY_ADMIN_PASS, role: 'secretaryAdmin' },
  ];

  for (const seed of adminSeeds) {
    if (!seed.email || !seed.password) continue;
    const exists = await admins.findOne({ email: seed.email });
    if (!exists) {
      const hash = await bcrypt.hash(seed.password, 12);
      await admins.insertOne({
        email: seed.email,
        passwordHash: hash,
        role: seed.role,
        createdAt: new Date()
      });
      console.log(`✅ ${seed.role} admin created (${seed.email})`);
    } else {
      // Ensure password matches environment variable
      const match = await bcrypt.compare(seed.password, exists.passwordHash);
      if (!match) {
        const hash = await bcrypt.hash(seed.password, 12);
        await admins.updateOne(
          { email: seed.email },
          { $set: { passwordHash: hash, updatedAt: new Date() } }
        );
        console.log(`🔄 ${seed.role} admin password updated to match environment variable`);
      }
    }
  }
} catch (err) {
  console.warn('⚠️ Admin seeding encountered an error:', err.message);
}

/* ================== INITIALIZE GLOBAL SETTINGS (non-fatal) ================== */
try {
  const existing = await settings.findOne({ _id: 'global' });
  if (!existing) {
    await settings.insertOne({
      _id: 'global',
      paymentApprovalMethod: 'gateway',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Global settings initialized');
  }
} catch (err) {
  console.warn('⚠️ Settings initialization encountered an error:', err.message);
}