import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { users, donations, attendance, loans, savingsGoals } from '../config/db.js';
import { callGeminiChat } from '../utils/gemini.js';

const router = Router();

const OFFICER_POSITIONS = [
  'Deacon','Local Evangelist','District Evangelist','National Evangelist',
  'Assistant Priest','Priest','Elder','District Elder',
  'Bishop','District Bishop','National Bishop','Apostle',
];

/* ── IsangDiwa Knowledge Base (system context for AI) ── */
const PUAC_KB = `
You are **IsangDiwa Chatbot**, the official AI assistant for **IsangDiwa** — the digital church management portal of the **Philippine United Apostolic Church (PUAC)**.

## ⚠️ SYSTEM NAME & FAITHLY RULE — CRITICAL
- The platform is strictly named **IsangDiwa** (NOT Faithly).
- NEVER refer to the system as Faithly. Always use **IsangDiwa**.
- If a user asks about "Faithly" (e.g. "Do you know Faithly?", "What can Faithly do?", "What is Faithly?"), politely clarify that the platform is named **IsangDiwa** (the name was updated to IsangDiwa), and explain what IsangDiwa is or what it can do.

## Your Personality
- Warm, professional, and spiritually encouraging
- Use emojis sparingly but naturally (👋, ✅, 📋, ⚠️, etc.)
- Be concise — keep responses under 150 words unless the user asks for detail
- **Always respond in English by default.** Only switch to Tagalog/Filipino/Taglish if the user clearly writes in Filipino first.
- Always suggest 2-4 relevant quick reply topics at the end of your response in a JSON array

## ⚠️ CRITICAL ACCESS RULES — Follow these strictly at all times

### Loans: OFFICER-ONLY
- **Loans are EXCLUSIVELY for verified church officers.**
- Regular members (non-officers) do NOT have access to the Loans feature.
- If a regular member asks about loans, simply tell them: "Loans are only available to church officers." Do NOT explain how to apply or give any loan details.
- Only if the Current User Context confirms the user is a verified officer may you explain loan application steps.

### Savings: All Members
- All members (officers and regular members alike) can use Savings features.

### Donations: All Members
- All members (officers and regular members alike) can make donations.

## IsangDiwa Platform Features

### Donations (All Members)
- **Categories:** General Fund, Children's Department, Men's Department, Women's Department, Youth Department, Mission Fund
- Each donation is linked to the member's branch/community
- **Payment method:** Manual — Cash or Bank Transfer. Member must upload proof of payment; admin confirms manually
- **Statuses:** pending → confirmed or rejected
- View donation history and category breakdown on the Donations page

### Savings (All Members)
- Set personalized savings goals with a target amount
- Deposit to savings via Manual — upload proof of deposit; admin confirms
- Track progress towards each goal

### Loans (VERIFIED OFFICERS ONLY)
- Only **verified church officers** may apply for loans
- **Application steps:** Go to Loans → Apply for a Loan → choose loan type, amount, term → upload documents (selfie, valid ID, COE, ITR, payslip) → submit for admin review
- **Loan Status Lifecycle:**
  1. **Pending** — Submitted; awaiting admin review
  2. **Awaiting Member Approval** — Admin proposed modified terms; member must accept or decline before moving forward
  3. **Approved** — Approved by admin; awaiting disbursement
  4. **Active** — Disbursed; monthly payments are now due
  5. **Completed** — All payments settled
  6. **Rejected** — Application declined by admin
  7. **Cancelled** — Cancelled by the member (only possible while Pending or Approved)
- **Disbursement methods:** Cash, E-Wallet, Bank Transfer
- **Repayment:** Monthly via Manual — cash or bank transfer with proof upload; admin confirms
- **Late Payment Penalty:** If a monthly payment is NOT made within **3 days** of the due date, a **3% flat interest penalty** replaces the normal interest for that month
- View loan schedule, remaining balance, and payment history in the Loan Detail page

### Attendance
- Recorded by administrators via **manual entry** or **RFID tap**
- Members cannot log their own attendance
- View attendance history and summary on the Attendance page and Home dashboard

### Branches
- PUAC has **68 branches** across the Philippines with over **3,400 members**
- Each member belongs to a branch/community
- Find locations, contact info, and service schedules on the Branches page

### Profile
- Members can view and update their profile by clicking their **name/avatar on the sidebar**
- Update profile (name, phone, address)
- Change password

### Notifications
- Real-time alerts for: donation confirmations/rejections, loan status changes, attendance records
- Email and push notification support

## Response Format Rules
- Use **bold** for important terms
- Use "- " for bullet points
- Use "1. " numbered steps for processes
- End EVERY response with exactly this line: QUICK_REPLIES:["Topic1","Topic2","Topic3"]
- Quick replies must be contextually relevant to what the user just asked
- If a non-officer asks about loans, do NOT suggest Officer Verification. Just tell them loans are for officers only.

## ⚠️ SCOPE LIMITATION — STRICTLY ENFORCED
- You are ONLY allowed to answer questions related to the **IsangDiwa / PUAC platform**: donations, savings, loans, attendance, branches, profile, notifications, and general church-related inquiries about PUAC.
- If a user asks about anything UNRELATED to IsangDiwa or PUAC (e.g. weather, math, coding, news, sports, recipes, personal advice, general knowledge, or any off-topic subject), REFUSE politely and say: "I can only assist with IsangDiwa and PUAC-related topics such as donations, savings, attendance, and branches. Please ask me something related to the platform!"
- Do NOT answer off-topic questions under any circumstances, even if the user insists.
`;

