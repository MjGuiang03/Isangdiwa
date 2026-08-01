import { useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import LoanApplicationModal from '../components/LoanApplicationModal';

import API from '../../utils/api';
import { Banknote, Lock as LockIcon, X, Wallet, ShieldAlert, Clock, CheckCircle2, Plus, HelpCircle, ShieldCheck, Layers, Zap, ArrowRight } from 'lucide-react';
import { isOfficerPosition } from '../../utils/officerPositions';

const fmt = (n) =>
  n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₱0.00';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const LIMIT = 5;

const STATUS_CLASS = {
  pending:    'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/30',
  approved:   'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30',
  active:     'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30',
  completed:  'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30',
  rejected:   'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/30',
  overdue:    'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/30',
  cancelled:  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10',
};

const STATUS_TEXT = {
  pending:    'Pending review',
  approved:   'Approved',
  active:     'Active',
  completed:  'Completed',
  rejected:   'Rejected',
  overdue:    'Overdue',
  awaiting_member_approval: 'Review requested',
  cancelled:  'Cancelled',
};

export default function Loans() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loans,        setLoans]        = useState([]);
  const [stats,        setStats]        = useState({ totalBorrowed: 0, remainingBalance: 0, activeCount: 0 });
  const [dataLoading,  setDataLoading]  = useState(true);
  const [error,        setError]        = useState(null);
  const [page,         setPage]         = useState(1);
  const [totalCount,   setTotalCount]   = useState(0);

  const [totalSavings, setTotalSavings] = useState(0);
  const [pendingSavings, setPendingSavings] = useState(0);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);

  const [cancelModalData, setCancelModalData] = useState({ open: false, loanId: null });
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonOther, setCancelReasonOther] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [showInstruction, setShowInstruction] = useState(false);
  const [hasClosedInstruction, setHasClosedInstruction] = useState(false);

  /* ── Verification & Active Loan Logic ── */
  const profile = user;
  const isVerified = isOfficerPosition(profile?.position);
  const hasActiveLoan = loans.some(l => ['active', 'pending', 'approved', 'overdue', 'awaiting_member_approval'].includes(l.status));
  const nextDueLoan = loans.find(l => l.status === 'active' && l.nextPaymentDate);

  // Redirect non-officers away from this page
  useEffect(() => {
    if (profile && !isVerified) {
      navigate('/home', { replace: true });
    }
  }, [profile, isVerified, navigate]);

  const token = localStorage.getItem('token');
  const fetcher = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.ok ? res.json() : { success: false });

  const { data: loansData, mutate: mutateLoans } = useSWR(
    token ? `${API}/api/loans/my-loans?page=${page}&limit=${LIMIT}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const { data: statsData, mutate: mutateStats } = useSWR(
    token ? `${API}/api/savings/stats` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const mutate = () => {
    mutateLoans();
    mutateStats();
  };

  useEffect(() => {
    if (!loansData) return;
    if (loansData.success) {
      setLoans(loansData.loans || []);
      setStats(loansData.stats || { totalBorrowed: 0, remainingBalance: 0, activeCount: 0 });
      setTotalCount(loansData.pagination?.totalItems || 0);
      setError(null);
      if ((loansData.loans || []).length === 0 && !hasClosedInstruction) {
        setShowInstruction(true);
      }
    } else {
      setError(loansData?.message || 'Failed to fetch loans');
    }
  }, [loansData, hasClosedInstruction]);

  useEffect(() => {
    if (!statsData) return;
    if (statsData.success) {
      setTotalSavings(statsData.stats?.totalSavings || 0);
      setPendingSavings(statsData.stats?.pendingSavings || 0);
    }
  }, [statsData]);

  useEffect(() => {
    if (loansData) setDataLoading(false);
  }, [loansData]);

  const handleApplyClick = () => {
    if (!isVerified) {
      navigate('/settings');
    } else if (totalSavings < 1000) {
      setError('Insufficient savings to apply for a loan.');
    } else {
      setIsLoanModalOpen(true);
    }
  };

  const handleLoanClose = () => { setIsLoanModalOpen(false); mutate(); };

  const handleCancelClick = (loanId) => {
    setCancelModalData({ open: true, loanId });
    setCancelReason('');
    setCancelReasonOther('');
  };

  const closeCancelModal = () => {
    setCancelModalData({ open: false, loanId: null });
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancelReason) {
      toast.error('Please select a reason for cancellation');
      return;
    }
    const finalReason = cancelReason === 'Other' ? cancelReasonOther : cancelReason;
    if (!finalReason.trim()) {
      toast.error('Please specify the reason');
      return;
    }

    setIsCancelling(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/loans/${cancelModalData.loanId}/cancel`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ reason: finalReason })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Loan application cancelled");
        closeCancelModal();
        mutate();
      } else {
        toast.error(data.message || "Failed to cancel loan");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  const renderLockedNotice = () => (
    <div className="bg-white dark:bg-[#1E2130] border border-amber-200/80 dark:border-amber-900/50 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-inter">
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/30">
          <LockIcon size={18} />
        </div>
        <div className="space-y-0.5">
          <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200 font-inter">Unlock Your Loan Privileges</h3>
          <p className="text-xs text-amber-700 dark:text-amber-300 font-inter">
            Grow your savings to <strong className="font-bold">₱1,000</strong> to unlock access to our loan programs.
          </p>
          <div className="flex items-center gap-4 text-[11px] pt-1 text-amber-800 dark:text-amber-300 font-inter">
            <span><strong className="font-semibold">Confirmed:</strong> ₱{Number(totalSavings).toLocaleString()}</span>
            {pendingSavings > 0 && (
              <span className="text-amber-600 dark:text-amber-400"><strong className="font-semibold">Pending:</strong> ₱{Number(pendingSavings).toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>
      <button className="h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs font-inter transition-all shrink-0 cursor-pointer border-none shadow-sm" onClick={() => navigate('/savings')}>
        Open / Fund Savings
      </button>
    </div>
  );

  const renderPolicyBar = () => (
    <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex items-center gap-3 font-inter">
      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
        <Banknote size={16} />
      </div>
      <div className="text-xs text-slate-600 dark:text-slate-300 font-inter">
        <strong className="font-bold text-slate-900 dark:text-white">Loan Policy:</strong> Repayments are automatically tracked. Ensure your savings balance remains sufficient for your loan bracket.
      </div>
    </div>
  );

  const renderLoanTypes = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Available Loan Types</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            type: 'Personal Loan',
            description: 'For personal needs such as education or family expenses.',
            term: '3 - 12 months',
            rate: '2% / month',
            maxAmount: 'Up to 2× savings',
            icon: <Wallet size={18} className="text-blue-600 dark:text-blue-400" />,
            badge: 'bg-blue-50 dark:bg-blue-950/50 border-blue-100 dark:border-blue-900/40'
          },
          {
            type: 'Emergency Loan',
            description: 'For urgent situations like medical emergencies.',
            term: '1 - 6 months',
            rate: '1.5% / month',
            maxAmount: 'Up to 1.5× savings',
            icon: <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400" />,
            badge: 'bg-amber-50 dark:bg-amber-950/50 border-amber-100 dark:border-amber-900/40'
          },
          {
            type: 'Short-term Loan',
            description: 'Quick cash with faster processing & shorter repayment.',
            term: '1 - 3 months',
            rate: '1% / month',
            maxAmount: 'Up to 1× savings',
            icon: <Clock size={18} className="text-teal-600 dark:text-teal-400" />,
            badge: 'bg-teal-50 dark:bg-teal-950/50 border-teal-100 dark:border-teal-900/40'
          }
        ].map(lt => (
          <div key={lt.type} className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3 font-inter">
            <div className="space-y-2.5">
              <div className={`w-9 h-9 rounded-xl ${lt.badge} border flex items-center justify-center`}>
                {lt.icon}
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white font-inter">{lt.type}</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed font-inter">{lt.description}</p>
              </div>
            </div>
            <div className="border-t border-slate-100 dark:border-white/5 pt-2.5 space-y-1.5 text-[11px] font-inter">
              <div className="flex items-center justify-between"><span className="text-slate-400">Term</span><span className="font-semibold text-slate-900 dark:text-white">{lt.term}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">Interest rate</span><span className="font-semibold text-slate-900 dark:text-white">{lt.rate}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">Max loanable</span><span className="font-semibold text-slate-900 dark:text-white">{lt.maxAmount}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPageSkeleton = () => (
    <div className="space-y-4 w-full pb-8 animate-pulse font-inter">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-white/10">
        <div className="space-y-2">
          <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
          <div className="h-7 w-36 bg-slate-200 dark:bg-slate-700/80 rounded-lg" />
          <div className="h-3.5 w-64 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700/80 rounded-xl" />
          <div className="h-10 w-36 bg-slate-200 dark:bg-slate-700/80 rounded-xl" />
        </div>
      </div>

      {/* 3 Stat Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/80 rounded" />
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700/80 shrink-0" />
            </div>
            <div className="h-7 w-28 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
            <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700/80 rounded" />
          </div>
        ))}
      </div>

      {/* 60/40 Layout Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 pt-1">
        {/* Left Column (3 cols) Skeleton */}
        <div className="lg:col-span-3 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700/80 rounded pb-2 border-b border-slate-100 dark:border-white/5" />
          <div className="space-y-3">
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700/80 rounded" />
            <div className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
            <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
          </div>
        </div>

        {/* Right Column (2 cols) Skeleton */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/5">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700/80 rounded" />
            <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700/80 rounded" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Loan Types Skeleton */}
      <div className="space-y-3 pt-2">
        <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700/80 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((k) => (
            <div key={k} className="h-44 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm" />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {dataLoading ? renderPageSkeleton() : (
        <div className="space-y-2.5 w-full pb-8 font-inter">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-white/10">
            <div>
              <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-inter mb-0.5">Credit &amp; Loans</p>
              <h1 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 dark:text-white font-dm leading-none tracking-tight">My Loans</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-inter mt-1">Repayments, loan applications &amp; brackets</p>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button 
                className="h-10 px-4 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold font-inter flex items-center gap-2 transition-all cursor-pointer border-none"
                onClick={() => setShowInstruction(true)}
              >
                <HelpCircle size={15} className="text-slate-400" />
                <span>Loan Guide</span>
              </button>

              {totalSavings >= 1000 && !hasActiveLoan && (
                <button 
                  className="h-10 px-4 rounded-xl bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white text-xs font-bold font-inter flex items-center gap-2 transition-all cursor-pointer border-none shadow-md active:scale-95"
                  onClick={handleApplyClick}
                >
                  <Plus size={16} />
                  <span>Apply for Loan</span>
                </button>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 text-xs flex justify-between items-center font-inter">
              <span>{error}</span>
              <button onClick={() => mutate()} className="font-bold underline cursor-pointer border-none bg-transparent">Retry</button>
            </div>
          )}

          {!error && (
            <>
              {isVerified && totalSavings < 1000 && renderLockedNotice()}
              {isVerified && hasActiveLoan && renderPolicyBar()}

              {/* Stats Cards Grid matching Savings.js */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Total Borrowed */}
                <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col gap-1 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-inter">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Total Borrowed</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100/60 dark:border-blue-900/30 shrink-0 group-hover:scale-105 transition-transform">
                      <Banknote size={16} />
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-none">
                    {fmt(stats.totalBorrowed)}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-inter mt-0.5">
                    {stats.activeCount > 0 
                      ? `${stats.activeCount} active loan(s)` 
                      : (loans.some(l => l.status === 'approved' || l.status === 'pending') 
                          ? 'Awaiting disbursement' 
                          : 'No active items')
                    }
                  </p>
                </div>

                {/* Remaining Balance */}
                <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col gap-1 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-inter">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Remaining Balance</span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100/60 dark:border-emerald-900/30 shrink-0 group-hover:scale-105 transition-transform">
                      <Wallet size={16} />
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-none">
                    {stats.activeCount > 0 ? fmt(stats.remainingBalance) : '₱0.00'}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-inter mt-0.5">
                    {stats.activeCount > 0 && stats.totalBorrowed > 0
                      ? `${Math.round((stats.remainingBalance / stats.totalBorrowed) * 100)}% outstanding`
                      : 'No active repayments'}
                  </p>
                </div>

                {/* Next Due Payment */}
                <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col gap-1 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-inter">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Next Due Payment</span>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100/60 dark:border-amber-900/30 shrink-0 group-hover:scale-105 transition-transform">
                      <Clock size={16} />
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-none">
                    {nextDueLoan ? fmt(nextDueLoan.upcomingPaymentAmount || nextDueLoan.monthlyPayment) : '₱0.00'}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-inter mt-0.5">
                    {nextDueLoan ? `Due ${fmtDate(nextDueLoan.nextPaymentDate)}` : (loans.some(l => l.status === 'approved' || l.status === 'pending') ? 'Pending disbursement' : 'No upcoming payments')}
                  </p>
                </div>
              </div>

              {/* Grid Layout with Savings Page Card Styling */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 pt-1">
                
                {/* LEFT COLUMN (60% - lg:col-span-3): Active Loan */}
                <div className="lg:col-span-3">
                  
                  {/* Active Loan Card Container matching Savings.js */}
                  {isVerified && (
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-md shadow-slate-200/50 dark:shadow-none space-y-4 font-inter h-full flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Active Loan</h2>
                        </div>

                        {loans.filter(l => ['active', 'pending', 'approved', 'awaiting_member_approval', 'overdue'].includes(l.status)).length === 0 ? (
                          <div className="py-8 px-4 text-center space-y-3 font-inter my-auto">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-100 dark:border-blue-900/30">
                              <Banknote size={22} />
                            </div>
                            <div className="max-w-md mx-auto space-y-1">
                              <h3 className="text-xs font-bold text-slate-900 dark:text-white">No active loan</h3>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">You don't have an active loan. Apply for a loan to get fast co-op funding.</p>
                            </div>
                            {totalSavings >= 1000 && (
                              <button className="h-9 px-4 rounded-xl bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white text-xs font-bold font-inter transition-all cursor-pointer border-none shadow-sm mt-1" onClick={handleApplyClick}>
                                Apply for a loan
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {loans.filter(l => ['active', 'pending', 'approved', 'awaiting_member_approval', 'overdue'].includes(l.status)).slice(0, 1).map((loan) => (
                              <div key={loan._id} className="space-y-4 font-inter">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div>
                                    <div className="flex items-center gap-2.5">
                                      <h3 className="text-base font-bold text-slate-900 dark:text-white font-dm">{loan.loanId}</h3>
                                      <span className={`px-2 py-0.5 rounded font-semibold uppercase text-[9px] tracking-wider leading-none ${STATUS_CLASS[loan.status] || 'bg-slate-100 text-slate-700'}`}>
                                        {STATUS_TEXT[loan.status] || loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{fmtDate(loan.appliedDate)} · {loan.purpose}</p>
                                  </div>
                                  <div className="sm:text-right">
                                    <div className="text-lg font-extrabold font-dm text-slate-900 dark:text-white">{fmt(loan.amount)}</div>
                                    <div className="text-[10px] text-slate-400 font-medium">Original amount</div>
                                  </div>
                                </div>

                                {loan.status === 'active' ? (
                                  <>
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                        <span>Repayment progress</span>
                                        <span className="font-semibold text-slate-900 dark:text-white">{loan.paidMonths || 0} of {loan.termMonths} payments made</span>
                                      </div>
                                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                          style={{ width: `${Math.max(2, Math.round(((loan.paidMonths || 0) / loan.termMonths) * 100))}%` }}
                                        />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 rounded-xl text-xs">
                                      <div>
                                        <div className="text-slate-400 text-[11px]">Monthly payment</div>
                                        <div className="font-bold text-slate-900 dark:text-white mt-0.5">{loan.monthlyPayment ? fmt(loan.monthlyPayment) : '—'}</div>
                                      </div>
                                      <div>
                                        <div className="text-slate-400 text-[11px]">Remaining balance</div>
                                        <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                                          {loan.remainingBalance != null ? fmt(loan.remainingBalance) : '—'}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-slate-400 text-[11px]">Next due date</div>
                                        <div className={`font-bold mt-0.5 ${loan.nextPaymentDate && new Date(loan.nextPaymentDate) < new Date() ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                                          {loan.nextPaymentDate ? fmtDate(loan.nextPaymentDate) : '—'}
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                ) : null}

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  {loan.status !== 'pending' && loan.status !== 'awaiting_member_approval' && (
                                    <>
                                      <button className="h-8 px-3 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold font-inter transition-all cursor-pointer border-none" onClick={() => navigate(`/loans/${loan.loanId}?tab=schedule`)}>
                                        View schedule
                                      </button>
                                      <button className="h-8 px-3 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold font-inter transition-all cursor-pointer border-none" onClick={() => navigate(`/loans/${loan.loanId}`)}>
                                        Loan details
                                      </button>
                                    </>
                                  )}
                                  {loan.status === 'active' && (
                                    <button className="h-8 px-4 rounded-xl bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white text-xs font-bold font-inter shadow-xs transition-all ml-auto cursor-pointer border-none" onClick={() => navigate(`/loans/${loan.loanId}?pay=true`)}>
                                      Pay now
                                    </button>
                                  )}
                                  {loan.status === 'approved' && (
                                    <button className="h-8 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold font-inter ml-auto cursor-not-allowed border-none" disabled title="Awaiting secretary disbursement">
                                      Awaiting disbursement
                                    </button>
                                  )}
                                  {['pending', 'awaiting_member_approval', 'approved'].includes(loan.status) && (
                                    <button 
                                      className="h-8 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold font-inter transition-all cursor-pointer border-none"
                                      style={{ marginLeft: loan.status === 'approved' ? '0' : 'auto' }}
                                      onClick={() => handleCancelClick(loan._id)}
                                    >
                                      Cancel application
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>

                {/* RIGHT COLUMN (40% - lg:col-span-2): Loan Records & History List Container */}
                <div className="lg:col-span-2">
                  <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col justify-between font-inter h-full">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Loan History</h2>
                        {totalCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                            {totalCount} items
                          </span>
                        )}
                      </div>

                      {loans.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 dark:text-slate-500 font-inter">
                          <div className="text-xs font-semibold">No loan records yet</div>
                          <div className="text-[11px]">Your loan applications and history will appear here.</div>
                        </div>
                      ) : (
                        <div className="mt-3 mb-1">
                          {/* Fixed height scrollable list container matching Savings.js */}
                          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                            {loans.map((loan) => {
                              let iconColor = "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200/60 dark:border-white/10";
                              let Icon = CheckCircle2;

                              if (loan.status === 'completed') {
                                Icon = CheckCircle2;
                                iconColor = "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900/30";
                              } else if (loan.status === 'rejected' || loan.status === 'cancelled') {
                                Icon = X;
                                iconColor = "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-100 dark:border-rose-900/30";
                              } else if (loan.status === 'active') {
                                Icon = Banknote;
                                iconColor = "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-100 dark:border-indigo-900/30";
                              } else {
                                Icon = Clock;
                                iconColor = "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-100 dark:border-amber-900/30";
                              }

                              return (
                                <div 
                                  key={loan._id} 
                                  onClick={() => navigate(`/loans/${loan.loanId}`)}
                                  className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all cursor-pointer gap-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${iconColor}`}>
                                      <Icon size={15} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-semibold text-slate-900 dark:text-white font-inter truncate">
                                        {loan.loanId} — {loan.purpose}
                                      </div>
                                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-inter truncate">
                                        {fmtDate(loan.appliedDate)} · {loan.termMonths} mo
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                    <div className="text-xs font-bold font-dm text-slate-900 dark:text-white">
                                      {fmt(loan.amount)}
                                    </div>
                                    <span className={`px-1.5 py-0.5 rounded font-semibold uppercase text-[9px] tracking-wider leading-none ${STATUS_CLASS[loan.status] || 'bg-slate-100 text-slate-700'}`}>
                                      {STATUS_TEXT[loan.status] || loan.status}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Pagination Controls */}
                          {totalCount > LIMIT && (
                            <div className="pt-3 mt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-inter">
                              <span>Page {page} of {Math.ceil(totalCount / LIMIT)}</span>
                              <div className="flex gap-2">
                                <button
                                  className="text-slate-500 hover:text-slate-800 dark:hover:text-white disabled:opacity-40 font-semibold cursor-pointer border-none bg-transparent"
                                  onClick={() => setPage(p => Math.max(1, p - 1))}
                                  disabled={page === 1}
                                >
                                  Prev
                                </button>
                                <button
                                  className="text-[#1E3A8A] dark:text-blue-400 hover:underline disabled:opacity-40 font-semibold cursor-pointer border-none bg-transparent"
                                  onClick={() => setPage(p => Math.min(Math.ceil(totalCount / LIMIT), p + 1))}
                                  disabled={page === Math.ceil(totalCount / LIMIT)}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Full Width Available Loan Types Section below 60/40 grid */}
              <div className="pt-2">
                {renderLoanTypes()}
              </div>
            </>
          )}
        </div>
      )}

      <LoanApplicationModal
        isOpen={isLoanModalOpen}
        onClose={handleLoanClose}
        totalSavings={totalSavings}
        existingLoanBalance={stats.remainingBalance || 0}
        hasOverdueLoans={loans.some(l => l.status === 'overdue')}
      />

      {cancelModalData.open && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden sm:overflow-y-auto transition-all duration-300" onClick={closeCancelModal}>
          <div className="relative w-full max-w-none sm:max-w-sm bg-white dark:bg-[#1E2130] rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl border-t sm:border border-slate-200 dark:border-white/10 my-0 sm:my-auto text-left mobile-slide-up-modal h-auto max-h-[92dvh] flex flex-col font-inter" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5 shrink-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-dm">Cancel Application</h2>
              <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors border-none bg-transparent cursor-pointer" onClick={closeCancelModal}><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <form onSubmit={handleCancelSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Reason for cancellation</label>
                  <select 
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 font-inter"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select a reason...</option>
                    <option value="Found a better alternative">Found a better alternative</option>
                    <option value="No longer need the loan">No longer need the loan</option>
                    <option value="Applied by mistake">Applied by mistake</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {cancelReason === 'Other' && (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Please specify</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 font-inter"
                      value={cancelReasonOther}
                      onChange={(e) => setCancelReasonOther(e.target.value)}
                      placeholder="Type your reason here..."
                      required
                    />
                  </div>
                )}
                <div className="flex items-center gap-3 pt-2">
                  <button type="button" className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all text-xs border-none cursor-pointer font-inter" onClick={closeCancelModal}>
                    Keep application
                  </button>
                  <button type="submit" disabled={isCancelling} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow-md transition-all text-xs border-none cursor-pointer font-inter">
                    {isCancelling ? 'Cancelling...' : 'Cancel Loan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <LoanInstructionModal 
        isOpen={showInstruction} 
        onClose={() => {
            setShowInstruction(false);
            setHasClosedInstruction(true);
        }}
        onApply={handleApplyClick}
        isLocked={isVerified && totalSavings < 1000}
      />
    </>
  );
}

function LoanInstructionModal({ isOpen, onClose, onApply, isLocked }) {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden sm:overflow-y-auto transition-all duration-300 animate-fadeIn" 
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-none sm:max-w-2xl bg-white dark:bg-[#181B28] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border-t sm:border border-slate-200 dark:border-white/10 my-0 sm:my-auto text-left mobile-slide-up-modal h-auto max-h-[92dvh] flex flex-col font-inter" 
                onClick={e => e.stopPropagation()}
            >
                {/* Hero Header Banner */}
                <div className="relative bg-gradient-to-br from-[#0D1F45] via-[#1E3A8A] to-[#2563EB] p-6 sm:p-7 text-white shrink-0 overflow-hidden">
                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex items-start justify-between gap-4">
                        <div className="space-y-1 max-w-lg">
                            <h2 className="text-xl sm:text-2xl font-extrabold font-dm text-white tracking-tight">
                                How to Apply for a Loan
                            </h2>
                            <p className="text-xs text-blue-100/80 leading-relaxed font-inter">
                                Access fast, transparent co-op funding straight from your IsangDiwa account in 3 simple steps.
                            </p>
                        </div>

                        <button 
                            onClick={onClose} 
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer border-none shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Step Cards Grid */}
                <div className="p-5 sm:p-6 space-y-3.5 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-[#181B28]">
                    {/* Step 1 */}
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-start gap-4 group">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-extrabold text-sm shadow-2xs group-hover:scale-105 transition-transform">
                            <ShieldCheck size={20} />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-xs font-bold text-slate-900 dark:text-white font-inter">
                                    1. Check Savings Eligibility
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                                    Step 01
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-inter">
                                Maintain at least <strong className="text-slate-900 dark:text-white font-bold">₱1,000</strong> in confirmed savings to unlock loan access. Your maximum borrowing limit scales directly with your savings.
                            </p>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-start gap-4 group">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-extrabold text-sm shadow-2xs group-hover:scale-105 transition-transform">
                            <Layers size={20} />
                        </div>
                        <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-xs font-bold text-slate-900 dark:text-white font-inter">
                                    2. Select Your Loan Type
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
                                    Step 02
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-inter">
                                Pick the loan bracket tailored to your needs:
                            </p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                                <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/30 text-center space-y-0.5">
                                    <div className="text-[11px] font-bold text-blue-900 dark:text-blue-200">Personal</div>
                                    <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Up to 2× Savings</div>
                                </div>
                                <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/30 text-center space-y-0.5">
                                    <div className="text-[11px] font-bold text-amber-900 dark:text-amber-200">Emergency</div>
                                    <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Up to 1.5× Savings</div>
                                </div>
                                <div className="p-2.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/30 text-center space-y-0.5">
                                    <div className="text-[11px] font-bold text-teal-900 dark:text-teal-200">Short-Term</div>
                                    <div className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">Up to 1× Savings</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-start gap-4 group">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-extrabold text-sm shadow-2xs group-hover:scale-105 transition-transform">
                            <Zap size={20} />
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-xs font-bold text-slate-900 dark:text-white font-inter">
                                    3. Submit &amp; Receive Disbursement
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                                    Step 03
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-inter">
                                Complete identity verification and your payout details. Once approved by co-op officers, funds are disbursed directly.
                            </p>
                            
                            {!isLocked && (
                                <div className="pt-1">
                                    <button 
                                        onClick={() => { onClose(); onApply(); }}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer border-none bg-transparent"
                                    >
                                        <span>Apply for a loan now</span>
                                        <ArrowRight size={13} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 sm:px-6 bg-white dark:bg-[#1E2130] border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-inter hidden sm:block">
                        Need assistance? Contact your co-op admin.
                    </div>
                    <div className="flex items-center gap-2.5 ml-auto">
                        {!isLocked && (
                            <button 
                                onClick={() => { onClose(); onApply(); }}
                                className="h-9 px-4 rounded-xl bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white text-xs font-bold font-inter flex items-center gap-1.5 transition-all cursor-pointer border-none shadow-md active:scale-95"
                            >
                                <Plus size={14} />
                                <span>Apply Now</span>
                            </button>
                        )}
                        <button 
                            onClick={onClose}
                            className="h-9 px-4 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-bold font-inter transition-all cursor-pointer border-none"
                        >
                            Got it, thanks!
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}