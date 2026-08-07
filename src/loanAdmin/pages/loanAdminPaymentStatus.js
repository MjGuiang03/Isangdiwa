import { useState, useEffect, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import LoanAdminSidebar from './loanAdminSidebar';
import PageHeader from '../components/PageHeader';


import API from '../../utils/api';
import useDebounce from '../../hooks/useDebounce';
import Pagination from '../../components/Pagination';
import { PiggyBank, Search, X, Loader2, CreditCard } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Label } from 'recharts';

const renderSliceLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const fmt = (n) => n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '₱0.00';
const fmtDate = (d) => { if (!d) return 'N/A'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };

function getDaysLate(dueDate) {
  if (!dueDate) return 0;
  const now = new Date(); const due = new Date(dueDate);
  const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function getPaymentStatus(daysLate) {
  if (daysLate === 0) return { label: 'On Track', cls: 'on-track' };
  if (daysLate <= 7) return { label: 'Reminder', cls: 'reminder' };
  if (daysLate <= 30) return { label: 'Delinquent', cls: 'delinquent' };
  if (daysLate <= 60) return { label: 'High Risk', cls: 'high-risk' };
  return { label: 'Default', cls: 'default' };
}

export default function LoanAdminPaymentStatus() {
  const location = useLocation();
  const isSavingsRoute = location.pathname.includes('/savings');

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(isSavingsRoute ? 'savings' : 'loans');
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [selectedLoanPayments, setSelectedLoanPayments] = useState([]);
  const [selectedLoanPaymentsLoading, setSelectedLoanPaymentsLoading] = useState(false);

  const [savingsFilter, setSavingsFilter] = useState('all');
  const [savingsTypeFilter, setSavingsTypeFilter] = useState('all'); // 'all', 'deposit', 'withdrawal'
  const [selectedSavings, setSelectedSavings] = useState(null);
  const [savingsPage, setSavingsPage] = useState(1);
  const SAVINGS_PER_PAGE = 10;
  const [loansPage, setLoansPage] = useState(1);
  const LOANS_PER_PAGE = 10;
  const [pendingPage, setPendingPage] = useState(1);
  const PENDING_PER_PAGE = 10;
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PER_PAGE = 10;
  useEffect(() => {
    setLoansPage(1);
    setSavingsPage(1);
    setHistoryPage(1);
    setPendingPage(1);
  }, [searchQuery, savingsTypeFilter]);

  // Manual Approval State
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingDetail, setPendingDetail] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [proofZoom, setProofZoom] = useState(null);

  // Walk-in Feature State
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinType, setWalkinType] = useState('loan'); // 'loan' or 'savings'
  const [walkinSearch, setWalkinSearch] = useState('');
  const [walkinUsers, setWalkinUsers] = useState([]);
  const [showWalkinUsers, setShowWalkinUsers] = useState(false);
  const [walkinSelectedMember, setWalkinSelectedMember] = useState(null);
  const [walkinSelectedLoan, setWalkinSelectedLoan] = useState('');
  const [walkinGoals, setWalkinGoals] = useState([]);
  const [walkinSelectedGoal, setWalkinSelectedGoal] = useState('');
  const [walkinAmount, setWalkinAmount] = useState('');
  const [walkinMethod, setWalkinMethod] = useState('cash');
  const [walkinRef, setWalkinRef] = useState('');
  const [walkinLoading, setWalkinLoading] = useState(false);

  const token = localStorage.getItem('adminToken');
  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());

  // Public Settings (to check approval method)
  const { data: settingsData } = useSWR(
    `${API}/api/settings/public`,
    fetcherSingle,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000
    }
  );

  const approvalMethod = useMemo(() => settingsData?.paymentApprovalMethod || 'gateway', [settingsData]);

  // Loans
  const { data: loansData, isValidating: loadingLoans, mutate: fetchLoans } = useSWR(
    token ? `${API}/api/admin/loans` : null,
    fetcherSingle,
    {
      revalidateOnFocus: false,
      revalidateIfStale: true,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );

  const allLoans = useMemo(() => loansData?.loans || [], [loansData]);
  const loans = useMemo(() => allLoans.filter(l => l.status === 'active'), [allLoans]);

  // Savings
  const { data: savingsData, mutate: fetchSavings } = useSWR(
    token ? `${API}/api/admin/savings/deposits` : null,
    fetcherSingle,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );

  const allSavings = useMemo(() => savingsData?.deposits || [], [savingsData]);

  // Pending Approvals
  const pendingSavUrl = (token && isSavingsRoute) ? `${API}/api/admin/savings/deposits?status=pending&limit=100` : null;
  const pendingLoanUrl = (token && !isSavingsRoute) ? `${API}/api/admin/loan-payments?status=pending&limit=100` : null;

  const { data: pendingSavData, isValidating: pendingLoadingSav, mutate: mutateSavPending } = useSWR(pendingSavUrl, fetcherSingle, { revalidateOnFocus: false });
  const { data: pendingLoanData, isValidating: pendingLoadingLoan, mutate: mutateLoanPending } = useSWR(pendingLoanUrl, fetcherSingle, { revalidateOnFocus: false });

  const pendingSavings = useMemo(() => pendingSavData?.deposits || [], [pendingSavData]);
  const pendingLoanPayments = useMemo(() => pendingLoanData?.payments || [], [pendingLoanData]);

  const filteredPendingDeposits = useMemo(() => {
    return pendingSavings.filter(t => t.type !== 'withdrawal' && (
      (t.memberName || t.email || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (t.goalName || t.goalId || '').toLowerCase().includes(debouncedSearch.toLowerCase())
    ));
  }, [pendingSavings, debouncedSearch]);

  const filteredPendingWithdrawals = useMemo(() => {
    return pendingSavings.filter(t => t.type === 'withdrawal' && (
      (t.memberName || t.email || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (t.goalName || t.goalId || '').toLowerCase().includes(debouncedSearch.toLowerCase())
    ));
  }, [pendingSavings, debouncedSearch]);

  // Payment History
  const { data: loanHistoryData } = useSWR(
    (token && activeTab === 'history') ? `${API}/api/admin/loan-payments?status=confirmed&page=${historyPage}&limit=${HISTORY_PER_PAGE}` : null,
    fetcherSingle,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );

  const loanHistory = useMemo(() => loanHistoryData?.payments || [], [loanHistoryData]);
  const historyTotalCount = useMemo(() => loanHistoryData?.totalCount || 0, [loanHistoryData]);

  const fetchPendingApprovals = useCallback(() => {
    if (isSavingsRoute) mutateSavPending();
    else mutateLoanPending();
  }, [isSavingsRoute, mutateSavPending, mutateLoanPending]);

  useEffect(() => {
    setPendingLoading(pendingLoadingSav || pendingLoadingLoan);
  }, [pendingLoadingSav, pendingLoadingLoan]);

  useEffect(() => {
    setLoading(loadingLoans && !loansData);
  }, [loadingLoans, loansData]);

  useEffect(() => {
    setActiveTab(isSavingsRoute ? 'savings' : 'loans');
    setSearchQuery('');
  }, [isSavingsRoute]);


  const handleApprovePending = async () => {
    if (!pendingDetail) return;
    setActionLoading(true);
    try {
      const endpoint = isSavingsRoute ? `/api/admin/savings/deposits/${pendingDetail._id}/approve` : `/api/admin/loans/payments/${pendingDetail._id}/approve`;
      const res = await fetch(`${API}${endpoint}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        toast.success('Approved successfully');
        setShowApproveConfirm(false);
        setPendingDetail(null);
        fetchPendingApprovals();
        if (isSavingsRoute) fetchSavings(); else fetchLoans();
      } else toast.error(data.message || 'Failed to approve');
    } catch { toast.error('Error approving'); }
    finally { setActionLoading(false); }
  };

  const handleRejectPending = async () => {
    if (!pendingDetail || !rejectReason.trim()) return toast.error('Please provide a reason');
    setActionLoading(true);
    try {
      const endpoint = isSavingsRoute ? `/api/admin/savings/deposits/${pendingDetail._id}/reject` : `/api/admin/loans/payments/${pendingDetail._id}/reject`;
      const res = await fetch(`${API}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: rejectReason })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Rejected successfully');
        setPendingDetail(null);
        setRejectReason('');
        setShowRejectInput(false);
        fetchPendingApprovals();
      } else toast.error(data.message || 'Failed to reject');
    } catch { toast.error('Error rejecting'); }
    finally { setActionLoading(false); }
  };

  /* ── WALKIN FUNCTIONS ── */
  const handleWalkinSearchChange = async (query) => {
    setWalkinSearch(query);
    if (query.trim().length < 2) {
      setWalkinUsers([]);
      setShowWalkinUsers(false);
      return;
    }
    try {
      const res = await fetch(`${API}/api/admin/members?search=${query}&limit=5`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setWalkinUsers(data.members || []);
        setShowWalkinUsers(true);
      }
    } catch { /* silent */ }
  };

  const selectWalkinMember = async (member) => {
    setWalkinSelectedMember(member);
    setWalkinSearch(member.fullName || member.email);
    setShowWalkinUsers(false);
    setWalkinGoals([]);
    setWalkinSelectedGoal('');

    // fetch goals
    try {
      const res = await fetch(`${API}/api/admin/user-savings-goals/${member.email}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setWalkinGoals(data.goals || []);
        if (data.goals?.length > 0) setWalkinSelectedGoal(data.goals[0]._id);
      }
    } catch { /* silent */ }
  };

  const handleWalkinLoanSelected = (e) => {
    const lId = e.target.value;
    setWalkinSelectedLoan(lId);
    const ln = allLoans.find(x => x._id === lId);
    if (ln) setWalkinAmount(ln.upcomingPaymentAmount || ln.monthlyPayment || '');
    else setWalkinAmount('');
  };

  const handleWalkinSubmit = async () => {
    if (walkinType === 'loan') {
      if (!walkinSelectedLoan || !walkinAmount || Number(walkinAmount) <= 0) return toast.error('Select a loan and enter a valid amount');
      setWalkinLoading(true);
      try {
        const res = await fetch(`${API}/api/admin/process-loan-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ loanId: walkinSelectedLoan, amount: Number(walkinAmount), paymentMethod: walkinMethod, referenceNumber: walkinRef })
        });
        const data = await res.json();
        if (data.success) {
          toast.success(data.message);
          setShowWalkinModal(false);
          fetchLoans();
        } else toast.error(data.message);
      } catch { toast.error('Failed to process payment'); }
      finally { setWalkinLoading(false); }
    } else {
      if (!walkinSelectedMember || !walkinSelectedGoal || !walkinAmount || Number(walkinAmount) <= 0) return toast.error('Select member, goal, and enter a valid amount');
      setWalkinLoading(true);
      try {
        const res = await fetch(`${API}/api/admin/process-savings-deposit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email: walkinSelectedMember.email, goalId: walkinSelectedGoal, amount: Number(walkinAmount), paymentMethod: walkinMethod, referenceNumber: walkinRef })
        });
        const data = await res.json();
        if (data.success) {
          toast.success(data.message);
          setShowWalkinModal(false);
          fetchSavings();
        } else toast.error(data.message);
      } catch { toast.error('Failed to process deposit'); }
      finally { setWalkinLoading(false); }
    }
  };

  const resetWalkin = () => {
    setWalkinType('loan');
    setWalkinSearch('');
    setWalkinUsers([]);
    setShowWalkinUsers(false);
    setWalkinSelectedMember(null);
    setWalkinSelectedLoan('');
    setWalkinGoals([]);
    setWalkinSelectedGoal('');
    setWalkinAmount('');
    setWalkinMethod('cash');
    setWalkinRef('');
    setWalkinLoading(false);
  };

  const enriched = useMemo(() => {
    return loans.map(l => {
      let effectiveDueDate = l.nextPaymentDate || l.nextDueDate;
      if (!effectiveDueDate) {
        // No due date set — calculate first due date as 1 month after disbursement/approval
        const baseDate = new Date(l.disbursementDate || l.approvedDate);
        baseDate.setMonth(baseDate.getMonth() + 1);
        effectiveDueDate = baseDate;
      }
      const daysLate = getDaysLate(effectiveDueDate);
      const status = getPaymentStatus(daysLate);
      return { ...l, daysLate, paymentStatus: status, effectiveDueDate };
    });
  }, [loans]);

  const filtered = useMemo(() => {
    return enriched.filter(l =>
      (l.memberName || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (l.loanId || '').toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [enriched, debouncedSearch]);

  const counts = useMemo(() => {
    return {
      onTrack: enriched.filter(l => l.paymentStatus.cls === 'on-track').length,
      overdue: enriched.filter(l => ['reminder', 'delinquent'].includes(l.paymentStatus.cls)).length,
      highRisk: enriched.filter(l => l.paymentStatus.cls === 'high-risk').length,
      defaulted: enriched.filter(l => l.paymentStatus.cls === 'default').length,
    };
  }, [enriched]);

  const confirmedSavings = useMemo(() => {
    return allSavings.filter(s => {
      if (s.status !== 'confirmed') return false;
      const sDate = new Date(s.confirmedAt || s.date);
      const now = new Date();
      if (savingsFilter === 'this_month') {
        return sDate.getMonth() === now.getMonth() && sDate.getFullYear() === now.getFullYear();
      }
      if (savingsFilter === 'this_year') {
        return sDate.getFullYear() === now.getFullYear();
      }
      return true; // 'all'
    });
  }, [allSavings, savingsFilter]);

  const totalSavingsFiltered = useMemo(() => {
    return confirmedSavings.reduce((sum, s) => {
      const amt = Number(s.amount) || 0;
      return s.type === 'withdrawal' ? sum - amt : sum + amt;
    }, 0);
  }, [confirmedSavings]);

  const totalWithdrawalsFiltered = useMemo(() => {
    return confirmedSavings
      .filter(s => s.type === 'withdrawal')
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  }, [confirmedSavings]);

  const savingsChartData = useMemo(() => {
    const memberVal = confirmedSavings
      .filter(s => s.type === 'deposit' && ((s.position || '').toLowerCase() === 'member' || !s.position))
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const officerVal = confirmedSavings
      .filter(s => s.type === 'deposit' && ((s.position || '').toLowerCase() !== 'member' && s.position))
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const pieTotal = memberVal + officerVal;
    const pieData = [
      { name: 'Members', value: memberVal, color: '#0D1F45' },
      { name: 'Officers', value: officerVal, color: '#60A5FA' }
    ];
    return { pieTotal, pieData };
  }, [confirmedSavings]);



  if (!loansData && loadingLoans) {
    return (
      <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
        <LoanAdminSidebar />
        <div className="flex-1 overflow-y-auto p-6 pb-16 w-full animate-pulse flex flex-col gap-6">
          {/* Header Skeleton */}
          <div className="flex flex-col gap-2">
            <div className="h-8 w-56 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
            <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
          </div>

          {/* Cards Skeleton */}
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-white/10">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 min-h-[90px] flex flex-col justify-between">
                  <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                  <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700/80 rounded mt-2"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Table Skeleton */}
          <div className="w-full bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm p-4 flex flex-col gap-4">
            <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
      <LoanAdminSidebar />
      <div className="flex-1 overflow-y-auto p-6 pb-16 w-full">
        <PageHeader
          title={isSavingsRoute ? 'Savings Overview' : 'Loan Payments'}
          subtitle={isSavingsRoute ? 'Monitor member savings accounts, deposits, and role distribution.' : 'Track active loan repayments, schedules, and payment statuses.'}
          rightElement={
            <button
              onClick={() => { resetWalkin(); setShowWalkinModal(true); setWalkinType(isSavingsRoute ? 'savings' : 'loan'); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold font-inter rounded-lg hover:bg-blue-700 transition-colors border-none cursor-pointer shadow-sm"
            >
              <PiggyBank size={16} />
              Process Walk-in
            </button>
          }
        />

        {!isSavingsRoute && (
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 dark:divide-white/10">
              <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] flex flex-col justify-between min-h-[90px]">
                <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">On Track</span>
                <p className="font-inter font-extrabold text-2xl text-emerald-500 dark:text-emerald-400 m-0 mt-2">{counts.onTrack}</p>
              </div>
              <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] flex flex-col justify-between min-h-[90px]">
                <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">Overdue (1-30d)</span>
                <p className="font-inter font-extrabold text-2xl text-amber-500 dark:text-amber-400 m-0 mt-2">{counts.overdue}</p>
              </div>
              <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] flex flex-col justify-between min-h-[90px]">
                <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">High Risk (31-60d)</span>
                <p className="font-inter font-extrabold text-2xl text-orange-500 dark:text-orange-400 m-0 mt-2">{counts.highRisk}</p>
              </div>
              <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] flex flex-col justify-between min-h-[90px]">
                <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">Default (60+d)</span>
                <p className="font-inter font-extrabold text-2xl text-rose-500 dark:text-rose-400 m-0 mt-2">{counts.defaulted}</p>
              </div>
            </div>
          </div>
        )}

        {isSavingsRoute && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Left Column: Compact Donut Chart */}
            <div className="md:col-span-2 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <h3 className="font-inter text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 m-0 mb-2">Savings by Role</h3>
              {savingsChartData.pieTotal === 0 ? (
                <p className="text-xs text-slate-400 py-6">No savings deposits available yet.</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-1">
                  <div className="w-[240px] h-[190px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={savingsChartData.pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={44}
                          outerRadius={76}
                          paddingAngle={3}
                          dataKey="value"
                          label={renderSliceLabel}
                          labelLine={false}
                        >
                          {savingsChartData.pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                          <Label
                            value={`₱${savingsChartData.pieTotal >= 1000000 ? (savingsChartData.pieTotal / 1000000).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1') + 'M' : savingsChartData.pieTotal >= 1000 ? (savingsChartData.pieTotal / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : savingsChartData.pieTotal}`}
                            position="center"
                            fill="#1e3a5f"
                            className="text-sm font-extrabold font-inter"
                          />
                          <Label
                            value="Total"
                            position="center"
                            dy={14}
                            fill="#6B7280"
                            className="text-[10px] font-inter"
                          />
                        </Pie>
                        <RechartsTooltip formatter={(value, name, props) => [`₱${(value || 0).toLocaleString()} (${Math.round((value / savingsChartData.pieTotal) * 100)}%)`, props.payload.name]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-col gap-2.5 min-w-[240px] max-w-[280px]">
                    {savingsChartData.pieData.map((cat, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                          <span className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300">{cat.name}</span>
                        </div>
                        <span className="font-inter text-xs font-bold text-slate-800 dark:text-white ml-3">₱{cat.value.toLocaleString()} <span className="text-slate-400 text-[11px] font-normal">({Math.round((cat.value / savingsChartData.pieTotal) * 100)}%)</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Unified Stat Card with Dividers */}
            <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
              <div className="divide-y divide-slate-100 dark:divide-white/5 flex flex-col h-full justify-between">
                {/* Total Savings */}
                <div className="p-3 px-4 flex flex-col justify-center gap-1 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Total Savings</span>
                    <select value={savingsFilter} onChange={e => setSavingsFilter(e.target.value)} className="text-[10px] font-inter px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-[#252836] text-slate-600 dark:text-slate-400 outline-none cursor-pointer">
                      <option value="all">All Time</option>
                      <option value="this_month">This Month</option>
                      <option value="this_year">This Year</option>
                    </select>
                  </div>
                  <p className="font-inter font-bold text-xl text-emerald-500 m-0">{fmt(totalSavingsFiltered)}</p>
                </div>

                {/* Total Withdrawals */}
                <div className="p-3 px-4 flex flex-col justify-center gap-1 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Total Withdrawals</span>
                  <p className="font-inter font-bold text-xl text-rose-600 dark:text-rose-400 m-0">{fmt(totalWithdrawalsFiltered)}</p>
                </div>

                {/* Pending Review */}
                <div
                  className="p-3 px-4 flex flex-col justify-center gap-1 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => setActiveTab('pending')}
                >
                  <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Pending Review</span>
                  <p className="font-inter font-bold text-xl text-orange-600 dark:text-orange-400 m-0">{pendingSavings.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Control Toolbar: Tabs + Search + Filter */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 mb-4 pb-3">
          {(!isSavingsRoute || approvalMethod === 'manual') && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab(isSavingsRoute ? 'savings' : 'loans')}
                className={`px-4 py-2 text-[13px] font-semibold font-inter transition-colors border-b-2 -mb-[13px] ${activeTab === (isSavingsRoute ? 'savings' : 'loans') ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'} bg-transparent cursor-pointer`}
              >
                {isSavingsRoute ? 'Savings Records' : 'Active Loans'}
              </button>
              {!isSavingsRoute && (
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 text-[13px] font-semibold font-inter transition-colors border-b-2 -mb-[13px] ${activeTab === 'history' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'} bg-transparent cursor-pointer`}
                >
                  Payment History
                </button>
              )}
              {approvalMethod === 'manual' && (
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-4 py-2 flex items-center gap-2 text-[13px] font-semibold font-inter transition-colors border-b-2 -mb-[13px] ${activeTab === 'pending' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'} bg-transparent cursor-pointer`}
                >
                  Pending Approvals
                  {(isSavingsRoute ? pendingSavings.length : pendingLoanPayments.length) > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                      {isSavingsRoute ? pendingSavings.length : pendingLoanPayments.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 max-sm:w-full">
            <div className="relative max-w-[320px] w-full flex items-center">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
              <input
                type="text"
                placeholder={isSavingsRoute ? "Search by member name or goal..." : "Search member or loan ID..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-xs font-inter text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors shadow-sm"
              />
            </div>
            {isSavingsRoute && activeTab === 'savings' && (
              <select
                value={savingsTypeFilter}
                onChange={(e) => setSavingsTypeFilter(e.target.value)}
                className="h-9 px-3 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-xs font-inter text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-sm"
              >
                <option value="all">All Types</option>
                <option value="deposit">Deposits Only</option>
                <option value="withdrawal">Withdrawals Only</option>
              </select>
            )}
          </div>
        </div>

        {activeTab === 'savings' && isSavingsRoute && (
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm mb-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-2.5 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Date</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-2.5 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Member</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-2.5 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Type</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-2.5 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Goal</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-2.5 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-2.5 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="text-center p-8 text-slate-400">Loading...</td></tr>
                  ) : (() => {
                    const filteredSavingsList = confirmedSavings.filter(s => {
                      const matchesSearch = (s.memberName || '').toLowerCase().includes(debouncedSearch.toLowerCase()) || (s.goalName || s.goalId || '').toLowerCase().includes(debouncedSearch.toLowerCase());
                      const matchesType = savingsTypeFilter === 'all' || s.type === savingsTypeFilter;
                      return matchesSearch && matchesType;
                    });

                    if (filteredSavingsList.length === 0) {
                      return <tr><td colSpan={6} className="text-center p-8 text-slate-400">No records found</td></tr>;
                    }

                    const paginatedSavings = filteredSavingsList.slice((savingsPage - 1) * SAVINGS_PER_PAGE, savingsPage * SAVINGS_PER_PAGE);

                    return (
                      <>
                        {paginatedSavings.map(txn => (
                          <tr key={txn._id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setSelectedSavings(txn)}>
                            <td className="px-4 py-2 whitespace-nowrap font-inter text-[12.5px] text-slate-700 dark:text-slate-300">{fmtDate(txn.confirmedAt || txn.date)}</td>
                            <td className="px-4 py-2 whitespace-nowrap font-inter text-[12.5px] text-slate-700 dark:text-slate-300">
                              <div className="flex flex-col">
                                <p className="font-inter text-[13px] font-semibold text-slate-800 dark:text-white m-0">{txn.memberName || txn.email}</p>
                                <p className="font-inter text-[10.5px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">{txn.email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap font-inter text-[12.5px] text-slate-700 dark:text-slate-300">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold tracking-wider uppercase ${txn.type === 'withdrawal' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                                {txn.type}
                              </span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-[12.5px] text-slate-600 dark:text-slate-400">{txn.goalName || 'General Savings'}</td>
                            <td className={`px-4 py-2 whitespace-nowrap font-inter text-[13px] font-bold ${txn.type === 'withdrawal' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {txn.type === 'withdrawal' ? '-' : '+'}{fmt(txn.amount)}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap font-inter text-[12.5px] text-slate-700 dark:text-slate-300">
                              <span className="inline-block px-2 py-0.5 rounded text-[10.5px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">Confirmed</span>
                            </td>
                          </tr>
                        ))}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {(() => {
              const filteredSavingsList = confirmedSavings.filter(s => {
                const matchesSearch = (s.memberName || '').toLowerCase().includes(debouncedSearch.toLowerCase()) || (s.goalName || s.goalId || '').toLowerCase().includes(debouncedSearch.toLowerCase());
                const matchesType = savingsTypeFilter === 'all' || s.type === savingsTypeFilter;
                return matchesSearch && matchesType;
              });
              const totalSavingsPages = Math.ceil(filteredSavingsList.length / SAVINGS_PER_PAGE);
              return (
                <Pagination
                  currentPage={savingsPage}
                  totalPages={totalSavingsPages}
                  onPageChange={(newPage) => setSavingsPage(newPage)}
                  totalItems={filteredSavingsList.length}
                  itemsPerPage={SAVINGS_PER_PAGE}
                  itemName="savings records"
                  embedded={true}
                />
              );
            })()}
          </div>
        )}

        {activeTab === 'loans' && !isSavingsRoute && (
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Loan ID</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Member</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Paid</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Balance</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Due Date</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Days Late</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="text-center p-10 text-slate-400">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={8} className="text-center p-10 text-slate-400">No active loans found</td></tr>
                  ) : (
                    filtered.slice((loansPage - 1) * LOANS_PER_PAGE, loansPage * LOANS_PER_PAGE).map(loan => (
                      <tr key={loan._id} onClick={() => setSelectedLoan(loan)} className="cursor-pointer border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                        <td className="px-4 py-3 font-inter text-sm font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">{loan.loanId}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">
                          <div className="flex flex-col">
                            <p className="font-inter text-sm font-semibold text-slate-800 dark:text-white m-0">{loan.memberName}</p>
                            <p className="font-inter text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">{loan.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-inter text-sm font-bold text-slate-800 dark:text-white">{fmt(loan.amount)}</td>
                        <td className="text-[13px]">{loan.paidMonths || 0}/{loan.termMonths || 0}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-inter text-sm font-bold text-slate-800 dark:text-white">{fmt(loan.remainingBalance)}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">{fmtDate(loan.effectiveDueDate)}</td>
                        <td className={`font-semibold ${loan.daysLate > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {loan.daysLate > 0 ? `${loan.daysLate} days` : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${loan.paymentStatus.cls === 'on-track' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : loan.paymentStatus.cls === 'reminder' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : loan.paymentStatus.cls === 'delinquent' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' : loan.paymentStatus.cls === 'high-risk' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-red-900 text-white'}`}>{loan.paymentStatus.label}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={loansPage}
              totalPages={Math.ceil(filtered.length / LOANS_PER_PAGE)}
              onPageChange={(newPage) => setLoansPage(newPage)}
              totalItems={filtered.length}
              itemsPerPage={LOANS_PER_PAGE}
              itemName="active loans"
              embedded={true}
            />
          </div>
        )}

        {/* Pending Approvals Tab */}
        {activeTab === 'pending' && (
          isSavingsRoute ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pending Deposits Table */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 font-inter font-bold text-sm text-slate-800 dark:text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Pending Deposits
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                      {filteredPendingDeposits.length}
                    </span>
                  </div>
                </div>
                <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto shadow-sm">
                  <table className="w-full text-left border-collapse min-w-[480px]">
                    <thead>
                      <tr>
                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Date</th>
                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Member</th>
                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Method</th>
                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Proof</th>
                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingLoading ? (
                        <tr><td colSpan={6} className="text-center p-8 text-slate-400">Loading...</td></tr>
                      ) : filteredPendingDeposits.length === 0 ? (
                        <tr><td colSpan={6} className="text-center p-8 text-slate-400 text-xs font-inter">No pending deposits</td></tr>
                      ) : (
                        filteredPendingDeposits.map(txn => (
                          <tr key={txn._id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                            <td className="px-3.5 py-3 whitespace-nowrap font-inter text-xs text-slate-700 dark:text-slate-300">{fmtDate(txn.submittedAt || txn.createdAt || txn.date)}</td>
                            <td className="px-3.5 py-3 whitespace-nowrap font-inter text-xs text-slate-700 dark:text-slate-300">
                              <div className="flex flex-col">
                                <p className="font-inter text-xs font-semibold text-slate-800 dark:text-white m-0">{txn.memberName || txn.email}</p>
                                <p className="font-inter text-[10.5px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">Goal: {txn.goalName || txn.goalId || 'General'}</p>
                              </div>
                            </td>
                            <td className="px-3.5 py-3 whitespace-nowrap font-inter text-xs font-bold text-emerald-600 dark:text-emerald-400">{fmt(txn.amount)}</td>
                            <td className="px-3.5 py-3 whitespace-nowrap font-inter text-xs capitalize text-slate-700 dark:text-slate-300">{txn.paymentMethod || 'e-wallet'}</td>
                            <td className="px-3.5 py-3 whitespace-nowrap font-inter text-xs text-slate-700 dark:text-slate-300">
                              {(txn.proofData || txn.proofOfPayment) ? (
                                <img
                                  src={txn.proofData || txn.proofOfPayment}
                                  alt="Proof"
                                  className="w-7 h-7 object-cover rounded shadow-xs cursor-pointer border border-slate-200 dark:border-white/10"
                                  onClick={(e) => { e.stopPropagation(); const win = window.open(); win.document.write(`<img src="${txn.proofData || txn.proofOfPayment}" style="max-width:100%;" />`); }}
                                />
                              ) : (
                                <span className="text-[11px] text-slate-400">No Proof</span>
                              )}
                            </td>
                            <td className="px-3.5 py-3 whitespace-nowrap font-inter text-xs">
                              <button onClick={() => { setPendingDetail(txn); setShowRejectInput(false); }} className="px-2.5 py-1 rounded-md font-semibold text-[11px] border-none cursor-pointer transition-colors bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/30">Review</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pending Withdrawals Table */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 font-inter font-bold text-sm text-slate-800 dark:text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    Pending Withdrawals
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-bold">
                      {filteredPendingWithdrawals.length}
                    </span>
                  </div>
                </div>
                <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto shadow-sm">
                  <table className="w-full text-left border-collapse min-w-[480px]">
                    <thead>
                      <tr>
                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Date</th>
                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Member</th>
                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Payout Method</th>
                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Reason</th>
                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingLoading ? (
                        <tr><td colSpan={6} className="text-center p-8 text-slate-400">Loading...</td></tr>
                      ) : filteredPendingWithdrawals.length === 0 ? (
                        <tr><td colSpan={6} className="text-center p-8 text-slate-400 text-xs font-inter">No pending withdrawals</td></tr>
                      ) : (
                        filteredPendingWithdrawals.map(txn => (
                          <tr key={txn._id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                            <td className="px-3.5 py-3 whitespace-nowrap font-inter text-xs text-slate-700 dark:text-slate-300">{fmtDate(txn.submittedAt || txn.createdAt || txn.date)}</td>
                            <td className="px-3.5 py-3 whitespace-nowrap font-inter text-xs text-slate-700 dark:text-slate-300">
                              <div className="flex flex-col">
                                <p className="font-inter text-xs font-semibold text-slate-800 dark:text-white m-0">{txn.memberName || txn.email}</p>
                                <p className="font-inter text-[10.5px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">Goal: {txn.goalName || txn.goalId || 'General'}</p>
                              </div>
                            </td>
                            <td className="px-3.5 py-3 whitespace-nowrap font-inter text-xs font-bold text-rose-600 dark:text-rose-400">{fmt(txn.amount)}</td>
                            <td className="px-3.5 py-3 whitespace-nowrap font-inter text-xs capitalize text-slate-700 dark:text-slate-300">{txn.sendMethod || txn.paymentMethod || 'e-wallet'}</td>
                            <td className="px-3.5 py-3 whitespace-nowrap font-inter text-xs text-slate-700 dark:text-slate-300 max-w-[140px] truncate" title={txn.description}>{txn.description || 'Withdrawal'}</td>
                            <td className="px-3.5 py-3 whitespace-nowrap font-inter text-xs">
                              <button onClick={() => { setPendingDetail(txn); setShowRejectInput(false); }} className="px-2.5 py-1 rounded-md font-semibold text-[11px] border-none cursor-pointer transition-colors bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/30">Review</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr>
                      <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Date</th>
                      <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Member</th>
                      <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Type</th>
                      <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                      <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Method</th>
                      <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Reference</th>
                      <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Proof</th>
                      <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingLoading ? (
                      <tr><td colSpan={8} className="text-center p-10 text-slate-400">Loading...</td></tr>
                    ) : pendingLoanPayments.length === 0 ? (
                      <tr><td colSpan={8} className="text-center p-10 text-slate-400">No pending approvals</td></tr>
                    ) : (
                      pendingLoanPayments.slice((pendingPage - 1) * PENDING_PER_PAGE, pendingPage * PENDING_PER_PAGE).map(txn => (
                        <tr key={txn._id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                          <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">{fmtDate(txn.submittedAt || txn.createdAt || txn.date)}</td>
                          <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">
                            <div className="flex flex-col">
                              <p className="font-inter text-sm font-semibold text-slate-800 dark:text-white m-0">{txn.memberName || txn.email}</p>
                              <p className="font-inter text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">{`Loan: ${txn.loanId}`}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold font-inter capitalize ${txn.paymentType === 'full' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400' : txn.paymentType === 'advance' ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'}`}>
                              {txn.paymentType || 'regular'}
                              {txn.monthsCovered > 1 && ` (${txn.monthsCovered}mo)`}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-inter text-sm font-bold text-orange-600 dark:text-orange-400">{fmt(txn.amount)}</td>
                          <td className="capitalize">{txn.paymentMethod || 'cash'}</td>
                          <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">{txn.referenceNumber || '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">
                            {(txn.proofData || txn.proofOfPayment) ? (
                              <img
                                src={txn.proofData || txn.proofOfPayment}
                                alt="Proof"
                                className="w-8 h-8 object-cover rounded shadow-sm cursor-pointer border border-slate-200 dark:border-white/10"
                                onClick={(e) => { e.stopPropagation(); const win = window.open(); win.document.write(`<img src="${txn.proofData || txn.proofOfPayment}" style="max-width:100%;" />`); }}
                              />
                            ) : (
                              <span className="text-xs text-slate-400">No Proof</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">
                            <button onClick={() => { setPendingDetail(txn); setShowRejectInput(false); }} className="px-3 py-1.5 rounded-md font-semibold text-xs border-none cursor-pointer transition-colors bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/30">Review</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={pendingPage}
                totalPages={Math.ceil(pendingLoanPayments.length / PENDING_PER_PAGE)}
                onPageChange={(newPage) => setPendingPage(newPage)}
                totalItems={pendingLoanPayments.length}
                itemsPerPage={PENDING_PER_PAGE}
                itemName="pending approvals"
                embedded={true}
              />
            </div>
          )
        )}

        {/* Payment History Tab (Loans Only) */}
        {activeTab === 'history' && !isSavingsRoute && (
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-2.5 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Date</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-2.5 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Member</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-2.5 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Type</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-2.5 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-2.5 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Method</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-2.5 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Reference</th>
                    <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-2.5 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center p-8 text-slate-400">Loading...</td></tr>
                  ) : loanHistory.length === 0 ? (
                    <tr><td colSpan={7} className="text-center p-8 text-slate-400">No payment history found</td></tr>
                  ) : (
                    loanHistory.map(txn => (
                      <tr key={txn._id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setPendingDetail(txn)}>
                        <td className="px-4 py-2 whitespace-nowrap font-inter text-[12.5px] text-slate-700 dark:text-slate-300">{fmtDate(txn.submittedAt || txn.createdAt || txn.date)}</td>
                        <td className="px-4 py-2 whitespace-nowrap font-inter text-[12.5px] text-slate-700 dark:text-slate-300">
                          <div className="flex flex-col">
                            <p className="font-inter text-[13px] font-semibold text-slate-800 dark:text-white m-0">{txn.memberName || txn.email}</p>
                            <p className="font-inter text-[10.5px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">{`Loan: ${txn.loanId}`}</p>
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap font-inter text-[12.5px] text-slate-700 dark:text-slate-300">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold font-inter capitalize ${txn.paymentType === 'full' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400' : txn.paymentType === 'advance' ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'}`}>
                            {txn.paymentType || 'regular'}
                            {txn.monthsCovered > 1 && ` (${txn.monthsCovered}mo)`}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap font-inter text-[13px] font-bold text-slate-800 dark:text-white">{fmt(txn.amount)}</td>
                        <td className="px-4 py-2 whitespace-nowrap font-inter text-[12.5px] capitalize text-slate-700 dark:text-slate-300">{txn.paymentMethod || 'cash'}</td>
                        <td className="px-4 py-2 whitespace-nowrap font-inter text-[12.5px] text-slate-700 dark:text-slate-300">{txn.referenceNumber || '—'}</td>
                        <td className="px-4 py-2 whitespace-nowrap font-inter text-[12.5px] text-slate-700 dark:text-slate-300">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold tracking-wide uppercase ${txn.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                            {txn.status === 'confirmed' ? 'Confirmed' : 'Rejected'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={historyPage}
              totalPages={Math.ceil(historyTotalCount / HISTORY_PER_PAGE)}
              onPageChange={(newPage) => setHistoryPage(newPage)}
              totalItems={historyTotalCount}
              itemsPerPage={HISTORY_PER_PAGE}
              itemName="payment records"
              embedded={true}
            />
          </div>
        )}
      </div>

      {/* ── Loan Detail Modal ── */}
      {selectedLoan && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => { setSelectedLoan(null); setSelectedLoanPayments([]); }}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[520px] flex flex-col border border-slate-200 dark:border-white/10 shadow-2xl" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-[18px_24px] border-b border-slate-200 dark:border-white/10 shrink-0">
              <h2 className="font-inter text-lg font-bold text-slate-800 dark:text-white m-0">Loan Payment Progress</h2>
              <button className="w-8 h-8 border-none bg-slate-100 dark:bg-white/5 text-slate-500 rounded-lg cursor-pointer flex items-center justify-center text-lg font-bold hover:bg-slate-200 transition-colors" onClick={() => { setSelectedLoan(null); setSelectedLoanPayments([]); }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px 24px 8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <div style={{ background: '#F9FAFB', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <p style={{ margin: 0, marginBottom: '2px', fontSize: '12px', color: '#6B7280', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Loan ID</p>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, fontFamily: 'Inter', color: '#111827' }}>{selectedLoan.loanId}</p>
                </div>
                <div style={{ background: '#F9FAFB', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <p style={{ margin: 0, marginBottom: '2px', fontSize: '12px', color: '#6B7280', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Member</p>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, fontFamily: 'Inter', color: '#111827' }}>{selectedLoan.memberName}</p>
                </div>
                <div style={{ background: '#F9FAFB', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <p style={{ margin: 0, marginBottom: '2px', fontSize: '12px', color: '#6B7280', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Loan Amount</p>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, fontFamily: 'Inter', color: '#111827' }}>{fmt(selectedLoan.amount)}</p>
                </div>
                <div style={{ background: '#F9FAFB', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <p style={{ margin: 0, marginBottom: '2px', fontSize: '12px', color: '#6B7280', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Monthly Payment</p>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, fontFamily: 'Inter', color: '#155DFC' }}>{fmt(selectedLoan.monthlyPayment)}</p>
                </div>
                <div style={{ background: '#F9FAFB', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <p style={{ margin: 0, marginBottom: '2px', fontSize: '12px', color: '#6B7280', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Term</p>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, fontFamily: 'Inter', color: '#111827' }}>{selectedLoan.termMonths} months</p>
                </div>
                <div style={{ background: '#F9FAFB', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <p style={{ margin: 0, marginBottom: '2px', fontSize: '12px', color: '#6B7280', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Interest Rate</p>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, fontFamily: 'Inter', color: '#111827' }}>{(selectedLoan.interestRate < 1 ? (selectedLoan.interestRate * 100).toFixed(1) : selectedLoan.interestRate)}%</p>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ background: '#EEF2FF', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', border: '1px solid #E0E7FF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Inter', color: '#1E3A8A' }}>Repayment Progress</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Inter', color: '#155DFC', background: '#DBEAFE', padding: '4px 10px', borderRadius: '20px' }}>
                    {selectedLoan.paidMonths || 0} / {selectedLoan.termMonths || 0} months
                  </span>
                </div>
                <div style={{ background: '#BFDBFE', borderRadius: '8px', height: '10px', overflow: 'hidden' }}>
                  <div style={{
                    background: '#2563EB', borderRadius: '8px', height: '100%',
                    width: `${Math.max(2, ((selectedLoan.paidMonths || 0) / (selectedLoan.termMonths || 1)) * 100)}%`,
                    transition: 'width 0.4s ease-out',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#4B5563', fontFamily: 'Inter' }}>Balance: <span style={{ color: '#111827' }}>{fmt(selectedLoan.remainingBalance)}</span></span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#4B5563', fontFamily: 'Inter' }}>Total: <span style={{ color: '#111827' }}>{fmt(selectedLoan.totalRepayment)}</span></span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ padding: '4px' }}>
                  <p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280', fontFamily: 'Inter', fontWeight: 600 }}>Status</p>
                  <span className={`inline-block px-3 py-1 rounded-md text-sm font-bold tracking-wide uppercase ${selectedLoan.paymentStatus.cls === 'on-track' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : selectedLoan.paymentStatus.cls === 'reminder' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : selectedLoan.paymentStatus.cls === 'delinquent' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' : selectedLoan.paymentStatus.cls === 'high-risk' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-red-900 text-white'}`}>{selectedLoan.paymentStatus.label}</span>
                </div>
                <div style={{ padding: '4px' }}>
                  <p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280', fontFamily: 'Inter', fontWeight: 600 }}>Days Late</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, fontFamily: 'Inter', color: selectedLoan.daysLate > 0 ? '#DC2626' : '#16A34A' }}>{selectedLoan.daysLate > 0 ? `${selectedLoan.daysLate} days` : 'Current'}</p>
                </div>
                <div style={{ padding: '4px' }}>
                  <p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280', fontFamily: 'Inter', fontWeight: 600 }}>Approved Date</p>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, fontFamily: 'Inter', color: '#374151' }}>{fmtDate(selectedLoan.approvedDate)}</p>
                </div>
                <div style={{ padding: '4px' }}>
                  <p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280', fontFamily: 'Inter', fontWeight: 600 }}>Next Due Date</p>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, fontFamily: 'Inter', color: '#374151' }}>{fmtDate(selectedLoan.effectiveDueDate)}</p>
                </div>
              </div>

              {/* Payment History */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, fontFamily: 'Inter', color: '#1E3A8A' }}>Payment History</p>
                  {selectedLoanPayments.length === 0 && !selectedLoanPaymentsLoading && (
                    <button
                      onClick={async () => {
                        setSelectedLoanPaymentsLoading(true);
                        try {
                          const res = await fetch(`${API}/api/admin/loan-payments?status=all&limit=50&search=${encodeURIComponent(selectedLoan.loanId)}`, { headers: { Authorization: `Bearer ${token}` } });
                          const data = await res.json();
                          if (data.success) setSelectedLoanPayments((data.payments || []).filter(p => p.status === 'confirmed'));
                        } catch { /* silent */ }
                        finally { setSelectedLoanPaymentsLoading(false); }
                      }}
                      style={{ background: '#EEF2FF', color: '#1E3A8A', border: '1px solid #C7D2FE', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter' }}
                    >Load History</button>
                  )}
                </div>
                {selectedLoanPaymentsLoading && (
                  <p style={{ fontSize: '13px', color: '#9CA3AF', fontFamily: 'Inter', textAlign: 'center', padding: '12px 0' }}>Loading...</p>
                )}
                {selectedLoanPayments.length > 0 && (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'Inter' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>Date</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>Amount</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>Method</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLoanPayments.map((p, i) => (
                          <tr key={p._id || i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '7px 10px', color: '#374151' }}>{fmtDate(p.confirmedAt || p.submittedAt)}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>{fmt(p.amount)}</td>
                            <td style={{ padding: '7px 10px', color: '#374151', textTransform: 'capitalize' }}>{p.paymentMethod || 'cash'}</td>
                            <td style={{ padding: '7px 10px' }}>
                              <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', background: p.paymentType === 'full' ? '#DCFCE7' : p.paymentType === 'advance' ? '#DBEAFE' : '#F3F4F6', color: p.paymentType === 'full' ? '#166534' : p.paymentType === 'advance' ? '#1E3A8A' : '#374151' }}>
                                {p.paymentType || 'regular'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!selectedLoanPaymentsLoading && selectedLoanPayments.length === 0 && (
                  <p style={{ fontSize: '12px', color: '#9CA3AF', fontFamily: 'Inter', textAlign: 'center', padding: '8px 0', margin: 0 }}>Click "Load History" to view payment records</p>
                )}
              </div>
            </div>
            <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => { setSelectedLoan(null); setSelectedLoanPayments([]); }} style={{ background: '#155DFC', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pending Detail Modal ── */}
      {pendingDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4" onClick={() => !actionLoading && setPendingDetail(null)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[480px] flex flex-col border border-slate-200 dark:border-white/10 shadow-2xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 px-6 border-b border-slate-200 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${pendingDetail.status === 'pending' ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-blue-100 dark:bg-blue-500/20'}`}>
                  <CreditCard size={18} className={pendingDetail.status === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'} />
                </div>
                <div>
                  <h2 className="font-inter text-base font-bold text-slate-800 dark:text-white m-0">
                    {pendingDetail.status === 'pending' ? 'Review Transaction' : 'Transaction Detail'}
                  </h2>
                  <p className="font-inter text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">
                    {isSavingsRoute ? `Goal: ${pendingDetail.goalName || pendingDetail.goalId || 'General'}` : `Loan: ${pendingDetail.loanId || '—'}`}
                  </p>
                </div>
              </div>
              <button
                className="w-8 h-8 border-none bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-lg cursor-pointer flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                onClick={() => { setPendingDetail(null); setShowRejectInput(false); setRejectReason(''); }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 p-5 px-6 flex flex-col gap-3">
              {/* Info — single container with rows */}
              <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                {(isSavingsRoute ? [
                  { label: 'Member', value: pendingDetail.memberName || pendingDetail.email },
                  { label: 'Transaction Type', badge: pendingDetail.type || 'deposit' },
                  { label: 'Goal Name', value: pendingDetail.goalName || 'General Savings' },
                  { label: 'Amount', value: fmt(pendingDetail.amount), highlight: true },
                  { label: 'Payout Method', value: `${pendingDetail.sendMethod || pendingDetail.paymentMethod || 'e-wallet'}` },
                  ...(pendingDetail.accountName ? [{ label: 'Account Holder', value: pendingDetail.accountName }] : []),
                  ...(pendingDetail.accountNumber ? [{ label: 'Account Number', value: pendingDetail.accountNumber }] : []),
                  ...(pendingDetail.description ? [{ label: 'Reason', value: pendingDetail.description }] : []),
                  { label: 'Date Requested', value: fmtDate(pendingDetail.date || pendingDetail.submittedAt || pendingDetail.createdAt) },
                ] : [
                  { label: 'Member', value: pendingDetail.memberName || pendingDetail.email },
                  { label: 'Reference #', value: pendingDetail.referenceNumber || pendingDetail.loanId || 'N/A' },
                  { label: 'Amount', value: fmt(pendingDetail.amount), highlight: true },
                  { label: 'Payment Type', badge: pendingDetail.paymentType || 'regular' },
                  { label: 'Months Covered', value: pendingDetail.monthsCovered > 0 ? `${pendingDetail.monthsCovered} month${pendingDetail.monthsCovered > 1 ? 's' : ''}` : 'Partial' },
                  { label: 'Method', value: `${pendingDetail.paymentMethod || 'cash'}${pendingDetail.subMethod ? ` (${pendingDetail.subMethod})` : ''}` },
                  ...(pendingDetail.accountName ? [{ label: 'Sender Name', value: pendingDetail.accountName }] : []),
                  ...(pendingDetail.accountNumber ? [{ label: 'Sender Account', value: pendingDetail.accountNumber }] : []),
                ]).map((item, i, arr) => (
                  <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : ''}`}>
                    <span className="font-inter text-xs text-slate-500 dark:text-slate-400">{item.label}</span>
                    {item.badge ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${item.badge === 'withdrawal' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : item.badge === 'deposit' || item.badge === 'full' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : item.badge === 'advance' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300'}`}>
                        {item.badge}
                      </span>
                    ) : (
                      <span className={`font-inter text-sm font-semibold ${item.highlight ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>{item.value}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Proof of Payment */}
              {(pendingDetail.proofData || pendingDetail.proofOfPayment) && (() => {
                const proof = pendingDetail.proofData || pendingDetail.proofOfPayment;
                const isPdf = proof.startsWith('data:application/pdf');
                return (
                  <div>
                    <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 m-0 mb-2">Proof of Payment</p>
                    {isPdf ? (
                      <div className="flex items-center gap-3 bg-slate-50 dark:bg-black/20 rounded-lg border border-slate-100 dark:border-white/5 p-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0 text-lg">📄</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 m-0 truncate">{pendingDetail.proofFileName || 'proof.pdf'}</p>
                          <p className="font-inter text-[10px] text-slate-400 m-0">PDF Document</p>
                        </div>
                        <button
                          onClick={() => { const win = window.open(); win.document.write(`<iframe src="${proof}" style="width:100%;height:100%;border:none;" />`); }}
                          className="px-3 py-1.5 bg-blue-600 text-white border-none rounded-lg text-[11px] font-semibold font-inter cursor-pointer hover:bg-blue-700 transition-colors shrink-0"
                        >View</button>
                      </div>
                    ) : (
                      <div
                        className="bg-slate-50 dark:bg-black/20 rounded-lg border border-slate-100 dark:border-white/5 p-2 cursor-pointer hover:border-blue-300 dark:hover:border-blue-500/30 transition-colors group"
                        onClick={() => setProofZoom(proof)}
                      >
                        <img
                          src={proof}
                          alt="Proof"
                          className="w-full max-h-[120px] object-contain rounded-md group-hover:opacity-90 transition-opacity"
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Rejection Reason (inline, always visible when showRejectInput) */}
              {showRejectInput && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 m-0">Reason for Rejection</p>
                    <span className="text-rose-500 text-xs font-bold">*</span>
                  </div>
                  <input 
                    list="reject-reasons-list"
                    value={rejectReason} 
                    onChange={(e) => setRejectReason(e.target.value)} 
                    placeholder="Select or type a reason..." 
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/30 transition-all"
                  />
                  <datalist id="reject-reasons-list">
                    <option value="Invalid or unclear proof of payment" />
                    <option value="Amount does not match the required payment" />
                    <option value="Reference number not found or already used" />
                    <option value="Payment sent to wrong account" />
                    <option value="Duplicate transaction submission" />
                    <option value="Proof of payment appears to be altered or fraudulent" />
                    <option value="Payment received after the cut-off period" />
                  </datalist>
                  {rejectReason.trim().length === 0 && (
                    <p className="font-inter text-[11px] text-rose-500 m-0">This field is required to reject the transaction.</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 px-6 border-t border-slate-200 dark:border-white/10 shrink-0 bg-slate-50/50 dark:bg-black/10 rounded-b-2xl">
              {pendingDetail.status !== 'pending' ? (
                <div className="flex justify-end">
                  <button
                    onClick={() => setPendingDetail(null)}
                    className="px-5 py-2.5 bg-blue-600 text-white border-none rounded-lg text-sm font-semibold font-inter cursor-pointer hover:bg-blue-700 transition-colors"
                  >Close</button>
                </div>
              ) : !showRejectInput ? (
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowRejectInput(true)}
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-lg text-sm font-semibold font-inter cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                  >Reject</button>
                  <button
                    onClick={() => setShowApproveConfirm(true)}
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-emerald-600 text-white border-none rounded-lg text-sm font-semibold font-inter cursor-pointer hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    Approve
                  </button>
                </div>
              ) : (
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
                    className="px-5 py-2.5 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-semibold font-inter cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >Cancel</button>
                  <button
                    onClick={handleRejectPending}
                    disabled={actionLoading || !rejectReason.trim()}
                    className="px-5 py-2.5 bg-rose-600 text-white border-none rounded-lg text-sm font-semibold font-inter cursor-pointer hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {actionLoading && <Loader2 size={14} className="animate-spin" />}
                    {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Approve Confirmation Modal ── */}
      {showApproveConfirm && pendingDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[3000] p-4" onClick={() => !actionLoading && setShowApproveConfirm(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[400px] border border-slate-200 dark:border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="font-inter text-lg font-bold text-slate-800 dark:text-white m-0 mb-2">Confirm Approval</h3>
              <p className="font-inter text-sm text-slate-600 dark:text-slate-400 m-0 mb-1 leading-relaxed">
                Are you sure you want to approve this payment?
              </p>
              <div className="bg-slate-50 dark:bg-black/20 rounded-lg p-3 mt-3 border border-slate-100 dark:border-white/5">
                <p className="font-inter text-xs text-slate-500 dark:text-slate-400 m-0 mb-1">
                  {pendingDetail.memberName || pendingDetail.email}
                </p>
                <p className="font-inter text-lg font-extrabold text-emerald-600 dark:text-emerald-400 m-0">
                  {fmt(pendingDetail.amount)}
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-4 px-6 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/10 rounded-b-2xl">
              <button
                onClick={() => setShowApproveConfirm(false)}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-semibold font-inter cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >Cancel</button>
              <button
                onClick={handleApprovePending}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-emerald-600 text-white border-none rounded-lg text-sm font-semibold font-inter cursor-pointer hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading && <Loader2 size={14} className="animate-spin" />}
                {actionLoading ? 'Approving...' : 'Yes, Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Proof Zoom Lightbox ── */}
      {proofZoom && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[4000] p-6 cursor-pointer" onClick={() => setProofZoom(null)}>
          <button
            onClick={() => setProofZoom(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border-none text-white cursor-pointer flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
          <img
            src={proofZoom}
            alt="Proof of Payment"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Savings Detail Modal ── */}
      {selectedSavings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setSelectedSavings(null)} style={{ zIndex: 2000 }}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[520px] flex flex-col border border-slate-200 dark:border-white/10 shadow-2xl" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-[18px_24px] border-b border-slate-200 dark:border-white/10 shrink-0">
              <h2 className="font-inter text-lg font-bold text-slate-800 dark:text-white m-0">Savings Transaction Detail</h2>
              <button className="w-8 h-8 border-none bg-slate-100 dark:bg-white/5 text-slate-500 rounded-lg cursor-pointer flex items-center justify-center text-lg font-bold hover:bg-slate-200 transition-colors" onClick={() => setSelectedSavings(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '16px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '16px', columnGap: '12px', marginBottom: '16px' }}>
                <div><p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Member Name</p><p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{selectedSavings.memberName || selectedSavings.email}</p></div>
                <div><p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Email</p><p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{selectedSavings.email}</p></div>
                <div><p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Goal</p><p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{selectedSavings.goalName || 'General Savings'}</p></div>
                <div><p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Type</p>
                  <p style={{ margin: 0, fontWeight: 700, textTransform: 'capitalize' }}>
                    <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase ${selectedSavings.type === 'withdrawal' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>{selectedSavings.type}</span>
                  </p>
                </div>
                <div><p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Amount</p><p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: selectedSavings.type === 'withdrawal' ? '#DC2626' : '#16A34A' }}>{fmt(selectedSavings.amount)}</p></div>
                <div><p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Date Confirmed</p><p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{fmtDate(selectedSavings.confirmedAt || selectedSavings.date)}</p></div>
                <div><p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Method</p><p style={{ margin: 0, fontSize: '15px', fontWeight: 600, textTransform: 'capitalize' }}>{selectedSavings.paymentMethod || 'cash'}</p></div>
                <div><p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Reference #</p><p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{selectedSavings.referenceNumber || '—'}</p></div>
              </div>

              {(selectedSavings.proofData || selectedSavings.proofOfPayment) && (
                <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>Proof of Payment</p>
                  <img src={selectedSavings.proofData || selectedSavings.proofOfPayment} alt="Proof" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                </div>
              )}

              <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setSelectedSavings(null)} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#155DFC', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Walk-in Transaction Modal ── */}
      {showWalkinModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2000] p-4" onClick={() => setShowWalkinModal(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[480px] flex flex-col border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10 shrink-0">
              <div>
                <h2 className="font-inter text-base font-bold text-slate-800 dark:text-white m-0">Process Walk-in Transaction</h2>
                <p className="font-inter text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">Process payments or deposits directly on behalf of a user.</p>
              </div>
              <button className="w-8 h-8 border-none bg-slate-100 dark:bg-white/5 text-slate-500 rounded-lg cursor-pointer flex items-center justify-center text-lg font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors" onClick={() => setShowWalkinModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3.5 max-h-[65vh] overflow-y-auto">
              <div className="flex flex-col gap-1">
                <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300">Transaction Type</label>
                <select
                  className="w-full h-9 px-3 bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/10 rounded-lg font-inter text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-sm"
                  value={walkinType}
                  onChange={(e) => { setWalkinType(e.target.value); setWalkinSelectedLoan(''); setWalkinSelectedMember(null); setWalkinAmount(''); }}
                >
                  <option value="loan">Loan Repayment</option>
                  <option value="savings">Savings Deposit</option>
                </select>
              </div>

              {walkinType === 'loan' ? (
                <div className="flex flex-col gap-1">
                  <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300">Select Active Loan</label>
                  <select
                    className="w-full h-9 px-3 bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/10 rounded-lg font-inter text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-sm"
                    value={walkinSelectedLoan}
                    onChange={handleWalkinLoanSelected}
                  >
                    <option value="">-- Choose Loan --</option>
                    {allLoans.filter(l => l.status === 'active').map(l => (
                      <option key={l._id} value={l._id}>
                        [{l.loanId}] {l.memberName} — Bal: {fmt(l.remainingBalance)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1 relative">
                    <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300">Search Member</label>
                    <input
                      type="text"
                      className="w-full h-9 px-3 bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/10 rounded-lg font-inter text-xs text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 transition-colors shadow-sm"
                      placeholder="Type name or email..."
                      value={walkinSearch}
                      onChange={(e) => handleWalkinSearchChange(e.target.value)}
                    />
                    {showWalkinUsers && walkinUsers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                        {walkinUsers.map(u => (
                          <div key={u._id} className="p-2.5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors flex flex-col" onClick={() => selectWalkinMember(u)}>
                            <span className="font-inter text-xs font-semibold text-slate-800 dark:text-white">{u.fullName || 'Unknown'}</span>
                            <span className="font-inter text-[11px] text-slate-500 dark:text-slate-400">{u.email}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300">Select Savings Goal</label>
                    <select
                      className="w-full h-9 px-3 bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/10 rounded-lg font-inter text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                      value={walkinSelectedGoal}
                      onChange={(e) => setWalkinSelectedGoal(e.target.value)}
                      disabled={!walkinSelectedMember || walkinGoals.length === 0}
                    >
                      {!walkinSelectedMember ? (
                        <option value="">-- Search and Select a Member First --</option>
                      ) : walkinGoals.length === 0 ? (
                        <option value="">No Active Goals Found</option>
                      ) : (
                        <option value="">-- Choose Goal --</option>
                      )}
                      {walkinGoals.map(g => (
                        <option key={g._id} value={g._id}>
                          {g.name} — Progress: {fmt(g.savedAmount)} / {fmt(g.targetAmount)}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1">
                <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300">{walkinType === 'loan' ? 'Payment Amount' : 'Deposit Amount'}</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-inter text-xs pointer-events-none">₱</span>
                  <input
                    type="number"
                    className="w-full h-9 pl-7 pr-3 bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/10 rounded-lg font-inter text-xs text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 transition-colors shadow-sm"
                    placeholder="0.00"
                    value={walkinAmount}
                    onChange={(e) => setWalkinAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300">Payment Method</label>
                  <select
                    className="w-full h-9 px-3 bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/10 rounded-lg font-inter text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-sm"
                    value={walkinMethod}
                    onChange={(e) => setWalkinMethod(e.target.value)}
                  >
                    <option value="cash">Walk-in Cash</option>
                    <option value="e-wallet">E-Wallet</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300">Reference # (Optional)</label>
                  <input
                    type="text"
                    className="w-full h-9 px-3 bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/10 rounded-lg font-inter text-xs text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 transition-colors shadow-sm"
                    placeholder="e.g. 12345678"
                    value={walkinRef}
                    onChange={(e) => setWalkinRef(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2 bg-slate-50 dark:bg-black/20">
              <button
                onClick={() => setShowWalkinModal(false)}
                disabled={walkinLoading}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#252836] text-slate-700 dark:text-slate-300 text-xs font-semibold font-inter hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleWalkinSubmit}
                disabled={walkinLoading}
                className="px-4 py-2 rounded-lg border-none bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold font-inter transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                {walkinLoading ? <Loader2 className="animate-spin" size={14} /> : null}
                Submit & Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
