import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, LabelList, AreaChart, Area, Label
} from 'recharts';
import LoanAdminSidebar from './loanAdminSidebar';
import PageHeader from '../components/PageHeader';


import API from '../../utils/api';
import { Banknote, CheckCircle, LayoutDashboard, PiggyBank, X, Filter, Expand, TrendingUp } from 'lucide-react';


const fmt = (n) =>
  n != null ? `₱${Number(n).toLocaleString('en-PH')}` : '₱0';

const formatYAxis = (num) => {
  if (num >= 1000000) return `₱${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1000) return `₱${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return num === 0 ? '₱0' : `₱${num}`;
};

const PIE_COLORS = ['#0D1F45', '#1E3A8A', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];
const STATUS_COLORS = {
  Active: '#10B981', Completed: '#0D1F45', Pending: '#2563EB',
  Rejected: '#EF4444', Cancelled: '#F59E0B', Approved: '#60A5FA',
  'Awaiting Approval': '#BFDBFE'
};

const renderSliceLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const fmtDate = (d) => {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i);

export default function LoanAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pending: 0, active: 0, totalThisMonth: 0, totalDisbursed: 0 });
  const [recentLoans, setRecentLoans] = useState([]);
  const [allLoans, setAllLoans] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [disbursementByType, setDisbursementByType] = useState([]);
  const [disbursementByTypeDetail, setDisbursementByTypeDetail] = useState([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [savingsMonthly, setSavingsMonthly] = useState([]);
  const [communitySavings, setCommunitySavings] = useState([]);
  const [savingsSummary, setSavingsSummary] = useState({});
  const [statusDistribution, setStatusDistribution] = useState([]);
  const [repaymentPerformance, setRepaymentPerformance] = useState([]);
  const [monthlyApplications, setMonthlyApplications] = useState([]);
  const [delinquencyRate, setDelinquencyRate] = useState([]);
  const [branchStatusData, setBranchStatusData] = useState([]);
  const [branchRepaymentData, setBranchRepaymentData] = useState([]);
  const [branchAppData, setBranchAppData] = useState([]);
  const [branchDelinquencyData, setBranchDelinquencyData] = useState([]);
  const [monthlyRepayment, setMonthlyRepayment] = useState([]);
  const [monthlyStatusTrend, setMonthlyStatusTrend] = useState([]);
  const [totalPenalties, setTotalPenalties] = useState(0);
  const [branchesAtRisk, setBranchesAtRisk] = useState(0);


  // Modal states
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showDisbursedModal, setShowDisbursedModal] = useState(false);
  const [monthModalMonth, setMonthModalMonth] = useState(new Date().getMonth().toString());
  const [monthModalYear, setMonthModalYear] = useState(new Date().getFullYear());
  const [disbModalMonth, setDisbModalMonth] = useState('all');
  const [disbModalYear, setDisbModalYear] = useState('all');
  const [expandedChart, setExpandedChart] = useState(null);

  const token = localStorage.getItem('adminToken');
  const currentYear = new Date().getFullYear();

  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => {
    if (res.status === 401 || res.status === 403) { navigate('/'); return { success: false }; }
    return res.json();
  });

  const { data: loansData, isValidating: loadingLoans } = useSWR(
    token ? `${API}/api/admin/loans` : null,
    fetcherSingle,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );

  const { data: reportsData, isValidating: loadingReports } = useSWR(
    token ? `${API}/api/admin/loan-reports?year=${currentYear}` : null,
    fetcherSingle,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );

  const { data: savingsData, isValidating: loadingSavings } = useSWR(
    token ? `${API}/api/admin/member-savings` : null,
    fetcherSingle,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );

  useEffect(() => {
    if (!token) { navigate('/'); return; }
  }, [token, navigate]);

  useEffect(() => {
    if (loansData) {
      if (loansData.message && !loansData.success && !loansData.loans) {
        toast.error(loansData.message || 'Failed to fetch dashboard data');
      } else {
        setStats(prev => ({
          ...prev,
          pending: loansData.stats?.pending || 0,
          active: (loansData.stats?.active || 0) + (loansData.stats?.completed || 0),
          totalThisMonth: loansData.stats?.totalThisMonth || 0,
          totalDisbursed: loansData.stats?.totalDisbursed || 0,
        }));
        setAllLoans(loansData.loans || []);
        const upcoming = (loansData.loans || []).filter(l => l.status === 'active' || l.status === 'pending').slice(0, 5);
        setRecentLoans(upcoming);
      }
    }
  }, [loansData]);

  useEffect(() => {
    if (reportsData && reportsData.success) {
      setMonthlyData(reportsData.monthlyData || []);
      setDisbursementByType(reportsData.disbursementByType || []);
      setDisbursementByTypeDetail(reportsData.byType || []);
      setStatusDistribution(reportsData.statusDistribution || []);
      setRepaymentPerformance(reportsData.repaymentPerformance || []);
      setMonthlyApplications(reportsData.monthlyApplications || []);
      setDelinquencyRate(reportsData.delinquencyRate || []);
      setBranchStatusData(reportsData.branchStatusData || []);
      setBranchRepaymentData(reportsData.branchRepaymentData || []);
      setBranchAppData(reportsData.branchAppData || []);
      setBranchDelinquencyData(reportsData.branchDelinquencyData || []);
      setMonthlyRepayment(reportsData.monthlyRepayment || []);
      setMonthlyStatusTrend(reportsData.monthlyStatusTrend || []);
      setTotalPenalties(reportsData.totalPenalties || 0);
      setBranchesAtRisk(reportsData.branchesAtRisk || 0);
    }
  }, [reportsData]);

  useEffect(() => {
    if (savingsData) {
      setTotalSavings(savingsData.totalSavings || 0);
      setCommunitySavings(savingsData.communitySavings || []);
      setSavingsSummary(savingsData.savingsSummary || {});
      const now = new Date();
      const monthsCount = currentYear === now.getFullYear() ? Math.max(now.getMonth() + 1, 6) : 12;

      // Use pre-aggregated monthlyTrend from server if available
      if (savingsData.monthlyTrend && savingsData.monthlyTrend.length > 0) {
        setSavingsMonthly(savingsData.monthlyTrend.slice(0, monthsCount));
      } else {
        // Fallback: process raw transactions (backward compatibility)
        const allMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const months = allMonths.slice(0, monthsCount);
        const monthlyTrend = months.map(m => ({ month: m, savings: 0 }));
        if (savingsData.transactions) {
          savingsData.transactions.forEach(t => {
            const d = new Date(t.date || t.createdAt);
            if (d.getFullYear() === currentYear && monthlyTrend[d.getMonth()]) {
              monthlyTrend[d.getMonth()].savings += Number(t.amount) || 0;
            }
          });
        }
        setSavingsMonthly(monthlyTrend);
      }
    }
  }, [savingsData, currentYear]);

  // For UI rendering, loading is active only when data is missing and it's fetching
  const isLoading = (!loansData && loadingLoans) || (!reportsData && loadingReports) || (!savingsData && loadingSavings);

  const dash = useCallback((v) => isLoading ? '—' : v, [isLoading]);

  // Derived: all disbursed loans
  const allDisbursedLoans = useMemo(() => {
    return allLoans.filter(l => l.disbursed && l.disbursementDate);
  }, [allLoans]);

  const [interestFilter, setInterestFilter] = useState('all');

  const totalInterestFiltered = useMemo(() => {
    if (!allLoans || allLoans.length === 0) return 0;
    return allLoans.reduce((sum, loan) => {
      if (loan.status !== 'completed' && loan.status !== 'active' && loan.status !== 'approved') return sum;
      if (interestFilter === '2x' && loan.interestRateMultiplier !== 2) return sum;
      if (interestFilter === '1.5x' && loan.interestRateMultiplier !== 1.5) return sum;
      if (interestFilter === '1x' && loan.interestRateMultiplier !== 1) return sum;
      const interest = (loan.totalRepayment || loan.amount || 0) - (loan.amount || 0);
      return sum + (interest > 0 ? interest : 0);
    }, 0);
  }, [allLoans, interestFilter]);

  // Filtered loans for This Month modal
  const filteredMonthLoans = useMemo(() => {
    return allDisbursedLoans.filter(l => {
      const d = new Date(l.disbursementDate);
      return d.getMonth() === parseInt(monthModalMonth) && d.getFullYear() === monthModalYear;
    });
  }, [allDisbursedLoans, monthModalMonth, monthModalYear]);

  // Filtered loans for All Disbursements modal
  const filteredDisbLoans = useMemo(() => {
    return allDisbursedLoans.filter(l => {
      const d = new Date(l.disbursementDate);
      if (disbModalYear !== 'all' && d.getFullYear() !== parseInt(disbModalYear)) return false;
      if (disbModalMonth !== 'all' && d.getMonth() !== parseInt(disbModalMonth)) return false;
      return true;
    });
  }, [allDisbursedLoans, disbModalMonth, disbModalYear]);

  const getMonthModalLabel = useCallback(() => `${MONTH_NAMES[parseInt(monthModalMonth)]} ${monthModalYear}`, [monthModalMonth, monthModalYear]);
  const getDisbModalLabel = useCallback(() => {
    if (disbModalYear === 'all' && disbModalMonth === 'all') return 'All Time';
    if (disbModalYear !== 'all' && disbModalMonth === 'all') return `Year ${disbModalYear}`;
    if (disbModalYear === 'all' && disbModalMonth !== 'all') return `${MONTH_NAMES[parseInt(disbModalMonth)]} (All Years)`;
    return `${MONTH_NAMES[parseInt(disbModalMonth)]} ${disbModalYear}`;
  }, [disbModalMonth, disbModalYear]);

  const openMonthModal = useCallback(() => {
    setMonthModalMonth(new Date().getMonth().toString());
    setMonthModalYear(new Date().getFullYear());
    setShowMonthModal(true);
  }, []);
  const openDisbModal = useCallback(() => {
    setDisbModalMonth('all');
    setDisbModalYear('all');
    setShowDisbursedModal(true);
  }, []);

  const visibleMonthlyData = useMemo(() => {
    const now = new Date();
    const maxMonth = currentYear === now.getFullYear() ? now.getMonth() + 1 : 12;
    return monthlyData.slice(0, maxMonth);
  }, [monthlyData, currentYear]);

  const visibleMonthlyApplications = useMemo(() => {
    const now = new Date();
    const maxMonth = currentYear === now.getFullYear() ? now.getMonth() + 1 : 12;
    return monthlyApplications.slice(0, maxMonth);
  }, [monthlyApplications, currentYear]);

  const visibleDelinquencyRate = useMemo(() => {
    const now = new Date();
    const maxMonth = currentYear === now.getFullYear() ? now.getMonth() + 1 : 12;
    return delinquencyRate.slice(0, maxMonth);
  }, [delinquencyRate, currentYear]);

  const visibleMonthlyStatusTrend = useMemo(() => {
    const now = new Date();
    const maxMonth = currentYear === now.getFullYear() ? now.getMonth() + 1 : 12;
    return monthlyStatusTrend.slice(0, maxMonth);
  }, [monthlyStatusTrend, currentYear]);

  const visibleMonthlyRepayment = useMemo(() => {
    const now = new Date();
    const maxMonth = currentYear === now.getFullYear() ? now.getMonth() + 1 : 12;
    return monthlyRepayment.slice(0, maxMonth);
  }, [monthlyRepayment, currentYear]);

  const moneyInVsOutSummary = useMemo(() => {
    const totalIn = visibleMonthlyData.reduce((sum, d) => sum + (d.received || 0), 0);
    const totalOut = visibleMonthlyData.reduce((sum, d) => sum + (d.disbursed || 0), 0);
    const net = totalIn - totalOut;
    return { totalIn, totalOut, net };
  }, [visibleMonthlyData]);

  const disbursementSummary = useMemo(() => {
    const total = disbursementByType.reduce((s, d) => s + (d.amount || 0), 0);
    const activeDisbursements = disbursementByType.filter(d => d.amount > 0);
    const zeroDisbursements = disbursementByType.filter(d => d.amount === 0);
    return { total, activeDisbursements, zeroDisbursements };
  }, [disbursementByType]);

  // Monthly disbursement trend per loan type (for expanded view)
  const disbursementMonthlyTrend = useMemo(() => {
    const LOAN_TYPE_LABELS = { 'personal': 'Personal Loan', 'emergency': 'Emergency Loan', 'short-term': 'Short-Term Loan' };
    const now = new Date();
    const maxMonth = currentYear === now.getFullYear() ? now.getMonth() + 1 : 12;
    return MONTH_NAMES.slice(0, maxMonth).map((month, idx) => {
      const monthLoans = allDisbursedLoans.filter(l => {
        const d = new Date(l.disbursementDate);
        return d.getMonth() === idx && d.getFullYear() === currentYear;
      });
      const row = { month };
      Object.keys(LOAN_TYPE_LABELS).forEach(key => {
        row[LOAN_TYPE_LABELS[key]] = monthLoans
          .filter(l => (l.loanType || 'personal') === key)
          .reduce((s, l) => s + (Number(l.amount) || 0), 0);
      });
      return row;
    });
  }, [allDisbursedLoans, currentYear]);

  const enhancedSavingsData = useMemo(() => {
    const enhancedSavings = savingsMonthly.map(d => ({
      ...d,
      actualSavings: d.savings > 0 ? d.savings : null,
      zeroSavings: d.savings === 0 ? 0 : null
    }));
    let firstDataIdx = enhancedSavings.findIndex(d => d.actualSavings !== null);
    if (firstDataIdx > 0) enhancedSavings[firstDataIdx].zeroSavings = enhancedSavings[firstDataIdx].actualSavings;
    return enhancedSavings;
  }, [savingsMonthly]);

  const statusDistributionSummary = useMemo(() => {
    // eslint-disable-next-line no-unused-vars
    const total = statusDistribution.reduce((s, d) => s + (d.value || 0), 0);
    return { total };
  }, [statusDistribution]);

  const repaymentPerformanceSummary = useMemo(() => {
    const total = repaymentPerformance.reduce((s, d) => s + (d.value || 0), 0);
    const onTime = repaymentPerformance.find(d => d.name === 'On-Time')?.value || 0;
    const pct = total > 0 ? ((onTime / total) * 100).toFixed(1) : 0;
    return { total, onTime, pct };
  }, [repaymentPerformance]);

  const delinquencyRateSummary = useMemo(() => {
    const totalPayments = visibleDelinquencyRate.reduce((s, d) => s + (d.total || 0), 0);
    const totalLate = visibleDelinquencyRate.reduce((s, d) => s + (d.late || 0), 0);
    const avgRate = totalPayments > 0 ? ((totalLate / totalPayments) * 100).toFixed(1) : 0;
    return { totalPayments, totalLate, avgRate };
  }, [visibleDelinquencyRate]);

  const monthModalTotal = useMemo(() => {
    return filteredMonthLoans.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  }, [filteredMonthLoans]);

  const disbModalTotal = useMemo(() => {
    return filteredDisbLoans.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  }, [filteredDisbLoans]);

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
        <LoanAdminSidebar />
        <div className="p-6 pb-16 flex-1 overflow-y-auto w-full animate-pulse flex flex-col gap-6">
          {/* Header Skeleton */}
          <div className="flex flex-col gap-2">
            <div className="h-8 w-56 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
            <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
          </div>

          {/* 6 Stat Cards Skeleton */}
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden mb-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 lg:divide-x divide-slate-200 dark:divide-white/10">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-4 min-h-[105px] flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700/80"></div>
                  </div>
                  <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700/80 rounded mt-3"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts Grid Skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="h-[320px] bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6">
              <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700/80 rounded mb-4"></div>
              <div className="h-4/5 bg-slate-100 dark:bg-slate-800/50 rounded-xl"></div>
            </div>
            <div className="h-[320px] bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6">
              <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700/80 rounded mb-4"></div>
              <div className="h-4/5 bg-slate-100 dark:bg-slate-800/50 rounded-xl"></div>
            </div>
          </div>

          {/* Recent Table Skeleton */}
          <div className="h-64 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6">
            <div className="h-5 w-52 bg-slate-200 dark:bg-slate-700/80 rounded mb-4"></div>
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/50 rounded-xl"></div>
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
      <div className="p-6 pb-16 flex-1 overflow-y-auto w-full">
        {!expandedChart && (<>
        {/* Header */}
        <PageHeader
          title={
            <>
              <span className="text-slate-500 dark:text-slate-400 font-normal">
                {(() => {
                  const h = new Date().getHours();
                  return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
                })()}, 
              </span>{' '}
              <span className="text-slate-900 dark:text-white font-bold">Loan Staff</span>
            </>
          }
          subtitle={
            <>
              Loan operations overview for <strong>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
            </>
          }
        />

        {/* Row 1 — Unified Metric Bar */}
        <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-white/10">
            {/* Pending Review */}
            <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer flex flex-col justify-between min-h-[105px]" onClick={() => navigate('/loan-admin/loan-management')}>
              <div className="flex items-start justify-between relative z-10">
                <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5 pr-1">Pending Review</span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-xs">
                  <LayoutDashboard size={16} strokeWidth={2.2} />
                </div>
              </div>
              <div className="font-inter font-extrabold text-[22px] 2xl:text-[25px] text-slate-900 dark:text-white tracking-tight leading-none relative z-10 mt-2.5">{dash(stats.pending)}</div>
            </div>

            {/* Approved Loans */}
            <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer flex flex-col justify-between min-h-[105px]" onClick={() => navigate('/loan-admin/loan-management')}>
              <div className="flex items-start justify-between relative z-10">
                <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5 pr-1">Approved Loans</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-xs">
                  <CheckCircle size={16} strokeWidth={2.2} />
                </div>
              </div>
              <div className="font-inter font-extrabold text-[22px] 2xl:text-[25px] text-slate-900 dark:text-white tracking-tight leading-none relative z-10 mt-2.5">{dash(stats.active)}</div>
            </div>

            {/* Total This Month */}
            <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer flex flex-col justify-between min-h-[105px]" onClick={openMonthModal}>
              <div className="flex items-start justify-between relative z-10">
                <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5 pr-1">Total This Month</span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xs">
                  <LayoutDashboard size={16} strokeWidth={2.2} />
                </div>
              </div>
              <div className="font-inter font-extrabold text-[22px] 2xl:text-[25px] text-slate-900 dark:text-white tracking-tight leading-none relative z-10 mt-2.5">{dash(stats.totalThisMonth)}</div>
            </div>

            {/* Total Disbursed */}
            <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer flex flex-col justify-between min-h-[105px]" onClick={openDisbModal}>
              <div className="flex items-start justify-between relative z-10">
                <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5 pr-1">Total Disbursed</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-xs">
                  <Banknote size={16} strokeWidth={2.2} />
                </div>
              </div>
              <div className="font-inter font-extrabold text-[18px] xl:text-[20px] 2xl:text-[23px] text-slate-900 dark:text-white tracking-tight leading-none relative z-10 mt-2.5" title={fmt(stats.totalDisbursed)}>{dash(fmt(stats.totalDisbursed))}</div>
            </div>

            {/* Total Savings */}
            <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer flex flex-col justify-between min-h-[105px]" onClick={() => navigate('/loan-admin/payments/savings')}>
              <div className="flex items-start justify-between relative z-10">
                <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5 pr-1">Total Savings</span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20 shadow-xs">
                  <PiggyBank size={16} strokeWidth={2.2} />
                </div>
              </div>
              <div className="font-inter font-extrabold text-[18px] xl:text-[20px] 2xl:text-[23px] text-slate-900 dark:text-white tracking-tight leading-none relative z-10 mt-2.5" title={fmt(totalSavings)}>{dash(fmt(totalSavings))}</div>
            </div>

            {/* Total Income from Interest */}
            <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] flex flex-col justify-between min-h-[105px]">
              <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col gap-0.5 pr-1">
                  <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Total Interest</span>
                  <select 
                    value={interestFilter} 
                    onChange={e => setInterestFilter(e.target.value)} 
                    className="text-[9px] px-1 py-0.5 rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-700 dark:text-slate-300 focus:outline-none font-inter cursor-pointer w-fit"
                  >
                    <option value="all">All</option>
                    <option value="2x">2x Savings</option>
                    <option value="1.5x">1.5x Savings</option>
                    <option value="1x">1x Savings</option>
                  </select>
                </div>
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/20 shadow-xs">
                  <TrendingUp size={16} strokeWidth={2.2} />
                </div>
              </div>
              <div className="font-inter font-extrabold text-[18px] xl:text-[20px] 2xl:text-[23px] text-slate-900 dark:text-white tracking-tight leading-none relative z-10 mt-2.5" title={fmt(totalInterestFiltered)}>{dash(fmt(totalInterestFiltered))}</div>
            </div>
          </div>
        </div>

        {/* Row 2 — Money In vs Money Out (60%) + Loan Status Distribution (40%) */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 mb-5">
          {/* Money In vs Money Out */}
          <div className="group relative bg-white dark:bg-[#1E2130] rounded-2xl p-6 border border-slate-100 dark:border-white/5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
            <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white font-inter tracking-tight m-0">Money In vs Money Out</h3>
                <span className="text-[13px] text-slate-500 dark:text-slate-400 font-inter mt-1 block">Monthly comparison of received funds and loan disbursements</span>
                <div className="mt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Total In: ₱{(moneyInVsOutSummary.totalIn/1000).toFixed(1)}k</span>
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">Total Out: ₱{(moneyInVsOutSummary.totalOut/1000).toFixed(1)}k</span>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${moneyInVsOutSummary.net >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                      Net: {moneyInVsOutSummary.net < 0 ? '-' : '+'}₱{(Math.abs(moneyInVsOutSummary.net)/1000).toFixed(1)}k
                    </span>
                  </div>
                </div>
              </div>
              <button className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-white/10 border-none shrink-0" onClick={() => setExpandedChart('moneyIn')} title="Expand Chart">
                <Expand size={18} color="#4B5563" strokeWidth={2.5} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={visibleMonthlyData} margin={{ top: 15, right: 8, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={11} fontFamily="DM Sans, sans-serif" fontWeight={400} axisLine={false} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={11} fontFamily="DM Mono, monospace" fontWeight={500} axisLine={false} tickLine={false} tickFormatter={formatYAxis} width={55} />
                <Tooltip cursor={{ fill: '#F9FAFB' }} contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} formatter={(v) => '₱' + v.toLocaleString()} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '8px' }} />
                <Bar dataKey="received" fill="#0D1F45" name="Money Received" radius={[4, 4, 0, 0]} />
                <Bar dataKey="disbursed" fill="#60A5FA" name="Money Released" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>

          {/* Loan Status Distribution (Donut) */}
          <div className="group relative bg-white dark:bg-[#1E2130] rounded-2xl p-6 border border-slate-100 dark:border-white/5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
            <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white font-inter tracking-tight m-0">Loan Status Distribution</h3>
                <span className="text-[13px] text-slate-500 dark:text-slate-400 font-inter mt-1 block">Portfolio breakdown by current loan status</span>
              </div>
              <button className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-white/10 border-none shrink-0" onClick={() => setExpandedChart('statusDist')} title="Expand Chart">
                <Expand size={18} color="#4B5563" strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex items-center mt-2 max-md:flex-col">
              <div className="w-[50%] max-md:w-full">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusDistribution} cx="55%" cy="50%" innerRadius={38} outerRadius={78} paddingAngle={2} dataKey="value" label={renderSliceLabel} labelLine={false}>
                      {statusDistribution.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                      <Label value={statusDistributionSummary.total} position="center" fill="#1e3a5f" style={{ fontSize: '16px', fontWeight: 'bold' }} />
                      <Label value="Total" position="center" dy={15} fill="#6B7280" style={{ fontSize: '9px' }} />
                    </Pie>
                    <Tooltip formatter={(v, name) => [v + ' loans', name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-[50%] flex flex-col gap-3 pl-4 max-md:w-full max-md:pl-0 max-md:mt-4">
                {statusDistribution.map((entry, i) => {
                  const pct = statusDistributionSummary.total > 0 ? ((entry.value / statusDistributionSummary.total) * 100).toFixed(0) : 0;
                  const color = STATUS_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length];
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: color }} />
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-slate-800 dark:text-white font-inter leading-tight">{entry.value} {entry.value === 1 ? 'loan' : 'loans'} · {pct}%</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-inter mt-0.5">{entry.name}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Row 3 — 50 / 30 / 20 Split: Loan Applications Trend (50%), Disbursements by Type (30%), Repayment Performance (20%) */}
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_3fr_2fr] gap-5 mb-5">
          {/* Monthly Loan Applications Trend (50%) */}
          <div className="group relative bg-white dark:bg-[#1E2130] rounded-2xl p-6 border border-slate-100 dark:border-white/5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
            <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white font-inter tracking-tight m-0">Loan Applications Trend</h3>
                <span className="text-[12px] text-slate-500 dark:text-slate-400 font-inter mt-0.5 block">YTD {new Date().getFullYear()} — Monthly breakdown</span>
              </div>
              <button className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-white/10 border-none shrink-0" onClick={() => setExpandedChart('appTrend')} title="Expand Chart">
                <Expand size={18} color="#4B5563" strokeWidth={2.5} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={visibleMonthlyApplications} margin={{ top: 15, right: 8, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={11} fontFamily="DM Sans, sans-serif" fontWeight={400} axisLine={false} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={11} fontFamily="DM Mono, monospace" fontWeight={500} axisLine={false} tickLine={false} allowDecimals={false} label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fontSize: '11px', fill: '#9CA3AF', fontFamily: 'DM Sans, sans-serif' } }} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '8px' }} />
                <Area type="monotone" dataKey="applications" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorApps)" name="Applications" />
                <Line type="monotone" dataKey="approved" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="Approved" />
                <Line type="monotone" dataKey="rejected" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} name="Rejected" />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          </div>

          {/* Disbursements by Type (30%) */}
          <div className="group relative bg-white dark:bg-[#1E2130] rounded-2xl p-6 border border-slate-100 dark:border-white/5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
            <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white font-inter tracking-tight m-0">Disbursements by Type</h3>
                <span className="text-[12px] text-slate-500 dark:text-slate-400 font-inter mt-0.5 block">Funds allocated by loan type</span>
              </div>
              <button className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-white/10 border-none shrink-0" onClick={() => setExpandedChart('disbursements')} title="Expand Chart">
                <Expand size={18} color="#4B5563" strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={disbursementSummary.activeDisbursements.map(d => ({ name: d.type, value: d.amount }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={62}
                    paddingAngle={2}
                    dataKey="value"
                    label={renderSliceLabel}
                    labelLine={false}
                  >
                    {disbursementSummary.activeDisbursements.map((_, index) => {
                      const CHART_COLORS = ['#0D1F45', '#1E3A8A', '#2563EB', '#3B82F6', '#60A5FA'];
                      return <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />;
                    })}
                    <Label
                      value={`₱${disbursementSummary.total >= 1000000 ? (disbursementSummary.total/1000000).toFixed(1).replace(/\.0$/, '') + 'M' : disbursementSummary.total >= 1000 ? (disbursementSummary.total/1000).toFixed(1).replace(/\.0$/, '') + 'k' : disbursementSummary.total}`}
                      position="center"
                      fill="#1e3a5f"
                      style={{ fontSize: '11px', fontWeight: 'bold' }}
                    />
                  </Pie>
                  <Tooltip formatter={(v) => '₱' + v.toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-full flex flex-col gap-1.5 mt-1">
                {(() => {
                  const CHART_COLORS = ['#0D1F45', '#1E3A8A', '#2563EB', '#3B82F6', '#60A5FA'];
                  return disbursementByTypeDetail.slice(0, 4).map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs font-inter">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-slate-600 dark:text-slate-300 truncate text-[11px]">{d.label}</span>
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-white text-[11px]">₱{d.amount >= 1000000 ? (d.amount / 1000000).toFixed(1).replace(/\.0$/, '') + 'M' : d.amount >= 1000 ? (d.amount / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : d.amount}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
            </div>
          </div>

          {/* Repayment Performance (20%) */}
          <div className="group relative bg-white dark:bg-[#1E2130] rounded-2xl p-6 border border-slate-100 dark:border-white/5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
            <div className="relative z-10">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white font-inter tracking-tight m-0">Repayment</h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-inter mt-0.5 block">On-time ratio</span>
                <div className={`mt-2 inline-block px-2 py-0.5 rounded-full text-[11px] font-bold font-inter ${repaymentPerformanceSummary.pct >= 80 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>{repaymentPerformanceSummary.pct}% On-Time</div>
              </div>
              <button className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-white/10 border-none shrink-0" onClick={() => setExpandedChart('repayment')} title="Expand Chart">
                <Expand size={16} color="#4B5563" strokeWidth={2.5} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={repaymentPerformance} margin={{ top: 20, right: 4, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} fontFamily="DM Sans, sans-serif" fontWeight={400} axisLine={false} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={10} fontFamily="DM Mono, monospace" fontWeight={500} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(v) => v + ' payments'} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={36}>
                  <LabelList dataKey="value" position="top" fontSize={11} fontWeight={600} fill="#374151" />
                  <Cell fill="#10B981" />
                  <Cell fill="#EF4444" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Row 4 — Savings Trend (60%) + Delinquency Rate (40%) */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 mb-5">
          {/* Savings Trend */}
          <div className="group relative bg-white dark:bg-[#1E2130] rounded-2xl p-6 border border-slate-100 dark:border-white/5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
            <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white font-inter tracking-tight m-0">Savings Trend</h3>
                <span className="text-[13px] text-slate-500 dark:text-slate-400 font-inter mt-1 block">Monthly member savings deposits this year</span>
              </div>
              <button className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-white/10 border-none shrink-0" onClick={() => setExpandedChart('savings')} title="Expand Chart">
                <Expand size={18} color="#4B5563" strokeWidth={2.5} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={enhancedSavingsData} margin={{ top: 20, right: 8, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={11} fontFamily="DM Sans, sans-serif" fontWeight={400} axisLine={false} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={11} fontFamily="DM Mono, monospace" fontWeight={500} axisLine={false} tickLine={false} tickFormatter={formatYAxis} width={50} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} formatter={(v, name) => [v != null ? '₱' + v.toLocaleString() : 'No data', name === 'zeroSavings' ? 'No Data' : 'Savings']} labelFormatter={(label) => label} />
                <Line type="monotone" dataKey="zeroSavings" stroke="#D1D5DB" strokeDasharray="5 5" strokeWidth={2} dot={false} name="No Data" connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="actualSavings" stroke="#0D1F45" strokeWidth={2} dot={({ cx, cy, payload }) => payload.actualSavings != null ? <circle cx={cx} cy={cy} r={3} fill="#0D1F45" /> : null} name="Savings" connectNulls />
              </LineChart>
            </ResponsiveContainer>
            </div>
          </div>

          {/* Delinquency Rate */}
          <div className="group relative bg-white dark:bg-[#1E2130] rounded-2xl p-6 border border-slate-100 dark:border-white/5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
            <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white font-inter tracking-tight m-0">Delinquency Rate</h3>
                <span className="text-[13px] text-slate-500 dark:text-slate-400 font-inter mt-1 block">Percentage of late payments per month</span>
                <div className={`mt-3 inline-block px-3 py-1 rounded-full text-xs font-bold font-inter ${delinquencyRateSummary.avgRate <= 10 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : delinquencyRateSummary.avgRate <= 25 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>Avg: {delinquencyRateSummary.avgRate}%</div>
              </div>
              <button className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-white/10 border-none shrink-0" onClick={() => setExpandedChart('delinquency')} title="Expand Chart">
                <Expand size={18} color="#4B5563" strokeWidth={2.5} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={visibleDelinquencyRate} margin={{ top: 20, right: 8, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={11} fontFamily="DM Sans, sans-serif" fontWeight={400} axisLine={false} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={11} fontFamily="DM Mono, monospace" fontWeight={500} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} domain={[0, 100]} />
                <Tooltip formatter={(v) => v + '%'} />
                <ReferenceLine y={15} stroke="#EF4444" strokeDasharray="5 5" label={{ value: 'Risk Threshold (15%)', position: 'insideTopRight', fill: '#EF4444', fontSize: 10, fontWeight: 600 }} />
                <Line type="monotone" dataKey="rate" stroke="#0D1F45" strokeWidth={2.5} dot={{ r: 4, fill: '#0D1F45' }} name="Delinquency %" />
              </LineChart>
            </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Row 5 — Recent Loan Applications */}
        <div className="bg-white dark:bg-[#1E2130] rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white font-inter tracking-tight m-0">Recent Loan Applications</h3>
            <button className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-transparent border-none cursor-pointer hover:underline p-0" onClick={() => navigate('/loan-admin/loan-management')}>View All</button>
          </div>
          <div className="flex flex-col gap-2">
            {recentLoans.length === 0 ? (
              <p className="text-center text-slate-400 dark:text-slate-500 text-xs font-inter py-4 m-0">No recent loan applications.</p>
            ) : (
              recentLoans.slice(0, 5).map(loan => (
                <div className="flex items-center justify-between p-2.5 sm:px-3.5 sm:py-2 bg-slate-50 dark:bg-[#252836] rounded-xl border border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" key={loan._id}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: loan.status === 'pending' ? '#FEF3C7' : '#EFF6FF' }}>
                      <Banknote size={15} className={loan.status === 'pending' ? 'text-amber-600' : 'text-blue-600'} />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-white font-inter leading-tight">{loan.memberName}</span>
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">· {loan.loanId}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-inter mt-0.5">Applied: {fmtDate(loan.appliedDate)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-800 dark:text-white font-inter">{fmt(loan.amount)}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${loan.status === 'pending' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'}`}>
                      {loan.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </>)}

      {/* ── This Month Modal ── */}
      {showMonthModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-fadeIn" onClick={() => setShowMonthModal(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[700px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-white/10 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white font-inter m-0">Monthly Disbursements</h2>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 font-inter mt-1">{getMonthModalLabel()} — {filteredMonthLoans.length} loan(s) processed</p>
              </div>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 cursor-pointer border-none hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" onClick={() => setShowMonthModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center gap-3 p-[12px_24px] bg-slate-50 dark:bg-[#252836] border-b border-slate-100 dark:border-white/5 shrink-0">
              <Filter size={14} color="#6B7280" />
              <select value={monthModalMonth} onChange={e => setMonthModalMonth(e.target.value)} className="appearance-none bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg p-[6px_32px_6px_12px] text-[13px] font-inter text-slate-700 dark:text-slate-300 outline-none cursor-pointer hover:border-blue-500 transition-colors ">
                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={monthModalYear} onChange={e => setMonthModalYear(parseInt(e.target.value))} className="appearance-none bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg p-[6px_32px_6px_12px] text-[13px] font-inter text-slate-700 dark:text-slate-300 outline-none cursor-pointer hover:border-blue-500 transition-colors ">
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              {filteredMonthLoans.length === 0 ? (
                <div className="p-10 text-center text-slate-500 dark:text-slate-400 text-sm font-inter">No disbursements for {getMonthModalLabel()}.</div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full border-collapse font-inter text-left">
                    <thead ><tr className="sticky top-0 bg-slate-50 dark:bg-[#252836] z-10 shadow-sm border-b border-slate-200 dark:border-white/10">
                        <th className="p-[12px_16px] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Loan ID</th>
                        <th className="p-[12px_16px] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Member</th>
                        <th className="p-[12px_16px] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Amount</th>
                        <th className="p-[12px_16px] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Method</th>
                        <th className="p-[12px_16px] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {filteredMonthLoans.map(l => (
                        <tr key={l._id}>
                          <td className="font-semibold text-blue-600 dark:text-blue-400">{l.loanId}</td>
                          <td className="p-[14px_16px] text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap">{l.memberName || 'N/A'}</td>
                          <td className="font-semibold text-slate-800 dark:text-white">{fmt(l.amount)}</td>
                          <td className="p-[14px_16px] text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap"><span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${ (l.paymentMethod || 'cash').toLowerCase() === 'e-wallet' || (l.paymentMethod || 'cash').toLowerCase() === 'gcash' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : (l.paymentMethod || 'cash').toLowerCase().includes('bank') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'}`}>{l.paymentMethod || 'Cash'}</span></td>
                          <td className="p-[14px_16px] text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtDate(l.disbursementDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-500/10 border-t border-blue-100 dark:border-blue-500/20 text-[13px] font-semibold text-blue-800 dark:text-blue-300 mt-auto shrink-0">
                <span>Total for {getMonthModalLabel()}</span>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{fmt(monthModalTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Total Disbursed Modal ── */}
      {showDisbursedModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-fadeIn" onClick={() => setShowDisbursedModal(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[700px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-white/10 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white font-inter m-0">All Disbursements</h2>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 font-inter mt-1">{getDisbModalLabel()} — {filteredDisbLoans.length} loan(s) — {fmt(disbModalTotal)}</p>
              </div>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 cursor-pointer border-none hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" onClick={() => setShowDisbursedModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center gap-3 p-[12px_24px] bg-slate-50 dark:bg-[#252836] border-b border-slate-100 dark:border-white/5 shrink-0">
              <Filter size={14} color="#6B7280" />
              <select value={disbModalMonth} onChange={e => setDisbModalMonth(e.target.value)} className="appearance-none bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg p-[6px_32px_6px_12px] text-[13px] font-inter text-slate-700 dark:text-slate-300 outline-none cursor-pointer hover:border-blue-500 transition-colors ">
                <option value="all">All Months</option>
                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={disbModalYear} onChange={e => setDisbModalYear(e.target.value)} className="appearance-none bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg p-[6px_32px_6px_12px] text-[13px] font-inter text-slate-700 dark:text-slate-300 outline-none cursor-pointer hover:border-blue-500 transition-colors ">
                <option value="all">All Years</option>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              {filteredDisbLoans.length === 0 ? (
                <div className="p-10 text-center text-slate-500 dark:text-slate-400 text-sm font-inter">No disbursements for {getDisbModalLabel()}.</div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full border-collapse font-inter text-left">
                    <thead ><tr className="sticky top-0 bg-slate-50 dark:bg-[#252836] z-10 shadow-sm border-b border-slate-200 dark:border-white/10">
                        <th className="p-[12px_16px] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Loan ID</th>
                        <th className="p-[12px_16px] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Member</th>
                        <th className="p-[12px_16px] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Amount</th>
                        <th className="p-[12px_16px] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Method</th>
                        <th className="p-[12px_16px] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {filteredDisbLoans.map(l => (
                        <tr key={l._id}>
                          <td className="font-semibold text-blue-600 dark:text-blue-400">{l.loanId}</td>
                          <td className="p-[14px_16px] text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap">{l.memberName || 'N/A'}</td>
                          <td className="font-semibold text-slate-800 dark:text-white">{fmt(l.amount)}</td>
                          <td className="p-[14px_16px] text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap"><span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${ (l.paymentMethod || 'cash').toLowerCase() === 'e-wallet' || (l.paymentMethod || 'cash').toLowerCase() === 'gcash' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : (l.paymentMethod || 'cash').toLowerCase().includes('bank') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'}`}>{l.paymentMethod || 'Cash'}</span></td>
                          <td className="p-[14px_16px] text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtDate(l.disbursementDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center justify-between p-5 bg-blue-50 dark:bg-blue-500/10 border-t border-blue-100 dark:border-blue-500/20 text-[13px] font-semibold text-blue-800 dark:text-blue-300 mt-auto shrink-0">
                <span>Total ({getDisbModalLabel()})</span>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{fmt(disbModalTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Expanded Chart View ── */}
      {expandedChart && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 sm:p-6 animate-fadeIn" onClick={() => setExpandedChart(null)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[900px] max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 sm:px-6 sm:py-5 border-b border-slate-100 dark:border-white/10 shrink-0 bg-white dark:bg-[#1E2130]">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-inter tracking-tight m-0">
                {expandedChart === 'moneyIn' && 'Money In vs Money Out — Detailed View'}
                {expandedChart === 'disbursements' && 'Disbursements by Type — Detailed Analysis'}
                {expandedChart === 'savings' && 'Savings Trend — Detailed View'}
                {expandedChart === 'statusDist' && 'Loan Status Distribution — Detailed View'}
                {expandedChart === 'repayment' && 'Repayment Performance — Detailed View'}
                {expandedChart === 'appTrend' && 'Loan Applications Trend — Detailed View'}
                {expandedChart === 'delinquency' && 'Delinquency Rate — Detailed View'}
              </h2>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 cursor-pointer border-none hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" onClick={() => setExpandedChart(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar text-slate-800 dark:text-slate-200">
              {expandedChart === 'moneyIn' && (() => {
                const netData = visibleMonthlyData.map((d, idx) => {
                  const net = (d.received || 0) - (d.disbursed || 0);
                  const prevNet = idx > 0 ? (visibleMonthlyData[idx-1].received || 0) - (visibleMonthlyData[idx-1].disbursed || 0) : null;
                  const momChange = prevNet !== null && prevNet !== 0 ? (((net - prevNet) / Math.abs(prevNet)) * 100).toFixed(1) : null;
                  return { ...d, net, momChange };
                });
                // Cumulative cash flow
                let cumulative = 0;
                const cumulativeData = netData.map(d => {
                  cumulative += d.net;
                  return { month: d.month, cumulative };
                });
                const totalIn = netData.reduce((s, d) => s + (d.received || 0), 0);
                const totalOut = netData.reduce((s, d) => s + (d.disbursed || 0), 0);
                const totalNet = totalIn - totalOut;
                return (
                <>
                  {/* Monthly Breakdown Table */}
                  <div className="mb-5">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b-2 border-gray-200 dark:border-gray-700 text-left">
                          <th className="p-[12px_16px] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Month</th>
                          <th className="text-right">Money In</th>
                          <th className="text-right">Money Out</th>
                          <th className="text-right">Net</th>
                          <th className="text-right">MoM Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {netData.map((d, i) => {
                          const hasData = (d.received || 0) > 0 || (d.disbursed || 0) > 0;
                          return (
                            <tr key={d.month} className={`border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${!hasData ? 'opacity-40' : ''}`}>
                              <td className="font-medium">{d.month}</td>
                              <td className="text-right font-semibold text-[#0D1F45] dark:text-blue-300">₱{(d.received || 0).toLocaleString()}</td>
                              <td className="text-right font-semibold text-blue-500 dark:text-blue-400">₱{(d.disbursed || 0).toLocaleString()}</td>
                              <td className={`text-right font-bold ${d.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {d.net >= 0 ? '+' : '-'}₱{Math.abs(d.net).toLocaleString()}
                              </td>
                              <td className="text-right">
                                {d.momChange !== null && hasData ? (
                                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${parseFloat(d.momChange) >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                                    {parseFloat(d.momChange) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(d.momChange))}%
                                  </span>
                                ) : <span className="text-gray-400">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-slate-50 dark:bg-white/5 font-semibold">
                          <td className="p-[14px_16px] text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap">Total</td>
                          <td className="text-right text-[#0D1F45] dark:text-blue-300">₱{totalIn.toLocaleString()}</td>
                          <td className="text-right text-blue-500 dark:text-blue-400">₱{totalOut.toLocaleString()}</td>
                          <td className={`text-right font-bold ${totalNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {totalNet >= 0 ? '+' : '-'}₱{Math.abs(totalNet).toLocaleString()}
                          </td>
                          <td className="p-[14px_16px] text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Cumulative Cash Flow Line */}
                  <div className="mb-4">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 dark:text-gray-100 m-0 mb-2 uppercase tracking-[0.03em]">Cumulative Cash Flow</h4>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cumulativeData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                          <defs>
                            {(() => {
                              const maxVal = Math.max(...cumulativeData.map(d => d.cumulative));
                              const minVal = Math.min(...cumulativeData.map(d => d.cumulative));
                              const splitOff = maxVal <= 0 ? 0 : minVal >= 0 ? 1 : maxVal / (maxVal - minVal);
                              return (
                                <linearGradient id="cumSplitColor" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset={splitOff} stopColor="#10B981" stopOpacity={0.3} />
                                  <stop offset={splitOff} stopColor="#EF4444" stopOpacity={0.3} />
                                </linearGradient>
                              );
                            })()}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                          <XAxis dataKey="month" type="category" stroke="#9CA3AF" fontSize={12} />
                          <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={formatYAxis} />
                          <Tooltip formatter={(v) => '₱' + v.toLocaleString()} />
                          <ReferenceLine y={0} stroke="#374151" strokeWidth={1.5} strokeDasharray="6 3" label={{ value: '₱0 Baseline', position: 'right', fill: '#6B7280', fontSize: 11 }} />
                          <Area type="monotone" dataKey="cumulative" stroke="#0D1F45" strokeWidth={2.5} fill="url(#cumSplitColor)" name="Cumulative Net">
                            <LabelList
                              dataKey="cumulative"
                              position="top"
                              fontSize={10}
                              fill="#374151"
                              formatter={(v) => v !== 0 ? (v >= 0 ? '+' : '') + formatYAxis(v) : ''}
                            />
                          </Area>
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="mt-4 p-[14px_16px] bg-slate-50 dark:bg-[#1E2130] rounded-lg border-l-4 border-[#0D1F45] dark:border-blue-400 text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
                    <strong>Interpretation:</strong> The table shows exact peso values for money received (repayments) and released (disbursements) each month, along with the net balance and month-over-month change direction. The cumulative cash flow chart below tracks the running net position over the year — if the line stays above ₱0, the lending portfolio is in surplus; below means more has been released than received.
                  </div>
                </>
                );
              })()}

              {expandedChart === 'disbursements' && (
                <>
                  {/* Summary Table */}
                  <div className="mb-5">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b-2 border-gray-200 dark:border-gray-700 text-left">
                          <th >Loan Type</th>
                          <th className="text-center"># Loans</th>
                          <th className="text-right">Total Disbursed</th>
                          <th className="text-right">Avg Loan Size</th>
                          <th className="text-right">% Share</th>
                          <th className="text-center">Monthly Trend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {disbursementByTypeDetail.map((d, i) => {
                          const CHART_COLORS = ['#0D1F45', '#1E3A8A', '#2563EB', '#3B82F6', '#60A5FA'];
                          const color = CHART_COLORS[i % CHART_COLORS.length];
                          const pct = disbursementSummary.total > 0 ? ((d.amount / disbursementSummary.total) * 100).toFixed(1) : '0.0';
                          // Build sparkline data for this type
                          const sparkData = disbursementMonthlyTrend.map(m => ({ v: m[d.label] || 0 }));
                          return (
                            <tr key={d.type} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                              <td className="flex items-start gap-2.5">
                                <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: color }} />
                                {d.label}
                              </td>
                              <td className="text-center font-semibold">{d.count}</td>
                              <td className="text-right font-semibold text-[#0D1F45] dark:text-blue-300">₱{d.amount.toLocaleString()}</td>
                              <td className="text-right text-gray-500 dark:text-gray-400">{d.count > 0 ? `₱${Math.round(d.average).toLocaleString()}` : '—'}</td>
                              <td className="text-right">
                                <span style={{ background: `${color}18`, color, padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>{pct}%</span>
                              </td>
                              <td className="p-[8px_10px]">
                                <ResponsiveContainer width={120} height={32}>
                                  <LineChart data={sparkData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                                    <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </td>
                            </tr>
                          );
                        })}
                        {disbursementByTypeDetail.length > 0 && (
                          <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-slate-50 dark:bg-white/5 font-semibold">
                            <td >Total</td>
                            <td className="text-center">{disbursementByTypeDetail.reduce((s, d) => s + d.count, 0)}</td>
                            <td className="text-right text-[#0D1F45] dark:text-blue-300">₱{disbursementSummary.total.toLocaleString()}</td>
                            <td className="text-right text-gray-500 dark:text-gray-400">
                              {(() => { const total = disbursementByTypeDetail.reduce((s, d) => s + d.count, 0); return total > 0 ? `₱${Math.round(disbursementSummary.total / total).toLocaleString()}` : '—'; })()}
                            </td>
                            <td className="text-right">100%</td>
                            <td className="p-[14px_16px] text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap"></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Monthly Disbursement Trend by Type */}
                  <div className="mb-4">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 dark:text-gray-100 m-0 mb-2 uppercase tracking-[0.03em]">Monthly Disbursement Trend by Loan Type</h4>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={disbursementMonthlyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                          <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                          <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={formatYAxis} />
                          <Tooltip formatter={(v) => '₱' + v.toLocaleString()} />
                          <Legend iconType="circle" iconSize={8} />
                          <Bar dataKey="Personal Loan" fill="#0D1F45" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Emergency Loan" fill="#2563EB" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Short-Term Loan" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="mt-4 p-[14px_16px] bg-slate-50 dark:bg-[#1E2130] rounded-lg border-l-4 border-[#0D1F45] dark:border-blue-400 text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
                    <strong>Interpretation:</strong> The summary table breaks down each loan type by volume (# of loans), total disbursed amount, average loan size, and portfolio share. The sparklines show monthly directional trends per type. The bar chart below visualizes month-over-month disbursement patterns across all loan types to identify seasonal demand and inform fund allocation planning.
                  </div>
                </>
              )}

              {expandedChart === 'savings' && (() => {
                // Cumulative data
                let runningTotal = 0;
                const cumulativeData = savingsMonthly.map(d => {
                  runningTotal += d.savings || 0;
                  return { ...d, cumulative: runningTotal };
                });
                // Community data for bar chart
                const topCommunities = communitySavings.filter(c => c.totalSavings > 0).slice(0, 10);

                return (
                <>
                  {/* Section 1 — Summary Stats + Cumulative Chart */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    <div className="bg-slate-50 dark:bg-[#1E2130] rounded-xl p-[14px_16px] text-center border border-slate-100 dark:border-white/5">
                      <div className="text-[11px] text-gray-500 font-medium mb-1 dark:text-gray-400 font-inter">Total Savings</div>
                      <div className="text-xl font-bold text-[#0D1F45] dark:text-gray-100 font-inter">₱{totalSavings.toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#1E2130] rounded-xl p-[14px_16px] text-center border border-slate-100 dark:border-white/5">
                      <div className="text-[11px] text-gray-500 font-medium mb-1 dark:text-gray-400 font-inter">Total Members Saving</div>
                      <div className="text-xl font-bold text-[#0D1F45] dark:text-gray-100 font-inter">{savingsSummary.totalSavers || 0}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#1E2130] rounded-xl p-[14px_16px] text-center border border-slate-100 dark:border-white/5">
                      <div className="text-[11px] text-gray-500 font-medium mb-1 dark:text-gray-400 font-inter">Avg per Member</div>
                      <div className="text-xl font-bold text-[#0D1F45] dark:text-gray-100 font-inter">₱{(savingsSummary.avgPerSaver || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#1E2130] rounded-xl p-[14px_16px] text-center border border-slate-100 dark:border-white/5">
                      <div className="text-[11px] text-gray-500 font-medium mb-1 dark:text-gray-400 font-inter">Highest Month</div>
                      <div className="text-xl font-bold text-[#0D1F45] dark:text-gray-100 font-inter">{savingsSummary.highestMonth || '—'}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 font-inter">₱{(savingsSummary.highestMonthAmount || 0).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 dark:text-gray-100 m-0 mb-2 uppercase tracking-[0.03em]">Cumulative Savings Trend</h4>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cumulativeData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                          <defs>
                            <linearGradient id="colorSavCum" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0D1F45" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#0D1F45" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                          <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                          <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={formatYAxis} />
                          <Tooltip formatter={(v) => '₱' + v.toLocaleString()} />
                          <Area type="monotone" dataKey="cumulative" stroke="#0D1F45" strokeWidth={2.5} fill="url(#colorSavCum)" name="Cumulative Savings">
                            <LabelList dataKey="cumulative" position="top" fontSize={10} fill="#374151" formatter={(v) => v > 0 ? formatYAxis(v) : ''} />
                          </Area>
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Section 2 — Community Savings Table */}
                  <div className="mb-6">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 dark:text-gray-100 m-0 mb-2 uppercase tracking-[0.03em]">Savings by Community</h4>
                    <div className="max-h-[320px] overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="w-full border-collapse text-[13px]">
                        <thead >
                          <tr className="border-b-2 border-gray-200 dark:border-gray-700 text-left">
                            <th >#</th>
                            <th >Community</th>
                            <th className="text-right">Total Savings</th>
                            <th className="text-center">Members</th>
                            <th className="text-right">Avg / Member</th>
                            <th className="text-right">% Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {communitySavings.map((c, i) => {
                            const pct = totalSavings > 0 ? ((c.totalSavings / totalSavings) * 100).toFixed(1) : '0.0';
                            return (
                              <tr key={c.community} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <td className="text-gray-400 dark:text-gray-500">{i + 1}</td>
                                <td className="font-medium">{c.community}</td>
                                <td className="text-right font-semibold text-[#0D1F45] dark:text-blue-300">₱{c.totalSavings.toLocaleString()}</td>
                                <td className="text-center">{c.memberCount}</td>
                                <td className="text-right text-gray-500 dark:text-gray-400">₱{c.avgPerMember.toLocaleString()}</td>
                                <td className="text-right">
                                  <span style={{ background: '#0D1F4518', color: '#0D1F45', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>{pct}%</span>
                                </td>
                              </tr>
                            );
                          })}
                          {communitySavings.length === 0 && (
                            <tr><td colSpan={6} className="font-inter text-[13px] text-slate-600 dark:text-slate-300">No community savings data available.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3 — Top Communities Bar Chart */}
                  {topCommunities.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-inter text-[13px] font-semibold text-gray-700 dark:text-gray-100 m-0 mb-2 uppercase tracking-[0.03em]">Top Communities by Savings</h4>
                      <div style={{ height: Math.max(200, topCommunities.length * 36) + 'px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topCommunities} layout="vertical" margin={{ top: 5, right: 80, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                            <XAxis type="number" stroke="#9CA3AF" fontSize={12} tickFormatter={formatYAxis} />
                            <YAxis dataKey="community" type="category" stroke="#9CA3AF" fontSize={11} width={140} />
                            <Tooltip formatter={(v) => '₱' + v.toLocaleString()} />
                            <Bar dataKey="totalSavings" radius={[0, 4, 4, 0]} barSize={22} name="Total Savings">
                              <LabelList dataKey="totalSavings" position="right" formatter={v => '₱' + v.toLocaleString()} fontSize={11} fill="#6B7280" />
                              {topCommunities.map((_, index) => {
                                const CHART_COLORS = ['#0D1F45', '#1E3A8A', '#1E3A8A', '#2563EB', '#2563EB', '#3B82F6', '#3B82F6', '#60A5FA', '#60A5FA', '#93C5FD'];
                                return <Cell key={`tc-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 p-[14px_16px] bg-slate-50 dark:bg-[#1E2130] rounded-lg border-l-4 border-[#0D1F45] dark:border-blue-400 text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
                    <strong>Interpretation:</strong> The summary stats show overall savings health across the platform. The cumulative chart tracks total deposit growth over the year. The community table breaks down savings by branch — showing total amounts, active member counts, and per-member averages. The bar chart highlights the top-performing communities to identify where savings programs are most successful.
                  </div>
                </>
                );
              })()}

              {expandedChart === 'statusDist' && (() => {
                const STATUS_COLORS = { Active: '#10B981', Completed: '#0D1F45', Pending: '#2563EB', Rejected: '#EF4444', Cancelled: '#F59E0B', Approved: '#60A5FA' };
                return (
                <>
                  {/* Section 1 — Loan Status Distribution Bar Graph */}
                  <div className="mb-6 bg-slate-50 dark:bg-[#252836] p-5 rounded-2xl border border-slate-100 dark:border-white/5">
                    <h4 className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-200 m-0 mb-4 uppercase tracking-wider">Loan Status Distribution Breakdown</h4>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusDistribution} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                          <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} fontFamily="DM Sans, sans-serif" fontWeight={500} axisLine={false} tickLine={false} />
                          <YAxis stroke="#9CA3AF" fontSize={11} fontFamily="DM Mono, monospace" fontWeight={500} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip formatter={(v) => [v + ' loans', 'Count']} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={48}>
                            <LabelList dataKey="value" position="top" fontSize={12} fontWeight={700} fill="#374151" formatter={(v) => v > 0 ? v : ''} />
                            {statusDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#9CA3AF'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Section 2 — Branch Status Table */}
                  <div className="mb-6">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 dark:text-gray-100 m-0 mb-2 uppercase tracking-[0.03em]">Status by Community</h4>
                    <div className="max-h-[300px] overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="w-full border-collapse text-[12px]">
                        <thead >
                          <tr className="border-b-2 border-gray-200 dark:border-gray-700 text-left">
                            <th >Community</th>
                            <th className="text-center">Total</th>
                            <th className="text-center text-[#0D1F45] dark:text-blue-300">Completed</th>
                            <th className="text-center text-emerald-600 dark:text-emerald-400">Active</th>
                            <th className="text-center text-rose-600 dark:text-rose-400">Rejected</th>
                            <th className="text-center text-amber-600 dark:text-amber-400">Cancelled</th>
                            <th className="text-right">Rejection Rate</th>
                            <th className="text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {branchStatusData.map((b, i) => {
                            const rColor = b.rejectionRate > 20 ? '#EF4444' : b.rejectionRate > 10 ? '#F59E0B' : '#10B981';
                            return (
                              <tr key={i} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <td className="font-medium">{b.branch}</td>
                                <td className="text-center">{b.total}</td>
                                <td className="text-center">{b.completed}</td>
                                <td className="text-center">{b.active}</td>
                                <td className="text-center">{b.rejected}</td>
                                <td className="text-center">{b.cancelled}</td>
                                <td className="text-right">
                                  <span style={{ background: `${rColor}18`, color: rColor, padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>{b.rejectionRate}%</span>
                                </td>
                                <td className="text-center">
                                  {(() => { const sColor = b.rejectionRate > 20 ? '#EF4444' : b.rejectionRate > 10 ? '#F59E0B' : '#10B981'; const label = b.rejectionRate > 20 ? 'Critical' : b.rejectionRate > 10 ? 'At Risk' : 'Healthy'; return <span style={{ background: `${sColor}18`, color: sColor, padding: '2px 8px', borderRadius: '12px', fontWeight: 600, fontSize: '11px' }}>{label}</span>; })()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3 — Monthly Status Trend */}
                  <div className="mb-4">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 dark:text-gray-100 m-0 mb-2 uppercase tracking-[0.03em]">Monthly Status Trend</h4>
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={visibleMonthlyStatusTrend} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                          <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                          <YAxis stroke="#9CA3AF" fontSize={12} allowDecimals={false} />
                          <Tooltip />
                          <Legend iconType="circle" iconSize={8} />
                          <Area type="monotone" dataKey="completed" stackId="1" stroke="#0D1F45" fill="#0D1F45" fillOpacity={0.8} name="Completed" />
                          <Area type="monotone" dataKey="active" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.8} name="Active" />
                          <Area type="monotone" dataKey="rejected" stackId="1" stroke="#DC2626" fill="#DC2626" fillOpacity={0.8} name="Rejected" />
                          <Area type="monotone" dataKey="cancelled" stackId="1" stroke="#F97316" fill="#F97316" fillOpacity={0.8} name="Cancelled" />
                          <Area type="monotone" dataKey="pending" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.8} name="Pending" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="mt-4 p-[14px_16px] bg-slate-50 dark:bg-[#1E2130] rounded-lg border-l-4 border-[#0D1F45] dark:border-blue-400 text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
                    <strong>Interpretation:</strong> The stacked bar shows overall portfolio composition. The community table surfaces branches with high rejection rates — red indicates above 20%, yellow 10–20%, green below 10%. The trend chart reveals how loan statuses evolve month by month, helping identify if rejections are increasing.
                  </div>
                </>
                );
              })()}

              {expandedChart === 'repayment' && (() => {
                const onTime = repaymentPerformance.find(d => d.name === 'On-Time')?.value || 0;
                const late = repaymentPerformance.find(d => d.name === 'Late')?.value || 0;
                const totalPayments = onTime + late;
                const onTimeRate = totalPayments > 0 ? Math.round((onTime / totalPayments) * 100 * 10) / 10 : 100;
                const rateColor = onTimeRate >= 80 ? '#10B981' : onTimeRate >= 60 ? '#F59E0B' : '#EF4444';
                return (
                <>
                  {/* Section 1 — Scorecard */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                    {[
                      { label: 'Total Payments', value: totalPayments, color: '#0D1F45' },
                      { label: 'On-Time', value: onTime, color: '#10B981' },
                      { label: 'Late', value: late, color: '#EF4444' },
                      { label: 'On-Time Rate', value: onTimeRate + '%', color: rateColor },
                      { label: 'Total Penalties', value: '₱' + totalPenalties.toLocaleString(), color: late > 0 ? '#EF4444' : '#10B981' },
                    ].map((k, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-[#1E2130] rounded-xl p-[14px_16px] text-center border border-slate-100 dark:border-white/5">
                        <div className="text-[11px] text-gray-500 font-medium mb-1 dark:text-gray-400 font-inter">{k.label}</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: k.color }}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Section 2 — Branch Table */}
                  <div className="mb-6">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 dark:text-gray-100 m-0 mb-2 uppercase tracking-[0.03em]">Repayment by Community</h4>
                    <div className="max-h-[280px] overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="w-full border-collapse text-[12px]">
                        <thead >
                          <tr className="border-b-2 border-gray-200 dark:border-gray-700 text-left">
                            <th >Community</th>
                            <th className="text-center">Total</th>
                            <th className="text-center text-emerald-600 dark:text-emerald-400">On-Time</th>
                            <th className="text-center text-rose-600 dark:text-rose-400">Late</th>
                            <th className="text-right">On-Time Rate</th>
                            <th className="text-right">Penalties</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {branchRepaymentData.map((b, i) => {
                            const c = b.onTimeRate >= 80 ? '#10B981' : b.onTimeRate >= 60 ? '#F59E0B' : '#EF4444';
                            return (
                              <tr key={i} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <td className="font-medium">{b.branch}</td>
                                <td className="text-center">{b.total}</td>
                                <td className="text-center">{b.onTime}</td>
                                <td className="text-center">{b.late}</td>
                                <td className="text-right">
                                  <span style={{ background: `${c}18`, color: c, padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>{b.onTimeRate}%</span>
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: b.penalties > 0 ? '#EF4444' : '#6B7280' }}>₱{b.penalties.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3 — Monthly Trend */}
                  <div className="mb-4">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 dark:text-gray-100 m-0 mb-2 uppercase tracking-[0.03em]">Monthly Repayment Trend</h4>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={visibleMonthlyRepayment} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                          <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                          <YAxis stroke="#9CA3AF" fontSize={12} allowDecimals={false} />
                          <Tooltip />
                          <Legend iconType="circle" iconSize={8} />
                          <Bar dataKey="onTime" fill="#10B981" name="On-Time" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="late" fill="#EF4444" name="Late" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="mt-4 p-[14px_16px] bg-slate-50 dark:bg-[#1E2130] rounded-lg border-l-4 border-[#0D1F45] dark:border-blue-400 text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
                    <strong>Interpretation:</strong> The scorecard shows overall repayment health — green on-time rate (80%+) indicates strong discipline. The community table identifies branches with repayment problems. Late payments incur a 3% penalty; high penalty amounts signal systemic issues. The monthly trend shows whether repayment discipline is improving or deteriorating.
                  </div>
                </>
                );
              })()}

              {expandedChart === 'appTrend' && (() => {
                const rateData = visibleMonthlyApplications.map(d => ({
                  month: d.month,
                  approvalRate: d.applications > 0 ? Math.round((d.approved / d.applications) * 100) : 0,
                  rejectionRate: d.applications > 0 ? Math.round((d.rejected / d.applications) * 100) : 0,
                  approved: d.approved, rejected: d.rejected,
                }));
                return (
                <>
                  {/* Section 1 — Monthly Table */}
                  <div className="mb-5">
                    <table className="w-full border-collapse text-[12px]">
                      <thead>
                        <tr className="border-b-2 border-gray-200 dark:border-gray-700 text-left">
                          <th >Month</th>
                          <th className="text-center">Applications</th>
                          <th className="text-center text-emerald-600 dark:text-emerald-400">Approved</th>
                          <th className="text-center text-rose-600 dark:text-rose-400">Rejected</th>
                          <th className="text-center" style={{ color: '#2563EB' }}>Pending</th>
                          <th className="text-right">Approval Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {visibleMonthlyApplications.map((d, i) => {
                          const pending = d.applications - d.approved - d.rejected;
                          const rate = d.applications > 0 ? Math.round((d.approved / d.applications) * 100) : 0;
                          const rejRate = d.applications > 0 ? Math.round((d.rejected / d.applications) * 100) : 0;
                          const isBold = rejRate > 20;
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', fontWeight: isBold ? 700 : 400, opacity: d.applications > 0 ? 1 : 0.4, background: isBold ? '#FEF2F210' : 'transparent' }}>
                              <td >{d.month} {isBold && <span style={{ color: '#EF4444', fontSize: '10px' }}>⚠</span>}</td>
                              <td className="text-center">{d.applications}</td>
                              <td className="text-center">{d.approved}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: isBold ? '#EF4444' : 'inherit' }}>{d.rejected}</td>
                              <td className="text-center">{pending > 0 ? <span style={{ color: '#F59E0B' }}>⚠ {pending}</span> : '—'}</td>
                              <td className="text-right">
                                <span style={{ background: rate >= 80 ? '#10B98118' : rate >= 50 ? '#F59E0B18' : '#EF444418', color: rate >= 80 ? '#10B981' : rate >= 50 ? '#F59E0B' : '#EF4444', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>{rate}%</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Section 2 — Approval/Rejection Stacked Bar */}
                  <div className="mb-6">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 dark:text-gray-100 m-0 mb-2 uppercase tracking-[0.03em]">Approval vs Rejection Rate</h4>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rateData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                          <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                          <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 100]} tickFormatter={v => v + '%'} />
                          <Tooltip formatter={v => v + '%'} />
                          <Legend iconType="circle" iconSize={8} />
                          <Bar dataKey="approvalRate" fill="#10B981" name="Approval %" radius={[4, 4, 0, 0]} stackId="a">
                            <LabelList dataKey="approved" position="inside" fontSize={10} fill="#fff" formatter={v => v > 0 ? v : ''} />
                          </Bar>
                          <Bar dataKey="rejectionRate" fill="#EF4444" name="Rejection %" radius={[4, 4, 0, 0]} stackId="a">
                            <LabelList dataKey="rejected" position="inside" fontSize={10} fill="#fff" formatter={v => v > 0 ? v : ''} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Section 3 — Branch Table */}
                  <div className="mb-4">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 dark:text-gray-100 m-0 mb-2 uppercase tracking-[0.03em]">Applications by Community</h4>
                    <div className="max-h-[280px] overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="w-full border-collapse text-[12px]">
                        <thead >
                          <tr className="border-b-2 border-gray-200 dark:border-gray-700 text-left">
                            <th >Community</th>
                            <th className="text-center">Total</th>
                            <th className="text-center text-emerald-600 dark:text-emerald-400">Approved</th>
                            <th className="text-center text-rose-600 dark:text-rose-400">Rejected</th>
                            <th className="text-right">Approval Rate</th>
                            <th className="text-center">Top Loan Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {branchAppData.map((b, i) => {
                            const safeRate = Math.min(b.approvalRate, 100);
                            const c = safeRate >= 80 ? '#10B981' : safeRate >= 50 ? '#F59E0B' : '#EF4444';
                            return (
                              <tr key={i} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <td className="font-medium">{b.branch}</td>
                                <td className="text-center">{b.total}</td>
                                <td className="text-center">{b.approved}</td>
                                <td className="text-center">{b.rejected}</td>
                                <td className="text-right">
                                  <span style={{ background: `${c}18`, color: c, padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>{safeRate}%</span>
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#6B7280' }}>{b.topLoanType}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-4 p-[14px_16px] bg-slate-50 dark:bg-[#1E2130] rounded-lg border-l-4 border-[#0D1F45] dark:border-blue-400 text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
                    <strong>Interpretation:</strong> The monthly table shows exact application counts — bold rows have rejection rates above 20%. The stacked bar visualizes approval vs rejection proportions with actual counts inside each segment. The community table identifies where loan demand is coming from and which branches have low approval rates.
                  </div>
                </>
                );
              })()}

              {expandedChart === 'delinquency' && (() => {
                const totalLate = visibleDelinquencyRate.reduce((s, d) => s + d.late, 0);
                const totalPaymentsAll = visibleDelinquencyRate.reduce((s, d) => s + d.total, 0);
                const currentRate = totalPaymentsAll > 0 ? Math.round((totalLate / totalPaymentsAll) * 100 * 10) / 10 : 0;
                const allZero = visibleDelinquencyRate.every(d => d.rate === 0);
                const rColor = currentRate > 15 ? '#EF4444' : currentRate > 10 ? '#F59E0B' : '#10B981';
                return (
                <>
                  {/* Section 1 — Scorecard */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    {[
                      { label: 'Current Delinquency Rate', value: currentRate + '%', color: rColor },
                      { label: 'Total Late Payments', value: totalLate, color: totalLate > 0 ? '#EF4444' : '#10B981' },
                      { label: 'Total Penalties Collected', value: '₱' + totalPenalties.toLocaleString(), color: totalPenalties > 0 ? '#EF4444' : '#10B981' },
                      { label: 'Communities At Risk', value: branchesAtRisk, color: branchesAtRisk > 0 ? '#EF4444' : '#10B981' },
                    ].map((k, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-[#1E2130] rounded-xl p-[14px_16px] text-center border border-slate-100 dark:border-white/5">
                        <div className="text-[11px] text-gray-500 font-medium mb-1 dark:text-gray-400 font-inter">{k.label}</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: k.color }}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Section 2 — Branch Table */}
                  <div className="mb-6">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 dark:text-gray-100 m-0 mb-2 uppercase tracking-[0.03em]">Delinquency by Community</h4>
                    <div className="max-h-[300px] overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="w-full border-collapse text-[12px]">
                        <thead >
                          <tr className="border-b-2 border-gray-200 dark:border-gray-700 text-left">
                            <th >Community</th>
                            <th className="text-center">Total Payments</th>
                            <th className="text-center text-emerald-600 dark:text-emerald-400">On-Time</th>
                            <th className="text-center text-rose-600 dark:text-rose-400">Late</th>
                            <th className="text-right">Delinquency Rate</th>
                            <th className="text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {branchDelinquencyData.map((b, i) => {
                            const sColor = b.status === 'Critical' ? '#EF4444' : b.status === 'At Risk' ? '#F59E0B' : '#10B981';
                            return (
                              <tr key={i} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <td className="font-medium">{b.branch}</td>
                                <td className="text-center">{b.total}</td>
                                <td className="text-center">{b.onTime}</td>
                                <td className="text-center">{b.late}</td>
                                <td className="text-right">{b.delinquencyRate}%</td>
                                <td className="text-center">
                                  <span style={{ background: `${sColor}18`, color: sColor, padding: '2px 8px', borderRadius: '12px', fontWeight: 600, fontSize: '11px' }}>{b.status}</span>
                                </td>
                              </tr>
                            );
                          })}
                          {branchDelinquencyData.length === 0 && (
                            <tr><td colSpan={6} className="font-inter text-[13px] text-slate-600 dark:text-slate-300">No payment data available.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3 — Trend with Threshold */}
                  <div className="mb-4">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 dark:text-gray-100 m-0 mb-2 uppercase tracking-[0.03em]">Delinquency Rate Trend</h4>
                    <div className="h-[250px] relative">
                      {allZero && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-[#1E2130]/80 backdrop-blur-xs rounded-xl p-4 text-center pointer-events-none">
                          <div className="text-emerald-600 dark:text-emerald-400 font-bold text-sm font-inter flex items-center gap-1.5">✓ No delinquencies recorded</div>
                          <div className="text-slate-500 dark:text-slate-400 text-xs font-inter mt-1">Healthy portfolio — all payments are on time</div>
                        </div>
                      )}
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={visibleDelinquencyRate} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                          <defs>
                            <linearGradient id="colorDelq2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                          <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                          <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, allZero ? 20 : 'auto']} tickFormatter={v => v + '%'} />
                          <Tooltip formatter={v => v + '%'} />
                          <ReferenceLine y={15} stroke="#EF4444" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: 'Risk Threshold (15%)', position: 'insideTopRight', fill: '#EF4444', fontSize: 11 }} />
                          <Area type="monotone" dataKey="rate" stroke="#0D1F45" strokeWidth={2.5} fill="url(#colorDelq2)" name="Delinquency %" dot={{ r: 4, fill: '#0D1F45' }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="mt-4 p-[14px_16px] bg-slate-50 dark:bg-[#1E2130] rounded-lg border-l-4 border-[#0D1F45] dark:border-blue-400 text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
                    <strong>Interpretation:</strong> The scorecard shows overall portfolio risk — green indicates healthy, red signals concern. The community table identifies which branches have delinquency issues using status badges: Healthy (below 10%), At Risk (10–15%), Critical (above 15%). The trend chart tracks whether the situation is improving or worsening over time.
                  </div>
                </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
