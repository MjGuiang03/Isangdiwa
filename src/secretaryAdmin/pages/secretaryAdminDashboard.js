/* eslint-disable no-unused-vars */
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label, Legend, AreaChart, Area, LineChart, Line } from 'recharts';
import SecretaryAdminSidebar from '../components/secretaryAdminSidebar';
import PageHeader from '../components/PageHeader';


import API from '../../utils/api';
import { Banknote, Clock, CheckCircle, CalendarDays, X, Filter, Maximize2 } from 'lucide-react';


const fmt = (n) => n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0 })}` : '₱0';
const fmtDate = (d) => {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const COLORS = ['#155DFC', '#00A63E', '#F59E0B'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i);

export default function SecretaryAdminDashboard() {
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [expandedChart, setExpandedChart] = useState(null);

  // Modal states
  const [showAwaitingModal, setShowAwaitingModal] = useState(false);
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showDisbursedModal, setShowDisbursedModal] = useState(false);

  // Modal filter states
  const [monthModalMonth, setMonthModalMonth] = useState(new Date().getMonth().toString());
  const [monthModalYear, setMonthModalYear] = useState(new Date().getFullYear());
  const [disbModalMonth, setDisbModalMonth] = useState('all');
  const [disbModalYear, setDisbModalYear] = useState('all');

  const token = localStorage.getItem('secretaryToken') || localStorage.getItem('adminToken') || localStorage.getItem('token');

  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => {
    if (!res.ok) throw new Error('Failed to fetch loans');
    return res.json();
  });

  const { data, isValidating } = useSWR(
    token ? `${API}/api/admin/loans?limit=10000` : null,
    fetcherSingle,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );

  const rawLoans = useMemo(() => data?.loans || [], [data]);
  const loading = isValidating && !data;

  // Derived stats — always uses current month/year
  const derivedStats = useMemo(() => {
    const activeLoans = rawLoans.filter(l => ['active', 'approved', 'completed'].includes((l.status || '').toLowerCase()) || l.disbursed);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayStr = now.toLocaleDateString('en-US');

    let processedToday = 0;
    let processedMonth = 0;
    let totalDisbursedAmount = 0;
    const awaitingLoans = [];
    const todayLoans = [];
    const monthLoans = [];
    const disbursedLoans = [];
    let thisMonthAmount = 0;

    activeLoans.forEach(l => {
      if (!l.disbursed) {
        awaitingLoans.push(l);
      } else if (l.disbursementDate) {
        const disbDate = new Date(l.disbursementDate);
        if (disbDate.toLocaleDateString('en-US') === todayStr) {
          processedToday++;
          todayLoans.push(l);
        }

        if (disbDate.getFullYear() === currentYear && disbDate.getMonth() === currentMonth) {
          processedMonth++;
          monthLoans.push(l);
          thisMonthAmount += Number(l.amount) || 0;
        }

        totalDisbursedAmount += Number(l.amount) || 0;
        disbursedLoans.push(l);
      }
    });

    let prevMonthDisbursed = 0;
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    disbursedLoans.forEach(l => {
      if (!l.disbursementDate) return;
      const d = new Date(l.disbursementDate);
      if (d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear) {
        prevMonthDisbursed += Number(l.amount) || 0;
      }
    });

    return {
      stats: {
        awaiting: awaitingLoans.length,
        today: processedToday,
        month: processedMonth,
        disbursed: totalDisbursedAmount,
        thisMonthAmount,
        prevMonthDisbursed
      },
      awaitingLoans,
      todayLoans,
      monthLoans,
      disbursedLoans
    };
  }, [rawLoans]);

  const { stats, awaitingLoans, todayLoans, monthLoans, disbursedLoans } = derivedStats;

  // Derived stats for Reports and Chart
  const reportsAndCharts = useMemo(() => {
    const disbursedL = rawLoans.filter(l => l.disbursed);
    const approvedLoans = rawLoans.filter(l => ['active', 'approved', 'completed'].includes((l.status || '').toLowerCase()) || l.disbursed);

    const totalReceivedAmt = rawLoans.reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const totalProcessedAmt = approvedLoans.reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const totalReleasedAmt = disbursedL.reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const processingRate = approvedLoans.length > 0 ? Math.round((disbursedL.length / approvedLoans.length) * 100) : 0;
    const reportStats = { totalReceived: totalReceivedAmt, totalReleased: totalReleasedAmt, totalProcessed: totalProcessedAmt, processingRate };

    // Filter payment method pie chart based on selected chart year too, or keep all time? Let's use chartYear for pie chart as well
    const yearlyDisbursed = disbursedL.filter(l => l.disbursementDate && new Date(l.disbursementDate).getFullYear() === chartYear);
    const pieDataSrc = yearlyDisbursed.length > 0 ? yearlyDisbursed : disbursedL; // Fallback to all if empty for the year

    const gcashAmt = pieDataSrc.filter(l => l.paymentMethod && (l.paymentMethod.toLowerCase() === 'e-wallet' || l.paymentMethod.toLowerCase() === 'gcash')).reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const bankAmt = pieDataSrc.filter(l => l.paymentMethod && l.paymentMethod.toLowerCase().includes('bank')).reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const cashAmt = pieDataSrc.filter(l => !l.paymentMethod || l.paymentMethod.toLowerCase() === 'cash').reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const totalAmt = gcashAmt + bankAmt + cashAmt;
    const paymentMethodData = [
      { name: 'E-Wallet', value: gcashAmt, percentage: totalAmt > 0 ? Math.round((gcashAmt / totalAmt) * 100) : 0 },
      { name: 'Bank Transfer', value: bankAmt, percentage: totalAmt > 0 ? Math.round((bankAmt / totalAmt) * 100) : 0 },
      { name: 'Cash', value: cashAmt, percentage: totalAmt > 0 ? Math.round((cashAmt / totalAmt) * 100) : 0 }
    ];

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const moneyFlowData = months.map(m => ({ month: m, released: 0 }));
    disbursedL.forEach(l => {
      if (!l.disbursementDate) return;
      const d = new Date(l.disbursementDate);
      if (d.getFullYear() === chartYear) {
        moneyFlowData[d.getMonth()].released += Number(l.amount) || 0;
      }
    });

    return { reportStats, paymentMethodData, moneyFlowData };
  }, [rawLoans, chartYear]);

  const { reportStats, paymentMethodData, moneyFlowData } = reportsAndCharts;

  const dash = (v) => loading ? '—' : v;

  const now = new Date();
  const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Filtered loans for This Month modal
  const filteredMonthLoans = useMemo(() => {
    return disbursedLoans.filter(l => {
      if (!l.disbursementDate) return false;
      const d = new Date(l.disbursementDate);
      return d.getMonth() === parseInt(monthModalMonth) && d.getFullYear() === monthModalYear;
    });
  }, [disbursedLoans, monthModalMonth, monthModalYear]);

  // Filtered loans for All Disbursements modal
  const filteredDisbLoans = useMemo(() => {
    return disbursedLoans.filter(l => {
      if (!l.disbursementDate) return false;
      const d = new Date(l.disbursementDate);
      if (disbModalYear !== 'all' && d.getFullYear() !== parseInt(disbModalYear)) return false;
      if (disbModalMonth !== 'all' && d.getMonth() !== parseInt(disbModalMonth)) return false;
      return true;
    });
  }, [disbursedLoans, disbModalYear, disbModalMonth]);

  const getMonthModalLabel = () => `${MONTH_NAMES[parseInt(monthModalMonth)]} ${monthModalYear}`;
  const getDisbModalLabel = () => {
    if (disbModalYear === 'all' && disbModalMonth === 'all') return 'All Time';
    if (disbModalYear !== 'all' && disbModalMonth === 'all') return `Year ${disbModalYear}`;
    if (disbModalYear === 'all' && disbModalMonth !== 'all') return `${MONTH_NAMES[parseInt(disbModalMonth)]} (All Years)`;
    return `${MONTH_NAMES[parseInt(disbModalMonth)]} ${disbModalYear}`;
  };

  const openMonthModal = () => {
    setMonthModalMonth(new Date().getMonth().toString());
    setMonthModalYear(new Date().getFullYear());
    setShowMonthModal(true);
  };
  const openDisbModal = () => {
    setDisbModalMonth('all');
    setDisbModalYear('all');
    setShowDisbursedModal(true);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
      <SecretaryAdminSidebar />
      <div className="p-6 pb-16 flex-1 overflow-y-auto w-full">
        {!expandedChart && (
          <>
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
                  <span className="text-slate-900 dark:text-white font-bold">Secretary</span>
                </>
              }
              subtitle={
                <>
                  Disbursement overview for <strong>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                </>
              }
            />

        {loading ? (
          <div className="animate-pulse flex flex-col gap-6">
            {/* Stat Cards Row Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
              <div className="lg:col-span-5 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 h-[200px] flex flex-col justify-between">
                <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                <div className="h-10 w-48 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                <div className="h-12 bg-slate-100 dark:bg-slate-800/50 rounded-xl"></div>
              </div>
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm min-h-[140px] flex flex-col justify-between">
                    <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                    <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700/80 rounded mt-4"></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="h-[280px] bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6">
                <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700/80 rounded mb-4"></div>
                <div className="h-4/5 bg-slate-100 dark:bg-slate-800/50 rounded-xl"></div>
              </div>
              <div className="h-[280px] bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6">
                <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700/80 rounded mb-4"></div>
                <div className="h-4/5 bg-slate-100 dark:bg-slate-800/50 rounded-xl"></div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Asymmetrical Layout with Consistent White Design */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
              
              {/* Left Column: Disbursement Hero Card (Combines Total, This Month Amount, Last Month Amount) */}
              <div className="lg:col-span-5 group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between" onClick={openDisbModal}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
                
                <div className="flex items-start justify-between relative z-10 mb-4">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter uppercase tracking-wider mb-2 block">Total Lifetime Disbursed</span>
                    <h3 className="text-4xl lg:text-5xl font-bold text-slate-800 dark:text-white font-inter tracking-tight">{dash(fmt(stats.disbursed))}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/20 dark:to-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
                    <Banknote size={24} strokeWidth={2.2} />
                  </div>
                </div>

                {/* MoM Comparison integrated into the Hero Card */}
                <div className="flex items-center gap-4 pt-5 border-t border-slate-100 dark:border-white/5 mt-auto relative z-10">
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">This Month</p>
                    <div className="flex items-end gap-2">
                      <span className="text-lg font-bold text-slate-800 dark:text-white">{dash(fmt(stats.thisMonthAmount))}</span>
                      {(() => {
                        if (stats.prevMonthDisbursed === 0) return null;
                        const diff = stats.thisMonthAmount - stats.prevMonthDisbursed;
                        const pct = Math.round((diff / stats.prevMonthDisbursed) * 100);
                        const isUp = pct >= 0;
                        return (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isUp ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
                            {isUp ? '↑' : '↓'} {Math.abs(pct)}%
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="w-px h-10 bg-slate-200 dark:bg-white/5"></div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Last Month</p>
                    <span className="text-lg font-bold text-slate-600 dark:text-slate-400">{dash(fmt(stats.prevMonthDisbursed))}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: 3 Operational Stat Cards */}
              <div className="lg:col-span-7">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  
                  {/* Card 1: Awaiting */}
                  <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between" onClick={() => setShowAwaitingModal(true)}>
                    <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-150"></div>
                    
                    <div className="flex items-start justify-between relative z-10 mb-3">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-inter uppercase tracking-wider leading-tight pr-2 mt-1">Awaiting Processing</span>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-500/20 dark:to-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
                        <Clock size={20} strokeWidth={2.2} />
                      </div>
                    </div>
                    <h3 className="text-[28px] font-extrabold text-slate-900 dark:text-white font-inter tracking-tight m-0 relative z-10 mt-auto">{dash(stats.awaiting)}</h3>
                  </div>

                  {/* Card 2: Processed Today */}
                  <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between" onClick={() => setShowTodayModal(true)}>
                    <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-150"></div>
                    
                    <div className="flex items-start justify-between relative z-10 mb-3">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-inter uppercase tracking-wider leading-tight pr-2 mt-1">Processed Today</span>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/20 dark:to-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
                        <CheckCircle size={20} strokeWidth={2.2} />
                      </div>
                    </div>
                    <h3 className="text-[28px] font-extrabold text-slate-900 dark:text-white font-inter tracking-tight m-0 relative z-10 mt-auto">{dash(stats.today)}</h3>
                  </div>

                  {/* Card 3: This Month (Count) */}
                  <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between" onClick={openMonthModal}>
                    <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-150"></div>
                    
                    <div className="flex items-start justify-between relative z-10 mb-3">
                      <div className="flex flex-col gap-1 pr-2 mt-1">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-inter uppercase tracking-wider leading-tight">Loans This Month</span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded w-fit">{MONTH_NAMES[now.getMonth()]}</span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/20 dark:to-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
                        <CalendarDays size={20} strokeWidth={2.2} />
                      </div>
                    </div>
                    <h3 className="text-[28px] font-extrabold text-slate-900 dark:text-white font-inter tracking-tight m-0 relative z-10 mt-auto">{dash(stats.month)}</h3>
                  </div>

                </div>
              </div>
            </div>

            {/* Row 2 — Charts */}
            <div className="grid grid-cols-[7fr_3fr] gap-5 w-full min-w-0 mt-6">
              {/* Monthly Disbursements */}
              <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
                <div className="relative z-10">
                <div className="flex items-baseline justify-between mb-2.5">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 m-0 font-dm">Monthly Disbursements</h3>
                    <span className="text-[11px] text-gray-400 font-inter">Funds released per month</span>
                    {(() => {
                      const ytd = moneyFlowData.reduce((s, d) => s + d.released, 0);
                      return <div className="text-[11px] font-semibold text-gray-600 mt-1 dark:text-gray-300">YTD: ₱{ytd.toLocaleString()}</div>;
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center">
                      <select value={chartYear} onChange={e => setChartYear(parseInt(e.target.value))} className="h-[32px] pl-3 pr-8 appearance-none rounded-lg border border-gray-300 text-[13px] font-semibold font-inter text-gray-800 bg-gray-50 cursor-pointer transition-colors hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
                        {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute right-2.5 text-gray-500 pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                    <button className="bg-transparent border-none text-gray-400 cursor-pointer p-1.5 rounded-md flex items-center justify-center transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100" onClick={() => setExpandedChart('disbursements')} title="Expand Chart">
                      <Maximize2 size={16} color="#4B5563" strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  {(() => {
                    const maxReleased = Math.max(...moneyFlowData.map(d => d.released));
                    const chartData = moneyFlowData.map(d => ({
                      ...d,
                      released: d.released > 0 ? d.released : maxReleased * 0.01 // ghost bar
                    }));
                    return (
                      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                        <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                        <Tooltip cursor={{ fill: '#F9FAFB' }} contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} formatter={(v, n, props) => props.payload.released === maxReleased * 0.01 ? '₱0' : '₱' + Math.round(v).toLocaleString()} />
                        <Bar dataKey="released" name="Disbursed" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.released === maxReleased * 0.01 ? '#F3F4F6' : '#1e3a5f'} />
                          ))}
                        </Bar>
                      </BarChart>
                    );
                  })()}
                </ResponsiveContainer>
                </div>
              </div>

              {/* Payment Method Pie */}
              <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
                <div className="relative z-10">
                <div className="flex items-baseline justify-between mb-2.5">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 m-0 font-dm">Payment Method</h3>
                    <span className="text-[11px] text-gray-400 font-inter">Disbursement distribution</span>
                  </div>
                  <button className="bg-transparent border-none text-gray-400 cursor-pointer p-1.5 rounded-md flex items-center justify-center transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100" onClick={() => setExpandedChart('paymentMethod')} title="Expand Chart">
                    <Maximize2 size={16} color="#4B5563" strokeWidth={2} />
                  </button>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  {(() => {
                    const activeMethods = paymentMethodData.filter(d => d.percentage > 0);
                    const zeroMethods = paymentMethodData.filter(d => d.percentage === 0);
                    const totalVal = activeMethods.reduce((s, d) => s + d.value, 0);
                    const PIE_COLORS = ['#1e3a5f', '#4a90d9', '#9CA3AF'];
                    return (
                      <div className="h-full flex flex-col">
                        <div className="flex-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={activeMethods} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                                {activeMethods.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                                {/* Centered label for recharts Pie */}
                                <Label value={`₱${totalVal >= 1000 ? (totalVal / 1000).toFixed(1).replace(/\\.0$/, '') + 'k' : totalVal}`} position="center" fill="#1e3a5f" className="text-sm font-bold font-inter" />
                                <Label value="Total" position="center" dy={16} fill="#6B7280" className="text-[10px] font-inter uppercase tracking-wider" />
                              </Pie>
                              <Tooltip formatter={(value) => '₱' + value.toLocaleString()} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col gap-[5px] mt-2">
                          {activeMethods.map((entry, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px] font-inter">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="flex-1 text-gray-700 dark:text-gray-400">{entry.name}</span>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">₱{entry.value >= 1000 ? (entry.value / 1000).toFixed(0) + 'k' : entry.value} ({entry.percentage}%)</span>
                            </div>
                          ))}
                        </div>
                        {zeroMethods.length > 0 && (
                          <div className="text-[10px] text-gray-400 text-center mt-2 italic dark:text-gray-500">
                            ({zeroMethods.map(m => m.name).join(', ')}: 0%)
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Row 3 — Processing Overview */}
            <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300 mt-5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
              <div className="relative z-10">
              <div className="flex items-baseline justify-between mb-2.5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 m-0 font-dm">Processing Overview</h3>
                  <span className="text-[11px] text-gray-400 font-inter">Key disbursement metrics</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2.5 w-full">
                <div className="bg-white rounded-lg p-[12px_14px] shadow-sm flex flex-col gap-0.5 flex-1 transition-transform hover:-translate-y-0.5">
                  <span className="text-[11px] text-gray-500 font-inter font-medium">Total Amount Requested</span>
                  <span className="text-[15px] font-bold font-inter text-[#00A63E]">₱{reportStats.totalReceived.toLocaleString()}</span>
                </div>
                <div className="bg-white rounded-lg p-[12px_14px] shadow-sm flex flex-col gap-0.5 flex-1 transition-transform hover:-translate-y-0.5">
                  <span className="text-[11px] text-gray-500 font-inter font-medium">Total Approved</span>
                  <span className="text-[15px] font-bold font-inter text-blue-600">₱{reportStats.totalProcessed.toLocaleString()}</span>
                </div>
                <div className="bg-white rounded-lg p-[12px_14px] shadow-sm flex flex-col gap-0.5 flex-1 transition-transform hover:-translate-y-0.5">
                  <span className="text-[11px] text-gray-500 font-inter font-medium">Total Released</span>
                  <span className="text-[15px] font-bold font-inter text-red-500">₱{reportStats.totalReleased.toLocaleString()}</span>
                </div>
                <div className="bg-white rounded-lg p-[12px_14px] shadow-sm flex flex-col gap-0.5 flex-1 transition-transform hover:-translate-y-0.5">
                  <span className="text-[11px] text-gray-500 font-inter font-medium">Processing Rate</span>
                  <span className="text-[15px] font-bold font-inter text-purple-500">{reportStats.processingRate}%</span>
                </div>
              </div>
              </div>
            </div>

            {/* Row 4 — Recent Transactions */}
            <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300 mt-5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 dark:bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
              <div className="relative z-10">
              <div className="flex items-baseline justify-between mb-2.5">
                <h3 className="text-sm font-semibold text-gray-900 m-0 font-dm">Recent Transactions</h3>
              </div>
              <div className="overflow-x-auto p-[0_16px_16px]">
                <table className="w-full border-collapse text-[13px] text-left">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      <th className="p-[12px_8px] font-semibold">Date</th>
                      <th className="p-[12px_8px] font-semibold">Member</th>
                      <th className="p-[12px_8px] font-semibold">Amount</th>
                      <th className="p-[12px_8px] font-semibold">Method</th>
                      <th className="p-[12px_8px] font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disbursedLoans.slice(0, 5).map(l => (
                      <tr key={l._id} className="border-b border-gray-100 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5">
                        <td className="p-[12px_8px] text-gray-700 dark:text-gray-300">{fmtDate(l.disbursementDate)}</td>
                        <td className="p-[12px_8px] text-gray-900 font-medium dark:text-gray-100">{l.memberName || 'N/A'}</td>
                        <td className="p-[12px_8px] text-navy font-semibold dark:text-blue-400">{fmt(l.amount)}</td>
                        <td className="p-[12px_8px]">
                          <span className="p-[4px_8px] rounded-xl text-[11px] bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {l.paymentMethod || 'Cash'}
                          </span>
                        </td>
                        <td className="p-[12px_8px]">
                          <span className="p-[4px_8px] rounded-xl text-[11px] bg-emerald-100 text-emerald-800 font-semibold dark:bg-emerald-500/15 dark:text-emerald-400">
                            Completed
                          </span>
                        </td>
                      </tr>
                    ))}
                    {disbursedLoans.length === 0 && (
                      <tr><td colSpan="5" className="p-4 text-center text-gray-500 dark:text-gray-400">No recent transactions.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              </div>
            </div>
          </>
        )}
      </>
        )}
      </div>

      {/* ── Expanded Chart Overlay ── */}
      {expandedChart && (
        <div className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setExpandedChart(null)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[1140px] max-h-[95vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 shrink-0">
              <h2 className="font-inter font-bold text-[16px] text-slate-900 dark:text-white m-0">
                {expandedChart === 'disbursements' ? 'Monthly Disbursements — Detailed View' : 'Payment Method — Detailed View'}
              </h2>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border-none text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer transition-colors" onClick={() => setExpandedChart(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-[24px_28px] flex-1 overflow-y-auto flex flex-col gap-3">

              {expandedChart === 'disbursements' && (() => {
                const ytd = moneyFlowData.reduce((s, d) => s + d.released, 0);
                const activeMonths = moneyFlowData.filter(d => d.released > 0);
                const highestMonth = activeMonths.length > 0 ? activeMonths.reduce((a, b) => b.released > a.released ? b : a) : null;
                const avgMonthly = activeMonths.length > 0 ? Math.round(ytd / activeMonths.length) : 0;
                const totalCount = disbursedLoans.filter(l => l.disbursementDate && new Date(l.disbursementDate).getFullYear() === chartYear).length;
                return (
                <>
                  {/* Section 1 — Scorecard */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    {[
                      { label: 'YTD Total Disbursed', value: fmt(ytd), color: '#3B82F6' },
                      { label: 'Highest Month', value: highestMonth ? `${highestMonth.month} · ${fmt(highestMonth.released)}` : '—', color: '#10B981' },
                      { label: 'Avg Monthly', value: fmt(avgMonthly), color: '#8B5CF6' },
                      { label: 'Total Transactions', value: totalCount, color: '#F59E0B' },
                    ].map((s, i) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-[14px_16px] text-center dark:bg-[#1E2130] bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm p-[14px_16px] text-center" style={{ borderLeft: `4px solid ${s.color}` }}>
                        <div className="text-xl font-bold text-navy dark:text-gray-100 text-xl font-bold text-slate-800 dark:text-white">{s.value}</div>
                        <div className="text-[11px] text-gray-500 font-medium mb-1 dark:text-gray-400 text-[11px] text-slate-500 font-medium mb-1 dark:text-slate-400">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Section 2 — Monthly Breakdown Table */}
                  <div className="mb-6">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 m-[0_0_12px] uppercase tracking-[0.03em] mb-2 dark:text-gray-100">MONTHLY BREAKDOWN</h4>
                    <div className="max-h-[320px] overflow-auto border border-gray-200 rounded-lg dark:border-gray-700">
                      <table className="w-full border-collapse text-[12px]">
                        <thead >
                          <tr className="border-b-2 border-gray-200 text-left dark:border-gray-700">
                            <th className="p-[8px_10px] text-gray-700 font-semibold sticky top-0 bg-white z-10 dark:bg-[#2C2F36] dark:text-gray-300 dark:border-gray-700">Month</th>
                            <th className="text-right">Total Disbursed</th>
                            <th className="text-center">Transactions</th>
                            <th className="text-right">Avg / Txn</th>
                            <th className="text-right">MoM Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {moneyFlowData.map((d, i) => {
                            const monthLoansCount = disbursedLoans.filter(l => { if (!l.disbursementDate) return false; const dd = new Date(l.disbursementDate); return dd.getMonth() === i && dd.getFullYear() === chartYear; }).length;
                            const avgPerTxn = monthLoansCount > 0 ? Math.round(d.released / monthLoansCount) : 0;
                            const prev = i > 0 ? moneyFlowData[i - 1].released : 0;
                            const isFuture = d.released === 0 && i > new Date().getMonth();
                            const momPct = i === 0 || isFuture || (prev === 0 && d.released === 0) ? null : prev === 0 ? null : Math.round(((d.released - prev) / prev) * 100);
                            const isBold = d.released > avgMonthly && d.released > 0;
                            return (
                              <tr key={i} className={`border-b border-slate-100 dark:border-white/5 ${isFuture ? 'opacity-50' : 'opacity-100'} ${isBold ? 'font-bold' : 'font-normal'} ${i % 2 !== 0 ? 'bg-slate-50 dark:bg-white/5' : 'bg-white dark:bg-[#1E2130]'}`}>
                                <td >{d.month}</td>
                                <td className="text-right">{d.released > 0 ? fmt(d.released) : '—'}</td>
                                <td className="text-center">{monthLoansCount || '—'}</td>
                                <td className="text-right">{avgPerTxn > 0 ? fmt(avgPerTxn) : '—'}</td>
                                <td className="text-right">
                                  {momPct === null ? '—' : <span className={`font-semibold ${momPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{momPct >= 0 ? '↑' : '↓'} {Math.abs(momPct)}%</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3 — Branch Table */}
                  <div className="mb-4">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 m-[0_0_12px] uppercase tracking-[0.03em] mb-2 dark:text-gray-100">DISBURSEMENTS BY BRANCH</h4>
                    <div className="max-h-[280px] overflow-auto border border-gray-200 rounded-lg dark:border-gray-700">
                      <table className="w-full border-collapse text-[12px]">
                        <thead >
                          <tr className="border-b-2 border-gray-200 text-left dark:border-gray-700">
                            <th className="p-[8px_10px] text-gray-700 font-semibold sticky top-0 bg-white z-10 dark:bg-[#2C2F36] dark:text-gray-300 dark:border-gray-700">Branch</th>
                            <th className="text-right">Total Disbursed</th>
                            <th className="text-center">Transactions</th>
                            <th className="text-center">Top Method</th>
                            <th className="text-right">% Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const yearLoans = disbursedLoans.filter(l => l.disbursementDate && new Date(l.disbursementDate).getFullYear() === chartYear);
                            const branchMap = {};
                            yearLoans.forEach(l => {
                              const b = l.branchName || l.community || 'Unassigned';
                              if (!branchMap[b]) branchMap[b] = { branch: b, total: 0, count: 0, methods: {} };
                              branchMap[b].total += Number(l.amount) || 0;
                              branchMap[b].count++;
                              const m = (l.paymentMethod || 'Cash').toLowerCase();
                              const normalized = m === 'e-wallet' || m === 'gcash' ? 'E-Wallet' : m.includes('bank') ? 'Bank Transfer' : 'Cash';
                              branchMap[b].methods[normalized] = (branchMap[b].methods[normalized] || 0) + 1;
                            });
                            const totalAll = yearLoans.reduce((s, l) => s + (Number(l.amount) || 0), 0);
                            const METHOD_BADGE = { 'E-Wallet': { bg: '#EFF6FF', color: '#2563EB' }, 'Bank Transfer': { bg: '#F0F4FF', color: '#1e3a5f' }, 'Cash': { bg: '#F3F4F6', color: '#6B7280' } };
                            return Object.values(branchMap).sort((a, b) => b.total - a.total).map((b, idx) => {
                              const topMethod = Object.entries(b.methods).sort((x, y) => y[1] - x[1])[0];
                              const topName = topMethod ? topMethod[0] : '—';
                              const badge = METHOD_BADGE[topName] || { bg: '#EFF6FF', color: '#1D4ED8' };
                              const share = totalAll > 0 ? ((b.total / totalAll) * 100).toFixed(1) : 0;
                              return (
                                <tr key={idx} className={`border-b border-slate-100 dark:border-white/5 ${idx % 2 !== 0 ? 'bg-slate-50 dark:bg-white/5' : 'bg-white dark:bg-[#1E2130]'}`}>
                                  <td className="font-medium">{b.branch}</td>
                                  <td className="text-right">{fmt(b.total)}</td>
                                  <td className="text-center">{b.count}</td>
                                  <td ><span className="text-center inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide" style={{ backgroundColor: badge.bg, color: badge.color }}>{topName}</span></td>
                                  <td className="text-right">{share}%</td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-4 p-[14px_16px] bg-slate-50 rounded-lg border-l-4 border-navy text-[13px] text-gray-700 leading-relaxed dark:bg-[#1E2130] dark:border-blue-400 dark:text-gray-300">
                    <strong>Interpretation:</strong> The scorecard shows year-to-date totals. Bold rows in the monthly table exceed the average monthly disbursement. MoM change shows directional momentum — consecutive red arrows may signal declining demand. The branch table identifies where the most funds are flowing.
                  </div>
                </>
                );
              })()}

              {expandedChart === 'paymentMethod' && (() => {
                const PIE_COLORS_EX = ['#1e3a5f', '#4a90d9', '#9CA3AF'];
                const METHOD_BORDERS = { 'E-Wallet': '#4a90d9', 'Bank Transfer': '#1e3a5f', 'Cash': '#9CA3AF' };
                const totalVal = paymentMethodData.reduce((s, d) => s + d.value, 0);
                const yearLoans = disbursedLoans.filter(l => l.disbursementDate && new Date(l.disbursementDate).getFullYear() === chartYear);
                return (
                <>
                  {/* Section 1 — Method Scorecard */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                    {paymentMethodData.map((m, i) => {
                      const count = yearLoans.filter(l => {
                        const pm = (l.paymentMethod || 'Cash').toLowerCase();
                        if (m.name === 'E-Wallet') return pm === 'e-wallet' || pm === 'gcash';
                        if (m.name === 'Bank Transfer') return pm.includes('bank');
                        return pm === 'cash' || !l.paymentMethod;
                      }).length;
                      return (
                        <div key={i} className="bg-white dark:bg-[#1E2130] rounded-xl p-4 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col gap-1" style={{ borderLeft: `4px solid ${METHOD_BORDERS[m.name] || PIE_COLORS_EX[i]}` }}>
                          <div className="text-xl font-bold text-navy dark:text-gray-100 text-xl font-bold text-slate-800 dark:text-white">{fmt(m.value)}</div>
                          <div className="text-[11px] text-gray-500 font-medium mb-1 dark:text-gray-400 text-[11px] text-slate-500 font-medium mb-1 dark:text-slate-400">{m.name}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 text-[11px] text-slate-400 dark:text-slate-500">{count} txn · {m.percentage}%</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Section 2 — Branch Table */}
                  <div className="mb-6">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 m-[0_0_12px] uppercase tracking-[0.03em] mb-2 dark:text-gray-100">PAYMENT METHOD BY BRANCH</h4>
                    <div className="max-h-[300px] overflow-auto border border-gray-200 rounded-lg dark:border-gray-700">
                      <table className="w-full border-collapse text-[12px]">
                        <thead >
                          <tr className="border-b-2 border-gray-200 text-left dark:border-gray-700">
                            <th className="p-[8px_10px] text-gray-700 font-semibold sticky top-0 bg-white z-10 dark:bg-[#2C2F36] dark:text-gray-300 dark:border-gray-700">Branch</th>
                            <th className="text-right text-blue-500">E-Wallet</th>
                            <th className="text-right text-slate-700 dark:text-slate-300">Bank</th>
                            <th className="p-[8px_10px] font-semibold sticky top-0 bg-white z-10 text-right text-gray-500 dark:bg-[#2C2F36] dark:text-gray-400 dark:border-gray-700">Cash</th>
                            <th className="text-right">Total</th>
                            <th className="text-center">Dominant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const branchMap = {};
                            yearLoans.forEach(l => {
                              const b = l.branchName || l.community || 'Unassigned';
                              if (!branchMap[b]) branchMap[b] = { branch: b, ewallet: 0, bank: 0, cash: 0, total: 0 };
                              const pm = (l.paymentMethod || 'Cash').toLowerCase();
                              const amt = Number(l.amount) || 0;
                              if (pm === 'e-wallet' || pm === 'gcash') branchMap[b].ewallet += amt;
                              else if (pm.includes('bank')) branchMap[b].bank += amt;
                              else branchMap[b].cash += amt;
                              branchMap[b].total += amt;
                            });
                            return Object.values(branchMap).sort((a, b) => b.total - a.total).map((b, idx) => {
                              const dominant = b.ewallet >= b.bank && b.ewallet >= b.cash ? 'E-Wallet' : b.bank >= b.cash ? 'Bank' : 'Cash';
                              const dColor = dominant === 'E-Wallet' ? '#4a90d9' : dominant === 'Bank' ? '#1e3a5f' : '#6B7280';
                              return (
                                <tr key={idx} className={`border-b border-slate-100 dark:border-white/5 ${idx % 2 !== 0 ? 'bg-slate-50 dark:bg-white/5' : 'bg-white dark:bg-[#1E2130]'}`}>
                                  <td className="font-medium">{b.branch}</td>
                                  <td className="text-right">{b.ewallet > 0 ? fmt(b.ewallet) : '—'}</td>
                                  <td className="text-right">{b.bank > 0 ? fmt(b.bank) : '—'}</td>
                                  <td className="text-right">{b.cash > 0 ? fmt(b.cash) : '—'}</td>
                                  <td className="text-right">{fmt(b.total)}</td>
                                  <td className="text-center">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide" style={{ backgroundColor: `${dColor}20`, color: dColor }}>{dominant}</span>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3 — Monthly Trend */}
                  <div className="mb-4">
                    <h4 className="font-inter text-[13px] font-semibold text-gray-700 m-[0_0_12px] uppercase tracking-[0.03em] mb-2 dark:text-gray-100">MONTHLY TREND BY PAYMENT METHOD</h4>
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={(() => {
                          return MONTH_NAMES.map((month, idx) => {
                            const mLoans = yearLoans.filter(l => new Date(l.disbursementDate).getMonth() === idx);
                            let ew = 0, bk = 0, ca = 0;
                            mLoans.forEach(l => {
                              const pm = (l.paymentMethod || 'Cash').toLowerCase();
                              const amt = Number(l.amount) || 0;
                              if (pm === 'e-wallet' || pm === 'gcash') ew += amt;
                              else if (pm.includes('bank')) bk += amt;
                              else ca += amt;
                            });
                            return { month, 'E-Wallet': ew, 'Bank Transfer': bk, Cash: ca };
                          });
                        })()} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                          <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                          <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={v => v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`} />
                          <Tooltip formatter={v => fmt(v)} />
                          <Legend iconType="circle" iconSize={8} />
                          <Line type="monotone" dataKey="Bank Transfer" stroke="#1e3a5f" strokeWidth={3} dot={{ r: 5, fill: '#1e3a5f' }} activeDot={{ r: 7 }} />
                          <Line type="monotone" dataKey="E-Wallet" stroke="#10B981" strokeWidth={3} dot={{ r: 5, fill: '#10B981' }} activeDot={{ r: 7 }} />
                          <Line type="monotone" dataKey="Cash" stroke="#F59E0B" strokeWidth={3} dot={{ r: 5, fill: '#F59E0B' }} activeDot={{ r: 7 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="mt-4 p-[14px_16px] bg-slate-50 rounded-lg border-l-4 border-navy text-[13px] text-gray-700 leading-relaxed dark:bg-[#1E2130] dark:border-blue-400 dark:text-gray-300">
                    <strong>Interpretation:</strong> The scorecards show each method's total and share. The branch table reveals which branches are cash-heavy vs digital — cash-dominant branches may benefit from e-wallet adoption campaigns. The trend chart shows whether digital payment usage is growing month-over-month.
                  </div>
                </>
                );
              })()}

            </div>
          </div>
        </div>
      )}

      {/* ── Awaiting Processing Modal ── */}
      {showAwaitingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setShowAwaitingModal(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[680px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 shrink-0">
              <div>
                <h2 className="font-inter font-bold text-[16px] text-slate-900 dark:text-white m-0">Awaiting Processing</h2>
                <p className="font-inter text-[12px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">{awaitingLoans.length} loan(s) pending disbursement</p>
              </div>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border-none text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer transition-colors" onClick={() => setShowAwaitingModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {awaitingLoans.length === 0 ? (
                <div className="text-center text-slate-400 dark:text-slate-500 py-16 font-inter text-sm">No loans currently awaiting processing.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse font-inter">
                    <thead>
                      <tr>
                        {['Loan ID','Member','Amount','Approved Date'].map(h => (
                          <th key={h} className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/5 px-3 py-2.5 text-left font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 sticky top-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {awaitingLoans.map(l => (
                        <tr key={l._id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">{l.loanId}</td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap">{l.memberName || 'N/A'}</td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">{fmt(l.amount)}</td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtDate(l.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Processed Today Modal ── */}
      {showTodayModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setShowTodayModal(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[680px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 shrink-0">
              <div>
                <h2 className="font-inter font-bold text-[16px] text-slate-900 dark:text-white m-0">Processed Today</h2>
                <p className="font-inter text-[12px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} &mdash; {todayLoans.length} loan(s)</p>
              </div>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border-none text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer transition-colors" onClick={() => setShowTodayModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {todayLoans.length === 0 ? (
                <div className="text-center text-slate-400 dark:text-slate-500 py-16 font-inter text-sm">No loans processed today.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse font-inter">
                    <thead>
                      <tr>
                        {['Loan ID','Member','Amount','Method'].map(h => (
                          <th key={h} className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/5 px-3 py-2.5 text-left font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 sticky top-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {todayLoans.map(l => (
                        <tr key={l._id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">{l.loanId}</td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap">{l.memberName || 'N/A'}</td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">{fmt(l.amount)}</td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 whitespace-nowrap">
                            <span className={`inline-flex px-2.5 py-1 rounded-md font-inter font-semibold text-[11px] capitalize ${
                              ((l.paymentMethod || 'cash').toLowerCase() === 'e-wallet' || (l.paymentMethod || 'cash').toLowerCase() === 'gcash')
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                                : (l.paymentMethod || 'cash').toLowerCase().includes('bank')
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            }`}>{l.paymentMethod || 'Cash'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── This Month Modal ── */}
      {showMonthModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setShowMonthModal(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[680px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 shrink-0">
              <div>
                <h2 className="font-inter font-bold text-[16px] text-slate-900 dark:text-white m-0">Monthly Disbursements</h2>
                <p className="font-inter text-[12px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">{getMonthModalLabel()} &mdash; {filteredMonthLoans.length} loan(s) processed</p>
              </div>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border-none text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer transition-colors" onClick={() => setShowMonthModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-100 dark:border-white/5 shrink-0">
              <Filter size={14} className="text-slate-400" />
              <select value={monthModalMonth} onChange={e => setMonthModalMonth(e.target.value)} className="h-8 px-3 border border-slate-200 dark:border-white/10 rounded-lg font-inter text-[13px] text-slate-700 dark:text-slate-300 bg-white dark:bg-[#1E2130] cursor-pointer outline-none focus:border-navy dark:focus:border-blue-400 transition-colors">
                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={monthModalYear} onChange={e => setMonthModalYear(parseInt(e.target.value))} className="h-8 px-3 border border-slate-200 dark:border-white/10 rounded-lg font-inter text-[13px] text-slate-700 dark:text-slate-300 bg-white dark:bg-[#1E2130] cursor-pointer outline-none focus:border-navy dark:focus:border-blue-400 transition-colors">
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {filteredMonthLoans.length === 0 ? (
                <div className="text-center text-slate-400 dark:text-slate-500 py-16 font-inter text-sm">No disbursements for {getMonthModalLabel()}.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse font-inter">
                    <thead>
                      <tr>
                        {['Loan ID','Member','Amount','Method','Date'].map(h => (
                          <th key={h} className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/5 px-3 py-2.5 text-left font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 sticky top-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMonthLoans.map(l => (
                        <tr key={l._id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">{l.loanId}</td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap">{l.memberName || 'N/A'}</td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">{fmt(l.amount)}</td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 whitespace-nowrap">
                            <span className={`inline-flex px-2.5 py-1 rounded-md font-inter font-semibold text-[11px] capitalize ${
                              ((l.paymentMethod || 'cash').toLowerCase() === 'e-wallet' || (l.paymentMethod || 'cash').toLowerCase() === 'gcash')
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                                : (l.paymentMethod || 'cash').toLowerCase().includes('bank')
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            }`}>{l.paymentMethod || 'Cash'}</span>
                          </td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtDate(l.disbursementDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-slate-100 dark:border-white/5 shrink-0">
              <div className="flex items-center justify-between bg-navy/5 dark:bg-blue-500/10 border border-navy/10 dark:border-blue-500/20 rounded-xl px-4 py-3">
                <span className="font-inter text-[13px] font-semibold text-slate-600 dark:text-slate-300">Total for {getMonthModalLabel()}</span>
                <span className="font-inter text-[18px] font-bold text-navy dark:text-blue-400">{fmt(filteredMonthLoans.reduce((s, l) => s + (Number(l.amount) || 0), 0))}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDisbursedModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setShowDisbursedModal(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[680px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 shrink-0">
              <div>
                <h2 className="font-inter font-bold text-[16px] text-slate-900 dark:text-white m-0">All Disbursements</h2>
                <p >{getDisbModalLabel()} &mdash; {filteredDisbLoans.length} loan(s) &mdash; <span className="font-inter text-[12px] text-slate-500 dark:text-slate-400 m-0 mt-0.5 font-semibold text-navy dark:text-blue-400">{fmt(filteredDisbLoans.reduce((s, l) => s + (Number(l.amount) || 0), 0))}</span></p>
              </div>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border-none text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer transition-colors" onClick={() => setShowDisbursedModal(false)}>
                <X size={18} />
              </button>
            </div>
            {/* Filter Bar */}
            <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-100 dark:border-white/5 shrink-0">
              <Filter size={14} className="text-slate-400" />
              <select value={disbModalMonth} onChange={e => setDisbModalMonth(e.target.value)} className="h-8 px-3 border border-slate-200 dark:border-white/10 rounded-lg font-inter text-[13px] text-slate-700 dark:text-slate-300 bg-white dark:bg-[#1E2130] cursor-pointer outline-none focus:border-navy dark:focus:border-blue-400 transition-colors">
                <option value="all">All Months</option>
                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={disbModalYear} onChange={e => setDisbModalYear(e.target.value)} className="h-8 px-3 border border-slate-200 dark:border-white/10 rounded-lg font-inter text-[13px] text-slate-700 dark:text-slate-300 bg-white dark:bg-[#1E2130] cursor-pointer outline-none focus:border-navy dark:focus:border-blue-400 transition-colors">
                <option value="all">All Years</option>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {/* Table */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {filteredDisbLoans.length === 0 ? (
                <div className="text-center text-slate-400 dark:text-slate-500 py-16 font-inter text-sm">No disbursements for {getDisbModalLabel()}.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse font-inter">
                    <thead>
                      <tr>
                        {['Loan ID','Member','Amount','Method','Date'].map(h => (
                          <th key={h} className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/5 px-3 py-2.5 text-left font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 sticky top-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDisbLoans.map(l => (
                        <tr key={l._id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">{l.loanId}</td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap">{l.memberName || 'N/A'}</td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">{fmt(l.amount)}</td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 whitespace-nowrap">
                            <span className={`inline-flex px-2.5 py-1 rounded-md font-inter font-semibold text-[11px] capitalize ${
                              ((l.paymentMethod || 'cash').toLowerCase() === 'e-wallet' || (l.paymentMethod || 'cash').toLowerCase() === 'gcash')
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                                : (l.paymentMethod || 'cash').toLowerCase().includes('bank')
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            }`}>{l.paymentMethod || 'Cash'}</span>
                          </td>
                          <td className="px-3 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtDate(l.disbursementDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {/* Footer Total */}
            <div className="px-6 py-3 border-t border-slate-100 dark:border-white/5 shrink-0">
              <div className="flex items-center justify-between bg-navy/5 dark:bg-blue-500/10 border border-navy/10 dark:border-blue-500/20 rounded-xl px-4 py-3">
                <span className="font-inter text-[13px] font-semibold text-slate-600 dark:text-slate-300">Total ({getDisbModalLabel()})</span>
                <span className="font-inter text-[18px] font-bold text-navy dark:text-blue-400">{fmt(filteredDisbLoans.reduce((s, l) => s + (Number(l.amount) || 0), 0))}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