/* ── Accurate fallback keyword matching (role-aware) ── */
const OFFICER_KB = [
  {
    patterns: ['loan', 'loans', 'borrow', 'apply loan', 'utang', 'hulugan', 'pautang'],
    responses: ["💳 **Loan Application:**\n\nGo to **Loans** → **Apply for a Loan** → choose loan type, amount, and term → upload required documents → submit for admin review.\n\n**Loan Statuses:** Pending → Awaiting Approval → Approved → Active → Completed"],
    quickReplies: ['Loan statuses', 'Late payment penalty', 'Donations']
  },
  {
    patterns: ['loan status', 'status', 'pending loan', 'approved loan', 'active loan', 'loan lifecycle'],
    responses: ["📋 **Loan Statuses:**\n1. **Pending** — Under admin review\n2. **Awaiting Your Approval** — Admin proposed modified terms; accept or decline\n3. **Approved** — Approved, waiting for disbursement\n4. **Active** — Disbursed; monthly payments due\n5. **Completed** — Fully paid\n6. **Rejected** — Application declined\n7. **Cancelled** — Cancelled by you"],
    quickReplies: ['Loans', 'Late payment penalty']
  },
  {
    patterns: ['late', 'penalty', 'overdue', 'missed payment', 'late payment', 'late fee'],
    responses: ["⚠️ **Late Payment Penalty:**\nIf a loan payment is not made within **3 days** of the due date, a **3% flat interest penalty** is applied to that month's payment instead of the regular interest.\n\nCheck your next due date on the Loan Detail page."],
    quickReplies: ['Loans', 'Loan statuses']
  },
];

const MEMBER_KB = [
  {
    patterns: ['loan', 'loans', 'borrow', 'apply loan', 'utang', 'hulugan', 'pautang',
               'late', 'penalty', 'overdue', 'missed payment', 'late payment', 'late fee',
               'loan status', 'pending loan', 'approved loan', 'active loan', 'loan lifecycle'],
    responses: ["🚫 **Loans are only available to church officers.**\n\nAs a regular member, you do not have access to this feature."],
    quickReplies: ['Savings', 'Donations', 'Attendance']
  },
];

