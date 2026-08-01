import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

import API from '../../utils/api';
import { CalendarDays, CheckCircle, Activity, CreditCard, Camera, X, ChevronDown, ChevronUp, Receipt } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { toast } from 'sonner';
import { branchData } from '../components/branchData';

const CountUp = ({ end, duration = 1000, suffix = '' }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const numericEnd = typeof end === 'number' ? end : parseInt(end) || 0;
    
    if (numericEnd === 0) {
      setCount(0);
      return;
    }

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * numericEnd));
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    
    window.requestAnimationFrame(step);
  }, [end, duration]);

  return <>{count}{suffix}</>;
};

const branchToProvinceMap = {};
branchData.forEach(b => {
  branchToProvinceMap[b.name.toLowerCase().trim()] = b.province;
});

const getBranchProvince = (bName) => {
  if (!bName) return 'Other';
  const normalized = bName.toLowerCase().replace(/\s*city\s*/gi, '').trim();
  if (branchToProvinceMap[normalized]) {
    return branchToProvinceMap[normalized];
  }
  const match = branchData.find(b => {
    const bNorm = b.name.toLowerCase().replace(/\s*city\s*/gi, '').trim();
    return bNorm.includes(normalized) || normalized.includes(bNorm);
  });
  return match ? match.province : 'Other';
};

