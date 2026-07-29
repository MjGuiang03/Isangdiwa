import { useState, useEffect, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import LoanAdminSidebar from './loanAdminSidebar';


import API from '../../utils/api';
import { PiggyBank, Search, X, Loader2 } from 'lucide-react'; 
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
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PER_PAGE = 10;
  useEffect(() => {
    setSavingsPage(1);
    setHistoryPage(1);
  }, [searchQuery, savingsTypeFilter]);

  // Manual Approval State
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingDetail, setPendingDetail] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
      const effectiveDueDate = l.nextPaymentDate || l.nextDueDate || l.approvedDate;
      const daysLate = getDaysLate(effectiveDueDate);
      const status = getPaymentStatus(daysLate);
      return { ...l, daysLate, paymentStatus: status, effectiveDueDate };
    });
  }, [loans]);

  const filtered = useMemo(() => {
    return enriched.filter(l =>
      (l.memberName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.loanId || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [enriched, searchQuery]);

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



  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
      <LoanAdminSidebar />
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h1 className="font-inter text-xl font-bold text-slate-800 dark:text-white m-0">
            {isSavingsRoute ? 'Savings Overview' : 'Loan Payments'}
          </h1>
          <button 
            onClick={() => { resetWalkin(); setShowWalkinModal(true); setWalkinType(isSavingsRoute ? 'savings' : 'loan'); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold font-inter rounded-lg hover:bg-blue-700 transition-colors border-none cursor-pointer shadow-sm"
          >
            <PiggyBank size={16} />
            Process Walk-in
          </button>
        </div>

        {!isSavingsRoute && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between mb-3 min-h-[24px]">
                <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">On Track</p>
              </div>
              <p className="font-inter font-bold text-3xl text-emerald-500 m-0">{counts.onTrack}</p>
            </div>
            <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between mb-3 min-h-[24px]">
                <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">Overdue (1-30d)</p>
              </div>
              <p className="font-inter font-bold text-3xl text-amber-500 m-0">{counts.overdue}</p>
            </div>
            <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between mb-3 min-h-[24px]">
                <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">High Risk (31-60d)</p>
              </div>
              <p className="font-inter font-bold text-3xl text-orange-500 m-0">{counts.highRisk}</p>
            </div>
            <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between mb-3 min-h-[24px]">
                <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">Default (60+d)</p>
              </div>
              <p className="font-inter font-bold text-3xl text-rose-500 m-0">{counts.defaulted}</p>
            </div>
          </div>
        )}

        {isSavingsRoute && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Left Column: Chart */}
            <div className="md:col-span-2 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm">
              <h3 className="font-inter text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 m-0">Savings by Role</h3>
              <div className="flex flex-col gap-4">
                {savingsChartData.pieTotal === 0 ? (
                  <p className="text-sm text-slate-400">No savings deposits available yet.</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={savingsChartData.pieData}
                          cx="50%"
                          cy="45%"
                          innerRadius={50}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={renderSliceLabel}
                          labelLine={false}
                        >
                          {savingsChartData.pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                          <Label 
                            value={`₱${savingsChartData.pieTotal >= 1000 ? (savingsChartData.pieTotal/1000).toFixed(1).replace(/\.0$/, '') + 'k' : savingsChartData.pieTotal}`} 
                            position="center" 
                            fill="#1e3a5f" 
                            className="text-lg font-bold font-inter" 
                          />
                          <Label 
                            value="Total" 
                            position="center" 
                            dy={16} 
                            fill="#6B7280" 
                            className="text-xs font-inter" 
                          />
                        </Pie>
                        <RechartsTooltip formatter={(value, name, props) => [`₱${(value || 0).toLocaleString()} (${Math.round((value/savingsChartData.pieTotal)*100)}%)`, props.payload.name]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 px-1">
                      {savingsChartData.pieData.map((cat, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                            <span className="font-inter text-[13px] text-slate-700 dark:text-slate-300">{cat.name}</span>
                          </div>
                          <span className="font-inter text-[13px] font-semibold text-slate-800 dark:text-white">₱{cat.value.toLocaleString()} — {Math.round((cat.value/savingsChartData.pieTotal)*100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: 3 Stat Cards */}
            <div className="flex flex-col gap-4">
              <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-2 cursor-pointer hover:-translate-y-0.5 transition-transform">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">Total Savings</p>
                  <select value={savingsFilter} onChange={e => setSavingsFilter(e.target.value)} className="text-[11px] font-inter p-1 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-[#252836] text-slate-600 dark:text-slate-400 outline-none cursor-pointer">
                    <option value="all">All Time</option>
                    <option value="this_month">This Month</option>
                    <option value="this_year">This Year</option>
                  </select>
                </div>
                <p className="font-inter font-bold text-3xl text-emerald-500 m-0">{fmt(totalSavingsFiltered)}</p>
              </div>

              <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-2 cursor-pointer hover:-translate-y-0.5 transition-transform">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">Total Withdrawals</p>
                </div>
                <p className="font-inter font-bold text-3xl text-rose-600 m-0">{fmt(totalWithdrawalsFiltered)}</p>
              </div>

              <div 
                className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-2 cursor-pointer hover:-translate-y-0.5 transition-transform" 
                onClick={() => setActiveTab('pending')}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">Pending Review</p>
                </div>
                <p className="font-inter font-bold text-3xl text-orange-600 m-0">{pendingSavings.length}</p>
              </div>
            </div>
          </div>
        )}

        {(!isSavingsRoute || approvalMethod === 'manual') && (
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-white/10">
            <button 
              onClick={() => setActiveTab(isSavingsRoute ? 'savings' : 'loans')}
              className={`px-4 py-2 text-[13px] font-semibold font-inter transition-colors border-b-2 -mb-[2px] ${activeTab === (isSavingsRoute ? 'savings' : 'loans') ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'} bg-transparent cursor-pointer`}
            >
              {isSavingsRoute ? 'Savings Records' : 'Active Loans'}
            </button>
            {!isSavingsRoute && (
              <button 
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 text-[13px] font-semibold font-inter transition-colors border-b-2 -mb-[2px] ${activeTab === 'history' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'} bg-transparent cursor-pointer`}
              >
                Payment History
              </button>
            )}
            {approvalMethod === 'manual' && (
              <button 
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 flex items-center gap-2 text-[13px] font-semibold font-inter transition-colors border-b-2 -mb-[2px] ${activeTab === 'pending' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'} bg-transparent cursor-pointer`}
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

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-[400px]">
            <Search size={18} color="#9CA3AF" />
            <input 
              type="text" 
              placeholder={isSavingsRoute ? "Search by member name or goal..." : "Search by member name or loan ID..."} 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full h-10 pl-10 pr-4 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          {isSavingsRoute && activeTab === 'savings' && (
            <select 
              value={savingsTypeFilter} 
              onChange={(e) => setSavingsTypeFilter(e.target.value)}
              className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposits Only</option>
              <option value="withdrawal">Withdrawals Only</option>
            </select>
          )}
        </div>

        {activeTab === 'savings' && isSavingsRoute && (
          <div className="flex flex-col gap-5 mb-5">
            {/* Table */}
            <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto shadow-sm" >
              <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Date</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Member</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Type</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Goal</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center p-10 text-slate-400">Loading...</td></tr>
                ) : (() => {
                  const filteredSavingsList = confirmedSavings.filter(s => {
                    const matchesSearch = (s.memberName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.goalName || s.goalId || '').toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesType = savingsTypeFilter === 'all' || s.type === savingsTypeFilter;
                    return matchesSearch && matchesType;
                  });
                  
                  if (filteredSavingsList.length === 0) {
                    return <tr><td colSpan={6} className="text-center p-10 text-slate-400">No records found</td></tr>;
                  }
                  
                  const paginatedSavings = filteredSavingsList.slice((savingsPage - 1) * SAVINGS_PER_PAGE, savingsPage * SAVINGS_PER_PAGE);
                  
                  return (
                    <>
                      {paginatedSavings.map(txn => (
                        <tr key={txn._id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer cursor-pointer" onClick={() => setSelectedSavings(txn)}>
                          <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">{fmtDate(txn.confirmedAt || txn.date)}</td>
                          <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">
                            <div className="flex flex-col">
                              <p className="font-inter text-sm font-semibold text-slate-800 dark:text-white m-0">{txn.memberName || txn.email}</p>
                              <p className="font-inter text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">{txn.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">
                            <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase ${txn.type === 'withdrawal' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                              {txn.type}
                            </span>
                          </td>
                          <td className="text-[13px] text-slate-600 dark:text-slate-400">{txn.goalName || 'General Savings'}</td>
                          <td className={`px-4 py-3 whitespace-nowrap font-inter text-sm font-bold ${txn.type === 'withdrawal' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {txn.type === 'withdrawal' ? '-' : '+'}{fmt(txn.amount)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">
                            <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">Confirmed</span>
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
                const matchesSearch = (s.memberName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.goalName || s.goalId || '').toLowerCase().includes(searchQuery.toLowerCase());
                const matchesType = savingsTypeFilter === 'all' || s.type === savingsTypeFilter;
                return matchesSearch && matchesType;
              });
              const totalSavingsPages = Math.ceil(filteredSavingsList.length / SAVINGS_PER_PAGE);
              if (totalSavingsPages > 1) {
                return (
                  <div className="flex items-center justify-center gap-4 p-4">
                    <button disabled={savingsPage === 1} onClick={() => setSavingsPage(p => p - 1)} className="px-4 py-2 text-[13px] font-semibold font-inter bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
                    <span className="font-inter text-[13px] text-slate-500 dark:text-slate-400">Page {savingsPage} of {totalSavingsPages}</span>
                    <button disabled={savingsPage === totalSavingsPages} onClick={() => setSavingsPage(p => p + 1)} className="px-4 py-2 text-[13px] font-semibold font-inter bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        {activeTab === 'loans' && !isSavingsRoute && (
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto shadow-sm">
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
                  filtered.map(loan => (
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
        )}

        {/* Pending Approvals Tab */}
        {activeTab === 'pending' && (
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto shadow-sm">
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
                ) : (isSavingsRoute ? pendingSavings : pendingLoanPayments).length === 0 ? (
                  <tr><td colSpan={8} className="text-center p-10 text-slate-400">No pending approvals</td></tr>
                ) : (
                  (isSavingsRoute ? pendingSavings : pendingLoanPayments).map(txn => (
                    <tr key={txn._id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                      <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">{fmtDate(txn.submittedAt || txn.createdAt || txn.date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">
                        <div className="flex flex-col">
                          <p className="font-inter text-sm font-semibold text-slate-800 dark:text-white m-0">{txn.memberName || txn.email}</p>
                          <p className="font-inter text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">{isSavingsRoute ? `Goal: ${txn.goalId}` : `Loan: ${txn.loanId}`}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold font-inter capitalize ${txn.paymentType === 'full' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400' : txn.paymentType === 'advance' ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'}`}>
                          {txn.paymentType || 'regular'}
                          {txn.monthsCovered > 1 && ` (${txn.monthsCovered}mo)`}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-inter text-sm font-bold text-slate-800 dark:text-white text-orange-600 dark:text-orange-400">{fmt(txn.amount)}</td>
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
        )}

        {/* Payment History Tab (Loans Only) */}
        {activeTab === 'history' && !isSavingsRoute && (
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Date</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Member</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Type</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Method</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Reference</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center p-10 text-slate-400">Loading...</td></tr>
                ) : loanHistory.length === 0 ? (
                  <tr><td colSpan={7} className="text-center p-10 text-slate-400">No payment history found</td></tr>
                ) : (
                  loanHistory.map(txn => (
                    <tr key={txn._id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer cursor-pointer" onClick={() => setPendingDetail(txn)}>
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
                      <td className="px-4 py-3 whitespace-nowrap font-inter text-sm font-bold text-slate-800 dark:text-white text-orange-600 dark:text-orange-400">{fmt(txn.amount)}</td>
                      <td className="capitalize">{txn.paymentMethod || 'cash'}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">{txn.referenceNumber || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${txn.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                          {txn.status === 'confirmed' ? 'Confirmed' : 'Rejected'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {historyTotalCount > HISTORY_PER_PAGE && (
              <div className="flex items-center justify-center gap-4 p-4" style={{ margin: '20px 0 0 0' }}>
                <button disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)} className="px-4 py-2 text-[13px] font-semibold font-inter bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
                <span className="font-inter text-[13px] text-slate-500 dark:text-slate-400">Page {historyPage} of {Math.ceil(historyTotalCount / HISTORY_PER_PAGE)}</span>
                <button disabled={historyPage === Math.ceil(historyTotalCount / HISTORY_PER_PAGE)} onClick={() => setHistoryPage(p => p + 1)} className="px-4 py-2 text-[13px] font-semibold font-inter bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
              </div>
            )}
          </div>
        )}


        <div className="flex items-center justify-between p-4 bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10">
          <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 m-0">
            {activeTab === 'loans' ? `Showing ${filtered.length} active loans` : ''}
          </p>
        </div>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => !actionLoading && setPendingDetail(null)} style={{ zIndex: 2000 }}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[520px] flex flex-col border border-slate-200 dark:border-white/10 shadow-2xl" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-[18px_24px] border-b border-slate-200 dark:border-white/10 shrink-0">
              <h2 className="font-inter text-lg font-bold text-slate-800 dark:text-white m-0">
                {pendingDetail.status === 'pending' ? 'Review Transaction' : 'Transaction Detail'}
              </h2>
              <button className="w-8 h-8 border-none bg-slate-100 dark:bg-white/5 text-slate-500 rounded-lg cursor-pointer flex items-center justify-center text-lg font-bold hover:bg-slate-200 transition-colors" onClick={() => setPendingDetail(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '16px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '16px', columnGap: '12px', marginBottom: '16px' }}>
                <div><p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Member</p><p style={{ margin: 0, fontWeight: 600 }}>{pendingDetail.memberName || pendingDetail.email}</p></div>
                <div><p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Amount</p><p style={{ margin: 0, fontWeight: 700, color: '#EA580C', fontSize: '16px' }}>{fmt(pendingDetail.amount)}</p></div>
                <div>
                  <p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Payment Type</p>
                  <p style={{ margin: 0, fontWeight: 700, textTransform: 'capitalize' }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', background: pendingDetail.paymentType === 'full' ? '#DCFCE7' : pendingDetail.paymentType === 'advance' ? '#DBEAFE' : '#F3F4F6', color: pendingDetail.paymentType === 'full' ? '#166534' : pendingDetail.paymentType === 'advance' ? '#1E3A8A' : '#374151' }}>
                      {pendingDetail.paymentType || 'regular'}
                    </span>
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Months Covered</p>
                  <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>{pendingDetail.monthsCovered > 0 ? `${pendingDetail.monthsCovered} month${pendingDetail.monthsCovered > 1 ? 's' : ''}` : 'Partial'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Method</p>
                  <p style={{ margin: 0, fontWeight: 600, textTransform: 'capitalize' }}>
                    {pendingDetail.paymentMethod || 'cash'}
                    {pendingDetail.subMethod ? ` (${pendingDetail.subMethod})` : ''}
                  </p>
                </div>
                <div><p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Reference #</p><p style={{ margin: 0, fontWeight: 600 }}>{pendingDetail.referenceNumber || '—'}</p></div>
                
                {pendingDetail.accountName && (
                  <div><p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Sender Account Name</p><p style={{ margin: 0, fontWeight: 600 }}>{pendingDetail.accountName}</p></div>
                )}
                {pendingDetail.accountNumber && (
                  <div><p style={{ margin: 0, marginBottom: '4px', fontSize: '12px', color: '#6B7280' }}>Sender Account No.</p><p style={{ margin: 0, fontWeight: 600 }}>{pendingDetail.accountNumber}</p></div>
                )}
              </div>

              {(pendingDetail.proofData || pendingDetail.proofOfPayment) && (() => {
                const proof = pendingDetail.proofData || pendingDetail.proofOfPayment;
                const isPdf = proof.startsWith('data:application/pdf');
                return (
                  <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>Proof of Payment</p>
                    {isPdf ? (
                      <div style={{ background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>📄 {pendingDetail.proofFileName || 'proof.pdf'}</span>
                        <button
                          onClick={() => { const win = window.open(); win.document.write(`<iframe src="${proof}" style="width:100%;height:100%;border:none;" />`); }}
                          style={{ background: '#155DFC', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >View PDF</button>
                      </div>
                    ) : (
                      <img
                        src={proof}
                        alt="Proof"
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #E5E7EB', cursor: 'pointer' }}
                        onClick={() => { const win = window.open(); win.document.write(`<img src="${proof}" style="max-width:100%;" />`); }}
                      />
                    )}
                  </div>
                );
              })()}

              <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
                {pendingDetail.status !== 'pending' ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => setPendingDetail(null)} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#155DFC', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Close</button>
                  </div>
                ) : !showRejectInput ? (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowRejectInput(true)} disabled={actionLoading} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#FEE2E2', color: '#DC2626', fontWeight: 600, cursor: 'pointer' }}>Reject</button>
                    <button onClick={handleApprovePending} disabled={actionLoading} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#16A34A', color: 'white', fontWeight: 600, cursor: 'pointer' }}>{actionLoading ? 'Approving...' : 'Approve'}</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter reason for rejection..." style={{ padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB', width: '100%', minHeight: '80px', fontFamily: 'inherit', fontSize: '14px' }} />
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setShowRejectInput(false); setRejectReason(''); }} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                      <button onClick={handleRejectPending} disabled={actionLoading || !rejectReason.trim()} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#DC2626', color: 'white', fontWeight: 600, cursor: 'pointer' }}>{actionLoading ? 'Rejecting...' : 'Confirm Rejection'}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setShowWalkinModal(false)} style={{ zIndex: 2000 }}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[520px] flex flex-col border border-slate-200 dark:border-white/10 shadow-2xl" style={{ maxWidth: '440px', overflow: 'visible' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-[18px_24px] border-b border-slate-200 dark:border-white/10 shrink-0" style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '16px' }}>
              <div>
                <h2 className="font-inter text-lg font-bold text-slate-800 dark:text-white m-0" style={{ fontSize: '18px' }}>Process Walk-in Transaction</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0', fontFamily: 'Inter' }}>Process payments or deposits directly on behalf of a user.</p>
              </div>
              <button className="w-8 h-8 border-none bg-slate-100 dark:bg-white/5 text-slate-500 rounded-lg cursor-pointer flex items-center justify-center text-lg font-bold hover:bg-slate-200 transition-colors" onClick={() => setShowWalkinModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', maxHeight: '65vh', overflowY: 'auto' }}>
              <div className="walkin-form-group">
                <label className="walkin-label">Transaction Type</label>
                <select className="walkin-select" value={walkinType} onChange={(e) => { setWalkinType(e.target.value); setWalkinSelectedLoan(''); setWalkinSelectedMember(null); setWalkinAmount(''); }}>
                  <option value="loan">Loan Repayment</option>
                  <option value="savings">Savings Deposit</option>
                </select>
              </div>

              {walkinType === 'loan' ? (
                <div className="walkin-form-group">
                  <label className="walkin-label">Select Active Loan</label>
                  <select className="walkin-select" value={walkinSelectedLoan} onChange={handleWalkinLoanSelected}>
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
                  <div className="walkin-form-group" style={{ position: 'relative' }}>
                    <label className="walkin-label">Search Member</label>
                    <input 
                      type="text" 
                      className="walkin-input" 
                      placeholder="Type name or email..." 
                      value={walkinSearch}
                      onChange={(e) => handleWalkinSearchChange(e.target.value)}
                    />
                    {showWalkinUsers && walkinUsers.length > 0 && (
                      <div className="walkin-search-results">
                        {walkinUsers.map(u => (
                          <div key={u._id} className="walkin-search-item" onClick={() => selectWalkinMember(u)}>
                            <span className="walkin-search-item-title">{u.fullName || 'Unknown'}</span>
                            <span className="walkin-search-item-sub">{u.email}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="walkin-form-group">
                    <label className="walkin-label">Select Savings Goal</label>
                    <select className="walkin-select" value={walkinSelectedGoal} onChange={(e) => setWalkinSelectedGoal(e.target.value)} disabled={!walkinSelectedMember || walkinGoals.length === 0}>
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

              <div className="walkin-form-group">
                <label className="walkin-label">{walkinType === 'loan' ? 'Payment Amount' : 'Deposit Amount'}</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: 10, color: '#6B7280', fontFamily: 'Inter', fontSize: '14px', pointerEvents: 'none' }}>₱</span>
                  <input type="number" className="walkin-input" style={{ paddingLeft: '28px' }} placeholder="0.00" value={walkinAmount} onChange={(e) => setWalkinAmount(e.target.value)} />
                </div>
              </div>

              <div className="walkin-form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="walkin-label">Payment Method</label>
                  <select className="walkin-select" value={walkinMethod} onChange={(e) => setWalkinMethod(e.target.value)}>
                    <option value="cash">Walk-in Cash</option>
                    <option value="e-wallet">E-Wallet</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="walkin-label">Reference # (Optional)</label>
                  <input type="text" className="walkin-input" placeholder="e.g. 12345678" value={walkinRef} onChange={(e) => setWalkinRef(e.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#F9FAFB', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
               <button onClick={() => setShowWalkinModal(false)} disabled={walkinLoading} style={{ background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter' }}>Cancel</button>
               <button onClick={handleWalkinSubmit} disabled={walkinLoading} style={{ background: '#155DFC', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter', display: 'flex', alignItems: 'center', gap: '6px' }}>
                 {walkinLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                 Submit & Confirm
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
