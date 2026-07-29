import { useEffect, useState, useMemo } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';

import API from '../../utils/api';
import { Banknote, CalendarDays, CheckCircle, ChevronRight, ChevronLeft, Clock, Heart, MapPin, PiggyBank, Wallet, FileText, BookOpen, Target, X, Sparkles } from 'lucide-react';
import { isOfficerPosition } from '../../utils/officerPositions';



export default function Home() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [loanStats, setLoanStats] = useState({ activeCount: 0, remainingBalance: 0 });
  const [activeLoansList, setActiveLoansList] = useState([]);
  const [rejectedLoansCount, setRejectedLoansCount] = useState(0);

  const [donationStats, setDonationStats] = useState({ totalDonated: 0 });
  const [monthlyDonationCount, setMonthlyDonationCount] = useState(0);

  const [recentActivity, setRecentActivity] = useState([]);
  const [savingsStats, setSavingsStats] = useState({ totalSavings: 0, thisMonth: 0 });
  const [savingsGoalsList, setSavingsGoalsList] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [allAnnouncements, setAllAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  /* User interaction modals */
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [prayers, setPrayers] = useState([]);
  const [newPrayer, setNewPrayer] = useState("");
  const [calendarDate, setCalendarDate] = useState(new Date());

  const token = localStorage.getItem('token');
  const branch = profile?.branch || '';

  const urls = useMemo(() => {
    if (!token) return null;
    return [
      `${API}/api/loans/my-loans`,
      `${API}/api/donations/my-donations`,
      `${API}/api/attendance/my-attendance`,
      `${API}/api/admin/announcements${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`,
      `${API}/api/savings/stats`,
      `${API}/api/savings/goals`,
      `${API}/api/prayers`,
      `${API}/api/savings/transactions?limit=5`,
      `${API}/api/loans/my-payments`,
    ];
  }, [token, branch]);

  const fetcher = async (urlsToFetch) => {
    const headers = { Authorization: `Bearer ${token}` };
    const responses = await Promise.all(urlsToFetch.map(url => fetch(url, { headers })));
    return Promise.all(responses.map(res => res.ok ? res.json() : { success: false }));
  };

  const { data, isValidating } = useSWR(urls, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: true
  });

  useEffect(() => {
    if (!data) return;
    setLoading(isValidating && !data);
    try {
      const [loansData, donationsData, attendanceData, annData, savingsData, savingsGoalsData, prayersData, savingsTxnData, loanPaymentsData] = data;

      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      if (loansData && loansData.success) {
        setLoanStats(loansData.stats || { activeCount: 0, remainingBalance: 0 });
        const activeList = (loansData.loans || []).filter(l => l.status === 'active');
        setActiveLoansList(activeList);
        const rejected = (loansData.loans || []).filter(l => l.status === 'rejected').length;
        setRejectedLoansCount(rejected);
      }
      if (donationsData && donationsData.success) {
        setDonationStats(donationsData.stats || { totalDonated: 0 });
        const monthlyDons = (donationsData.donations || []).filter(d => {
          const dt = new Date(d.createdAt);
          return dt.getMonth() === thisMonth && dt.getFullYear() === thisYear;
        });
        setMonthlyDonationCount(monthlyDons.length);
      }

      if (savingsData && savingsData.success) {
        setSavingsStats(savingsData.stats || { totalSavings: 0, thisMonth: 0 });
      }

      if (savingsGoalsData && savingsGoalsData.success) {
        setSavingsGoalsList((savingsGoalsData.goals || []).filter(g => g.status !== 'completed'));
      }

      if (annData && annData.success) {
        const list = (annData.announcements || []).map(ann => {
          const d = ann.eventDate ? new Date(ann.eventDate) : new Date(ann.createdAt);
          const text = ann.content || ann.body || '';
          const vis = ann.visibility;
          const branches = ann.targetBranches;
          const branchLabel = (!vis || vis === 'all') ? 'All Branches'
            : (vis === 'branches' && Array.isArray(branches) && branches.length > 0)
              ? branches.join(', ')
              : vis;
          const timeLabel = ann.eventDate ? new Date(ann.eventDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
          return {
            ...ann,
            day: d.getDate().toString(),
            month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
            title: ann.title,
            body: text.length > 80 ? text.substring(0, 80) + '...' : text,
            fullBody: text,
            dateObj: d,
            time: timeLabel,
            category: ann.category || 'General',
            branch: branchLabel,
            tag: ann.category || 'General',
          };
        });
        list.sort((a, b) => b.dateObj - a.dateObj);
        setAllAnnouncements(list);
        setUpcomingEvents(list.slice(0, 4));
      }

      if (prayersData && prayersData.success) {
        setPrayers(prayersData.prayers || []);
      }

      const activities = [];

      if (loansData.success && loansData.loans?.length) {
        const STATUS_TEXT = {
          pending: 'Pending review',
          approved: 'Approved',
          active: 'Active',
          completed: 'Completed',
          rejected: 'Rejected',
          overdue: 'Overdue',
          awaiting_member_approval: 'Review requested',
        };

        loansData.loans.slice(0, 5).forEach(loan => {
          activities.push({
            type: 'loan',
            title: `Loan ${STATUS_TEXT[loan.status] || loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}`,
            loanId: loan.loanId,
            amount: `₱${Number(loan.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            date: new Date(loan.appliedDate),
            status: loan.status,
          });
        });
      }

      if (loanPaymentsData.success && loanPaymentsData.payments?.length) {
        loanPaymentsData.payments.slice(0, 5).forEach(payment => {
          activities.push({
            type: 'loan',
            title: payment.status === 'confirmed' ? 'Loan Payment Confirmed' : 'Loan Payment Pending',
            loanId: payment.loanId,
            amount: `₱${Number(payment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            date: new Date(payment.submittedAt || payment.createdAt),
            status: payment.status,
          });
        });
      }

      if (donationsData.success && donationsData.donations?.length) {
        donationsData.donations
          .filter(donation => donation.status === 'confirmed')
          .slice(0, 5)
          .forEach(donation => {
            activities.push({
              type: 'donation',
              title: 'Donation Made',
              category: donation.category,
              amount: `₱${Number(donation.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              date: new Date(donation.createdAt),
            });
          });
      }

      if (attendanceData.success && attendanceData.attendance?.length) {
        attendanceData.attendance.slice(0, 3).forEach(record => {
          activities.push({
            type: 'attendance',
            title: 'Service Attended',
            category: record.service || record.branch,
            amount: '',
            date: new Date(record.createdAt),
          });
        });
      }

      if (savingsTxnData.success && savingsTxnData.transactions?.length) {
        savingsTxnData.transactions
          .filter(txn => txn.type === 'deposit')
          .slice(0, 5)
          .forEach(txn => {
            activities.push({
              type: 'savings',
              title: txn.status === 'confirmed' ? 'Savings Validated' : 'Savings Deposit',
              category: txn.goalName || 'General Savings',
              amount: `₱${Number(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              date: new Date(txn.date),
              status: txn.status
            });
          });
      }

      activities.sort((a, b) => b.date - a.date);

      // Dedup: if a loan has payment entries, remove the bare loan-application entry for that same loanId
      const loanIdsWithPayments = new Set(
        activities.filter(a => a.type === 'loan' && a.title.includes('Payment')).map(a => a.loanId)
      );
      const dedupedActivities = activities.filter(a =>
        !(a.type === 'loan' && !a.title.includes('Payment') && loanIdsWithPayments.has(a.loanId))
      );

      setRecentActivity(dedupedActivities.slice(0, 5));

    } catch (err) {
      console.error('Failed to parse dashboard data:', err);
    } finally {
      if (data) setLoading(false);
    }
  }, [data, isValidating, profile?.branch]);

  useEffect(() => {
    if (upcomingEvents.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentEventIndex(prev => (prev + 1) % upcomingEvents.length);
    }, 5000 * (1 + currentEventIndex / 10));
    return () => clearInterval(timer);
  }, [upcomingEvents.length, currentEventIndex]);

  const isOfficer = isOfficerPosition(profile?.position);
  
  const processedLoans = activeLoansList.map(l => {
    let isLate = l.isLate === true;
    if (!isLate && l.status === 'active' && l.disbursementDate) {
      const term = l.termMonths || 12;
      const paidMonths = l.paidMonths || 0;
      if (paidMonths < term) {
        const startDate = new Date(l.disbursementDate);
        const nextDue = new Date(startDate);
        nextDue.setMonth(startDate.getMonth() + paidMonths + 1);
        const cutoffDate = new Date(nextDue);
        cutoffDate.setDate(nextDue.getDate() + 3);
        cutoffDate.setHours(23, 59, 59, 999);
        if (Date.now() > cutoffDate.getTime()) {
          isLate = true;
        }
      }
    }
    return { ...l, isLate };
  });

  const lateLoansCount = processedLoans.filter(l => l.isLate).length;

  const renderActivityIcon = (activity) => {
    if (activity.type === 'loan') return <Banknote size={18} />;
    if (activity.type === 'donation') return <Heart size={18} />;
    if (activity.type === 'attendance') return <CalendarDays size={18} />;
    if (activity.type === 'savings') return <PiggyBank size={18} />;
    return <CheckCircle size={18} />;
  };

  const formatTimeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 0) {
      if (diff > -60000) return 'Just now';
      return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const quickActions = [
    {
      title: 'Make a Donation',
      description: 'Support the church today',
      iconBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
      action: () => navigate('/donation'),
      icon: <Heart size={18} />
    },
    {
      title: 'Check Attendance',
      description: 'View your attendance record',
      iconBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
      action: () => navigate('/attendance'),
      icon: <CalendarDays size={18} />
    },
    {
      title: 'Manage Savings',
      description: 'View and save for your goals',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
      action: () => navigate('/savings'),
      icon: <Wallet size={18} />
    },
    ...(isOfficer ? [
      {
        title: 'Loan Services',
        description: 'See history and apply for loans',
        iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
        action: () => navigate('/loans'),
        icon: <FileText size={18} />
      }
    ] : [])
  ];

  const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const DAILY_VERSES = useMemo(() => [
    { text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", ref: "Jeremiah 29:11" },
    { text: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to Him, and He will make your paths straight.", ref: "Proverbs 3:5-6" },
    { text: "I can do all this through Him who gives me strength.", ref: "Philippians 4:13" },
    { text: "The Lord is my shepherd, I lack nothing. He makes me lie down in green pastures, He leads me beside quiet waters, He refreshes my soul.", ref: "Psalm 23:1-3" },
    { text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.", ref: "Joshua 1:9" },
    { text: "And we know that in all things God works for the good of those who love Him, who have been called according to His purpose.", ref: "Romans 8:28" },
    { text: "The Lord bless you and keep you; the Lord make His face shine on you and be gracious to you.", ref: "Numbers 6:24-25" },
    { text: "Come to me, all you who are weary and burdened, and I will give you rest.", ref: "Matthew 11:28" },
    { text: "But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary.", ref: "Isaiah 40:31" },
    { text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.", ref: "Philippians 4:6" },
    { text: "The Lord is close to the brokenhearted and saves those who are crushed in spirit.", ref: "Psalm 34:18" },
    { text: "For God so loved the world that He gave His one and only Son, that whoever believes in Him shall not perish but have eternal life.", ref: "John 3:16" },
    { text: "He has shown you, O mortal, what is good. And what does the Lord require of you? To act justly and to love mercy and to walk humbly with your God.", ref: "Micah 6:8" },
    { text: "Delight yourself in the Lord, and He will give you the desires of your heart.", ref: "Psalm 37:4" },
    { text: "Cast all your anxiety on Him because He cares for you.", ref: "1 Peter 5:7" },
    { text: "The Lord is my light and my salvation — whom shall I fear? The Lord is the stronghold of my life — of whom shall I be afraid?", ref: "Psalm 27:1" },
    { text: "Give thanks to the Lord, for He is good; His love endures forever.", ref: "Psalm 107:1" },
    { text: "But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control.", ref: "Galatians 5:22-23" },
    { text: "Therefore, if anyone is in Christ, the new creation has come: The old has gone, the new is here!", ref: "2 Corinthians 5:17" },
    { text: "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.", ref: "2 Corinthians 9:7" },
    { text: "Commit to the Lord whatever you do, and He will establish your plans.", ref: "Proverbs 16:3" },
    { text: "So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you.", ref: "Isaiah 41:10" },
    { text: "This is the day the Lord has made; let us rejoice and be glad in it.", ref: "Psalm 118:24" },
    { text: "Every good and perfect gift is from above, coming down from the Father of the heavenly lights.", ref: "James 1:17" },
    { text: "And let us not grow weary of doing good, for in due season we will reap, if we do not give up.", ref: "Galatians 6:9" },
    { text: "The name of the Lord is a fortified tower; the righteous run to it and are safe.", ref: "Proverbs 18:10" },
    { text: "God is our refuge and strength, an ever-present help in trouble.", ref: "Psalm 46:1" },
    { text: "Love is patient, love is kind. It does not envy, it does not boast, it is not proud.", ref: "1 Corinthians 13:4" },
    { text: "Let everything that has breath praise the Lord.", ref: "Psalm 150:6" },
    { text: "Above all, love each other deeply, because love covers over a multitude of sins.", ref: "1 Peter 4:8" },
    { text: "A cheerful heart is good medicine, but a crushed spirit dries up the bones.", ref: "Proverbs 17:22" },
  ], []);

  const dailyVerse = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / 86400000);
    return DAILY_VERSES[dayOfYear % DAILY_VERSES.length];
  }, [DAILY_VERSES]);

  const nextPaymentInfo = useMemo(() => {
    if (!isOfficer || processedLoans.length === 0) return null;
    const activeLoans = processedLoans.filter(l => l.status === 'active' && l.disbursementDate);
    if (activeLoans.length === 0) return null;

    let soonest = null;
    activeLoans.forEach(l => {
      const paidMonths = l.paidMonths || 0;
      const term = l.termMonths || 12;
      if (paidMonths >= term) return;
      const start = new Date(l.disbursementDate);
      const nextDue = new Date(start);
      nextDue.setMonth(start.getMonth() + paidMonths + 1);
      if (!soonest || nextDue < soonest.dueDate) {
        soonest = {
          loanId: l.loanId,
          dueDate: nextDue,
          monthlyPayment: l.monthlyPayment || (l.amount / (l.termMonths || 12)),
          remainingBalance: l.remainingBalance != null ? l.remainingBalance : l.amount,
          isLate: l.isLate,
        };
      }
    });
    return soonest;
  }, [isOfficer, processedLoans]);

  const topSavingsGoal = useMemo(() => {
    if (savingsGoalsList.length === 0) return null;
    return savingsGoalsList.reduce((best, g) => {
      const pct = g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) : 0;
      const bestPct = best.targetAmount > 0 ? (best.savedAmount / best.targetAmount) : 0;
      return pct > bestPct ? g : best;
    }, savingsGoalsList[0]);
  }, [savingsGoalsList]);

  const formatAuthorName = (name) => {
    if (!name) return 'Anonymous';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    const firstNames = parts.slice(0, -1).join(' ');
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstNames} ${lastInitial}.`;
  };

  const handlePostPrayer = async () => {
    if (!newPrayer.trim()) return;
    try {
      const author = formatAuthorName(profile?.fullName);
      const res = await fetch(`${API}/api/prayers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: newPrayer.trim(), author })
      });
      const data = await res.json();
      if (data.success) {
        setPrayers([data.prayer, ...prayers]);
        setNewPrayer("");
      }
    } catch (err) {
      console.error('Error posting prayer:', err);
    }
  };



  return (
    <div className="space-y-5 w-full pb-8">

      {/* Page Header matching Savings/Loans/Attendance */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-white/10 font-inter">
        <div>
          <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-inter mb-0.5">Overview &amp; Dashboard</p>
          <h1 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 dark:text-white font-dm leading-none tracking-tight">
            Welcome back, <span className="text-blue-600 dark:text-blue-400">{profile?.fullName ? profile.fullName.trim().split(' ')[0] : 'Member'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-inter mt-1">
            Here is your personal overview, savings status, and the latest announcements from your IsangDiwa community.
          </p>
        </div>

        {/* Right info chips */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 text-xs font-inter font-semibold text-slate-700 dark:text-slate-200 shadow-xs">
            <MapPin size={14} className="text-blue-600 dark:text-blue-400" />
            <span>{profile?.branch || 'Main Community Branch'}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 text-xs font-inter font-semibold text-slate-700 dark:text-slate-200 shadow-xs">
            <Clock size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Savings Stat Card */}
        <div 
          onClick={() => navigate('/savings')}
          className="group relative bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Total Savings</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100/60 dark:border-emerald-900/30 shrink-0 group-hover:scale-105 transition-transform">
              <PiggyBank size={16} />
            </div>
          </div>
          {loading ? (
            <div className="h-7 w-32 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-md" />
          ) : (
            <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-tight">
              {formatCurrency(savingsStats.totalSavings)}
            </div>
          )}
          {!loading && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-inter">+{formatCurrency(savingsStats.thisMonth)} this month</p>
          )}
        </div>

        {/* Active Loans Stat Card (Officers only) */}
        {isOfficer ? (
          <div 
            onClick={() => navigate('/loans')}
            className="group relative bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Active Loans</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100/60 dark:border-blue-900/30 shrink-0 group-hover:scale-105 transition-transform">
                <Banknote size={16} />
              </div>
            </div>
            {loading ? (
              <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-md" />
            ) : (
              <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-tight">
                {loanStats.activeCount}
              </div>
            )}
            {!loading && (
              <p className={`text-xs font-inter ${
                lateLoansCount > 0 
                  ? 'text-rose-600 dark:text-rose-400' 
                  : 'text-slate-500 dark:text-slate-400'
              }`}>
                {lateLoansCount > 0 ? `${lateLoansCount} late payment${lateLoansCount > 1 ? 's' : ''}` : rejectedLoansCount > 0 ? `${rejectedLoansCount} rejected` : 'No overdue loans'}
              </p>
            )}
          </div>
        ) : null}

        {/* Total Donated Stat Card */}
        <div 
          onClick={() => navigate('/donation')}
          className="group relative bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Total Donated</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100/60 dark:border-rose-900/30 shrink-0 group-hover:scale-105 transition-transform">
              <Heart size={16} />
            </div>
          </div>
          {loading ? (
            <div className="h-7 w-32 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-md" />
          ) : (
            <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-tight">
              {formatCurrency(donationStats.totalDonated)}
            </div>
          )}
          {!loading && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-inter">{monthlyDonationCount} contribution{monthlyDonationCount !== 1 ? 's' : ''} this month</p>
          )}
        </div>

        {/* Today's Verse Mini Stat Card */}
        <div className="bg-gradient-to-br from-[#0B1736] via-[#0D1F45] to-[#1E3A8A] text-white rounded-2xl p-4 sm:p-4.5 shadow-sm relative overflow-hidden flex flex-col gap-2 border border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-6.5 h-6.5 rounded-lg bg-amber-400/20 text-[#F5C800] flex items-center justify-center">
              <BookOpen size={14} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#F5C800] font-inter">Today's Verse</span>
          </div>
          
          <p className="font-cormorant italic text-xs sm:text-sm text-white/95 leading-snug line-clamp-2">
            "{dailyVerse.text}"
          </p>
          
          <div className="pt-1 border-t border-white/10">
            <span className="font-inter text-[11px] font-bold text-[#F5C800] tracking-wide uppercase">
              — {dailyVerse.ref}
            </span>
          </div>
        </div>

      </div>

      {/* Main Content Grid: [Left col: QA + Overview] [Right col: Announcements] */}
      <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.5fr] gap-6">

        {/* Left column: Quick Actions stacked above My Overview */}
        <div className="flex flex-col gap-6">

          {/* Quick Actions — compact */}
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Quick Actions</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 font-inter">{quickActions.length} Shortcuts</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={action.action}
                  className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-blue-500/30 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-blue-50/40 dark:hover:bg-slate-800/80 transition-all duration-200 cursor-pointer text-left w-full group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${action.iconBg}`}>
                    {action.icon}
                  </div>
                  <span className="font-inter text-xs font-semibold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">{action.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* My Overview Card */}
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-sm flex flex-col justify-between flex-1">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-white/5">
                <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">My Overview</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-inter">Personal Stats</span>
              </div>

              {/* Top Savings Goal Block */}
              <div className="mb-4 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Target size={15} />
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 font-inter uppercase tracking-wide">Top Savings Goal</h3>
                  </div>
                  {topSavingsGoal && (
                    <button onClick={() => navigate('/savings')} className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline border-none bg-transparent cursor-pointer">Manage →</button>
                  )}
                </div>

                {topSavingsGoal ? (() => {
                  const pct = topSavingsGoal.targetAmount > 0
                    ? Math.min(100, Math.round((topSavingsGoal.savedAmount / topSavingsGoal.targetAmount) * 100))
                    : 0;
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-900 dark:text-white font-inter">
                        <span className="truncate max-w-[170px]">{topSavingsGoal.name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden p-0.5">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-inter pt-0.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(topSavingsGoal.savedAmount)}</span>
                        <span>Target: {formatCurrency(topSavingsGoal.targetAmount)}</span>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="text-center py-4 bg-white dark:bg-white/5 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-inter mb-2">No active savings goal set</p>
                    <button onClick={() => navigate('/savings')} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline border-none bg-transparent cursor-pointer">
                      + Create a Goal
                    </button>
                  </div>
                )}
              </div>

              {/* Officer Next Loan Payment Reminder */}
              {isOfficer && nextPaymentInfo && (
                <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 space-y-2 font-inter text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Banknote size={15} className="text-blue-600 dark:text-blue-400" />
                      <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px] tracking-wide">Next Payment Due</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[10px]">
                      {new Date(nextPaymentInfo.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 pt-1">
                    <span>Due Amount:</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{formatCurrency(nextPaymentInfo.monthlyPayment)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Community Prayer Wall Button */}
            <button
              onClick={() => setShowPrayerModal(true)}
              className="w-full mt-4 flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-indigo-500/10 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200/60 dark:border-purple-800/40 text-purple-700 dark:text-purple-300 text-xs font-semibold hover:border-purple-300 dark:hover:border-purple-700/60 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Heart size={14} />
                </div>
                <span className="font-inter">Community Prayer Wall</span>
              </div>
              <span className="bg-purple-200/80 dark:bg-purple-900/80 text-purple-800 dark:text-purple-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                {prayers.length} Requests
              </span>
            </button>
          </div>

        </div>

        {/* Announcements & Events Carousel Card */}
        <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full">
          <div className="flex flex-col flex-1">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Announcements &amp; Events</h2>
              <button onClick={() => setShowAllEvents(true)} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 border-none bg-transparent cursor-pointer">
                See All →
              </button>
            </div>

            {upcomingEvents.length > 0 ? (
              <div
                className="relative rounded-2xl overflow-hidden bg-slate-900 min-h-[280px] sm:min-h-[310px] flex-1 group cursor-pointer shadow-md mb-2"
                onClick={() => { setSelectedEvent(upcomingEvents[currentEventIndex]); setModalImageIndex(0); }}
              >
                <img
                  src={upcomingEvents[currentEventIndex]?.images?.[0] || upcomingEvents[currentEventIndex]?.image || ''}
                  alt=""
                  className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700 absolute inset-0"
                />
                <div className="absolute top-3 left-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-2 text-center border border-white/20 shadow-md z-10">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 font-inter">{upcomingEvents[currentEventIndex]?.month}</span>
                  <span className="block text-base font-extrabold text-slate-900 dark:text-white font-dm leading-none">{upcomingEvents[currentEventIndex]?.day}</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-4 flex flex-col justify-end z-10">
                  <span className="inline-block self-start text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F5C800] text-slate-950 font-inter mb-1.5">{upcomingEvents[currentEventIndex]?.category}</span>
                  <h3 className="text-base font-bold text-white font-inter line-clamp-1 mb-1 group-hover:text-[#F5C800] transition-colors">{upcomingEvents[currentEventIndex]?.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-300 font-inter">
                    <span className="flex items-center gap-1"><Clock size={12} className="text-[#F5C800]" /> {upcomingEvents[currentEventIndex]?.time || 'All Day'}</span>
                    <span className="flex items-center gap-1"><MapPin size={12} className="text-emerald-400" /> {upcomingEvents[currentEventIndex]?.branch?.split(',')[0]}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="min-h-[260px] flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 mb-2">
                <CalendarDays size={36} className="mb-2 opacity-40 text-blue-500" />
                <p className="text-xs font-inter font-medium">No upcoming events scheduled</p>
              </div>
            )}
          </div>

          {/* Dots & Nav Controls */}
          {upcomingEvents.length > 1 && (
            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-1.5">
                {upcomingEvents.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentEventIndex(i)}
                    className={`h-2 rounded-full transition-all duration-300 border-none cursor-pointer ${
                      i === currentEventIndex ? 'w-6 bg-blue-600 dark:bg-blue-400' : 'w-2 bg-slate-300 dark:bg-slate-700'
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentEventIndex((prev) => (prev === 0 ? upcomingEvents.length - 1 : prev - 1))} className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer transition-colors border-none">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setCurrentEventIndex((prev) => (prev + 1) % upcomingEvents.length)} className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer transition-colors border-none">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>


      {/* Bottom Grid: Recent Activity & Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Activity Card */}
        <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-white/5">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Recent Activity</h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-inter">Latest Actions</span>
          </div>

          {recentActivity.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center py-6 px-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800/40 dark:to-blue-950/20 border border-dashed border-slate-200 dark:border-white/10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-center mx-auto mb-3">
                <Sparkles size={22} className="text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 font-inter mb-1">No activity yet</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-inter mb-4">Start by making a donation, savings deposit, or attending a service.</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button onClick={() => navigate('/donation')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-100 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors cursor-pointer border-none">
                  <Heart size={12} /> Donate
                </button>
                <button onClick={() => navigate('/savings')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-100 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer border-none">
                  <PiggyBank size={12} /> Save
                </button>

              </div>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline spine */}
              <div className="absolute left-[21px] top-4 bottom-4 w-px bg-slate-100 dark:bg-white/5" />
              <div className="space-y-1">
                {recentActivity.map((act, index) => {
                  const iconBg =
                    act.type === 'savings'  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' :
                    act.type === 'loan'     ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400' :
                    act.type === 'donation' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' :
                                             'bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400';
                  const amountColor =
                    act.type === 'savings'  ? 'text-emerald-600 dark:text-emerald-400' :
                    act.type === 'loan'     ? 'text-blue-600 dark:text-blue-400' :
                    act.type === 'donation' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white';
                  const isLast = index === recentActivity.length - 1;
                  return (
                    <div key={index} className={`flex items-center gap-3 py-2.5 ${!isLast ? 'border-b border-slate-100 dark:border-white/5' : ''}`}>
                      <div className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                        {renderActivityIcon(act)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-slate-900 dark:text-white font-inter block leading-snug truncate">{act.title}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-inter block truncate mt-0.5">
                              {act.loanId ? `Loan #${act.loanId}` : act.category || 'General'}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            {act.amount && (
                              <span className={`text-sm font-bold font-dm block ${amountColor}`}>{act.amount}</span>
                            )}
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-inter block mt-0.5">{formatTimeAgo(act.date)}</span>
                          </div>
                        </div>
                        {act.status && (act.status === 'pending' || act.status === 'rejected') && (
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            act.status === 'pending'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          }`}>
                            {act.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Calendar + Events — single merged card */}
        {(() => {
          const year = calendarDate.getFullYear();
          const month = calendarDate.getMonth();
          const firstDay = new Date(year, month, 1);
          const startWeekday = (firstDay.getDay() + 6) % 7;
          const daysInMonth = new Date(year, month + 1, 0).getDate();

          const now = new Date();
          const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
          const today = isCurrentMonth ? now.getDate() : -1;

          const eventDays = {};
          allAnnouncements.forEach(evt => {
            if (evt.dateObj) {
              const d = new Date(evt.dateObj);
              if (d.getMonth() === month && d.getFullYear() === year) {
                const day = d.getDate();
                if (!eventDays[day]) eventDays[day] = [];
                eventDays[day].push(evt);
              }
            }
          });

          const cells = [];
          for (let i = 0; i < startWeekday; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);

          const monthEvents = allAnnouncements
            .filter(evt => {
              if (!evt.dateObj) return false;
              const d = new Date(evt.dateObj);
              return d.getMonth() === month && d.getFullYear() === year;
            })
            .sort((a, b) => new Date(a.dateObj) - new Date(b.dateObj));

          const catColor = (cat) => {
            const map = {
              Events:    { dot: 'bg-orange-400', pill: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300' },
              General:   { dot: 'bg-blue-400',   pill: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
              Prayer:    { dot: 'bg-purple-400',  pill: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
              Services:  { dot: 'bg-emerald-400', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
              Donations: { dot: 'bg-pink-400',    pill: 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300' },
              Urgent:    { dot: 'bg-rose-500',    pill: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
            };
            return map[cat] || { dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
          };

          return (
            <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">

              {/* Dark gradient header */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-[#0f172a] dark:to-[#1E2130] px-4 pt-3 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-sm font-extrabold text-white font-dm leading-tight">
                      {firstDay.toLocaleDateString('en-US', { month: 'long' })}{' '}
                      <span className="text-slate-400 font-medium text-xs">{year}</span>
                    </h2>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border-none cursor-pointer transition-colors"
                      aria-label="Previous month"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border-none cursor-pointer transition-colors"
                      aria-label="Next month"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Day labels */}
                <div className="grid grid-cols-7 text-center">
                  {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d, idx) => (
                    <span key={idx} className="text-[9px] font-bold text-slate-500 py-0.5 font-inter">{d}</span>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-y-0.5 text-center font-inter">
                  {cells.map((day, i) => (
                    <div
                      key={i}
                      onClick={() => { if (day && eventDays[day]) { setSelectedEvent(eventDays[day][0]); setModalImageIndex(0); } }}
                      className={`h-6 flex flex-col items-center justify-center text-[11px] font-semibold transition-all relative mx-auto w-6 rounded-full ${
                        !day ? 'invisible' : eventDays[day] ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        day === today
                          ? 'bg-blue-500 text-white shadow-md shadow-blue-500/40 font-bold'
                          : eventDays[day]
                          ? 'text-white hover:bg-white/15'
                          : 'text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {day}
                      {day && eventDays[day] && day !== today && (
                        <span className="w-1 h-1 rounded-full bg-amber-400 absolute bottom-0.5" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"><span className="text-[9px] font-bold text-white">{today > 0 ? today : '·'}</span></div>
                    <span className="text-[10px] text-slate-400 font-inter">Today</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 block" />
                    <span className="text-[10px] text-slate-400 font-inter">Has event</span>
                  </div>
                  {monthEvents.length > 0 && (
                    <div className="ml-auto">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-inter">
                        {monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Events list — white section */}
              <div className="p-3">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-inter">Scheduled Events</p>

                {monthEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-3 px-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center mb-1.5">
                      <CalendarDays size={18} className="text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Nothing scheduled</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-inter mt-0.5">Navigate months to see events</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {monthEvents.map((evt, i) => {
                      const d = new Date(evt.dateObj);
                      const dayNum = d.getDate();
                      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                      const isPast = d < new Date();
                      const colors = catColor(evt.category);
                      return (
                        <button
                          key={i}
                          onClick={() => { setSelectedEvent(evt); setModalImageIndex(0); }}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer group text-left ${
                            isPast
                              ? 'border-slate-100 dark:border-white/5 opacity-50'
                              : 'border-slate-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-blue-800/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/20'
                          }`}
                        >
                          {/* Date badge */}
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">{dayName}</span>
                            <span className={`text-sm font-extrabold leading-tight font-dm ${isPast ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>{dayNum}</span>
                          </div>
                          {/* Color bar */}
                          <div className={`w-0.5 h-7 rounded-full shrink-0 ${colors.dot}`} />
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-slate-800 dark:text-white font-inter block truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {evt.title}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${colors.pill}`}>{evt.category}</span>
                              {evt.time && (
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5 font-inter">
                                  <Clock size={9} /> {evt.time}
                                </span>
                              )}
                           </div>
                         </div>
                         <ChevronRight size={13} className="text-slate-300 dark:text-slate-600 group-hover:text-blue-400 transition-colors shrink-0" />
                       </button>
                     );
                   })}
                 </div>
               )}
             </div>
           </div>
         );
        })()}

      </div>


      {/* Prayer Wall Modal */}
      {showPrayerModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-4" onClick={() => setShowPrayerModal(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-lg overflow-hidden border border-slate-200/80 dark:border-white/10 shadow-lg flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-inter">Community Prayer Wall</h2>
              <button onClick={() => setShowPrayerModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex gap-2">
              <input
                type="text"
                className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-900 dark:text-white outline-none focus:border-[#1E3A8A]"
                placeholder="Share your prayer request..."
                value={newPrayer}
                onChange={(e) => setNewPrayer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePostPrayer(); }}
              />
              <button
                onClick={handlePostPrayer}
                className="bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white px-4 text-xs font-semibold rounded-xl"
              >
                Post
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {prayers.map((prayer) => (
                <div key={prayer._id || prayer.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <p className="text-xs text-slate-700 dark:text-slate-200 font-inter italic mb-2">"{prayer.text}"</p>
                  <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 font-inter">
                    <span className="font-semibold">{prayer.author}</span>
                    <span>{formatTimeAgo(prayer.createdAt || prayer.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-4 sm:p-6" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-3xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col md:flex-row max-h-[90vh]" onClick={e => e.stopPropagation()}>
            
            {/* Left Media Column */}
            <div className="w-full md:w-1/2 h-64 md:h-auto min-h-[280px] bg-slate-100 dark:bg-slate-900 relative flex flex-col justify-between overflow-hidden group shrink-0">
              <img 
                src={selectedEvent.images?.[modalImageIndex] || selectedEvent.image || ''} 
                alt={selectedEvent.title} 
                className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-105" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

              {/* Mobile Close Button */}
              <button 
                onClick={() => setSelectedEvent(null)} 
                className="md:hidden absolute top-3.5 right-3.5 bg-black/50 hover:bg-black text-white p-2 rounded-full backdrop-blur-md border border-white/20 z-10 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              {/* Category overlay badge */}
              <div className="relative z-10 p-4 sm:p-5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-white/90 dark:bg-slate-900/90 text-blue-700 dark:text-blue-400 backdrop-blur-md border border-slate-200/50 dark:border-white/10 shadow-xs">
                  <Sparkles size={12} className="text-[#F5C800]" />
                  {selectedEvent.category || 'Event'}
                </span>
              </div>

              {/* Bottom Image Navigation dots if multiple images exist */}
              {selectedEvent.images && selectedEvent.images.length > 1 && (
                <div className="relative z-10 p-4 flex items-center justify-center gap-2">
                  {selectedEvent.images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setModalImageIndex(idx)}
                      className={`h-2 rounded-full transition-all duration-300 border-none cursor-pointer ${
                        idx === modalImageIndex ? 'w-6 bg-white' : 'w-2 bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right Details Column */}
            <div className="p-6 sm:p-8 w-full md:w-1/2 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-5">
                
                {/* Header Row */}
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block font-inter mb-1">
                      Official Announcement
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold font-inter text-slate-900 dark:text-white leading-snug">
                      {selectedEvent.title}
                    </h2>
                  </div>
                  <button 
                    onClick={() => setSelectedEvent(null)} 
                    className="hidden md:flex w-9 h-9 rounded-full items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-all border-none cursor-pointer shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Event Schedule & Location Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-inter">
                  <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-bold">
                      <CalendarDays size={14} />
                      <span>Date</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {selectedEvent.dateObj?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || 'Scheduled'}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold">
                      <Clock size={14} />
                      <span>Time</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {selectedEvent.time || 'All Day'}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                      <MapPin size={14} />
                      <span>Venue</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {selectedEvent.branch || 'All Branches'}
                    </span>
                  </div>
                </div>

                {/* Announcement Content Block */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/10 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 to-indigo-600" />
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-inter leading-relaxed whitespace-pre-line">
                    "{selectedEvent.fullBody || selectedEvent.body}"
                  </p>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-400 font-inter">
                <span>IsangDiwa Community Event</span>
                <span className="text-[11px] font-semibold text-slate-400">Official Notice</span>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* All Events / Announcements Modal */}
      {showAllEvents && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-4 sm:p-6" onClick={() => setShowAllEvents(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl sm:rounded-3xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-lg flex flex-col max-h-[90vh] font-inter" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-dm">All Announcements & Events</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                    {allAnnouncements.length} Total
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Stay updated with official community news and service schedules</p>
              </div>
              <button onClick={() => setShowAllEvents(false)} className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-white/10 border-none cursor-pointer transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* List Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {allAnnouncements.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 font-medium">No announcements found</div>
              ) : (
                allAnnouncements.map((evt, i) => {
                  const hasImage = !!(evt.images?.[0] || evt.image);
                  const imgUrl = evt.images?.[0] || evt.image;

                  return (
                    <div 
                      key={i} 
                      onClick={() => { setShowAllEvents(false); setSelectedEvent(evt); setModalImageIndex(0); }}
                      className="group flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-slate-50/80 dark:bg-white/5 hover:bg-white dark:hover:bg-slate-800/80 border border-slate-200/60 dark:border-white/10 hover:border-blue-500/40 hover:shadow-lg transition-all duration-300 cursor-pointer"
                    >
                      {/* Left Thumbnail or Date Pill */}
                      <div className="shrink-0">
                        {hasImage ? (
                          <div className="w-full sm:w-36 h-40 sm:h-28 rounded-xl overflow-hidden relative bg-slate-900 border border-slate-200/60 dark:border-white/10">
                            <img src={imgUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-bold text-white uppercase tracking-wider">
                              {evt.month} {evt.day}
                            </div>
                          </div>
                        ) : (
                          <div className="w-full sm:w-28 h-20 sm:h-28 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex flex-col items-center justify-center p-3 text-center shadow-xs">
                            <span className="text-xs font-bold uppercase tracking-wider text-blue-200 font-inter">{evt.month || 'EVENT'}</span>
                            <span className="text-2xl font-extrabold font-dm leading-none mt-1">{evt.day || '•'}</span>
                          </div>
                        )}
                      </div>

                      {/* Right Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40">
                              {evt.category || 'General'}
                            </span>
                            {evt.branch && (
                              <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-inter">
                                <MapPin size={12} className="text-emerald-500" />
                                <span className="truncate max-w-[180px]">{evt.branch.split(',')[0]}</span>
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-bold text-slate-900 dark:text-white font-inter group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                            {evt.title}
                          </h4>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-inter line-clamp-2 mt-1.5 leading-relaxed">
                            {evt.body}
                          </p>
                        </div>

                        {/* Footer details row */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-white/5 text-xs text-slate-400 dark:text-slate-500 font-inter">
                          <span className="flex items-center gap-1.5">
                            <Clock size={13} className="text-[#F5C800]" />
                            {evt.time || 'All Day'}
                          </span>
                          <span className="font-semibold text-xs text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                            View details <ChevronRight size={14} />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