const SHARED_KB = [
  {
    patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'kumusta', 'magandang umaga', 'magandang hapon', 'magandang gabi'],
    responses: ["Hello! 👋 I'm IsangDiwa Chatbot, your AI assistant for IsangDiwa. How can I help you today?"],
    quickReplies: ['Donations', 'Savings', 'Attendance', 'Branches']
  },
  {
    patterns: ['savings', 'save', 'ipon', 'savings goal'],
    responses: ["🏦 **Savings:**\n\nYou can set personal savings goals, track progress, and deposit via Payment Gateway or Manual.\n\nGo to **Savings** to manage your goals."],
    quickReplies: ['Donations', 'Attendance']
  },
  {
    patterns: ['donat', 'donation', 'donate', 'giving', 'tithe', 'offering', 'handog', 'ikapu'],
    responses: ["❤️ **Donations** are open to all members!\n\n**Categories:** General Fund, Children's Dept, Men's Dept, Women's Dept, Youth Dept, Mission Fund\n\n**Payment method:** Manual — Cash or Bank Transfer. Upload proof of payment and your admin will confirm it.\n\nGo to **Donations** → choose category → enter amount → upload proof."],
    quickReplies: ['Attendance', 'Savings']
  },
  {
    patterns: ['attendance', 'attend', 'check in', 'presensya'],
    responses: ["📅 Attendance is recorded by administrators via **manual entry** or **RFID tap**.\n\nYou cannot log your own attendance. View your history on the **Attendance** page or your **Home** dashboard."],
    quickReplies: ['Branches', 'Donations']
  },
  {
    patterns: ['branch', 'location', 'address', 'simbahan', 'church', 'komunidad', 'community', 'how many'],
    responses: ["🏛️ PUAC has **68 branches** across the Philippines with over **3,400 members**. Visit the **Branches** page to find locations, contact info, and service schedules."],
    quickReplies: ['Attendance', 'Donations']
  },
  {
    patterns: ['settings', 'profile', 'password', 'account', 'update profile'],
    responses: ["👤 To view or update your profile, click your **name or avatar on the sidebar** — it will take you to your profile page where you can edit your info and change your password."],
    quickReplies: ['Donations', 'Savings', 'Attendance']
  },
  {
    patterns: ['notification', 'alert', 'updates', 'abiso'],
    responses: ["🔔 **Notifications** keep you updated on:\n- Donation confirmations/rejections\n- Savings updates\n- Attendance records\n\nCheck the **Notifications** page for all updates."],
    quickReplies: ['Donations', 'Savings', 'Attendance']
  },
  {
    patterns: ['what is faithly', 'about faithly', 'ano ang faithly', 'faithly'],
    responses: ["🙏 The platform is named **IsangDiwa** (formerly Faithly), the official digital portal of the **Philippine United Apostolic Church (PUAC)**.\n\nAll members can manage donations, savings, attendance, and branches. **Church officers** also get access to loans."],
    quickReplies: ['Donations', 'Savings', 'Attendance']
  },
  {
    patterns: ['what is isangdiwa', 'about isangdiwa', 'isangdiwa', 'ano ang isangdiwa', 'portal'],
    responses: ["🙏 **IsangDiwa** is the official digital portal of the **Philippine United Apostolic Church (PUAC)**.\n\nAll members can manage donations, savings, attendance, and branches. **Church officers** also get access to loans."],
    quickReplies: ['Donations', 'Savings', 'Attendance']
  },
];

function getKeywordResponse(input, isOfficer) {
  const normalized = input.toLowerCase().trim();
  // Check role-specific KB first, then shared
  const roleKB = isOfficer ? OFFICER_KB : MEMBER_KB;
  for (const entry of roleKB) {
    if (entry.patterns.some(p => normalized.includes(p))) {
      return { text: entry.responses[0], quickReplies: entry.quickReplies };
    }
  }
  for (const entry of SHARED_KB) {
    if (entry.patterns.some(p => normalized.includes(p))) {
      return { text: entry.responses[0], quickReplies: entry.quickReplies };
    }
  }
  return null;
}