export default function Attendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [attendanceData, setAttendanceData] = useState([]);
  const [stats,          setStats]          = useState({ total: 0, thisMonth: 0 });
  const [loading,        setLoading]        = useState(true);

  const [expandedProvinces, setExpandedProvinces] = useState({});

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const token = localStorage.getItem('token');

  const groupedAttendance = useMemo(() => {
    const groups = {};
    attendanceData.forEach(record => {
      const branchName = record.branch || 'Unknown Community';
      const province = getBranchProvince(branchName);

      if (!groups[province]) {
        groups[province] = {};
      }
      if (!groups[province][branchName]) {
        groups[province][branchName] = [];
      }
      groups[province][branchName].push(record);
    });
    return groups;
  }, [attendanceData]);

  const highlightBranch = location.state?.highlightBranch || null;

  useEffect(() => {
    if (highlightBranch && attendanceData.length > 0) {
      const province = getBranchProvince(highlightBranch);
      setExpandedProvinces(prev => ({
        ...prev,
        [province]: true
      }));

      // Scroll to recent attendance card
      setTimeout(() => {
        const el = document.getElementById('recent-attendance-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    }
  }, [highlightBranch, attendanceData]);

  const fetcher = async (url) => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return res.json();
  };

  const { data, isValidating, mutate } = useSWR(
    token ? `${API}/api/attendance/my-attendance?page=1&limit=100` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  useEffect(() => {
    if (!data) return;
    setLoading(isValidating && !data);
    if (data.success) {
      setAttendanceData(data.attendance || []);
      setStats(data.stats || { total: 0, thisMonth: 0 });
    }
    if (data) setLoading(false);
  }, [data, isValidating]);

  // Attendance rate = thisMonth / weeks in current month * 100 (capped at 100)
  const attendanceRateNum = useMemo(() => {
    if (!stats.total) return 0;
    const weeksInMonth = 4;
    return Math.min(100, Math.round((stats.thisMonth / weeksInMonth) * 100));
  }, [stats]);

  /* ── History Modal States ── */
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [modalPage, setModalPage] = useState(1);
  const [modalHistory, setModalHistory] = useState([]);
  const [modalTotalPages, setModalTotalPages] = useState(1);
  const [modalLoading, setModalLoading] = useState(false);
  const MODAL_LIMIT = 5;

  const { data: modalData, isValidating: modalValidating } = useSWR(
    isHistoryModalOpen && token ? `${API}/api/attendance/my-attendance?page=${modalPage}&limit=${MODAL_LIMIT}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!modalData) return;
    setModalLoading(modalValidating && !modalData);
    if (modalData.success) {
      setModalHistory(modalData.attendance || []);
      setModalTotalPages(modalData.totalPages || 1);
    }
    if (modalData) setModalLoading(false);
  }, [modalData, modalValidating]);

  const handleOpenHistory = () => {
    setModalPage(1);
    setIsHistoryModalOpen(true);
  };

  const handleScan = async (sessionId) => {
    setIsScanning(true);
    console.log('[QR Scan] Sending sessionId:', sessionId);
    try {
      const res = await fetch(`${API}/api/attendance/scan-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId })
      });
      const data = await res.json();
      console.log('[QR Scan] Response:', res.status, data);
      if (data.success) {
        toast.success(data.message);
        setIsScannerOpen(false);
        setIsScanning(false);
        mutate();
      } else {
        toast.error(data.message);
        setTimeout(() => setIsScanning(false), 2500); // Delay before next scan
      }
    } catch (err) {
      console.error('[QR Scan] Error:', err);
      toast.error('Failed to process QR code');
      setTimeout(() => setIsScanning(false), 2500);
    }
  };

  return (
    <>
      <div className="space-y-4 w-full pb-8 font-inter">

        {loading ? (
          <div className="space-y-4 w-full pb-8 animate-pulse font-inter">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-white/10">
              <div className="space-y-2">
                <div className="h-3 w-36 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
                <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700/80 rounded-lg" />
                <div className="h-3.5 w-72 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
              </div>
              <div className="h-10 w-36 bg-slate-200 dark:bg-slate-700/80 rounded-xl shrink-0" />
            </div>

            {/* 3 Stat Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/80 rounded" />
                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700/80 shrink-0" />
                  </div>
                  <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
                  <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700/80 rounded" />
                </div>
              ))}
            </div>

            {/* Main Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-1">
              {/* Check In Skeleton */}
              <div className="lg:col-span-5 p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm space-y-4">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700/80 rounded pb-3 border-b border-slate-100 dark:border-white/5" />
                <div className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-2xl" />
                <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
              </div>

              {/* Recent Attendance Skeleton */}
              <div className="lg:col-span-7 p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-white/5">
                  <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700/80 rounded" />
                  <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700/80 rounded" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Page Header matching Loans/Savings/Donation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-white/10">
              <div>
                <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-inter mb-0.5">Service &amp; Community Engagement</p>
                <h1 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 dark:text-white font-dm leading-none tracking-tight">Attendance Tracking</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-inter mt-1">Check in to services, scan QR codes &amp; track your attendance records</p>
              </div>

              {/* Right Action Button */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button 
                  className="h-10 px-4 rounded-xl bg-white dark:bg-[#1E2130] border border-slate-200/90 dark:border-white/10 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 text-xs font-bold font-inter flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  onClick={handleOpenHistory}
                >
                  <Receipt size={16} className="text-blue-600 dark:text-blue-400" />
                  <span>Attendance History</span>
                </button>
              </div>
            </div>

            {/* Stats Grid matching Loans, Savings & Donation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total Attendance */}
              <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col gap-1 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-inter">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Total Attendance</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100/60 dark:border-blue-900/30 shrink-0 group-hover:scale-105 transition-transform">
                    <CheckCircle size={16} />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-none">
                  <CountUp end={stats.total} />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-inter mt-0.5">
                  Lifetime check-ins
                </p>
              </div>

              {/* This Month */}
              <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col gap-1 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-inter">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">This Month</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100/60 dark:border-emerald-900/30 shrink-0 group-hover:scale-105 transition-transform">
                    <CalendarDays size={16} />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-none">
                  <CountUp end={stats.thisMonth} />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-inter mt-0.5">
                  Current month check-ins
                </p>
              </div>

              {/* Attendance Rate */}
              <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col gap-1 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-inter">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Attendance Rate</span>
                  <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100/60 dark:border-rose-900/30 shrink-0 group-hover:scale-105 transition-transform">
                    <Activity size={16} />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-none">
                  <CountUp end={attendanceRateNum} suffix="%" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-inter mt-0.5">
                  Monthly consistency
                </p>
              </div>
            </div>
          </>
        )}

        {/* Check In + Recent Attendance Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-1">
          {/* Check In Card */}
          <div className="lg:col-span-5 p-5 sm:p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-md shadow-slate-200/50 dark:shadow-none font-inter space-y-4">
            <div className="border-b border-slate-100 dark:border-white/10 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Check In</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose how you'd like to record your attendance:</p>
            </div>

            {/* Scan QR Button Card */}
            <div 
              className="p-4 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-slate-200/80 dark:border-white/10 rounded-2xl transition-all cursor-pointer flex items-center gap-3.5 group"
              onClick={() => setIsScannerOpen(true)}
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Camera size={20} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Scan Church QR</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Open camera to scan a service QR code</p>
              </div>
            </div>

            {/* RFID Scanner Button for authorized roles */}
            {['admin', 'secretaryAdmin', 'secretary', 'loanAdmin', 'loan'].includes(user?.role) && (
              <div 
                className="p-4 bg-purple-50/60 dark:bg-purple-950/30 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 border border-purple-100 dark:border-purple-900/40 rounded-2xl transition-all cursor-pointer flex items-center gap-3.5 group" 
                onClick={() => navigate('/admin/rfid-preview')}
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">RFID Scanner</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Open dedicated RFID check-in kiosk</p>
                </div>
              </div>
            )}

            {/* Tip Banner */}
            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100/80 dark:border-blue-900/40 rounded-xl text-xs space-y-1">
              <span className="font-bold text-blue-600 dark:text-blue-400 block">Tip:</span>
              <span className="text-slate-600 dark:text-slate-300 block text-[11px] leading-relaxed">Check in when you arrive at the service venue. Your attendance will be recorded automatically.</span>
            </div>
          </div>

          {/* Recent Attendance */}
          <div id="recent-attendance-section" className="lg:col-span-7 p-5 sm:p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-md shadow-slate-200/50 dark:shadow-none font-inter space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Recent Attendance</h2>
              <button className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer border-none bg-transparent" onClick={handleOpenHistory}>View History</button>
            </div>

            <div>
              {loading ? (
                <div className="space-y-3 py-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : Object.keys(groupedAttendance).length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">No records yet</h3>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Your attendance history will appear here once you check in to a service.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.keys(groupedAttendance).map((province) => {
                    const isExpanded = !!expandedProvinces[province];
                    const communities = groupedAttendance[province];
                    const totalProvinceVisits = Object.values(communities).reduce((sum, list) => sum + list.length, 0);

                    return (
                      <div key={province} className="border border-slate-200/80 dark:border-white/10 rounded-xl overflow-hidden font-inter">
                        <button 
                          className="w-full p-3 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer border-none"
                          onClick={() => {
                            setExpandedProvinces(prev => ({
                              ...prev,
                              [province]: !prev[province]
                            }));
                          }}
                        >
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{province}</span>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                            <span className="text-[11px]">
                              {totalProvinceVisits} {totalProvinceVisits === 1 ? 'visit' : 'visits'}
                            </span>
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-3 bg-white dark:bg-[#1E2130] space-y-3 border-t border-slate-200/80 dark:border-white/10">
                            {Object.keys(communities).map((communityName) => {
                              const visits = communities[communityName];
                              const isHighlighted = highlightBranch?.toLowerCase().replace(/\s*city\s*/gi, '').trim() === communityName.toLowerCase().replace(/\s*city\s*/gi, '').trim();

                              return (
                                <div key={communityName} className={`space-y-2 p-3 rounded-xl border ${isHighlighted ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/60 dark:border-white/5'}`}>
                                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                                    <span>{communityName}</span>
                                    {isHighlighted && <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[9px] uppercase font-extrabold">Selected</span>}
                                  </h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="text-slate-400 font-semibold border-b border-slate-200/60 dark:border-white/5">
                                          <th className="pb-1.5 font-semibold text-[11px]">Service</th>
                                          <th className="pb-1.5 font-semibold text-[11px]">Date</th>
                                          <th className="pb-1.5 font-semibold text-[11px]">Method</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
                                        {visits.map((record, index) => (
                                          <tr key={index}>
                                            <td className="py-2 font-bold truncate max-w-[120px] text-xs">{record.service}</td>
                                            <td className="py-2 text-slate-500 text-xs">{record.date}</td>
                                            <td className="py-2">
                                              <span className="inline-block px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-full text-blue-600 bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/30">
                                                {record.method}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Attendance History Modal matching Donation History ── */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setIsHistoryModalOpen(false)}>
          <div className="relative w-full max-w-xl bg-white dark:bg-[#1E2130] rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col my-auto text-left font-inter" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Attendance History</h2>
              <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer border-none bg-transparent" onClick={() => setIsHistoryModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* List */}
            <div className="py-3 space-y-2">
              {modalLoading ? (
                <p className="text-center text-xs text-slate-400 py-6">Loading history...</p>
              ) : modalHistory.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">No attendance records found.</p>
              ) : (
                <div className="space-y-2">
                  {modalHistory.map((record, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl border border-slate-200/60 dark:border-white/5 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                          <CheckCircle size={16} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">{record.service}</h3>
                          <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{record.branch} · {record.date} {record.time}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-block px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-full text-blue-600 bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/30">
                          {record.method}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination Footer */}
            {modalTotalPages > 1 && (
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-white/10 text-xs">
                <button
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors text-xs font-bold cursor-pointer border-none"
                  onClick={() => setModalPage(p => Math.max(1, p - 1))}
                  disabled={modalPage === 1 || modalLoading}
                >‹ Prev</button>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Page {modalPage} of {modalTotalPages}</span>
                <button
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors text-xs font-bold cursor-pointer border-none"
                  onClick={() => setModalPage(p => Math.min(modalTotalPages, p + 1))}
                  disabled={modalPage === modalTotalPages || modalLoading}
                >Next ›</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── QR Scanner Modal ── */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => !isScanning && setIsScannerOpen(false)}>
          <div className="relative w-full max-w-sm bg-white dark:bg-[#1E2130] rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 my-auto text-left font-inter" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/10">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Scan Service QR</h2>
              <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors border-none bg-transparent cursor-pointer" onClick={() => setIsScannerOpen(false)}><X size={18} /></button>
            </div>
            <div className="bg-black relative">
              <Scanner
                onScan={(result) => {
                  if (isScanning) return;
                  let scannedValue = '';
                  
                  if (Array.isArray(result) && result.length > 0) {
                    scannedValue = result[0].rawValue || result[0].text || '';
                  } else if (result && typeof result === 'object') {
                    scannedValue = result.rawValue || result.text || '';
                  } else if (typeof result === 'string') {
                    scannedValue = result;
                  }

                  if (scannedValue) {
                    handleScan(scannedValue);
                  }
                }}
                onError={(error) => console.log(error?.message)}
              />
              {isScanning && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xs">
                  Processing...
                </div>
              )}
            </div>
            <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
              Point your camera at the session QR code displayed by the admin.
            </div>
          </div>
        </div>
      )}
    </>
  );
}