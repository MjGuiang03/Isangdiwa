/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import useDebounce from '../../hooks/useDebounce';
import API from '../../utils/api';
import { 
  CalendarDays, MapPin, Search, UserCheck, Clock, ShieldAlert,
  Play, Square, Plus, CheckCircle2, AlertCircle, XCircle, Download,
  ArrowLeft, ChevronLeft, ChevronRight, CreditCard, FileText,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Pagination from '../../components/Pagination';

function ManualAttendanceModal({ session, onClose, onSave }) {
  const [memberId, setMemberId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!memberId.trim()) return toast.error('Member ID is required');

    setSaving(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API}/api/admin/attendance/log-tap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
           method: 'Manual', 
           memberId: memberId.trim(),
           minLevelSessionId: session.sessionId
        })
      });
      const data = await res.json();
      if (!data.success) {
         if (data.alreadyLogged) {
            toast.success(data.message);
            onSave();
         } else {
            throw new Error(data.message);
         }
      } else {
         toast.success(data.message);
         onSave();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to record attendance manually');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[400px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 p-5 border-b border-slate-200 dark:border-white/10 shrink-0 relative">
           <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
             <UserCheck size={20} />
           </div>
          <div className="flex flex-col">
            <h2 className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">Manual Record</h2>
            <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400">Add attendance without RFID card</p>
          </div>
          <button className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer border-none" onClick={onClose}><XCircle size={20} color="#6B7280" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
             <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Member ID</label>
             <input type="text" className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full" 
                autoFocus
                placeholder="e.g. M-12345" 
                value={memberId} 
                onChange={e => setMemberId(e.target.value)} />
          </div>
        </form>
        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-end gap-3 shrink-0">
          <button type="button" className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : 'Record Attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionLogsModal({ session, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        const res = await fetch(`${API}/api/admin/attendance?session=${session.sessionId}&limit=100`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setLogs(data.attendance || []);
        }
      } catch (err) {
        toast.error('Failed to load session logs');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [session]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[600px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 p-5 border-b border-slate-200 dark:border-white/10 shrink-0 relative" style={{ padding: '20px 24px' }}>
          <div className="flex flex-col">
            <h2 className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">{session.branch} - {session.serviceType}</h2>
            <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400">Attendance logs for this active session</p>
          </div>
          <button className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer border-none" onClick={onClose}><XCircle size={20} color="#6B7280" /></button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-5" style={{ maxHeight: '60vh', overflowY: 'auto', padding: 0 }}>
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Member</th>
                <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Time In</th>
                <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Status</th>
                <th className="px-4 py-3 pr-6 text-right bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Method</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/5">Loading attendance data...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/5">No members have tapped in yet.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id || log.recordId}>
                     <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">
                        <p className="font-semibold text-gray-900 m-0">{log.member}</p>
                        <p className="text-xs text-gray-500 m-0">{log.recordId}</p>
                     </td>
                     <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">
                        <p className="text-gray-800 m-0 font-medium">{log.time}</p>
                     </td>
                     <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${log.status.toLowerCase() === 'present' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : log.status.toLowerCase() === 'late' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                          {log.status === 'Present' && <CheckCircle2 size={14} />}
                          {log.status === 'Late' && <Clock size={14} />}
                          {log.status}
                        </span>
                     </td>
                     <td className="px-4 py-3 pr-6 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300 text-right">
                        <span className="inline-flex px-2 py-0.5 rounded font-mono text-[11px] bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400 border border-slate-200 dark:border-white/20">{log.rfidCardId || log.method || 'Manual'}</span>
                     </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-end gap-3 shrink-0">
          <button className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAttendance() {
  const navigate = useNavigate();
  
  // Tabs
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'history'

  // History Sessions Page
  const [historyPage, setHistoryPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // Drilldown: viewing a specific session's logs
  const [viewingSession, setViewingSession] = useState(null);
  const [logsPage, setLogsPage] = useState(1);

  // Pagination for sessions table (client-side)
  const [sessionsPage, setSessionsPage] = useState(1);
  const PER_PAGE = 10;

  // Filters
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const LIMIT = 15;

  const rfidBuffer = useRef('');

  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }).then(res => res.json());

  // 1. Fetch Active Sessions
  const { data: activeSessionsData } = useSWR(
    `${API}/api/admin/attendance/sessions/active`,
    fetcherSingle,
    { revalidateOnFocus: false, refreshInterval: 5000 }
  );

  const activeSessions = useMemo(() => activeSessionsData?.sessions || [], [activeSessionsData]);
  const selectedSession = activeSessions.length > 0 ? activeSessions[0] : null;

  // 2. Fetch History Sessions
  const { data: historySessionsData, isValidating: historyLoading } = useSWR(
    activeTab === 'history' ? `${API}/api/admin/attendance/sessions/history?page=${historyPage}&limit=${PER_PAGE}` : null,
    fetcherSingle,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );

  const historySessions = useMemo(() => historySessionsData?.sessions || [], [historySessionsData]);
  const historyTotalPages = useMemo(() => historySessionsData?.totalPages || 1, [historySessionsData]);
  const historyTotalCount = useMemo(() => historySessionsData?.totalCount || 0, [historySessionsData]);

  // 3. Fetch Logs & Stats
  const attendanceQueryParams = useMemo(() => {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (filterBranch && filterBranch !== 'all') params.set('branch', filterBranch);
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
      return params.toString();
  }, [page, debouncedSearch, filterBranch, filterStatus]);

  const { data: attendanceData, isValidating: attendanceLoading, mutate: fetchAttendance } = useSWR(
    `${API}/api/admin/attendance?${attendanceQueryParams}`,
    fetcherSingle,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );

  const logs = useMemo(() => attendanceData?.attendance || [], [attendanceData]);
  const totalCount = useMemo(() => attendanceData?.totalCount || 0, [attendanceData]);
  const stats = useMemo(() => ({
      totalToday: attendanceData?.stats?.totalToday || 0,
      servicesThisWeek: attendanceData?.stats?.servicesThisWeek || 0,
      avgAttendance: attendanceData?.stats?.avgAttendance || 0,
      lateToday: attendanceData?.stats?.lateToday || 0,
  }), [attendanceData]);

  useEffect(() => { setLoading(attendanceLoading && !attendanceData); }, [attendanceLoading, attendanceData]);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterBranch, filterStatus]);

  // 4. Session Logs (drilldown)
  const { data: sessionLogsData, isValidating: sessionLogsLoading } = useSWR(
    viewingSession ? `${API}/api/admin/attendance?session=${viewingSession.sessionId}&page=${logsPage}&limit=${PER_PAGE}` : null,
    fetcherSingle,
    { 
      revalidateOnFocus: false, 
      refreshInterval: viewingSession && logsPage === 1 ? 3000 : 0,
      dedupingInterval: 10000,
      keepPreviousData: true
    }
  );

  const sessionLogs = useMemo(() => sessionLogsData?.attendance || [], [sessionLogsData]);
  const logsTotalCount = useMemo(() => sessionLogsData?.totalCount || sessionLogsData?.attendance?.length || 0, [sessionLogsData]);

  const handleSessionClick = (session) => {
    setViewingSession(session);
    setLogsPage(1);
  };

  const handleLogsPageChange = (newPage) => {
    setLogsPage(newPage);
  };

  const handleBackToSessions = () => {
    setViewingSession(null);
    setLogsPage(1);
  };

  // Derived: paginated sessions (client-side)
  const totalSessionsPages = Math.ceil(activeSessions.length / PER_PAGE);
  const paginatedSessions = activeSessions.slice((sessionsPage - 1) * PER_PAGE, sessionsPage * PER_PAGE);
  const totalLogsPages = Math.ceil(logsTotalCount / PER_PAGE);

  const exportCSV = () => {
    if (logs.length === 0) return toast.info('No data to export');
    
    const headers = ['Record ID', 'Member', 'Service', 'Branch', 'Date', 'Time In', 'Status', 'Method', 'RFID'];
    const rows = logs.map(l => [
       l.recordId, 
       `"${l.member}"`, 
       l.service, 
       `"${l.branch}"`, 
       l.date, 
       l.time, 
       l.status, 
       l.method,
       l.rfidCardId || 'N/A'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `IsangDiwa_Attendance_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  /* ── Export session attendance to PDF ── */
  const [pdfExporting, setPdfExporting] = useState(false);

  const exportSessionPDF = async () => {
    if (!viewingSession) return toast.info('No session selected');
    setPdfExporting(true);

    try {
      // Fetch ALL logs for this session (not just the paginated page)
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API}/api/admin/attendance?session=${viewingSession.sessionId}&limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const allLogs = (data.success && data.attendance) ? data.attendance : sessionLogs;

      if (allLogs.length === 0) { toast.info('No attendance data to export'); setPdfExporting(false); return; }

      const sessionDate = new Date(viewingSession.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const presentCount = allLogs.filter(l => l.status === 'Present').length;
      const lateCount = allLogs.filter(l => l.status === 'Late').length;

      const tableRows = allLogs.map((log, i) => `
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 10px 12px; font-size: 12px; color: #374151;">${i + 1}</td>
          <td style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #111827;">${log.member}</td>
          <td style="padding: 10px 12px; font-size: 12px; color: #374151;">${log.time || 'N/A'}</td>
          <td style="padding: 10px 12px; font-size: 12px;">
            <span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;
              background: ${log.status === 'Present' ? '#D1FAE5' : '#FEF3C7'};
              color: ${log.status === 'Present' ? '#065F46' : '#92400E'};">
              ${log.status}
            </span>
          </td>
          <td style="padding: 10px 12px; font-size: 11px; color: #6B7280; font-family: monospace;">${log.rfidCardId || log.method || 'Manual'}</td>
        </tr>
      `).join('');

      const htmlContent = `
        <div style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; padding: 32px; max-width: 800px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #1E3A8A;">Philippine United Apostolic Church</h1>
            <p style="margin: 4px 0 0; font-size: 13px; color: #6B7280;">Attendance Report</p>
          </div>

          <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; font-size: 12px; color: #6B7280; width: 120px;">Branch</td>
                <td style="padding: 4px 0; font-size: 12px; font-weight: 600; color: #111827;">${viewingSession.branch}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-size: 12px; color: #6B7280;">Service Type</td>
                <td style="padding: 4px 0; font-size: 12px; font-weight: 600; color: #111827;">${viewingSession.serviceType}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-size: 12px; color: #6B7280;">Date</td>
                <td style="padding: 4px 0; font-size: 12px; font-weight: 600; color: #111827;">${sessionDate}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-size: 12px; color: #6B7280;">Start Time</td>
                <td style="padding: 4px 0; font-size: 12px; font-weight: 600; color: #111827;">${viewingSession.time}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-size: 12px; color: #6B7280;">Total Attendees</td>
                <td style="padding: 4px 0; font-size: 12px; font-weight: 600; color: #111827;">${allLogs.length} (Present: ${presentCount}, Late: ${lateCount})</td>
              </tr>
            </table>
          </div>

          <table style="width: 100%; border-collapse: collapse; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #1E3A8A;">
                <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #fff; text-transform: uppercase;">#</th>
                <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #fff; text-transform: uppercase;">Member</th>
                <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #fff; text-transform: uppercase;">Time In</th>
                <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #fff; text-transform: uppercase;">Status</th>
                <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #fff; text-transform: uppercase;">Method</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <p style="text-align: center; font-size: 10px; color: #9CA3AF; margin-top: 24px;">
            Generated by IsangDiwa Portal · ${new Date().toLocaleString()}
          </p>
        </div>
      `;

      const container = document.createElement('div');
      container.innerHTML = htmlContent;
      document.body.appendChild(container);

      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `Attendance_${viewingSession.branch}_${viewingSession.serviceType}_${sessionDate}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(container).save();

      document.body.removeChild(container);
      toast.success('PDF exported successfully');
    } catch (err) {
      console.error('PDF Export Error:', err);
      toast.error('Failed to export PDF');
    } finally {
      setPdfExporting(false);
    }
  };

  if (!attendanceData && attendanceLoading) {
    return (
      <div className="flex flex-col h-full bg-slate-100 dark:bg-[#161922] p-6 max-w-[1400px] mx-auto w-full gap-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex flex-col gap-2">
            <div className="h-8 w-60 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
            <div className="h-4 w-80 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
          </div>
          <div className="h-10 w-44 bg-slate-200 dark:bg-slate-700/80 rounded-xl"></div>
        </div>

        {/* 4 Stat Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-[138px]">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-2">
                  <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                  <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
                </div>
                <div className="w-12 h-12 rounded-[14px] bg-slate-200 dark:bg-slate-700/80"></div>
              </div>
              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700/80 rounded mt-2"></div>
            </div>
          ))}
        </div>

        {/* Sessions Table Skeleton */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden min-h-[400px]">
          <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-white/10">
            <div className="h-9 w-32 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
            <div className="h-9 w-32 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/5 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-3.5 gap-4">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700/80 rounded-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-[#161922] p-6 max-w-[1400px] mx-auto w-full gap-6">
      
      {showManualModal && selectedSession && <ManualAttendanceModal session={selectedSession} onClose={() => setShowManualModal(false)} onSave={() => { setShowManualModal(false); fetchAttendance(); }} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
           <h1 className="m-0 font-inter text-2xl font-bold text-slate-800 dark:text-white">Attendance Tracking</h1>
           <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Manage service sessions and monitor active RFID logging.</p>
        </div>
        <div className="flex items-center gap-3">
           <button className="h-10 px-4 bg-blue-600 text-white font-inter text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors border-none cursor-pointer flex items-center justify-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => navigate('/admin/rfid-preview')}>
             <CreditCard size={18} />
             Open RFID Scanner
           </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Attendance Today */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Total Today</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{stats.totalToday.toLocaleString()}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/20 dark:to-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <UserCheck size={24} strokeWidth={2.2} />
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md text-xs font-bold border border-blue-100 dark:border-blue-500/20">
              <UserCheck size={14} strokeWidth={2.5} />
              <span>Live</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">attendees recorded</span>
          </div>
        </div>

        {/* Services This Week */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Services This Week</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{stats.servicesThisWeek}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/20 dark:to-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <CalendarDays size={24} strokeWidth={2.2} />
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md text-xs font-bold border border-emerald-100 dark:border-emerald-500/20">
              <CalendarDays size={14} strokeWidth={2.5} />
              <span>Active</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">sessions held</span>
          </div>
        </div>

        {/* Average Attendance */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Average Attendance</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{stats.avgAttendance.toLocaleString()}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-500/20 dark:to-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <MapPin size={24} strokeWidth={2.2} />
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md text-xs font-bold border border-slate-200 dark:border-white/10">
              <span>30d</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">past 30 days</span>
          </div>
        </div>

        {/* Late Arrivals Today */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Late Arrivals</span>
              <div className="font-inter font-extrabold text-[32px] text-rose-500 dark:text-rose-400 tracking-tight leading-none">{stats.lateToday.toLocaleString()}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-500/20 dark:to-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <ShieldAlert size={24} strokeWidth={2.2} />
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md text-xs font-bold border border-rose-100 dark:border-rose-500/20">
              <ShieldAlert size={14} strokeWidth={2.5} />
              <span>Today</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">late arrivals</span>
          </div>
        </div>
      </div>
      {/* Active Sessions / Session Logs Table */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden min-h-[500px]">
        {viewingSession ? (
          /* ── Drilldown: Member logs for selected session ── */
          <>
            <div className="flex flex-col p-4 border-b border-slate-200 dark:border-white/10 shrink-0">
              <div className="flex items-center justify-between gap-4 w-full">
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors border-none cursor-pointer" onClick={handleBackToSessions}>
                  <ArrowLeft size={16} />
                  Back
                </button>
                <div style={{ flex: 1 }}>
                  <h2>{viewingSession.branch} — {viewingSession.serviceType}</h2>
                  <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">{new Date(viewingSession.date).toLocaleDateString()} · Started at {viewingSession.time}</p>
                </div>
                <button
                  className="h-10 px-4 bg-blue-600 text-white font-inter text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors border-none cursor-pointer flex items-center justify-center gap-2"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px' }}
                  onClick={exportSessionPDF}
                  disabled={pdfExporting || sessionLogs.length === 0}
                >
                  {pdfExporting ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                  Export PDF
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr>
                    <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Member</th>
                    <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Time In</th>
                    <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Status</th>
                    <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionLogsLoading ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '32px 16px', color: '#6B7280' }}>Loading attendance data...</td>
                    </tr>
                  ) : sessionLogs.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '32px 16px', color: '#6B7280' }}>No members have tapped in yet.</td>
                    </tr>
                  ) : (
                    sessionLogs.map((log) => (
                      <tr key={log._id || log.recordId}>
                        <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">
                          <span className="block font-semibold text-slate-800 dark:text-white">{log.member}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{log.recordId}</span>
                        </td>
                        <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{log.time}</td>
                        <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${log.status.toLowerCase() === 'present' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : log.status.toLowerCase() === 'late' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                            {log.status === 'Present' && <CheckCircle2 size={14} />}
                            {log.status === 'Late' && <Clock size={14} />}
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">
                          <span className="inline-flex px-2 py-0.5 rounded font-mono text-[11px] bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400 border border-slate-200 dark:border-white/20">{log.rfidCardId || log.method || 'Manual'}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Logs pagination */}
            {logsTotalCount > PER_PAGE && (
              <div className="border-t border-slate-200 dark:border-white/10 shrink-0 bg-white dark:bg-[#1E2130]">
                <Pagination
                  currentPage={logsPage}
                  totalPages={totalLogsPages}
                  onPageChange={handleLogsPageChange}
                  totalItems={logsTotalCount}
                  itemsPerPage={PER_PAGE}
                  itemName="logs"
                />
              </div>
            )}
          </>
        ) : (
          /* ── Default: Sessions list with Tabs ── */
          <>
            <div className="flex flex-col p-4 border-b border-slate-200 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <button 
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors border-none cursor-pointer ${activeTab === 'active' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                  onClick={() => setActiveTab('active')}
                >
                  Active Sessions
                </button>
                <button 
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors border-none cursor-pointer ${activeTab === 'history' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                  onClick={() => {
                    setActiveTab('history');
                    setHistoryPage(1);
                  }}
                >
                  Service History
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr>
                    <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Branch</th>
                    <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Service Type</th>
                    <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Date</th>
                    <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Start Time</th>
                    <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Status / Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab === 'active' ? (
                    activeSessions.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/5">No active RFID sessions right now.</td>
                      </tr>
                    ) : (
                      paginatedSessions.map((session) => (
                        <tr key={session.sessionId} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors" onClick={() => handleSessionClick(session)}>
                           <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{session.branch}</td>
                           <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{session.serviceType}</td>
                           <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{new Date(session.date).toLocaleDateString()}</td>
                           <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{session.time}</td>
                           <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Active
                              </span>
                           </td>
                        </tr>
                      ))
                    )
                  ) : (
                    historyLoading ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/5">Loading history...</td>
                      </tr>
                    ) : historySessions.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/5">No historical sessions found.</td>
                      </tr>
                    ) : (
                      historySessions.map((session) => (
                        <tr key={session.sessionId} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors" onClick={() => handleSessionClick(session)}>
                           <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{session.branch}</td>
                           <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{session.serviceType}</td>
                           <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{new Date(session.date).toLocaleDateString()}</td>
                           <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{session.time}</td>
                           <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" style={{ backgroundColor: '#F3F4F6', color: '#4B5563' }}>
                                Ended
                              </span>
                              <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: '8px' }}>
                                {session.stats?.total || 0} attendees
                              </span>
                           </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination depending on activeTab */}
            {activeTab === 'active' && activeSessions.length > PER_PAGE && (
              <div className="border-t border-slate-200 dark:border-white/10 shrink-0 bg-white dark:bg-[#1E2130]">
                <Pagination
                  currentPage={sessionsPage}
                  totalPages={totalSessionsPages}
                  onPageChange={setSessionsPage}
                  totalItems={activeSessions.length}
                  itemsPerPage={PER_PAGE}
                  itemName="sessions"
                />
              </div>
            )}

            {activeTab === 'history' && historyTotalCount > PER_PAGE && (
              <div className="border-t border-slate-200 dark:border-white/10 shrink-0 bg-white dark:bg-[#1E2130]">
                <Pagination
                  currentPage={historyPage}
                  totalPages={historyTotalPages}
                  onPageChange={setHistoryPage}
                  totalItems={historyTotalCount}
                  itemsPerPage={PER_PAGE}
                  itemName="sessions"
                />
              </div>
            )}
          </>

        )}
      </div>

    </div>
  );
}
