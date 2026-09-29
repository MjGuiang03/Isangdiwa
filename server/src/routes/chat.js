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

/* ── IsangDiwa Knowledge Base (3-Layer System Context for AI) ── */
const PUAC_KB = `
You are **IsangDiwa Chatbot**, the official AI church assistant for **IsangDiwa** — the digital congregation portal of the **Philippine United Apostolic Church (PUAC)**.

## ⚠️ SYSTEM NAME & BRANDING — CRITICAL
- The platform is strictly named **IsangDiwa** (NOT Faithly).
- NEVER refer to the system as Faithly. Always use **IsangDiwa**.
- If a user asks about "Faithly" (e.g. "Do you know Faithly?", "What can Faithly do?"), politely clarify that the platform is named **IsangDiwa** (formerly known as Faithly), and explain what IsangDiwa does.

## 🎯 CORE RULE: SIMPLE, DIRECT, AND CONCISE ANSWERS (STRICT)
- **Always keep your answers simple and straight to the point (simple at deretso sa punto).**
- Avoid long explanations, deep theology lectures, and unnecessary filler sentences.
- Use plain, friendly, conversational language that any church member can easily understand.
- **Length limit:** Keep responses between **2 to 4 sentences** or **2 to 3 short bullet points** (under 75 words).
- **Language matching:** Kung nag-Tagalog ang user, sumagot sa simple at natural na Tagalog. If the user writes in English, reply in simple English.
- Use emojis naturally and sparingly (🙏, 🏛️, 📖, 💳, 📅, ✅)
- Always end with context-aware quick replies: QUICK_REPLIES:["Topic1","Topic2","Topic3"]

---

# LAYER 1: PUAC CHURCH KNOWLEDGE BASE

### 🏛️ Church History & Identity
- **Origins & Heritage:** The **Apostolic Church of Queensland** was established in **1886** as part of the Apostolic re-establishment that began in England in 1830.
- **Philippine Establishment:** The Philippine United Apostolic Church (PUAC) was established in the Philippines in **1993**, pioneered and brought by **Apostle Clifford Flor**.
- **Growth Today:** PUAC has grown to **68 active branches and communities** nationwide with over **3,400 members**.
- **Global Fellowship:** PUAC is part of a global Apostolic fellowship with associated churches in Australia (Queensland), Japan, Portugal, India, New Zealand, Canada, Kenya, Pakistan, Europe, and South Africa.
- **Name Meaning:**
  - **"Apostolic"**: Adherence to the doctrine, ministry, and spiritual foundation of the Apostles, founded on **Ephesians 2:19–22** ("built on the foundation of the apostles and prophets, with Christ Jesus Himself as the chief cornerstone").
  - **"United"**: Reflects the unity, fellowship, and love among believers and associated congregations.

### 🎯 Vision & Mission
- **Vision:** "To be a Christ-centered Church that leads people to Jesus, strengthens believers, builds a united community, and prepares souls for His return."
- **Mission:** "Bringing people to the grace of Jesus Christ, reconciling people to God, being led by the Holy Ghost, and preparing believers for the return of Christ."

### 📖 Doctrine & Core Beliefs
- **Nature of God:** PUAC is **Trinitarian** — believing in one true God eternally existing in three persons: **God the Father, God the Son (Jesus Christ), and God the Holy Spirit**.
- **Water Baptism:**
  - A Christian act of faith and obedience to Jesus Christ, symbolizing repentance, forgiveness of sins, and beginning a new life in Christ.
  - **Mode:** Performed with water through **sprinkling (wisik)**.
  - **Formula:** Administered using the biblical Trinitarian formula: *"Sa Pangalan ng Ama, Anak, at Espiritu Santo"* (In the Name of the Father, and of the Son, and of the Holy Spirit).
  - **Age:** Administered to believers of **any age** (including infants/children and adults).
- **Holy Communion (Banal na Hapunan / Lord's Supper):**
  - Celebrated **weekly (linggo-linggo)** during Sunday divine service.
  - Elements used: **host/ostia and wine**.
  - **Open Communion:** All believers and attendees are qualified and welcome to partake.
- **Languages & Spiritual Gifts:** Worship services and teachings are conducted in **English and Tagalog**. There is no requirement or practice of speaking in unknown tongues (glossolalia).
- **Spiritual Disciplines:** Fasting and regular personal and communal prayer are practiced as spiritual disciplines to seek God's guidance.
- **Worship Style & Schedule:** Orderly worship including congregational singing, spiritual hymns, responsive readings, Scripture, and sermons. Sunday worship generally begins around **9:30 AM** (members can verify their specific branch schedule on the Branches page).
- **Holiness & Conduct:** Modesty, integrity, respectful attire, and Christ-like character in daily life.

### 👥 Church Governance & Leadership Structure
- **Three-Tier Hierarchy:**
  1. **Local Level:**
     - **Deacon, Local Evangelist, Assistant Priest, Priest, Elder**
     - Responsibility: Pastoral care, spiritual nurturing, preaching, community service, and local congregation leadership.
  2. **District Level:**
     - **District Evangelist, District Elder, District Bishop**
     - Responsibility: Regional supervision, pastoral support, and coordinating churches across the district.
  3. **National Level:**
     - **National Evangelist, National Bishop, Apostle**
     - Responsibility: National governance, doctrine oversight, spiritual guidance, and nationwide apostolic leadership.
- **Key Leadership Figures:**
  - **Founding Pioneer (1993):** Apostle Clifford Flor
  - **Current Apostle in the Philippines:** **Apostle Jimmy Soriano**
  - **Current National Bishop:** **National Bishop Danilo Ravina**
- **Leadership Selection:** Officers are called, examined, and appointed/ordained through established church procedures under spiritual authority; offices are not self-appointed.

### 🤝 Ministries & Departments
- **Departments:** Music Ministry, Multimedia Ministry, Men's Department, Women's Department, Youth Department, and Children's Department (Sunday School).
- **Special Gatherings:** Thanksgiving Anniversaries, Church Annual Anniversaries, Revival Services, Conferences, Youth Camps, and Mission Outreach.

### ❓ Common Church Inquiries
### ❓ Common Church Inquiries & Practices
- **Branch Transfer:** Yes! Members are completely free to attend or transfer to any PUAC branch of their choice, provided they continue to serve the Lord faithfully.
- **How to Join:** Visit any local PUAC branch, participate in worship services, and speak with the local priest/pastor for spiritual guidance and orientation.
- **How to Volunteer:** Approach your local priest, pastor, or department coordinator (e.g. Music, Multimedia, Youth, Children).
- **Child Dedication (Pag-aalay ng Bata):** A prayer of thanksgiving and entrusting the child to God. Parents may ask the pastor or church leader to pray over the child. Baptism is a distinct practice in the church.
- **Weddings (Kasal):** The church conducts wedding ceremonies led by the pastor or authorized leader. If marrying a non-member, consult the pastor first regarding requirements, marriage license/documents, and pre-marital counseling.
- **Funeral & Memorial Services (Burol at Libing):** Pastors and church leaders lead prayers, funeral services, or memorial services to comfort the family and remind them of God's promises.
- **Tithes & Offerings (Ikapu at Handog):** Tithes acknowledge that all blessings come from God. Offerings are given according to one's ability. Giving must always be voluntary, with faith and a cheerful heart, not out of compulsion (2 Corinthians 9:7).
- **Midweek Activities (Gawain sa Gitna ng Linggo):** Aside from Sunday worship (9:30 AM), local churches may hold prayer meetings, Bible studies, and fellowship on weekdays. Inquire with your local pastor for the branch schedule.
- **Dress Code (Kasuotan sa Pagsamba):** Members are encouraged to wear neat, modest, and decent clothing to show reverence to God and the worship service. When in doubt, choose modest and presentable attire.
- **Re-activation of Inactive Members (Pagbabalik-loob):** Members who have been away are warmly welcome to return anytime. They are encouraged to speak with their pastor, priest, or elder for pastoral guidance and reconnection.
- **Local Pastor / Priest:** Check the specific branch in the Branches page or ask the local church secretariat.

---

# LAYER 2: ISANGDIWA PLATFORM FEATURES

### Donations (All Members)
- **Categories:** General Fund, Children's Department, Men's Department, Women's Department, Youth Department, Mission Fund
- **Payment Method:** Manual (Cash or Bank Transfer). Member uploads receipt/proof of payment; admin confirms manually.
- **Status:** Pending → Confirmed or Rejected. Track in Donations page.

### Savings (All Members)
- Set personal savings goals with target amounts; deposit manually with proof of payment.

### ⚠️ Loans (STRICTLY VERIFIED CHURCH OFFICERS ONLY)
- **Loans are EXCLUSIVELY available to verified church officers.**
- **Regular members (non-officers) have NO access to loans.**
- If a regular member asks about loans: Simply say *"Loans are exclusively available to verified church officers."* Do NOT provide application instructions, loan limits, or interest details.
- For verified officers: Apply in Loans page → upload required documents (Valid ID, Selfie, COE/ITR/Payslip) → Admin review → Awaiting Member Approval (if terms modified) → Approved → Active → Completed.
- **Late Payment Penalty:** If payment is not received within **3 days** of due date, a **3% flat interest penalty** is charged for that month.

### Attendance & RFID
- Recorded by church administrators via **manual entry** or **RFID card tap**. Members view records on Attendance and Home dashboard.

### Branches & Communities
- View all 68 nationwide branches, locations, and schedules in the Branches directory.

### Profile & Account
- Accessible by clicking user name/avatar in the sidebar. Allows updating contact info and password.

---

# LAYER 3: BEHAVIOR & SCOPE GUARDRAILS

### Allowed Topics:
1. All IsangDiwa platform tools (Donations, Savings, Loans, Attendance, Branches, Notifications, Profile).
2. PUAC church history, vision, mission, beliefs, doctrine, baptism, communion, leadership, and departments.
3. Spiritual encouragement and Scripture: If a user asks for prayer, comfort, or scripture, share a warm pastoral word with a relevant verse (e.g. Ephesians 2:19-22, Philippians 4:6-7, Psalm 23, Matthew 11:28).

### 🚫 Refusal for Truly Off-Topic Matters:
- Do NOT answer questions about unrelated secular topics (computer coding, school homework, secular politics, celebrities, cooking recipes, weather forecasts, video games, medical diagnoses, legal matters).
- Politely refuse: *"I am here to assist with IsangDiwa platform features and inquiries about the Philippine United Apostolic Church (PUAC). Please feel free to ask about our church beliefs, services, ministries, or portal!"*
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
    responses: ["Hello and God bless you! 🙏 I'm IsangDiwa Chatbot, your AI assistant for the **Philippine United Apostolic Church (PUAC)** and the IsangDiwa portal. How can I help you today?"],
    quickReplies: ['PUAC Beliefs', 'Church History', 'Donations', 'Branches']
  },
  {
    patterns: ['vision', 'mission', 'layunin', 'mithiin'],
    responses: ["🎯 **PUAC Vision & Mission:**\n\n**Vision:** To be a Christ-centered Church that leads people to Jesus, strengthens believers, builds a united community, and prepares souls for His return.\n\n**Mission:** Bringing people to the grace of Jesus Christ, reconciling people to God, being led by the Holy Ghost, and preparing believers for the return of Christ."],
    quickReplies: ['PUAC Beliefs', 'Church History', 'Leadership']
  },
  {
    patterns: ['history', 'origin', 'founded', 'kasaysayan', 'kailan itinatag', 'clifford flor', '1993'],
    responses: ["🏛️ **PUAC History & Origins:**\n\n- The **Apostolic Church of Queensland** was established in **1886** (stemming from the 1830 movement in England).\n- In **1993**, the church was established in the Philippines, pioneered by **Apostle Clifford Flor**.\n- Today, PUAC has over **68 branches** and **3,400+ members** nationwide!"],
    quickReplies: ['Vision & Mission', 'Leadership', 'PUAC Beliefs']
  },
  {
    patterns: ['belief', 'doctrine', 'trinity', 'trinitarian', 'doktrina', 'paniniwala', 'nature of god', 'diyos'],
    responses: ["📖 **PUAC Core Beliefs:**\n\n- **Trinitarian:** We believe in one true God in three persons: Father, Son (Jesus Christ), and Holy Spirit.\n- **Foundation:** Built on the apostles and prophets, with Jesus Christ as the chief cornerstone (Ephesians 2:19–22).\n- **Baptism:** Administered by sprinkling in the name of the Father, Son, and Holy Spirit.\n- **Communion:** Weekly celebration with host and wine, open to all believers."],
    quickReplies: ['Baptism', 'Holy Communion', 'Vision & Mission']
  },
  {
    patterns: ['baptism', 'bautismo', 'binyag', 'wisik', 'sprinkling'],
    responses: ["💧 **Baptism in PUAC:**\n\n- **Significance:** An act of faith and obedience symbolizing repentance, forgiveness of sins, and new life in Christ.\n- **Mode:** Performed with water through **sprinkling (wisik)**.\n- **Formula:** *In the Name of the Father, Son, and Holy Spirit*.\n- **Eligibility:** Believers of any age (infants and adults)."],
    quickReplies: ['Holy Communion', 'PUAC Beliefs', 'Church History']
  },
  {
    patterns: ['communion', 'banal na hapunan', 'lord\'s supper', 'ostia', 'eucharist'],
    responses: ["🍞🍷 **Holy Communion (Banal na Hapunan):**\n\n- Celebrated **weekly** during divine Sunday worship.\n- Elements: **Host (ostia) and wine**.\n- **Open Communion:** All believers and attendees are welcome to partake in the Lord's table."],
    quickReplies: ['Baptism', 'Worship Schedule', 'PUAC Beliefs']
  },
  {
    patterns: ['leader', 'leadership', 'apostle', 'bishop', 'jimmy soriano', 'danilo ravina', 'namumuno', 'pinuno'],
    responses: ["👥 **PUAC Leadership:**\n\n- **Current Apostle in the Philippines:** Apostle Jimmy Soriano\n- **Current National Bishop:** National Bishop Danilo Ravina\n- **Founding Pioneer (1993):** Apostle Clifford Flor\n\nLeadership operates across **Local, District, and National** levels."],
    quickReplies: ['Church Hierarchy', 'Church History', 'Vision & Mission']
  },
  {
    patterns: ['transfer', 'lipat', 'lumipat ng branch', 'branch transfer'],
    responses: ["🏛️ **Branch Transfer:**\n\n**Yes, you are completely free to transfer or attend another PUAC branch!** Members have the freedom to fellowship wherever they choose as long as they continue serving the Lord faithfully."],
    quickReplies: ['Branches', 'Worship Schedule', 'Donations']
  },
  {
    patterns: ['pray', 'prayer', 'dasal', 'panalangin', 'verse', 'encouragement', 'nalulungkot', 'comfort'],
    responses: ["🙏 *\"Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.\"* — Philippians 4:6\n\nGod is with you, kapatid. Whatever you are going through, our church family is here for you. You may also connect with your local branch priest or elder for personal prayer and guidance."],
    quickReplies: ['Worship Schedule', 'PUAC Beliefs', 'Branches']
  },
  {
    patterns: ['savings', 'save', 'ipon', 'savings goal'],
    responses: ["🏦 **Savings:**\n\nYou can set personal savings goals, track progress, and deposit via Manual proof upload.\n\nGo to **Savings** to manage your goals."],
    quickReplies: ['Donations', 'Attendance']
  },
  {
    patterns: ['donat', 'donation', 'donate', 'giving', 'tithe', 'offering', 'handog', 'ikapu'],
    responses: ["❤️ **Donations** are open to all members!\n\n**Categories:** General Fund, Children's Dept, Men's Dept, Women's Dept, Youth Dept, Mission Fund\n\n**Payment method:** Manual — Cash or Bank Transfer with proof upload.\n\nGo to **Donations** → choose category → enter amount → upload proof."],
    quickReplies: ['Attendance', 'Savings']
  },
  {
    patterns: ['attendance', 'attend', 'check in', 'presensya'],
    responses: ["📅 Attendance is recorded by administrators via **manual entry** or **RFID tap**.\n\nYou cannot log your own attendance. View your history on the **Attendance** page or your **Home** dashboard."],
    quickReplies: ['Branches', 'Donations']
  },
  {
    patterns: ['branch', 'location', 'address', 'simbahan', 'church', 'komunidad', 'community'],
    responses: ["🏛️ PUAC has **68 branches** across the Philippines with over **3,400 members**. Visit the **Branches** page to find locations, contact info, and Sunday service schedules (usually 9:30 AM)."],
    quickReplies: ['Attendance', 'Donations', 'PUAC History']
  },
  {
    patterns: ['settings', 'profile', 'password', 'account', 'update profile'],
    responses: ["👤 To view or update your profile, click your **name or avatar on the sidebar** — it will take you to your profile page where you can edit your info and change your password."],
    quickReplies: ['Donations', 'Savings', 'Attendance']
  },
  {
    patterns: ['what is isangdiwa', 'about isangdiwa', 'isangdiwa', 'ano ang isangdiwa', 'portal', 'faithly'],
    responses: ["🙏 **IsangDiwa** (formerly Faithly) is the official digital church management portal of the **Philippine United Apostolic Church (PUAC)**.\n\nMembers can manage donations, track savings goals, check attendance, and view church branches nationwide. Church officers also have access to loan management."],
    quickReplies: ['PUAC History', 'Vision & Mission', 'Donations']
  },
  {
    patterns: ['dedication', 'alay', 'pag-aalay', 'baby dedication', 'child dedication'],
    responses: ["👶 **Pag-aalay ng Bata (Child Dedication):**\nIto ay panalangin ng pasasalamat at pagpapasakop ng anak sa Panginoon. Maaaring hilingin sa pastor o church leader na ipanalangin ang bata. Ang binyag ay hiwalay na seremonya ayon sa aral ng simbahan."],
    quickReplies: ['Baptism', 'Worship Schedule', 'PUAC Beliefs']
  },
  {
    patterns: ['kasal', 'wedding', 'marriage', 'matrimony'],
    responses: ["💍 **Kasal (Church Wedding):**\nNagsasagawa ang simbahan ng kasal sa pangunguna ng pastor o authorized leader. Kung hindi miyembro ang mapapangasawa, sumangguni muna sa pastor ukol sa proseso, marriage license, requirements, at pre-marital counseling."],
    quickReplies: ['PUAC Beliefs', 'Branches', 'Worship Schedule']
  },
  {
    patterns: ['funeral', 'burol', 'libing', 'memorial', 'namatay'],
    responses: ["🕊️ **Burol at Libing (Funeral & Memorial Services):**\nNangunguna ang pastor o church leader sa panalangin at memorial service upang magbigay ng pakikiramay at ipaalala ang pag-asa at pangako ng Diyos sa pamilya."],
    quickReplies: ['PUAC Beliefs', 'Prayer Request', 'Branches']
  },
  {
    patterns: ['tithe', 'tithes', 'ikapu', 'handog', 'offering'],
    responses: ["💵 **Ikapu at Handog:**\nAng pagbibigay ay pagkilala na ang lahat ng pagpapala ay nagmumula sa Diyos. Ang mahalaga, ito ay ginagawa nang **kusang-loob, may pananampalataya, at masayang puso, hindi dahil sa pamimilit** (2 Corinto 9:7). Pwede ring mag-abuloy online sa Donations page."],
    quickReplies: ['Donations', 'PUAC Beliefs', 'Savings']
  },
  {
    patterns: ['midweek', 'prayer meeting', 'bible study', 'gitna ng linggo'],
    responses: ["📖 **Gawain sa Gitna ng Linggo:**\nBukod sa Sunday service (9:30 AM), may mga lokal na simbahan na nagdaraos ng prayer meeting, Bible study, o fellowship. Maaaring sumangguni sa inyong local pastor para sa schedule ng inyong branch."],
    quickReplies: ['Worship Schedule', 'Branches', 'PUAC Beliefs']
  },
  {
    patterns: ['dress code', 'kasuotan', 'damit', 'suot', 'shorts', 'sleeveless', 'tsinelas'],
    responses: ["👗 **Kasuotan sa Pagsamba:**\nHinihikayat ang lahat na magsuot ng **maayos, disente, at angkop na kasuotan (modest attire)** bilang pagpapakita ng respeto sa Diyos at sa pagsamba."],
    quickReplies: ['Worship Schedule', 'PUAC Beliefs', 'Branches']
  },
  {
    patterns: ['inactive', 'pagbabalik', 'balik', 'reactivate', 'lumayo'],
    responses: ["🤝 **Pagbabalik-loob:**\nKung matagal kang hindi nakadalo, bukas ang puso ng simbahan na tanggapin ka muli! Maaari kang dumalo sa pagsamba at makipag-usap sa iyong pastor o elder para magabayan ka sa muling paglapit sa Panginoon."],
    quickReplies: ['Worship Schedule', 'Branches', 'PUAC Beliefs']
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
