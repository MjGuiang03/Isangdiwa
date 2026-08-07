/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, ReferenceDot, LabelList, Label, ReferenceArea
} from 'recharts';
import API from '../../utils/api';
import { 
  Banknote, Heart, Printer, Users, MapPin, Expand, X, Sparkles, RefreshCw, 
  TrendingUp, TrendingDown, AlertCircle, CheckCircle, DollarSign, Calendar, Activity 
} from 'lucide-react';

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

const InsightIcon = ({ name }) => {
  const icons = {
    TrendingUp: <TrendingUp size={18} />,
    TrendingDown: <TrendingDown size={18} />,
    AlertCircle: <AlertCircle size={18} />,
    CheckCircle: <CheckCircle size={18} />,
    DollarSign: <DollarSign size={18} />,
    Calendar: <Calendar size={18} />,
    Activity: <Activity size={18} />,
    Users: <Users size={18} />,
  };
  return icons[name] || <Sparkles size={18} />;
};




const INITIAL_DONATION_CATEGORIES = [
  { name: 'General Fund',           value: 0, color: '#0D1F45' }, // Navy
  { name: 'Children\'s Department', value: 0, color: '#3B82F6' }, // Blue
  { name: 'Men\'s Department',      value: 0, color: '#10B981' }, // Emerald
  { name: 'Women\'s Department',    value: 0, color: '#8B5CF6' }, // Violet
  { name: 'Youth Department',       value: 0, color: '#F59E0B' }, // Amber
  { name: 'Mission Fund',           value: 0, color: '#14B8A6' }, // Teal
];

const formatK = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'k';
  return num.toString();
};