/* ── Parse quick replies from AI response ── */
function parseAIResponse(text) {
  let reply = text;
  let quickReplies = ['Donations', 'Savings', 'Attendance', 'Branches'];

  const qrMatch = text.match(/QUICK_REPLIES:\s*\[([^\]]+)\]/i);
  if (qrMatch) {
    try {
      quickReplies = JSON.parse(`[${qrMatch[1]}]`);
      reply = text.replace(/QUICK_REPLIES:\s*\[[^\]]+\]/i, '').trim();
    } catch { /* keep defaults */ }
  }

  return { reply, quickReplies };
}

/* ── Per-user rate limiter (in-memory) ── */
const RATE_LIMIT_MAX = 20;          // max messages per window
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const userRateLimits = new Map();   // email -> { count, windowStart }

function checkRateLimit(email) {
  const now = Date.now();
  const entry = userRateLimits.get(email);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // Start a new window
    userRateLimits.set(email, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

/* ================== POST /api/chat ================== */
router.post('/chat', authenticateUser, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const email = req.user.email;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Rate limit check
    const rateCheck = checkRateLimit(email);
    if (!rateCheck.allowed) {
      const retryAfterSeconds = Math.ceil(rateCheck.retryAfterMs / 1000);
      return res.status(429).json({
        success: false,
        message: `You've reached the message limit. Please wait before sending more messages.`,
        retryAfterSeconds,
      });
    }

    // Fetch user's real-time data for context
    let userContext = '';
    let isOfficer = false;
    try {
      const user = await users.findOne({ email });

      // Determine if user is a verified officer using canonical list
      const pos = (user?.position || '').trim();
      isOfficer = OFFICER_POSITIONS.some(p => p.toLowerCase() === pos.toLowerCase());

      // Fetch data
      const userDonations = await donations.find({ email, status: 'confirmed' }).toArray();
      const pendingDonations = await donations.find({ email, status: 'pending' }).toArray();
      const userAttendance = await attendance.find({ email }).toArray();
      const userSavings = await savingsGoals.find({ email }).toArray();
      const userLoans = await loans.find({ email, status: { $ne: 'cancelled' } }).toArray();

      const totalDonated = userDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
      const totalSaved = userSavings.reduce((sum, g) => sum + (Number(g.savedAmount) || 0), 0);

      // Build active loan details with next payment info
      const activeLoans = userLoans.filter(l => l.status === 'active');
      const activeLoanDetails = activeLoans.map(loan => {
        const term = loan.termMonths || 12;
        const paidMonths = loan.paidMonths || 0;
        let nextPaymentDate = 'Not set';
        let upcomingPaymentAmount = loan.monthlyPayment || 0;
        let isLate = false;

        if (loan.disbursementDate && paidMonths < term) {
          const startDate = new Date(loan.disbursementDate);
          const nextDue = new Date(startDate);
          nextDue.setMonth(startDate.getMonth() + paidMonths + 1);
          nextPaymentDate = nextDue.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

          const cutoffDate = new Date(nextDue);
          cutoffDate.setDate(nextDue.getDate() + 3);
          cutoffDate.setHours(23, 59, 59, 999);

          if (Date.now() > cutoffDate.getTime()) {
            isLate = true;
            const principalPerMonth = (loan.amount || 0) / term;
            const penaltyInterest = (loan.amount || 0) * 0.03;
            upcomingPaymentAmount = principalPerMonth + penaltyInterest;
          }
        }

        return {
          loanId: loan.loanId,
          amount: loan.amount,
          remainingBalance: loan.remainingBalance,
          nextPaymentDate,
          upcomingPaymentAmount: Math.round(upcomingPaymentAmount),
          isLate,
          paidMonths,
          termMonths: term,
        };
      });

      const pendingLoans = userLoans.filter(l => l.status === 'pending').map(l => l.loanId);
      const awaitingApprovalLoans = userLoans.filter(l => l.status === 'awaiting_member_approval').map(l => l.loanId);

      userContext = `
## Current User Context
- **Name:** ${user?.fullName || 'Member'}
- **Branch:** ${user?.branch || 'Unknown'}
- **Position / Role:** ${user?.position || 'Member'}
- **Is Verified Officer:** ${isOfficer ? `YES — position: ${user.position}` : 'NO — regular member; cannot access Loans'}
- **Access to Loans:** ${isOfficer ? 'GRANTED' : 'DENIED — officers only'}

### Donation Summary
- Confirmed Donations: ₱${totalDonated.toLocaleString()} across ${userDonations.length} transactions
- Pending Donations: ${pendingDonations.length}
- Attendance Records: ${userAttendance.length} services

### Loan Summary
${isOfficer ? `- Active Loans: ${activeLoans.length}
${activeLoanDetails.length > 0 ? activeLoanDetails.map(l =>
  `  - Loan ${l.loanId}: ₱${(l.amount || 0).toLocaleString()} | Remaining: ₱${(l.remainingBalance || 0).toLocaleString()} | Next Payment: ${l.nextPaymentDate} (₱${l.upcomingPaymentAmount.toLocaleString()})${l.isLate ? ' ⚠️ OVERDUE — 3% penalty applies' : ''} | Month ${l.paidMonths}/${l.termMonths}`
).join('\n') : '  - No active loan details available'}
- Pending Applications: ${pendingLoans.length > 0 ? pendingLoans.join(', ') : 'None'}
- Awaiting Term Approval: ${awaitingApprovalLoans.length > 0 ? awaitingApprovalLoans.join(', ') : 'None'}` : '- NOT ACCESSIBLE (user is a regular member, not an officer — do NOT explain loan details)'}

### Savings Summary
- Savings Goals: ${userSavings.length} | Total Saved: ₱${totalSaved.toLocaleString()}

**IMPORTANT INSTRUCTIONS:**
- If the user is NOT a verified officer and asks about loans, simply say "Loans are only available to church officers." Do NOT explain how to apply or provide any loan details to non-officers.
- Do NOT mention Officer Verification — that feature does not exist.
- Savings is available to ALL members — always help with savings questions regardless of role.
- Use the data above to give personalized, accurate answers.
- Do NOT expose sensitive financial data unless the user specifically asks about their own account.
- If a user asks about ANOTHER member's data (savings, loans, donations, attendance, profile), REFUSE and say: "I can only access your own account information. For privacy reasons, I cannot look up other members' data."
- NEVER fabricate, guess, or hallucinate data you do not have. If you are unsure, say so honestly.
`;
    } catch (err) {
      console.error('[Chat] Failed to fetch user context:', err.message);
    }

    // Build conversation history for multi-turn context
    const chatHistory = history.slice(-8).map(m => ({
      role: m.sender === 'user' ? 'user' : 'bot',
      text: m.text || '',
    }));

    // Try AI first
    const systemPrompt = PUAC_KB + userContext;
    const aiResponse = await callGeminiChat(systemPrompt, chatHistory, message);

    if (aiResponse) {
      const { reply, quickReplies } = parseAIResponse(aiResponse);
      return res.json({ success: true, reply, quickReplies, source: 'ai', isOfficer });
    }

    // Fallback to keyword matching
    const fallback = getKeywordResponse(message, isOfficer);
    if (fallback) {
      return res.json({ success: true, reply: fallback.text, quickReplies: fallback.quickReplies, source: 'fallback', isOfficer });
    }

    // Ultimate fallback
    const defaultReplies = isOfficer
      ? ['Loans', 'Donations', 'Savings', 'Attendance']
      : ['Donations', 'Savings', 'Attendance', 'Branches'];
    return res.json({
      success: true,
      reply: "I'm not sure I understand that. Could you try rephrasing?\n\nHere are some things I can help with:",
      quickReplies: defaultReplies,
      source: 'fallback',
      isOfficer,
    });
  } catch (err) {
    console.error('[Chat Error]:', err);
    res.status(500).json({ success: false, message: 'Chat failed' });
  }
});

export default router;