export default function AdminDashboard() {
  const navigate = useNavigate();

  const [growthYear, setGrowthYear] = useState(new Date().getFullYear());
  const [growthMonth, setGrowthMonth] = useState('all');
  const [growthView, setGrowthView] = useState('both'); // 'both', 'total', 'new'
  const [topCommunitiesLimit, setTopCommunitiesLimit] = useState(20);
  const [donationPeriod, setDonationPeriod] = useState('all'); // 'all', 'thisMonth', 'thisYear'
  
  const [attYear, setAttYear] = useState(new Date().getFullYear());
  const [attMonth, setAttMonth] = useState('all');
  const [attBranch, setAttBranch] = useState('all');
  const [expandedChart, setExpandedChart] = useState(null);
  const [branchSearchInput, setBranchSearchInput] = useState('');
  const [branchSearchQuery, setBranchSearchQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setBranchSearchQuery(branchSearchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [branchSearchInput]);

  /* ── AI Insights State ── */
  const [aiInsights, setAiInsights] = useState([]);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsExpanded, setAiInsightsExpanded] = useState(true);
  const [aiInsightsTime, setAiInsightsTime] = useState(null);

  const fetcherSingle = (url) => 
    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      .then(res => res.ok ? res.json() : { success: false });

  const { data: membersData, isValidating: membersValidating } = useSWR(
    `${API}/api/admin/members?limit=5000`, 
    fetcherSingle, 
    { 
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );
  
  const { data: loansData } = useSWR(
    `${API}/api/admin/loans?limit=1`, 
    fetcherSingle, 
    { 
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );
  
  const { data: donationsData, isValidating: donationsValidating } = useSWR(
    `${API}/api/admin/donations?limit=5000`, 
    fetcherSingle, 
    { 
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );
  
  const { data: attendData, isValidating: attendValidating } = useSWR(
    `${API}/api/admin/attendance?limit=5000`, 
    fetcherSingle, 
    { 
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );

  // Progressive loading states
  const membersLoading = !membersData && membersValidating;
  const donationsLoading = !donationsData && donationsValidating;
  const attendanceLoading = !attendData && attendValidating;

  const rawAttendance = useMemo(() => attendData?.attendance || [], [attendData]);
  const rawMembers = useMemo(() => membersData?.members || [], [membersData]);

  const memberStats = useMemo(() => ({
    total: membersData?.stats?.total || 0,
    active: membersData?.stats?.active || 0,
    inactive: membersData?.stats?.inactive || 0,
    newThisMonth: membersData?.stats?.newThisMonth || 0
  }), [membersData]);

  const membersByBranch = useMemo(() => {
    const branchMap = {};
    rawMembers.forEach(m => {
      const b = m.branch || m.community;
      if (b && b !== 'Unknown') {
        branchMap[b] = (branchMap[b] || 0) + 1;
      }
    });
    return Object.entries(branchMap)
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => b.count - a.count);
  }, [rawMembers]);

  const loanStats = useMemo(() => ({
    active: loansData?.stats?.active || 0,
    pending: loansData?.stats?.pending || 0,
    totalDisbursed: loansData?.stats?.totalDisbursed || 0
  }), [loansData]);

  const donationStats = useMemo(() => ({
    thisMonth: donationsData?.stats?.thisMonth || 0,
    total: donationsData?.stats?.total || 0
  }), [donationsData]);

  const pieData = useMemo(() => {
    // If 'all', use the pre-aggregated stats from the server
    if (donationPeriod === 'all') {
      const catStats = donationsData?.stats?.categoryBreakdown || {};
      return INITIAL_DONATION_CATEGORIES.map(cat => ({
        ...cat,
        value: catStats[cat.name] || 0
      }));
    }
    // Otherwise, filter donations client-side by period
    const now = new Date();
    const allDonations = (donationsData?.donations || []).filter(d => d.status === 'confirmed');
    const filtered = allDonations.filter(d => {
      const date = new Date(d.createdAt || d.date);
      if (donationPeriod === 'thisYear') return date.getFullYear() === now.getFullYear();
      if (donationPeriod === 'thisMonth') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      return true;
    });
    const catMap = {};
    filtered.forEach(d => {
      const cat = d.category || 'General Fund';
      catMap[cat] = (catMap[cat] || 0) + (Number(d.amount) || 0);
    });
    return INITIAL_DONATION_CATEGORIES.map(cat => ({
      ...cat,
      value: catMap[cat.name] || 0
    }));
  }, [donationsData, donationPeriod]);

  const donationsByBranch = useMemo(() => {
    if (!donationsData || !donationsData.success) return [];
    const commStats = donationsData.stats?.communityBreakdown || {};
    const branchDonMap = { ...commStats };
    
    const confirmedDonations = (donationsData.donations || []).filter(d => (d.status || '').toLowerCase() === 'confirmed');
    const emailToBranch = {};
    
    rawMembers.forEach(m => { 
      const b = m.branch || m.community;
      if (b && b !== 'Unknown') emailToBranch[m.email] = b; 
    });
    
    confirmedDonations.forEach(d => {
      if (!d.community) {
        const branch = emailToBranch[d.email];
        if (branch) {
          branchDonMap[branch] = (branchDonMap[branch] || 0) + (Number(d.amount) || 0);
        }
      }
    });

    return Object.entries(branchDonMap)
      .map(([branch, total]) => ({ branch, total }))
      .sort((a, b) => b.total - a.total);
  }, [donationsData, rawMembers]);

  /* ── Fetch AI Insights ── */
  const fetchAiInsights = useCallback(async (refresh = false) => {
    setAiInsightsLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const url = `${API}/api/admin/ai-insights${refresh ? '?refresh=true' : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setAiInsights(data.insights || []);
        setAiInsightsTime(data.generatedAt);
      }
    } catch (err) {
      console.error('[AI Insights] Fetch error:', err);
    } finally {
      setAiInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { navigate('/'); return; }
    fetchAiInsights();
  }, [navigate, fetchAiInsights]);

  // --- Derived Growth Data ---
  const growthInfo = useMemo(() => {
    const validMembers = rawMembers.filter(m => {
      const s = (m.status || '').toLowerCase();
      return s !== 'deactivated';
    }).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));

    let growth = [];
    if (growthMonth === 'all') {
      const allMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      const monthsCount = growthYear === now.getFullYear() ? Math.max(now.getMonth() + 1, 6) : 12;
      const monthNames = allMonthNames.slice(0, monthsCount);
      growth = monthNames.map((m, i) => ({ label: m, totalMembers: 0, newMembers: 0, sortKey: i }));
      
      let runningTotal = 0;
      const windowStartDate = new Date(growthYear, 0, 1);
      validMembers.forEach(m => {
        if (new Date(m.createdAt) < windowStartDate) runningTotal++;
      });

      growth.forEach(g => {
        let newThisMonth = 0;
        validMembers.forEach(m => {
          const date = new Date(m.createdAt);
          if (date.getFullYear() === growthYear && date.getMonth() === g.sortKey) {
            newThisMonth++;
          }
        });
        runningTotal += newThisMonth;
        g.totalMembers = runningTotal;
        g.newMembers = newThisMonth;
      });
    } else {
      const daysInMonth = new Date(growthYear, parseInt(growthMonth) + 1, 0).getDate();
      growth = Array.from({length: daysInMonth}, (_, i) => ({ label: `${i+1}`, totalMembers: 0, newMembers: 0, sortKey: i+1 }));
      
      let runningTotal = 0;
      const windowStartDate = new Date(growthYear, parseInt(growthMonth), 1);
      validMembers.forEach(m => {
        if (new Date(m.createdAt) < windowStartDate) runningTotal++;
      });

      growth.forEach(g => {
        let newThisDay = 0;
        validMembers.forEach(m => {
          const date = new Date(m.createdAt);
          if (date.getFullYear() === growthYear && date.getMonth() === parseInt(growthMonth) && date.getDate() === g.sortKey) {
            newThisDay++;
          }
        });
        runningTotal += newThisDay;
        g.totalMembers = runningTotal;
        g.newMembers = newThisDay;
      });
    }

    const branchCounts = {};
    validMembers.forEach(m => {
      const date = new Date(m.createdAt);
      let inPeriod = false;
      if (growthMonth === 'all') {
        if (date.getFullYear() === growthYear) inPeriod = true;
      } else {
        if (date.getFullYear() === growthYear && date.getMonth() === parseInt(growthMonth)) inPeriod = true;
      }
      if (inPeriod) {
        const b = m.branch || m.community;
        if (b && b !== 'Unknown') {
          branchCounts[b] = (branchCounts[b] || 0) + 1;
        }
      }
    });

    const growthByBranch = Object.entries(branchCounts)
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { growthData: growth, growthByBranch };
  }, [rawMembers, growthYear, growthMonth]);

  const { growthData, growthByBranch } = growthInfo;

  // --- Derived Attendance Data ---
  const attendanceInfo = useMemo(() => {
    let att = [];
    let filteredAtt = rawAttendance;
    if (attBranch !== 'all') {
      filteredAtt = filteredAtt.filter(a => a.branch === attBranch || a.community === attBranch);
    }

    if (attMonth === 'all') {
      const allMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      const monthsCount = attYear === now.getFullYear() ? Math.max(now.getMonth() + 1, 6) : 12;
      const monthNames = allMonthNames.slice(0, monthsCount);
      att = monthNames.map((m, i) => ({ label: m, present: 0, late: 0, absent: 0, sortKey: i }));
      
      filteredAtt.forEach(a => {
        const s = (a.status || '').toLowerCase();
        const d = new Date(a.date || a.createdAt);
        if (d.getFullYear() === attYear && att[d.getMonth()]) {
          if (s === 'present') att[d.getMonth()].present += 1;
          else if (s === 'late') att[d.getMonth()].late += 1;
          else if (s === 'absent') att[d.getMonth()].absent += 1;
        }
      });
    } else {
      const daysInMonth = new Date(attYear, parseInt(attMonth) + 1, 0).getDate();
      att = Array.from({length: daysInMonth}, (_, i) => ({ label: `${i+1}`, present: 0, late: 0, absent: 0, sortKey: i+1 }));
      
      filteredAtt.forEach(a => {
        const s = (a.status || '').toLowerCase();
        const d = new Date(a.date || a.createdAt);
        if (d.getFullYear() === attYear && d.getMonth() === parseInt(attMonth)) {
          const dayMatch = att.find(x => x.sortKey === d.getDate());
          if (dayMatch) {
            if (s === 'present') dayMatch.present += 1;
            else if (s === 'late') dayMatch.late += 1;
            else if (s === 'absent') dayMatch.absent += 1;
          }
        }
      });
    }

    let attendanceByBranch = [];
    if (attBranch === 'all') {
      const branchAtt = {};
      const branchSessions = {};
      rawAttendance.forEach(a => {
        const s = (a.status || '').toLowerCase();
        const d = new Date(a.date || a.createdAt);
        let inPeriod = false;
        if (attMonth === 'all') {
          if (d.getFullYear() === attYear) inPeriod = true;
        } else {
          if (d.getFullYear() === attYear && d.getMonth() === parseInt(attMonth)) inPeriod = true;
        }
        if (inPeriod) {
          const b = a.branch || a.community || a.userBranch;
          if (b && b !== 'Unknown') {
            if (!branchSessions[b]) branchSessions[b] = new Set();
            branchSessions[b].add(a.sessionId || a.date);
            
            if (s === 'present' || s === 'late') {
              branchAtt[b] = (branchAtt[b] || 0) + 1;
            }
          }
        }
      });
      attendanceByBranch = Object.entries(branchAtt).map(([branch, total]) => {
        const sessionCount = branchSessions[branch] ? branchSessions[branch].size : 1;
        return {
          branch,
          avg: Math.round(total / (sessionCount || 1))
        };
      }).sort((a,b) => b.avg - a.avg).slice(0, 5);
    }

    return { attendVsDonData: att, attendanceByBranch };
  }, [rawAttendance, attYear, attMonth, attBranch]);

  const { attendVsDonData, attendanceByBranch } = attendanceInfo;


  const pieTotal = pieData.reduce((sum, item) => sum + (item.value || 0), 0);
  const activePieData = pieData.filter(d => d.value > 0);
  const zeroPieData = pieData.filter(d => d.value === 0);

  const sortedDonationData = [...pieData].sort((a, b) => b.value - a.value).map(item => {
    const percentage = pieTotal > 0 ? Math.round((item.value / pieTotal) * 100) : 0;
    
    let shortName = item.name.replace('Department', 'Dept');
    
    return {
      ...item,
      shortName,
      percentage,
      displayLabel: `₱${formatK(item.value || 0)} • ${percentage}%`,
      fillColor: item.value > 0 ? item.color : '#D1D5DB'
    };
  });

  const maxMembersInBranch = membersByBranch.length > 0 ? Math.max(...membersByBranch.map(b => b.count)) : 0;
  const isHorizontalMembers = maxMembersInBranch <= 3;

  let maxNewMembers = 0;
  let spikeLabel = null;
  growthData.forEach(g => {
    if (g.newMembers > maxNewMembers) {
      maxNewMembers = g.newMembers;
      spikeLabel = g.label;
    }
  });

  let momGrowth = 0;
  if (growthData.length >= 2) {
    const last = growthData[growthData.length - 1].totalMembers;
    const prev = growthData[growthData.length - 2].totalMembers;
    if (prev > 0) momGrowth = Math.round(((last - prev) / prev) * 100);
  }

  const enhancedGrowthData = growthData.map((d) => {
    let isZero = d.totalMembers === 0;
    return {
      ...d,
      actualTotal: isZero ? null : d.totalMembers,
      noDataTotal: isZero ? 0 : null // Not ideal for connecting but we will use connectNulls
    };
  });
  // Connect the zero line to the first real data point
  let firstDataIdx = enhancedGrowthData.findIndex(d => d.actualTotal !== null);
  if (firstDataIdx > 0) enhancedGrowthData[firstDataIdx].noDataTotal = enhancedGrowthData[firstDataIdx].actualTotal;

  const totalAttendanceCount = rawAttendance.filter(a => ['present', 'late'].includes((a.status || '').toLowerCase())).length;
  const attendanceRate = memberStats.total > 0 ? Math.round((totalAttendanceCount / memberStats.total) * 100) : 0;

  // Donation period filtering
  const donationPeriodLabel = donationPeriod === 'thisMonth' ? 'This Month' : donationPeriod === 'thisYear' ? `${new Date().getFullYear()}` : 'All Time';

  const isDashboardLoading = !membersData && !donationsData && !attendData && (membersValidating || donationsValidating || attendValidating);

  if (isDashboardLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex flex-col gap-2">
            <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
            <div className="h-4 w-80 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700/80 rounded-xl"></div>
            <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700/80 rounded-xl"></div>
          </div>
        </div>

        {/* 4 Stat Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-[138px]">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-2">
                  <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                  <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
                </div>
                <div className="w-12 h-12 rounded-[14px] bg-slate-200 dark:bg-slate-700/80"></div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
                <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
              </div>
            </div>
          ))}
        </div>

        {/* AI Insights Card Skeleton */}
        <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700/80"></div>
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
              <div className="h-5 w-28 bg-slate-200 dark:bg-slate-700/80 rounded-full"></div>
            </div>
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4 p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700/80 shrink-0"></div>
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                  <div className="h-3 w-full bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analytics Row Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm h-[340px] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col gap-2">
                  <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                  <div className="h-3.5 w-56 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                </div>
                <div className="h-7 w-24 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
              </div>
              <div className="flex-1 flex flex-col justify-around py-2">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700/80"></div>
                    <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700/80 rounded-full"></div>
                    <div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full">
      {!expandedChart && (<>
      {/* ── Dashboard Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-inter text-2xl font-bold text-slate-800 dark:text-white">
            {(() => {
              const h = new Date().getHours();
              return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
            })()}, <span className="text-blue-600 dark:text-blue-400">Admin</span>
          </h1>
          <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400">
            Here's your church overview for <strong>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select 
              value={attYear} 
              onChange={e => {
                setAttYear(parseInt(e.target.value)); 
                setGrowthYear(parseInt(e.target.value));
              }} 
              className="h-10 px-4 pr-10 appearance-none bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat"
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button className="flex items-center gap-2 h-10 px-4 bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold font-inter rounded-xl hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors border-none cursor-pointer" onClick={() => window.print()}>
            <Printer size={15} />
            Export
          </button>
        </div>
      </div>

      {/* ── Row 1: 4 Stat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Members Card */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 cursor-pointer" onClick={() => navigate('/admin/members')}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Total Members</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{membersLoading ? '—' : memberStats.total.toLocaleString()}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/20 dark:to-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <Users size={24} strokeWidth={2.2} />
            </div>
          </div>
          
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md text-xs font-bold border border-emerald-100 dark:border-emerald-500/20">
              <TrendingUp size={14} strokeWidth={2.5} />
              <span>+{membersLoading ? '—' : memberStats.newThisMonth}</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">new this month</span>
          </div>
        </div>

        {/* Total Communities Card */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 cursor-pointer" onClick={() => navigate('/admin/branches')}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Total Communities</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{membersLoading ? '—' : (membersByBranch.length > 0 ? membersByBranch.length : 68)}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/20 dark:to-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <MapPin size={24} strokeWidth={2.2} />
            </div>
          </div>
          
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md text-xs font-bold border border-slate-200 dark:border-white/10">
              <CheckCircle size={14} strokeWidth={2.5} />
              <span>Active</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">communities tracked</span>
          </div>
        </div>

        {/* Total Donations Card */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 cursor-pointer" onClick={() => navigate('/admin/donations')}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Total Donations</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none truncate max-w-[150px] sm:max-w-none">{donationsLoading ? '—' : `₱${(donationStats.total || 0).toLocaleString()}`}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-500/20 dark:to-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <Heart size={24} strokeWidth={2.2} />
            </div>
          </div>
          
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md text-xs font-bold border border-emerald-100 dark:border-emerald-500/20">
              <TrendingUp size={14} strokeWidth={2.5} />
              <span>+₱{donationsLoading ? '—' : (donationStats.thisMonth || 0).toLocaleString()}</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">this month</span>
          </div>
        </div>

        {/* Total Attendance Card */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 cursor-pointer" onClick={() => navigate('/admin/attendance')}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Total Attendance</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{attendanceLoading ? '—' : totalAttendanceCount.toLocaleString()}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-500/20 dark:to-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 border border-violet-200/60 dark:border-violet-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <Activity size={24} strokeWidth={2.2} />
            </div>
          </div>
          
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-md text-xs font-bold border border-violet-100 dark:border-violet-500/20">
              <Calendar size={14} strokeWidth={2.5} />
              <span>YTD</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">for {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>

      {/* ── AI Insights Card ── */}
      <div className={`bg-white dark:bg-[#1E2130] border border-blue-100 dark:border-blue-500/20 rounded-2xl shadow-sm transition-all duration-300 overflow-hidden ${aiInsightsExpanded ? 'p-6' : 'p-4'}`}>
        <div className="flex items-center justify-between cursor-pointer group" onClick={() => setAiInsightsExpanded(!aiInsightsExpanded)}>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-blue-500" />
            <h3 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">AI Insights</h3>
            <span className="text-[10px] font-semibold tracking-wider uppercase bg-gradient-to-r from-blue-600 to-violet-600 text-white px-2 py-0.5 rounded-full">Powered by Gemini</span>
          </div>
          <div className="flex items-center gap-3">
            {aiInsightsTime && (
              <span className="font-inter text-xs text-slate-400 dark:text-slate-500">
                {new Date(aiInsightsTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
            )}
            <button
              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 transition-colors border-none bg-transparent cursor-pointer disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                fetchAiInsights(true);
              }}
              disabled={aiInsightsLoading}
              title="Refresh insights"
            >
              <RefreshCw size={14} className={aiInsightsLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        {aiInsightsExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
            {aiInsightsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex gap-3 p-3">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-white/10" />
                    <div className="flex-1 flex flex-col gap-2 pt-0.5">
                      <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-1/3" />
                      <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : aiInsights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiInsights.map((insight, idx) => (
                  <div key={idx} className="flex gap-3 p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-blue-500/30 transition-colors">
                    <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 text-xs">
                      <InsightIcon name={insight.icon} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="m-0 mb-0.5 font-inter text-[13px] font-semibold text-slate-800 dark:text-white leading-tight">{insight.title}</p>
                      <p className="m-0 font-inter text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{insight.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="m-0 text-center font-inter text-sm text-slate-500 dark:text-slate-400 py-4">AI Service is waiting to connect. Click refresh to generate insights.</p>
            )}
          </div>
        )}
      </div>



      {/* ── Row 2: Analytics Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Donation Categories */}
        <div className="lg:col-span-5 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] flex flex-col relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
          <div className="flex items-center justify-between mb-5 relative z-10">
            <div>
              <h3 className="m-0 font-inter text-[15px] font-bold text-slate-900 dark:text-white leading-tight">Donation Categories</h3>
              <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">{donationPeriodLabel} · <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">₱{(pieTotal || 0).toLocaleString()}</span></p>
            </div>
            <div className="flex items-center gap-2">
              <select value={donationPeriod} onChange={e => setDonationPeriod(e.target.value)} className="h-7 px-2 pr-6 appearance-none bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[11px] font-inter font-semibold text-slate-600 dark:text-slate-400 outline-none cursor-pointer focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[position:right_6px_center] bg-no-repeat">
                <option value="all">All Time</option>
                <option value="thisYear">This Year</option>
                <option value="thisMonth">This Month</option>
              </select>
              <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors border-none bg-transparent cursor-pointer" onClick={() => setExpandedChart('donations')} title="Expand"><Expand size={15} strokeWidth={2.5} /></button>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-[260px]">
            {sortedDonationData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 text-[13px] font-inter py-1">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fillColor }}></div>
                <span className="w-28 truncate font-medium text-slate-700 dark:text-slate-300">{item.shortName}</span>
                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${item.percentage}%`, backgroundColor: item.fillColor }}></div>
                </div>
                <span className="w-24 text-right font-semibold text-slate-600 dark:text-slate-400 tabular-nums text-xs">{item.displayLabel}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Members by Community */}
        <div className="lg:col-span-7 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] flex flex-col relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
          <div className="flex items-center justify-between mb-5 relative z-10">
            <div>
              <h3 className="m-0 font-inter text-[15px] font-bold text-slate-900 dark:text-white leading-tight">Members by Community</h3>
              <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5"><span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{memberStats.total}</span> total across <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{membersByBranch.length}</span> communities</p>
            </div>
            <div className="flex items-center gap-2">
              <select 
                value={topCommunitiesLimit} 
                onChange={(e) => setTopCommunitiesLimit(Number(e.target.value))}
                className="h-7 px-2 pr-6 appearance-none bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[11px] font-inter font-semibold text-slate-600 dark:text-slate-400 outline-none cursor-pointer focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[position:right_6px_center] bg-no-repeat"
              >
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
                <option value={40}>Top 40</option>
                <option value={70}>Top 70</option>
              </select>
              <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors border-none bg-transparent cursor-pointer" onClick={() => setExpandedChart('branches')} title="Expand"><Expand size={15} strokeWidth={2.5} /></button>
            </div>
          </div>
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={membersByBranch.length > 0 ? membersByBranch.slice(0, topCommunitiesLimit) : [{ branch: 'No data', count: 0 }]} 
                layout={isHorizontalMembers ? "vertical" : "horizontal"}
                margin={isHorizontalMembers ? { top: 0, right: 30, left: 10, bottom: 0 } : { top: 10, right: 8, left: -25, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.6} horizontal={!isHorizontalMembers} vertical={isHorizontalMembers} />
                {isHorizontalMembers ? (
                  <>
                    <XAxis type="number" stroke="#9CA3AF" fontSize={11} domain={[0, maxMembersInBranch + 1]} allowDecimals={false} hide />
                    <YAxis dataKey="branch" type="category" stroke="#9CA3AF" fontSize={11} fontFamily="Inter, sans-serif" fontWeight={500} width={160} />
                  </>
                ) : (
                  <>
                    <XAxis dataKey="branch" stroke="#9CA3AF" fontSize={10} fontFamily="Inter, sans-serif" fontWeight={500} angle={-45} textAnchor="end" height={60} interval={0} tickMargin={5} />
                    <YAxis stroke="#9CA3AF" fontSize={11} fontFamily="Inter, sans-serif" fontWeight={500} domain={[0, maxMembersInBranch + 1]} allowDecimals={false} axisLine={false} tickLine={false} />
                  </>
                )}
                <Tooltip cursor={{ fill: 'rgba(59,130,246,0.04)' }} formatter={(value) => [value, 'Members']} contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '12px', fontFamily: 'Inter, sans-serif' }} />
                <Bar dataKey="count" fill="#3B82F6" radius={isHorizontalMembers ? [0, 6, 6, 0] : [6, 6, 0, 0]} barSize={isHorizontalMembers ? 18 : 28} name="Members">
                  <LabelList dataKey="count" position={isHorizontalMembers ? "right" : "top"} fill="#6B7280" fontSize={10} fontFamily="Inter, sans-serif" fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Row 3: Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Member Growth Trends */}
        <div className="lg:col-span-7 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] flex flex-col relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
          <div className="flex items-center justify-between mb-5 relative z-10">
            <div>
              <h3 className="m-0 font-inter text-[15px] font-bold text-slate-900 dark:text-white leading-tight">Member Growth Trends</h3>
              <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span className={`font-semibold ${momGrowth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{momGrowth >= 0 ? '↑' : '↓'} {Math.abs(momGrowth)}%</span> vs last month · <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{memberStats.total.toLocaleString()}</span> members
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select value={growthMonth} onChange={e => setGrowthMonth(e.target.value)} className="h-7 px-2 pr-6 appearance-none bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[11px] font-inter font-semibold text-slate-600 dark:text-slate-400 outline-none cursor-pointer focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[position:right_6px_center] bg-no-repeat">
                <option value="all">All Months</option>
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => <option key={i} value={String(i)}>{m}</option>)}
              </select>
              <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors border-none bg-transparent cursor-pointer" onClick={() => setExpandedChart('growth')} title="Expand"><Expand size={15} strokeWidth={2.5} /></button>
            </div>
          </div>
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={enhancedGrowthData} margin={{ top: 10, right: 8, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="label" stroke="#9CA3AF" fontSize={11} fontFamily="Inter, sans-serif" fontWeight={500} axisLine={false} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={11} fontFamily="Inter, sans-serif" fontWeight={500} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, memberStats.total > 0 ? memberStats.total + 2 : 'auto']} />
                <Tooltip formatter={(value, name) => [value, name === 'actualTotal' ? 'Total Members' : name === 'newMembers' ? 'New Members' : name]} contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '12px', fontFamily: 'Inter, sans-serif' }} />
                <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }} verticalAlign="bottom" />
                
                {enhancedGrowthData.length > 0 && enhancedGrowthData.findIndex(d => d.actualTotal !== null) > 0 && (
                  <ReferenceLine 
                    x={enhancedGrowthData[enhancedGrowthData.findIndex(d => d.actualTotal !== null)].label} 
                    stroke="#9CA3AF" 
                    strokeDasharray="3 3" 
                    label={{ position: 'insideTopLeft', value: 'Registration Opened', fill: '#9CA3AF', fontSize: 10, fontFamily: 'Inter, sans-serif' }} 
                  />
                )}
                
                <Bar dataKey="newMembers" barSize={14} fill="#F59E0B" radius={[4, 4, 4, 4]} name="New Members" />
                <Area type="monotone" dataKey="actualTotal" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTotal)" name="Total Members" connectNulls dot={false} activeDot={{ r: 5, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }} />
  
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Trends */}
        <div className="lg:col-span-5 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] flex flex-col relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-125"></div>
          <div className="flex items-center justify-between mb-5 relative z-10">
            <div>
              <h3 className="m-0 font-inter text-[15px] font-bold text-slate-900 dark:text-white leading-tight">Attendance Trends</h3>
              <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5"><span className="font-mono font-semibold text-violet-600 dark:text-violet-400">{totalAttendanceCount}</span> recorded · <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{attendanceRate}%</span> attendance rate</p>
            </div>
            <div className="flex items-center gap-1.5">
              <select value={attMonth} onChange={e => setAttMonth(e.target.value)} className="h-7 px-2 pr-6 appearance-none bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[11px] font-inter font-semibold text-slate-600 dark:text-slate-400 outline-none cursor-pointer focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[position:right_6px_center] bg-no-repeat">
                <option value="all">All Months</option>
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => <option key={i} value={String(i)}>{m}</option>)}
              </select>
              <select value={attBranch} onChange={e => setAttBranch(e.target.value)} className="h-7 px-2 pr-6 appearance-none bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[11px] font-inter font-semibold text-slate-600 dark:text-slate-400 outline-none cursor-pointer focus:border-blue-500 transition-colors max-w-[110px] truncate bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[position:right_6px_center] bg-no-repeat">
                <option value="all">All Branches</option>
                {membersByBranch.map(b => <option key={b.branch} value={b.branch}>{b.branch}</option>)}
              </select>
              <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors border-none bg-transparent cursor-pointer" onClick={() => setExpandedChart('attendance')} title="Expand"><Expand size={15} strokeWidth={2.5} /></button>
            </div>
          </div>
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendVsDonData} margin={{ top: 10, right: 8, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="label" stroke="#9CA3AF" fontSize={11} fontFamily="Inter, sans-serif" fontWeight={500} axisLine={false} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={11} fontFamily="Inter, sans-serif" fontWeight={500} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(139,92,246,0.04)' }} contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '12px', fontFamily: 'Inter, sans-serif' }} />
                <Legend iconType="square" wrapperStyle={{ paddingTop: '15px', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }} verticalAlign="bottom" />
                <Bar dataKey="present" fill="#3B82F6" stackId="a" name="Present" radius={[0, 0, 0, 0]} />
                <Bar dataKey="absent" fill="#EF4444" stackId="a" name="Absent" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      </>)}

      {/* ── Expanded Chart View (inline, sidebar stays visible) ── */}
      {expandedChart && (
        <div className="fixed inset-0 bg-slate-100/90 dark:bg-[#161922]/95 backdrop-blur-sm z-[100] flex flex-col">
          <div className="flex-1 max-w-[1200px] w-full mx-auto my-4 bg-white dark:bg-[#1E2130] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10 shrink-0">
              <h2 className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">
                {expandedChart === 'donations' && 'Donation Categories — Detailed View'}
                {expandedChart === 'branches' && 'Members by Community — Detailed View'}
                {expandedChart === 'growth' && 'Member Growth Trends — Detailed View'}
                {expandedChart === 'attendance' && 'Attendance Trends — Detailed View'}
              </h2>
              {expandedChart === 'growth' && (
                <div className="flex items-center gap-2 ml-auto mr-4">
                  <select value={growthView} onChange={e => setGrowthView(e.target.value)} className="h-9 px-3 pr-8 appearance-none bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-[13px] font-inter font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_8px_center] bg-no-repeat">
                    <option value="both">Total & New</option>
                    <option value="total">Total Only</option>
                    <option value="new">New Only</option>
                  </select>
                  <select value={growthMonth} onChange={e => setGrowthMonth(e.target.value)} className="h-9 px-3 pr-8 appearance-none bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-[13px] font-inter font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_8px_center] bg-no-repeat">
                    <option value="all">All Months</option>
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select value={growthYear} onChange={e => setGrowthYear(parseInt(e.target.value))} className="h-9 px-3 pr-8 appearance-none bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-[13px] font-inter font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_8px_center] bg-no-repeat">
                    {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}
              {expandedChart === 'attendance' && (
                <div className="flex items-center gap-2 ml-auto mr-4">
                  <select value={attBranch} onChange={e => setAttBranch(e.target.value)} className="h-9 px-3 pr-8 appearance-none bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-[13px] font-inter font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_8px_center] bg-no-repeat w-40">
                    <option value="all">All Communities</option>
                    {membersByBranch.map((b,i) => <option key={i} value={b.branch}>{b.branch}</option>)}
                  </select>
                  <select value={attMonth} onChange={e => setAttMonth(e.target.value)} className="h-9 px-3 pr-8 appearance-none bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-[13px] font-inter font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_8px_center] bg-no-repeat">
                    <option value="all">All Months</option>
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select value={attYear} onChange={e => setAttYear(parseInt(e.target.value))} className="h-9 px-3 pr-8 appearance-none bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-[13px] font-inter font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_8px_center] bg-no-repeat">
                    {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}
              <button className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border-none cursor-pointer" onClick={() => setExpandedChart(null)}><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
              {expandedChart === 'donations' && (() => {
                const dStats = donationsData?.stats || {};
                const donorsByCat = dStats.donorsByCategory || {};
                const donorsByComm = dStats.donorsByCommunity || {};
                const topCatByComm = dStats.topCategoryByCommunity || {};
                const highestCat = sortedDonationData.length > 0 ? sortedDonationData[0] : null;
                const fmt = v => `₱${(v || 0).toLocaleString()}`;
                return (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Donations Collected', value: fmt(dStats.total || pieTotal), color: '#3B82F6' },
                      { label: 'Total Donors', value: dStats.totalDonors || 0, color: '#10B981' },
                      { label: 'Average Donation', value: fmt(dStats.avgDonation || 0), color: '#8B5CF6' },
                      { label: 'Highest Category', value: highestCat ? highestCat.name : '—', sub: highestCat ? fmt(highestCat.value) : '', color: '#F59E0B' },
                    ].map((s, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-black/20 rounded-xl p-4 flex flex-col gap-1 border border-slate-100 dark:border-white/5" style={{ borderLeft: `4px solid ${s.color}` }}>
                        <div className="font-inter font-bold text-2xl text-slate-800 dark:text-white">{s.value}</div>
                        {s.sub && <div className="font-inter text-xs font-semibold text-slate-500 dark:text-slate-400">{s.sub}</div>}
                        <div className="font-inter text-[13px] font-medium text-slate-600 dark:text-slate-400 mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3">
                    <h4 className="m-0 font-inter text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Category Breakdown</h4>
                    <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-[13px] font-inter">
                        <thead>
                          <tr>
                            <th className="text-left px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Category Name</th>
                            <th className="text-right px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Total Amount</th>
                            <th className="text-center px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Unique Donors</th>
                            <th className="text-right px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Avg Donation</th>
                            <th className="text-right px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">% Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedDonationData.map((cat, idx) => {
                            const donors = donorsByCat[cat.name] || 0;
                            const avg = donors > 0 ? Math.round(cat.value / donors) : 0;
                            return (
                              <tr key={idx}>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color }} />
                                    {cat.name}
                                  </div>
                                </td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-right font-semibold text-slate-800 dark:text-white whitespace-nowrap tabular-nums">{fmt(cat.value)}</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">{donors || '—'}</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">{avg > 0 ? fmt(avg) : '—'}</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">{cat.percentage}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pb-4">
                    <h4 className="m-0 font-inter text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Donations by Community</h4>
                    <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto custom-scrollbar max-h-[300px]">
                      <table className="w-full text-left border-collapse text-[13px] font-inter">
                        <thead>
                          <tr>
                            <th className="text-left px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Community</th>
                            <th className="text-right px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Total Donated</th>
                            <th className="text-center px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Unique Donors</th>
                            <th className="text-center px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Top Category</th>
                            <th className="text-right px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Avg / Donor</th>
                            <th className="text-right px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">% Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {donationsByBranch.map((b, idx) => {
                            const donors = donorsByComm[b.branch] || 0;
                            const topCat = topCatByComm[b.branch] || '—';
                            const avgPerDonor = donors > 0 ? Math.round(b.total / donors) : 0;
                            const share = pieTotal > 0 ? ((b.total / pieTotal) * 100).toFixed(1) : '0';
                            return (
                              <tr key={idx}>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{b.branch}</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-right font-semibold text-slate-800 dark:text-white whitespace-nowrap tabular-nums">{fmt(b.total)}</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">{donors || '—'}</td>
                                <td ><span className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums inline-block px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">{topCat}</span></td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">{avgPerDonor > 0 ? fmt(avgPerDonor) : '—'}</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">{share}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 font-inter text-sm leading-relaxed border border-blue-100 dark:border-blue-500/20">
                    <strong>Interpretation:</strong> The scorecard shows overall donation health. The category table ranks each ministry fund by total amount and unique donor count — categories with high amounts but few donors indicate large individual gifts, while those with many donors but low totals reflect broad participation. The community table identifies the most generous communities and their preferred fund categories.
                  </div>
                </>
                );
              })()}

              {expandedChart === 'branches' && (() => {
                const totalMem = rawMembers.length;
                const officers = rawMembers.filter(m => m.position && m.position.toLowerCase() !== 'member').length;
                const regularMem = totalMem - officers;
                const ratio = totalMem > 0 ? `${Math.round((officers / totalMem) * 100)}%` : '0%';
                // Build per-community data
                const commData = {};
                rawMembers.forEach(m => {
                  const b = m.branch || m.community;
                  if (!b || b === 'Unknown') return;
                  if (!commData[b]) commData[b] = { name: b, total: 0, officers: 0 };
                  commData[b].total++;
                  if (m.position && m.position.toLowerCase() !== 'member') commData[b].officers++;
                });
                let commArr = Object.values(commData).sort((a, b) => {
                  const ra = a.total > 0 ? (a.officers / a.total) * 100 : 0;
                  const rb = b.total > 0 ? (b.officers / b.total) * 100 : 0;
                  return rb - ra;
                });
                
                if (branchSearchQuery.trim()) {
                  commArr = commArr.filter(c => c.name.toLowerCase().includes(branchSearchQuery.toLowerCase()));
                }
                
                const highRatioCommunities = commArr.filter(c => c.total > 0 && (c.officers / c.total) * 100 > 30).length;
                return (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Members', value: totalMem, color: '#3B82F6' },
                      { label: 'Total Officers', value: officers, color: '#10B981' },
                      { label: 'Officer Ratio', value: ratio, color: '#8B5CF6' },
                      { label: 'High Officer Ratio Communities', value: highRatioCommunities, color: highRatioCommunities > 0 ? '#F59E0B' : '#10B981' },
                    ].map((s, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-black/20 rounded-xl p-4 flex flex-col gap-1 border border-slate-100 dark:border-white/5" style={{ borderLeft: `4px solid ${s.color}` }}>
                        <div className="font-inter font-bold text-2xl text-slate-800 dark:text-white">{s.value}</div>
                        <div className="font-inter text-[13px] font-medium text-slate-600 dark:text-slate-400 mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 className="m-0 font-inter text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400" style={{ margin: 0 }}>Community Member Breakdown</h4>
                      <input 
                        type="text" 
                        placeholder="Search community..." 
                        value={branchSearchInput}
                        onChange={(e) => setBranchSearchInput(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '13px', width: '250px' }}
                      />
                    </div>
                    <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto custom-scrollbar max-h-[500px]">
                      <table className="w-full text-left border-collapse text-[13px] font-inter">
                        <thead>
                          <tr>
                            <th className="text-left px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Community</th>
                            <th className="text-center px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Total Members</th>
                            <th className="text-center px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Officers</th>
                            <th className="text-center px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Regular</th>
                            <th className="text-center px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Officer Ratio</th>
                            <th className="text-center px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commArr.map((c, idx) => {
                            const ratioPct = c.total > 0 ? Math.round((c.officers / c.total) * 100) : 0;
                            const statusCls = ratioPct > 40 ? 'adm-dv-badge-red' : ratioPct > 30 ? 'adm-dv-badge-yellow' : 'adm-dv-badge-green';
                            const statusLabel = ratioPct > 40 ? 'Critical' : ratioPct > 30 ? 'Review' : 'Healthy';
                            return (
                              <tr key={idx}>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{c.name}</td>
                                <td className="text-center fw-600">{c.total}</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">{c.officers}</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">{c.total - c.officers}</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">{ratioPct}%</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums"><span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase ${statusCls === 'adm-dv-badge-red' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : statusCls === 'adm-dv-badge-yellow' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>{statusLabel}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-center py-4">
                    <div className="w-full max-w-[400px] flex flex-col gap-4 relative">
                      <h4 className="m-0 font-inter text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Members vs Officers</h4>
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie data={[{ name: 'Regular Members', value: regularMem, fill: '#0D1F45' }, { name: 'Officers', value: officers, fill: '#155DFC' }]} cx="50%" cy="45%" innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="value" label={renderSliceLabel} labelLine={false}>
                            <Cell fill="#0D1F45" /><Cell fill="#155DFC" />
                            <Label 
                              position="center" 
                              content={({ viewBox: { cx, cy } }) => (
                                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                                  <tspan x={cx} y={cy - 5} fontSize="24" fontWeight="bold" fill="#0D1F45">{totalMem}</tspan>
                                  <tspan x={cx} y={cy + 15} fontSize="11" fill="#6B7280">Total Members</tspan>
                                </text>
                              )} 
                            />
                          </Pie>
                          <Tooltip formatter={(value) => [value, 'Members']} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} formatter={(value, entry) => <span className="text-slate-600 dark:text-slate-400 font-inter text-[13px]">{value}: {entry.payload.value} ({totalMem > 0 ? Math.round((entry.payload.value / totalMem) * 100) : 0}%)</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                      {highRatioCommunities > 0 && (
                        <div className="absolute -bottom-8 left-0 right-0 flex items-center justify-center gap-2 text-rose-600 dark:text-rose-400 font-inter text-sm font-semibold bg-rose-50 dark:bg-rose-500/10 py-2 rounded-lg">
                          <AlertCircle size={14} /> {highRatioCommunities} communities have officer ratio above 30%
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 font-inter text-sm leading-relaxed border border-blue-100 dark:border-blue-500/20">
                    <strong>Interpretation:</strong> The scorecard provides a high-level view of organizational capacity. The community table is sorted by officer ratio descending — communities marked "Critical" (red, &gt;40%) or "Review" (yellow, 30–40%) may need membership growth or officer role rebalancing. The donut chart visualizes the overall officer-to-member split.
                  </div>
                </>
                );
              })()}

              {expandedChart === 'growth' && (
                <div className="flex flex-col gap-4">
                  <div className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-5 flex flex-col gap-4">
                    <h4 className="m-0 font-inter text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Growth Trend (Line)</h4>
                    <div className="w-full">
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                          <XAxis dataKey="label" stroke="#9CA3AF" fontSize={12} />
                          <YAxis stroke="#9CA3AF" fontSize={12} allowDecimals={false} domain={[0, 'dataMax + 2']} tickFormatter={val => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
                          <Tooltip />
                          <Legend iconType="circle" />
                          {(growthView === 'both' || growthView === 'total') && <Line type="monotone" dataKey="totalMembers" stroke="#155DFC" strokeWidth={2.5} dot={{ r: 3 }} name="Total Members" />}
                          {(growthView === 'both' || growthView === 'new') && <Line type="monotone" dataKey="newMembers" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3 }} name="New Members" />}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-5 flex flex-col gap-4">
                      <h4 className="m-0 font-inter text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Growth by Community (Top {growthByBranch.length || 0})</h4>
                      <div className="w-full">
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={growthByBranch} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                            <XAxis dataKey="branch" stroke="#9CA3AF" fontSize={11} angle={-20} textAnchor="end" height={45} />
                            <YAxis stroke="#9CA3AF" fontSize={12} allowDecimals={false} tickFormatter={val => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
                            <Tooltip cursor={{ fill: '#F9FAFB' }} />
                            <Bar dataKey="count" fill="#0D1F45" radius={[4, 4, 0, 0]} name="New Members" barSize={28}>
                              <LabelList dataKey="count" position="top" fill="#6B7280" fontSize={11} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-5 flex flex-col gap-4">
                      <h4 className="m-0 font-inter text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active vs Inactive</h4>
                      <div className="w-full relative">
                        {(() => {
                          const activePct = memberStats.total > 0 ? (memberStats.active / memberStats.total) * 100 : 0;
                          const inactivePct = memberStats.total > 0 ? (memberStats.inactive / memberStats.total) * 100 : 0;
                          return (
                            <>
                              <ResponsiveContainer width="100%" height={280}>
                                <PieChart margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                                  <Pie data={[
                                    { name: 'Active', value: memberStats.active, fill: '#0D1F45' },
                                    { name: 'Inactive', value: memberStats.inactive, fill: '#155DFC' }
                                  ]} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value" label={renderSliceLabel} labelLine={false}>
                                    <Cell fill="#0D1F45" />
                                    <Cell fill="#155DFC" />
                                  </Pie>
                                  <Tooltip formatter={(value) => [value, 'Members']} />
                                  <Legend 
                                    verticalAlign="bottom" 
                                    height={36}
                                    iconType="circle"
                                    iconSize={8}
                                    formatter={(value, entry) => {
                                      const pct = value === 'Active' ? activePct : inactivePct;
                                      return <span className="text-slate-600 dark:text-slate-400 font-inter text-[13px]">{value}: {entry.payload.value} ({pct.toFixed(1)}%)</span>;
                                    }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-500 font-inter text-sm mt-16">
                                {memberStats.total} Total Members
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 font-inter text-sm leading-relaxed border border-blue-100 dark:border-blue-500/20">
                    <strong>Interpretation:</strong> The top panel shows cumulative membership growth over time. The bottom-left panel highlights the top communities driving new registrations, while the bottom-right panel contextualizes overall growth against the current ratio of active to inactive members.
                  </div>
                </div>
              )}

              {expandedChart === 'attendance' && (() => {
                const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const now = new Date();
                const ytdAtt = rawAttendance.filter(a => { const s = (a.status||'').toLowerCase(); const d = new Date(a.date||a.createdAt); return (s==='present'||s==='late') && d.getFullYear()===attYear; }).length;
                const monthlyAtt = MONTHS.map((m, i) => {
                  const count = rawAttendance.filter(a => { const s = (a.status||'').toLowerCase(); const d = new Date(a.date||a.createdAt); return (s==='present'||s==='late') && d.getFullYear()===attYear && d.getMonth()===i; }).length;
                  return { month: m, count, idx: i };
                });
                const activeMonthsAtt = monthlyAtt.filter(m => m.count > 0);
                const avgMonthly = activeMonthsAtt.length > 0 ? Math.round(ytdAtt / activeMonthsAtt.length) : 0;
                const highestMonth = activeMonthsAtt.length > 0 ? activeMonthsAtt.reduce((a, b) => b.count > a.count ? b : a) : null;
                // Community attendance
                const commAttMap = {};
                rawAttendance.forEach(a => {
                  const s = (a.status||'').toLowerCase();
                  const d = new Date(a.date||a.createdAt);
                  if ((s==='present'||s==='late') && d.getFullYear()===attYear) {
                    const b = a.branch || a.community || a.userBranch || 'Unknown';
                    if (b !== 'Unknown') {
                      if (!commAttMap[b]) commAttMap[b] = { name: b, total: 0, months: {} };
                      commAttMap[b].total++;
                      const mKey = d.getMonth();
                      commAttMap[b].months[mKey] = (commAttMap[b].months[mKey] || 0) + 1;
                    }
                  }
                });
                const commAttArr = Object.values(commAttMap).sort((a, b) => b.total - a.total);
                const topCommunity = commAttArr.length > 0 ? commAttArr[0].name : '—';
                return (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Attendance YTD', value: ytdAtt.toLocaleString(), color: '#3B82F6' },
                      { label: 'Avg Monthly Attendance', value: avgMonthly.toLocaleString(), color: '#10B981' },
                      { label: 'Highest Month', value: highestMonth ? highestMonth.month : '—', sub: highestMonth ? `${highestMonth.count.toLocaleString()} attendees` : '', color: '#8B5CF6' },
                      { label: 'Most Attended Community', value: topCommunity, color: '#F59E0B' },
                    ].map((s, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-black/20 rounded-xl p-4 flex flex-col gap-1 border border-slate-100 dark:border-white/5" style={{ borderLeft: `4px solid ${s.color}` }}>
                        <div className="font-inter font-bold text-2xl text-slate-800 dark:text-white">{s.value}</div>
                        {s.sub && <div className="font-inter text-xs font-semibold text-slate-500 dark:text-slate-400">{s.sub}</div>}
                        <div className="font-inter text-[13px] font-medium text-slate-600 dark:text-slate-400 mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3">
                    <h4 className="m-0 font-inter text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Monthly Attendance</h4>
                    <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-[13px] font-inter">
                        <thead>
                          <tr>
                            <th className="text-left px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Month</th>
                            <th className="text-right px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Total Attendance</th>
                            <th className="text-right px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">MoM Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyAtt.map((m, i) => {
                            const isFuture = m.count === 0 && i > now.getMonth() && attYear >= now.getFullYear();
                            const prev = i > 0 ? monthlyAtt[i - 1].count : 0;
                            const momPct = i === 0 || isFuture || (prev === 0 && m.count === 0) ? null : prev === 0 ? null : Math.round(((m.count - prev) / prev) * 100);
                            const isBold = m.count > avgMonthly && m.count > 0;
                            return (
                              <tr key={i} className={`${isFuture ? 'opacity-50 grayscale' : ''} ${isBold ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{m.month}</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">{m.count > 0 ? m.count.toLocaleString() : '—'}</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">
                                  {momPct === null ? '—' : momPct === 0 ? <span style={{ color: '#6B7280' }}>— 0%</span> : <span className={momPct > 0 ? 'adm-dv-mom-up' : 'adm-dv-mom-down'}>{momPct > 0 ? '↑' : '↓'} {Math.abs(momPct)}%</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pb-4">
                    <h4 className="m-0 font-inter text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Attendance by Community</h4>
                    <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto custom-scrollbar max-h-[300px]">
                      <table className="w-full text-left border-collapse text-[13px] font-inter">
                        <thead>
                          <tr>
                            <th className="text-left px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Community</th>
                            <th className="text-right px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Total Attendance</th>
                            <th className="text-right px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Avg / Month</th>
                            <th className="text-center px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Most Active Month</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commAttArr.map((c, idx) => {
                            const activeMs = Object.keys(c.months).length;
                            const avgPerMonth = activeMs > 0 ? Math.round(c.total / activeMs) : 0;
                            const bestMonthIdx = Object.entries(c.months).sort((a, b) => b[1] - a[1])[0];
                            const bestMonth = bestMonthIdx ? MONTHS[parseInt(bestMonthIdx[0])] : '—';
                            return (
                              <tr key={idx}>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{c.name}</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-right font-semibold text-slate-800 dark:text-white whitespace-nowrap tabular-nums">{c.total.toLocaleString()}</td>
                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">{avgPerMonth}</td>
                                <td ><span className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums inline-block px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">{bestMonth}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 font-inter text-sm leading-relaxed border border-blue-100 dark:border-blue-500/20">
                    <strong>Interpretation:</strong> The scorecard shows year-to-date attendance health. The monthly table highlights months exceeding the average in bold — consecutive MoM declines (red arrows) may signal engagement drops requiring outreach. The community table ranks communities by total attendance and identifies their peak months.
                  </div>
                </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
