import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label, LabelList
} from 'recharts';

import API from '../../utils/api';
import { FileText, Printer, RefreshCw, Sparkles, Calendar, ChevronDown, Download, MapPin, AlertCircle, X } from 'lucide-react';

// Color palette for per-community comparison lines
const COMMUNITY_COLORS = [
  '#2563eb', '#0ca678', '#f59e0b', '#ef4444', '#7c3aed',
  '#0891b2', '#dc2626', '#059669', '#d97706', '#4f46e5',
  '#0d9488', '#be185d',
];

/**
 * Given a byMonthByCommunity map and a month range, returns:
 *   - topSeries: top N community names by total
 *   - othersLabel: "X others" string or null
 *   - fullMonthData: chart rows with an "Others" key for the merged rest
 */
function buildTopNSeriesData({
  seriesKeys,       // string[] — all community/province names
  dataMap,          // { "2026-01": { communityName: value } }
  reportYear,
  from,             // month index start (0-based)
  to,               // month index end (0-based)
  maxSeries = 10,   // show at most this many series
}) {
  // Compute total per series across the month range
  const totals = {};
  seriesKeys.forEach(s => { totals[s] = 0; });
  for (let i = from; i <= to; i++) {
    const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
    if (dataMap[key]) {
      seriesKeys.forEach(s => { totals[s] += dataMap[key][s] || 0; });
    }
  }

  // Sort by total descending, take top N
  const sorted = [...seriesKeys].sort((a, b) => totals[b] - totals[a]);
  const topSeries = sorted.slice(0, maxSeries);
  const otherSeries = sorted.slice(maxSeries);
  const hasOthers = otherSeries.length > 0;

  // Build month-by-month rows
  const fullMonthData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
    const i = from + idx;
    const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
    const row = { month: label };
    topSeries.forEach(s => { row[s] = dataMap[key]?.[s] || 0; });
    if (hasOthers) {
      row['Others'] = otherSeries.reduce((sum, s) => sum + (dataMap[key]?.[s] || 0), 0);
    }
    return row;
  });

  return { topSeries, otherSeries, fullMonthData, totals, hasOthers };
}

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

const fmt = (n) => `₱${(Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n) => { const v = Number(n) || 0; return v >= 1000 ? `₱${(v/1000).toFixed(1)}k` : `₱${v.toLocaleString()}`; };
const PIE_COLORS = ['#0D1F45', '#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

const METHOD_MAP = { 'bank': 'Bank Transfer', 'bank transfer': 'Bank Transfer', 'gcash': 'E-Wallet', 'maya': 'E-Wallet', 'grab_pay': 'E-Wallet', 'e-wallet': 'E-Wallet', 'ewallet': 'E-Wallet', 'cash': 'Cash', 'check': 'Check', 'cheque': 'Check', 'manual': 'Manual' };
const normalizeMethod = (m) => METHOD_MAP[(m || '').toLowerCase()] || m;

const ChartFooter = ({ period, location }) => (
  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 text-center">
    <p className="m-0 font-inter text-xs text-slate-400 dark:text-slate-500">Source: IsangDiwa · {period} · {location}</p>
  </div>
);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const LOAN_STATUS_COLORS = {
  active: '#10B981', completed: '#0D1F45', pending: '#2563EB',
  rejected: '#EF4444', cancelled: '#F59E0B', approved: '#60A5FA',
  'awaiting approval': '#BFDBFE'
};

const getStatusColor = (status) => {
  return LOAN_STATUS_COLORS[(status || '').toLowerCase()] || PIE_COLORS[0];
};

const SESSION_KEY = 'faithly_financial_report';

export default function AdminFinancialReport() {
  const navigate = useNavigate();
  const now = new Date();
  const reportRef = useRef(null);
  const currentMonthIndex = now.getMonth(); // 0=Jan, 4=May, etc.

  const [periodMode, setPeriodMode] = useState('full');
  const [reportMonth, setReportMonth] = useState('');
  const [startMonth, setStartMonth] = useState(0);
  const [endMonth, setEndMonth] = useState(currentMonthIndex);
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const [reportType, setReportType] = useState('all');
  const [locationType, setLocationType] = useState('all'); // 'all', 'province', 'specific'
  const [selectedProvinces, setSelectedProvinces] = useState([]);
  const [selectedCommunities, setSelectedCommunities] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [compareYoY, setCompareYoY] = useState(false);

  const [provinceSearch, setProvinceSearch] = useState('');
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const provinceDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (provinceDropdownRef.current && !provinceDropdownRef.current.contains(event.target)) {
        setShowProvinceDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const adminRole = localStorage.getItem('adminRole'); // 'admin', 'loanAdmin', 'secretaryAdmin'

  // Load cached report from sessionStorage on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`${SESSION_KEY}_${adminRole}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setReport(parsed.report);
        setPeriodMode(parsed.periodMode ?? 'full');
        setReportMonth(parsed.month ?? '');
        setStartMonth(parsed.startMonth ?? 0);
        setEndMonth(parsed.endMonth ?? 11);
        setReportYear(parsed.year ?? now.getFullYear());
        setReportType(parsed.type ?? 'all');
        setLocationType(parsed.locationType ?? 'all');
        setSelectedProvinces(parsed.selectedProvinces ?? []);
        setSelectedCommunities(parsed.selectedCommunities ?? []);
      }
    } catch { /* ignore parse errors */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminRole]);

  // Fetch communities on mount (admin only)
  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }).then(res => res.json());
  
  const { data: branchesResp } = useSWR(
    localStorage.getItem('adminToken') ? `${API}/api/admin/branches?limit=1000` : null,
    fetcherSingle,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );

  const branchesData = useMemo(() => branchesResp?.branches || [], [branchesResp]);

  // Save report to sessionStorage whenever it changes
  useEffect(() => {
    if (report) {
      try {
        sessionStorage.setItem(`${SESSION_KEY}_${adminRole}`, JSON.stringify({
          report,
          periodMode,
          month: reportMonth,
          startMonth,
          endMonth,
          year: reportYear,
          type: reportType,
          locationType,
          selectedProvinces,
          selectedCommunities,
        }));
      } catch { /* quota exceeded — ignore */ }
    }
  }, [report, periodMode, reportMonth, startMonth, endMonth, reportYear, reportType, locationType, selectedProvinces, selectedCommunities, adminRole]);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) { navigate('/'); return; }

      const params = new URLSearchParams();
      params.set('year', reportYear);
      if (periodMode === 'month' && reportMonth !== '') params.set('month', reportMonth);
      if (periodMode === 'range') {
        params.set('startMonth', startMonth);
        params.set('endMonth', endMonth);
      }
      params.set('type', reportType);
      
      if (locationType === 'specific' && selectedCommunities.length > 0) {
        params.set('community', selectedCommunities.join(','));
      } else if (locationType === 'province' && selectedProvinces.length > 0) {
        params.set('province', selectedProvinces.join(','));
      }
      if (compareYoY) params.set('compare', 'true');

      const res = await fetch(`${API}/api/admin/financial-report?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { navigate('/'); return; }
        throw new Error(data.message || 'Failed to generate report');
      }

      setReport(data.report);
      toast.success('Financial report generated successfully');
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [periodMode, reportMonth, startMonth, endMonth, reportYear, reportType, locationType, selectedProvinces, selectedCommunities, compareYoY, navigate]);

  const toggleCommunity = (c) => {
    setSelectedCommunities(prev => 
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const toggleProvince = (p) => {
    setSelectedProvinces(prev => 
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleGenerateClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmGenerate = () => {
    setShowConfirm(false);
    generateReport();
  };

  const getReportTypeName = () => {
    if (reportType === 'donations') return 'Donations Only';
    if (reportType === 'attendance') return 'Attendance Only';
    return 'Comprehensive';
  };

  const getPeriodName = () => {
    if (periodMode === 'range') return `${MONTH_SHORT[startMonth]} - ${MONTH_SHORT[endMonth]} ${reportYear}`;
    if (periodMode === 'month' && reportMonth !== '') return `${MONTHS[parseInt(reportMonth)]} ${reportYear}`;
    return `Full Year ${reportYear}`;
  };

  // Max selectable month: if selected year is current year, cap at current month; otherwise allow all 12
  const maxSelectableMonth = reportYear === now.getFullYear() ? currentMonthIndex : 11;

  // Build location label from report data
  const getLocationLabel = () => {
    if (!report) return '';
    if (locationType === 'province' && selectedProvinces.length > 0) {
      if (selectedProvinces.length <= 3) return selectedProvinces.join(' and ');
      return `${selectedProvinces.slice(0, 3).join(', ')} (+${selectedProvinces.length - 3} more)`;
    }
    if (locationType === 'specific' && selectedCommunities.length > 0) {
      if (selectedCommunities.length <= 5) return selectedCommunities.join(', ');
      return `${selectedCommunities.slice(0, 4).join(', ')} (+${selectedCommunities.length - 4} more)`;
    }
    return 'All Locations';
  };



  // Get the month range to display on charts based on selected period
  const getChartMonthRange = () => {
    const maxMonth = reportYear === now.getFullYear() ? currentMonthIndex : 11;
    if (periodMode === 'range') return { from: startMonth, to: endMonth };
    if (periodMode === 'month' && reportMonth !== '') return { from: parseInt(reportMonth), to: parseInt(reportMonth) };
    return { from: 0, to: maxMonth }; // full year
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const element = reportRef.current;
      const periodName = report?.period?.replace(/\s+/g, '_') || 'Report';
      const reportTypeName = (() => {
        if (adminRole === 'loanAdmin') return 'Loan_Staff';
        if (adminRole === 'secretaryAdmin') return 'Secretary';
        return getReportTypeName().replace(/\s+/g, '_');
      })();
      const locationName = (() => {
        if (locationType === 'province' && selectedProvinces.length > 0) {
          return '_' + selectedProvinces.join('_').replace(/\s+/g, '_');
        }
        if (locationType === 'specific' && selectedCommunities.length > 0) {
          const names = selectedCommunities.length <= 3 ? selectedCommunities : selectedCommunities.slice(0, 3);
          return '_' + names.join('_').replace(/\s+/g, '_') + (selectedCommunities.length > 3 ? `_+${selectedCommunities.length - 3}more` : '');
        }
        return '_All_Locations';
      })();
      const filename = `IsangDiwa_${reportTypeName}_Report_${periodName}${locationName}.pdf`;

      const opt = {
        margin:       [10, 10, 10, 10],
        filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  {
          scale: 3,               // ← was 2, now 3 for crisp charts
          useCORS: true,
          logging: false,
          scrollY: 0,
          windowWidth: 1200,
          backgroundColor: '#ffffff',
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak:    { mode: ['css', 'legacy'] },
      };

      const html2pdf = (await import('html2pdf.js')).default;
      element.classList.add('exporting-pdf');
      await html2pdf().set(opt).from(element).save();
      element.classList.remove('exporting-pdf');
      toast.success('PDF exported successfully');
    } catch (err) {
      console.error('[PDF Export Error]:', err);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const yearOptions = [];
  for (let y = Math.max(2026, now.getFullYear()); y >= 2026; y--) {
    yearOptions.push(y);
  }

  const availableProvinces = Array.from(new Set(branchesData.map(b => b.province).filter(Boolean))).sort();
  const filteredProvinces = availableProvinces.filter(p => p.toLowerCase().includes(provinceSearch.toLowerCase()));

  return (
    <div className="flex flex-col p-6 max-w-[1200px] mx-auto w-full min-h-screen bg-slate-50 dark:bg-[#161922] font-inter text-slate-800 dark:text-slate-200">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="m-0 font-inter text-2xl font-bold text-slate-900 dark:text-white leading-tight">Automated Report</h1>
            <p className="m-0 font-inter text-sm text-slate-500 dark:text-slate-400 mt-1">AI-generated operational analysis with detailed breakdowns</p>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          {report && (
            <>
              <button
                className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                onClick={handleExportPDF}
                disabled={exporting}
              >
                {exporting ? <RefreshCw size={16} className="spinning" /> : <Download size={16} />}
                {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
              <button className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer" onClick={handlePrint}>
                <Printer size={16} />
                Print
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-4 mb-6 shadow-sm flex flex-col md:flex-row md:items-end justify-between gap-4 no-print">
        <div className="flex flex-wrap items-end gap-3">
          {adminRole === 'admin' && (
            <div className="flex flex-col gap-1.5 relative">
              <div className="relative">
                <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select value={reportType} onChange={e => setReportType(e.target.value)} className="h-9 pl-9 pr-8 appearance-none bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none cursor-pointer focus:border-blue-500 transition-colors">
                  <option value="all">Comprehensive</option>
                  <option value="donations">Donations Only</option>
                  <option value="attendance">Attendance Only</option>
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          {branchesData.length > 0 && (
            <>
              <div className="flex flex-col gap-1.5 relative">
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select value={locationType} onChange={e => setLocationType(e.target.value)} className="h-9 pl-9 pr-8 appearance-none bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none cursor-pointer focus:border-blue-500 transition-colors">
                    <option value="all">All Locations</option>
                    <option value="province">By Province</option>
                    <option value="specific">Specific Communities</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {locationType === 'province' && (
                <div className="flex flex-col gap-1.5 relative" ref={provinceDropdownRef} style={{ position: 'relative' }}>
                  <div 
                    className="h-9 pl-3 pr-8 appearance-none bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none cursor-pointer focus:border-blue-500 transition-colors" 
                    style={{ minWidth: '180px', display: 'flex', alignItems: 'center', padding: '0 8px 0 0', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  >
                    <input
                      type="text"
                      placeholder={selectedProvinces.length > 0 ? `${selectedProvinces.length} selected` : 'Search Province...'}
                      value={provinceSearch}
                      onChange={e => {
                         setProvinceSearch(e.target.value);
                         setShowProvinceDropdown(true);
                      }}
                      onFocus={() => setShowProvinceDropdown(true)}
                      style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', padding: '8px 10px', fontSize: '13px', color: '#374151' }}
                    />
                    <ChevronDown size={12} className="absolute right-2.5 top-[55%] -translate-y-1/2 text-slate-400 pointer-events-none" style={{ position: 'static', cursor: 'pointer' }} onClick={() => setShowProvinceDropdown(!showProvinceDropdown)} />
                  </div>
                  
                  {showProvinceDropdown && (
                    <div className="absolute top-full left-0 w-full bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg shadow-lg z-50 max-h-[250px] overflow-y-auto mt-1 custom-scrollbar">
                      {filteredProvinces.map(p => (
                        <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f3f4f6', margin: 0 }}>
                          <input 
                            type="checkbox"
                            checked={selectedProvinces.includes(p)}
                            onChange={() => toggleProvince(p)}
                          />
                          {p}
                        </label>
                      ))}
                      {filteredProvinces.length === 0 && (
                        <div style={{ padding: '8px 12px', fontSize: '13px', color: '#6b7280' }}>No provinces found</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex flex-col gap-1.5 relative">
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select 
                value={periodMode === 'full' ? 'full' : periodMode === 'range' ? 'range' : `month-${reportMonth}`} 
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'full') setPeriodMode('full');
                  else if (val === 'range') setPeriodMode('range');
                  else {
                    setPeriodMode('month');
                    setReportMonth(val.replace('month-', ''));
                  }
                }} 
                className="h-9 pl-9 pr-8 appearance-none bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none cursor-pointer focus:border-blue-500 transition-colors"
              >
                <option value="full">Full Year</option>
                {MONTHS.map((m, i) => (
                  i <= maxSelectableMonth ? <option key={i} value={`month-${i}`}>{m}</option> : null
                ))}
                <option value="range">Custom Range...</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {periodMode === 'range' && (
            <>
              <div className="flex flex-col gap-1.5 relative">
                <span style={{fontSize: '13px', color: '#6b7280', paddingRight: '4px'}}>From</span>
                <select value={startMonth} onChange={e => { const v = Number(e.target.value); setStartMonth(v); if (v >= endMonth) setEndMonth(Math.min(v + 1, maxSelectableMonth)); }} className="h-9 pl-3 pr-8 appearance-none bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none cursor-pointer focus:border-blue-500 transition-colors" style={{ minWidth: '70px', paddingLeft: 0 }}>
                  {MONTHS.map((m, i) => (
                    i < maxSelectableMonth ? <option key={i} value={i}>{MONTH_SHORT[i]}</option> : null
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-[55%] -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <div className="flex flex-col gap-1.5 relative">
                <span style={{fontSize: '13px', color: '#6b7280', paddingRight: '4px'}}>To</span>
                <select value={endMonth} onChange={e => setEndMonth(Number(e.target.value))} className="h-9 pl-3 pr-8 appearance-none bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none cursor-pointer focus:border-blue-500 transition-colors" style={{ minWidth: '70px', paddingLeft: 0 }}>
                  {MONTHS.map((m, i) => (
                    i > startMonth && i <= maxSelectableMonth ? <option key={i} value={i}>{MONTH_SHORT[i]}</option> : null
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-[55%] -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5 relative">
            <select value={reportYear} onChange={e => setReportYear(Number(e.target.value))} className="h-9 pl-3 pr-8 appearance-none bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none cursor-pointer focus:border-blue-500 transition-colors">
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-[55%] -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <label className="flex items-center gap-2 font-inter text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer h-9 px-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg select-none hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            <input type="checkbox" checked={compareYoY} onChange={e => setCompareYoY(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/10 dark:bg-black/20 cursor-pointer" />
            Compare YoY
          </label>
        </div>

        <button
          className="h-10 px-6 rounded-lg font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 shadow-sm flex items-center gap-2 cursor-pointer"
          onClick={handleGenerateClick}
          disabled={loading}
        >
          {loading ? (
            <>
              <RefreshCw size={16} className="spinning" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate Report
            </>
          )}
        </button>
      </div>

      {/* ── Specific Communities Selector ── */}
      {locationType === 'specific' && branchesData.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 no-print">
          <p className="font-inter text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Select Communities (Multiple allowed):</p>
          <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto custom-scrollbar pr-2">
            {[...branchesData].sort((a, b) => a.name.localeCompare(b.name)).map(b => (
              <label key={b.name} className={`fin-report-branch-chip${selectedCommunities.includes(b.name) ? ' selected' : ''}`}>
                <input 
                  type="checkbox" 
                  checked={selectedCommunities.includes(b.name)} 
                  onChange={() => toggleCommunity(b.name)} 
                />
                <MapPin size={11} />
                <span>{b.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-6 dark:border-white/10 dark:border-t-blue-500" />
          <p className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">Analyzing financial data with AI...</p>
          <p className="m-0 font-inter text-sm text-slate-500 dark:text-slate-400 mt-2">This may take 10-15 seconds</p>
        </div>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <div className="p-6 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-xl font-inter text-sm flex items-center gap-3">
          <p>⚠️ {error}</p>
          <button onClick={generateReport}>Try Again</button>
        </div>
      )}

      {/* ── Report Content ── */}
      {report && !loading && (
        <div className="flex flex-col gap-6" ref={reportRef}>

          {/* Report Header (print/PDF) */}
          <div className="hidden print:block mb-8 pb-4 border-b-2 border-slate-800 dark:border-white">
            <h1>IsangDiwa Financial Report</h1>
            <p>Period: {report.period}</p>
            {report.community && <p>Location: {report.community}</p>}
            <p>Generated: {new Date(report.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>

          {/* Executive Summary */}
          <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center gap-3">
              <div className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 rounded text-[10px] font-bold uppercase tracking-wide">
                <Sparkles size={14} />
                AI Executive Summary
              </div>
              <span className="font-inter text-[13px] font-medium text-slate-500 dark:text-slate-400">{report.period}</span>
            </div>
            <div className="p-6">
              {report.executiveSummary?.split('\n').filter(Boolean).map((line, i) => {
                const isBullet = line.trim().startsWith('-') || line.trim().startsWith('•') || /^\d+\./.test(line.trim());
                return (
                  <p 
                    key={i} 
                    className={`fin-report-executive-para ${isBullet ? 'bullet' : ''}`}
                    style={isBullet ? { paddingLeft: '1.5rem', textIndent: '-1.2rem' } : {}}
                  >
                    {line}
                  </p>
                );
              })}
            </div>
          </div>

          {/* === Year-over-Year Comparative Analysis === */}
          {report.comparison && (
            <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center gap-3">
                <h2 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white flex items-center gap-2">📊 Year-over-Year Comparison</h2>
              </div>
              <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1"><strong>{report.comparison.currentPeriod}</strong> vs <strong>{report.comparison.prevPeriod}</strong></p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Donations Comparison */}
                {report.comparison.donations && (() => {
                  const d = report.comparison.donations;
                  const barData = [
                    { label: 'Total Amount', current: d.current, previous: d.previous },
                    { label: 'Transactions', current: d.currentCount, previous: d.previousCount },
                  ];
                  return (
                    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                      <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Donations — Period Over Period</h3>
                      <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">
                        Current: <strong>{fmt(d.current)}</strong> · Previous: <strong>{fmt(d.previous)}</strong>
                        {d.change !== null && <> · Change: <strong className={d.change >= 0 ? 'fin-change-positive' : 'fin-change-negative'}>{d.change >= 0 ? '+' : ''}{d.change}%</strong></>}
                      </p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={barData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} allowDecimals={false} />
                          <Tooltip formatter={v => typeof v === 'number' && v >= 100 ? fmt(v) : v} />
                          <Bar name={report.comparison.currentPeriod} dataKey="current" fill="#0D1F45" radius={[4, 4, 0, 0]} barSize={28}>
                            <LabelList dataKey="current" position="top" formatter={v => v >= 1000 ? fmtShort(v) : v} style={{ fontSize: 10, fill: '#0D1F45', fontWeight: 700 }} />
                          </Bar>
                          <Bar name={report.comparison.prevPeriod} dataKey="previous" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={28}>
                            <LabelList dataKey="previous" position="top" formatter={v => v >= 1000 ? fmtShort(v) : v} style={{ fontSize: 10, fill: '#93c5fd' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#0D1F45' }} />
                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{report.comparison.currentPeriod}</span>
                          <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>({fmt(report.comparison.donations.current)})</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#93c5fd' }} />
                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{report.comparison.prevPeriod}</span>
                          <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>({fmt(report.comparison.donations.previous)})</span>
                        </div>
                      </div>
                      <ChartFooter period={`${report.comparison.currentPeriod} vs ${report.comparison.prevPeriod}`} location={getLocationLabel()} />
                    </div>
                  );
                })()}

                {/* Attendance Comparison */}
                {report.comparison.attendance && (() => {
                  const a = report.comparison.attendance;
                  const barData = [{ label: 'Total Attendance', current: a.current, previous: a.previous }];
                  return (
                    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                      <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Attendance — Period Over Period</h3>
                      <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">
                        Current: <strong>{a.current} attendees</strong> · Previous: <strong>{a.previous} attendees</strong>
                        {a.change !== null && <> · Change: <strong className={a.change >= 0 ? 'fin-change-positive' : 'fin-change-negative'}>{a.change >= 0 ? '+' : ''}{a.change}%</strong></>}
                      </p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={barData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <Tooltip />
                          <Bar name={report.comparison.currentPeriod} dataKey="current" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={36}>
                            <LabelList dataKey="current" position="top" style={{ fontSize: 11, fill: '#2563eb', fontWeight: 700 }} />
                          </Bar>
                          <Bar name={report.comparison.prevPeriod} dataKey="previous" fill="#bfdbfe" radius={[4, 4, 0, 0]} barSize={36}>
                            <LabelList dataKey="previous" position="top" style={{ fontSize: 11, fill: '#93c5fd' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#2563eb' }} />
                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{report.comparison.currentPeriod}</span>
                          <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>({a.current} attendees)</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#bfdbfe' }} />
                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{report.comparison.prevPeriod}</span>
                          <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>({a.previous} attendees)</span>
                        </div>
                      </div>
                      <ChartFooter period={`${report.comparison.currentPeriod} vs ${report.comparison.prevPeriod}`} location={getLocationLabel()} />
                    </div>
                  );
                })()}
              </div>

              {/* Loans Comparison */}
              {report.comparison.loans && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{marginTop: '16px'}}>
                  <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Loans — Period Over Period</h3>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">
                      Applications: <strong>{report.comparison.loans.currentApps}</strong> vs <strong>{report.comparison.loans.previousApps}</strong>
                      {report.comparison.loans.changeApps !== null && <> (<strong className={report.comparison.loans.changeApps >= 0 ? 'fin-change-positive' : 'fin-change-negative'}>{report.comparison.loans.changeApps >= 0 ? '+' : ''}{report.comparison.loans.changeApps}%</strong>)</>}
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={[
                        { label: 'Applications', current: report.comparison.loans.currentApps, previous: report.comparison.loans.previousApps },
                        { label: 'Disbursed', current: report.comparison.loans.currentDisbursed, previous: report.comparison.loans.previousDisbursed },
                        { label: 'Collected', current: report.comparison.loans.currentCollected, previous: report.comparison.loans.previousCollected },
                      ]} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} allowDecimals={false} />
                        <Tooltip formatter={v => typeof v === 'number' && v >= 100 ? fmt(v) : v} />
                        <Bar name={report.comparison.currentPeriod} dataKey="current" fill="#0D1F45" radius={[4, 4, 0, 0]} barSize={24}>
                          <LabelList dataKey="current" position="top" formatter={v => v >= 1000 ? fmtShort(v) : v} style={{ fontSize: 9, fill: '#0D1F45', fontWeight: 700 }} />
                        </Bar>
                        <Bar name={report.comparison.prevPeriod} dataKey="previous" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={24}>
                          <LabelList dataKey="previous" position="top" formatter={v => v >= 1000 ? fmtShort(v) : v} style={{ fontSize: 9, fill: '#93c5fd' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                      <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#0D1F45' }} />
                        <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{report.comparison.currentPeriod}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#93c5fd' }} />
                        <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{report.comparison.prevPeriod}</span>
                      </div>
                    </div>
                    <ChartFooter period={`${report.comparison.currentPeriod} vs ${report.comparison.prevPeriod}`} location={getLocationLabel()} />
                  </div>
                </div>
              )}

              {/* Disbursements Comparison */}
              {report.comparison.disbursements && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{marginTop: '16px'}}>
                  <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Disbursements — Period Over Period</h3>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">
                      Current: <strong>{fmt(report.comparison.disbursements.current)}</strong> · Previous: <strong>{fmt(report.comparison.disbursements.previous)}</strong>
                      {report.comparison.disbursements.change !== null && <> · Change: <strong className={report.comparison.disbursements.change >= 0 ? 'fin-change-positive' : 'fin-change-negative'}>{report.comparison.disbursements.change >= 0 ? '+' : ''}{report.comparison.disbursements.change}%</strong></>}
                    </p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={[
                        { label: 'Amount', current: report.comparison.disbursements.current, previous: report.comparison.disbursements.previous },
                        { label: 'Count', current: report.comparison.disbursements.currentCount, previous: report.comparison.disbursements.previousCount },
                      ]} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} allowDecimals={false} />
                        <Tooltip formatter={v => typeof v === 'number' && v >= 100 ? fmt(v) : v} />
                        <Bar name={report.comparison.currentPeriod} dataKey="current" fill="#0D1F45" radius={[4, 4, 0, 0]} barSize={36}>
                          <LabelList dataKey="current" position="top" formatter={v => v >= 1000 ? fmtShort(v) : v} style={{ fontSize: 10, fill: '#0D1F45', fontWeight: 700 }} />
                        </Bar>
                        <Bar name={report.comparison.prevPeriod} dataKey="previous" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={36}>
                          <LabelList dataKey="previous" position="top" formatter={v => v >= 1000 ? fmtShort(v) : v} style={{ fontSize: 10, fill: '#93c5fd' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                      <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#0D1F45' }} />
                        <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{report.comparison.currentPeriod}</span>
                        <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>({fmt(report.comparison.disbursements.current)})</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#93c5fd' }} />
                        <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{report.comparison.prevPeriod}</span>
                        <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>({fmt(report.comparison.disbursements.previous)})</span>
                      </div>
                    </div>
                    <ChartFooter period={`${report.comparison.currentPeriod} vs ${report.comparison.prevPeriod}`} location={getLocationLabel()} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Donations Section - Only for Super Admin */}
          {report.donations && adminRole === 'admin' && (report.reportType === 'all' || report.reportType === 'donations') && (
            <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center gap-3">
                <h2 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white flex items-center gap-2">💝 Donations Overview</h2>
              </div>

              {/* Donation Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Donations</span>
                  <span className="font-inter font-bold text-[32px] text-blue-600 dark:text-blue-400 mt-1">{fmt(report.donations.total)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Transaction Count</span>
                  <span className="font-inter font-bold text-[32px] text-slate-900 dark:text-white mt-1">{report.donations.count}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Avg per Transaction</span>
                  <span className="font-inter font-bold text-[32px] text-emerald-600 dark:text-emerald-400 mt-1">
                    {fmt(report.donations.count > 0 ? report.donations.total / report.donations.count : 0)}
                  </span>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: report.donations.byCategory?.length > 0 ? '4fr 6fr' : '1fr' }}>
                {/* By Category */}
                {report.donations.byCategory?.length > 0 && (
                  <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Donations By Category</h3>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Total: <strong>{fmt(report.donations.total)}</strong> · {report.donations.byCategory.length} categories</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={report.donations.byCategory} cx="50%" cy="42%" innerRadius={35} outerRadius={75} paddingAngle={2} dataKey="value" nameKey="name" label={renderSliceLabel} labelLine={false}>
                          {report.donations.byCategory.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                      {report.donations.byCategory.map((cat, i) => (
                        <div key={i} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{cat.name}</span>
                          <span className="font-bold text-slate-800 dark:text-white ml-1">{fmt(cat.value)} · {report.donations.total > 0 ? ((cat.value / report.donations.total) * 100).toFixed(0) : 0}%</span>
                        </div>
                      ))}
                    </div>
                    <ChartFooter period={report.period} location={getLocationLabel()} />
                  </div>
                )}

                {/* Monthly Donation Trend (Row 1) */}
                {(() => {
                  const byMonthMap = {};
                  (report.donations.byMonth || []).forEach(d => { byMonthMap[d.month] = d.value; });
                  const { from, to } = getChartMonthRange();

                  const bmp = report.donations.byMonthByProvince || {};
                  const availableProvinces = [...new Set(Object.values(bmp).flatMap(obj => Object.keys(obj)))].sort();
                  const showProvinceTrend = availableProvinces.length >= 2;

                  let allSeries = [];
                  let dataMap = {};
                  let chartTitle = 'Monthly Donation Trend';

                  if (showProvinceTrend) {
                    allSeries = availableProvinces;
                    dataMap = bmp;
                    chartTitle = `Monthly Donation Trend (By Province)`;
                  } else {
                    allSeries = [];
                    dataMap = {};
                    chartTitle = `Monthly Donation Trend`;
                  }

                  const isMulti = allSeries.length >= 2;

                  const seriesWithData = allSeries.filter(s => Object.values(dataMap).some(monthObj => (monthObj[s] || 0) > 0));

                  const fullMonthData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                    const i = from + idx;
                    const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                    const row = { month: label, value: byMonthMap[key] || 0 };
                    if (isMulti && dataMap[key]) {
                      allSeries.forEach(s => { row[s] = dataMap[key][s] || 0; });
                    }
                    return row;
                  });

                  const totalDon = fullMonthData.reduce((s, d) => s + d.value, 0);
                  const highestMon = fullMonthData.reduce((a, b) => b.value > a.value ? b : a, fullMonthData[0]);
                  
                  return (
                    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                      <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">{chartTitle}</h3>
                      <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Total: <strong>{fmt(totalDon)}</strong> · Highest: <strong>{highestMon?.month}</strong> ({fmt(highestMon?.value)})</p>
                      <ResponsiveContainer width="100%" height={isMulti ? 280 : 220}>
                        {isMulti ? (
                          <BarChart data={fullMonthData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                              <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                            </YAxis>
                            <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                            {allSeries.map((s, i) => (
                              <Bar key={s} dataKey={s} fill={COMMUNITY_COLORS[i % COMMUNITY_COLORS.length]} />
                            ))}
                          </BarChart>
                        ) : (
                          <BarChart data={fullMonthData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                              <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                            </YAxis>
                            <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                            <Bar dataKey="value" fill="#0D1F45" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="value" position="top" formatter={v => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 10, fill: '#6B7280' }} />
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                      {isMulti && (() => {
                        const branchToProv = {};
                        branchesData.forEach(b => {
                          branchToProv[b.name] = b.province || (b.address ? b.address.split(',')[0].trim() : 'Unknown');
                        });
                        const seriesByProv = {};
                        allSeries.forEach((s, i) => {
                          const prov = showProvinceTrend ? s : (branchToProv[s] || 'Unknown');
                          if (!seriesByProv[prov]) seriesByProv[prov] = [];
                          seriesByProv[prov].push({ name: s, index: i });
                        });
                        
                        return (
                          <div className="flex gap-8 mt-6 pt-4 border-t border-slate-100 dark:border-white/5" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '16px' }}>
                            {Object.entries(seriesByProv).map(([prov, seriesList]) => {
                              const activeSeries = seriesList.filter(s => seriesWithData.includes(s.name));
                              if (activeSeries.length === 0) return null;
                              return (
                                <div key={prov} className="flex flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                                  {!showProvinceTrend && (
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '2px' }}>
                                      {prov}
                                    </div>
                                  )}
                                  {activeSeries.map((s) => {
                                    const totalVal = fullMonthData.reduce((sum, row) => sum + (row[s.name] || 0), 0);
                                    return (
                                      <div key={s.name} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMMUNITY_COLORS[s.index % COMMUNITY_COLORS.length] }} />
                                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{s.name}</span>
                                          <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>({fmt(totalVal)})</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                            {allSeries.some(s => !seriesWithData.includes(s)) && (
                              <div style={{ width: '100%', fontSize: '11px', color: '#9CA3AF', marginTop: '8px', fontStyle: 'italic' }}>
                                No donations: {allSeries.filter(s => !seriesWithData.includes(s)).join(', ')}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <ChartFooter period={report.period} location={getLocationLabel()} />
                    </div>
                  );
                })()}
              </div>

              {/* Monthly Donation Trend (Row 2 - By Community) */}
              {(() => {
                const bmc = report.donations.byMonthByCommunity || {};
                const allSeries = [...new Set(Object.values(bmc).flatMap(obj => Object.keys(obj)))].sort();
                const shouldShowRow2 = allSeries.length >= 1;
                if (!shouldShowRow2) return null;

                // ↓ NEW: limit to top 10
                const { from, to } = getChartMonthRange();
                const { topSeries, otherSeries, fullMonthData, totals, hasOthers } = buildTopNSeriesData({
                  seriesKeys: allSeries,
                  dataMap: bmc,
                  reportYear,
                  from,
                  to,
                  maxSeries: 10,
                });

                // totals for summary
                const totalDon = fullMonthData.reduce((s, d) => {
                  return s + topSeries.reduce((sum, key) => sum + (d[key] || 0), 0) + (d['Others'] || 0);
                }, 0);
                const highestMon = fullMonthData.reduce((a, b) => {
                  const aVal = topSeries.reduce((s, k) => s + (a[k] || 0), 0) + (a['Others'] || 0);
                  const bVal = topSeries.reduce((s, k) => s + (b[k] || 0), 0) + (b['Others'] || 0);
                  return bVal > aVal ? b : a;
                }, fullMonthData[0]);


                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '1fr', marginTop: '16px' }}>
                    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]" style={{ width: '100%' }}>
                      <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Monthly Donation Trend (By Community)</h3>
                      <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">
                        Detailed Community Breakdown · Total: <strong>{fmt(totalDon)}</strong> · Highest: <strong>{highestMon?.month}</strong>
                        {hasOthers && <> · Showing top 10 of {allSeries.length} communities</>}
                      </p>

                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={fullMonthData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis
                            tick={{ fontSize: 10 }}
                            tickFormatter={v => `₱${(v/1000).toFixed(0)}k`}
                            allowDecimals={false}
                          >
                            <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                          </YAxis>
                          <Tooltip formatter={(v, name) => [fmt(v), name === 'Others' ? `Others (${otherSeries.length} communities)` : name]} />
                          {topSeries.map((s, i) => (
                            <Bar key={s} dataKey={s} stackId="a" fill={COMMUNITY_COLORS[i % COMMUNITY_COLORS.length]} />
                          ))}
                          {hasOthers && (
                            <Bar key="Others" dataKey="Others" stackId="a" fill="#d1d5db" name="Others" />
                          )}
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Legend — grouped by province */}
                      {(() => {
                        const branchToProv = {};
                        branchesData.forEach(b => {
                          branchToProv[b.name] = b.province || 'Unknown';
                        });
                        const seriesByProv = {};
                        topSeries.forEach((s, i) => {
                          const prov = branchToProv[s] || 'Unknown';
                          if (!seriesByProv[prov]) seriesByProv[prov] = [];
                          seriesByProv[prov].push({ name: s, index: i, total: totals[s] });
                        });
                        return (
                          <div className="flex gap-8 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                            {Object.entries(seriesByProv).map(([prov, seriesList]) => (
                              <div key={prov} className="flex flex-col gap-2">
                                <div className="font-inter text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide border-b border-slate-100 dark:border-white/5 pb-1 mb-1">{prov}</div>
                                {seriesList.map(s => (
                                  <div key={s.name} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0 }}>
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMMUNITY_COLORS[s.index % COMMUNITY_COLORS.length] }} />
                                    <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{s.name}</span>
                                    <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '4px' }}>({fmt(s.total)})</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                            {hasOthers && (
                              <div className="flex flex-col gap-2">
                                <div className="font-inter text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide border-b border-slate-100 dark:border-white/5 pb-1 mb-1">Others</div>
                                <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0 }}>
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#d1d5db' }} />
                                  <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{otherSeries.length} more communities</span>
                                  <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '4px' }}>
                                    ({fmt(otherSeries.reduce((s, k) => s + totals[k], 0))})
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {hasOthers && (
                        <p className="block font-inter text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
                          ℹ️ Chart shows top 10 communities by total donation. {otherSeries.length} smaller communities
                          ({otherSeries.join(', ')}) are merged into "Others".
                        </p>
                      )}

                      <ChartFooter period={report.period} location={getLocationLabel()} />
                    </div>
                  </div>
                );
              })()}

              {/* Top Communities & Top 8 Donators Side-by-Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Donor Communities Bar Chart */}
                {report.donations.byBranch?.length > 0 && (
                  <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Top Donor Communities</h3>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Top: <strong>{report.donations.byBranch[0]?.branch}</strong> · {fmt(report.donations.byBranch[0]?.value)} ({report.donations.total > 0 ? ((report.donations.byBranch[0]?.value / report.donations.total) * 100).toFixed(1) : 0}%)</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={report.donations.byBranch.slice(0, 8)} margin={{ top: 15, right: 10, left: -10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="branch" tick={{ fontSize: 9, angle: -35, textAnchor: 'end' }} interval={0} height={60} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                          <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                        </YAxis>
                        <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={28}>
                          {report.donations.byBranch.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={i === 0 ? '#3b82f6' : '#0D1F45'} />
                          ))}
                          <LabelList dataKey="value" position="top" formatter={v => fmtShort(v)} style={{ fontSize: 10, fill: '#6B7280' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <ChartFooter period={report.period} location={getLocationLabel()} />
                  </div>
                )}

                {/* Top 8 Donators */}
                {report.donations?.byDonor?.length > 0 && (() => {
                  const topDonors = report.donations.byDonor.slice(0, 8);
                  return (
                  <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Top {topDonors.length} Donators</h3>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">#1: <strong>{topDonors[0]?.donor}</strong> · {fmt(topDonors[0]?.value)} ({report.donations.total > 0 ? ((topDonors[0]?.value / report.donations.total) * 100).toFixed(0) : 0}%)</p>
                    <ResponsiveContainer width="100%" height={Math.max(220, topDonors.length * 32)}>
                      <BarChart data={topDonors} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`}>
                          <Label value="Amount (₱)" position="bottom" offset={-5} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                        </XAxis>
                        <YAxis type="category" dataKey="donor" tick={{ fontSize: 10 }} width={120} />
                        <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                          {topDonors.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? '#2563eb' : '#0D1F45'} />
                          ))}
                          <LabelList dataKey="value" position="right" formatter={v => fmtShort(v)} style={{ fontSize: 10, fill: '#6B7280' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                      {topDonors.slice(0, 5).map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: i === 0 ? '#2563eb' : '#0D1F45' }} />
                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{d.donor}</span>
                          <span className="font-bold text-slate-800 dark:text-white ml-1">{fmt(d.value)} · {report.donations.total > 0 ? ((d.value / report.donations.total) * 100).toFixed(0) : 0}%</span>
                        </div>
                      ))}
                    </div>
                    <ChartFooter period={report.period} location={getLocationLabel()} />
                  </div>
                  );
                })()}
              </div>

              {/* Full Width Community Table */}
              {report.donations.byBranch?.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '1fr', marginTop: '16px' }}>
                  <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col overflow-hidden">
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Donations Breakdown By Community</h3>
                    <div className="w-full overflow-x-auto custom-scrollbar" style={{ maxHeight: '400px' }}>
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Community</th>
                            <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Amount</th>
                            <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">% of Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.donations.byBranch.map((b, i) => (
                            <tr key={i}>
                              <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{b.branch}</td>
                              <td className="amount">{fmt(b.value)}</td>
                              <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{report.donations.total > 0 ? ((b.value / report.donations.total) * 100).toFixed(1) : 0}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Attendance Trends */}
              {report.attendance?.byMonth?.length > 0 && (() => {
                const byMonthMap = {};
                (report.attendance.byMonth || []).forEach(d => { byMonthMap[d.month] = d.count; });
                const { from, to } = getChartMonthRange();
                const bmc = report.attendance.byMonthByCommunity || {};
                const allCommunities = [...new Set(Object.values(bmc).flatMap(obj => Object.keys(obj)))].sort();
                const isMulti = allCommunities.length >= 2;

                if (!isMulti) return null; // handled by the row-1 chart

                const { topSeries, otherSeries, fullMonthData, totals, hasOthers } = buildTopNSeriesData({
                  seriesKeys: allCommunities,
                  dataMap: bmc,
                  reportYear,
                  from,
                  to,
                  maxSeries: 10,
                });

                const totalAtt = fullMonthData.reduce((s, d) =>
                  s + topSeries.reduce((sum, k) => sum + (d[k] || 0), 0) + (d['Others'] || 0), 0);
                const highestMon = fullMonthData.reduce((a, b) => {
                  const aVal = topSeries.reduce((s, k) => s + (a[k] || 0), 0) + (a['Others'] || 0);
                  const bVal = topSeries.reduce((s, k) => s + (b[k] || 0), 0) + (b['Others'] || 0);
                  return bVal > aVal ? b : a;
                }, fullMonthData[0]);

                return fullMonthData.some(d => topSeries.some(k => d[k] > 0)) ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '1fr', marginTop: '16px' }}>
                    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]" style={{ width: '100%' }}>
                      <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Monthly Attendance Trend (By Community)</h3>
                      <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">
                        Detailed Community Breakdown · Total: <strong>{totalAtt} attendees</strong> · Highest: <strong>{highestMon?.month}</strong>
                        {hasOthers && <> · Showing top 10 of {allCommunities.length} communities</>}
                      </p>

                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={fullMonthData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false}>
                            <Label value="Attendees" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                          </YAxis>
                          <Tooltip formatter={(v, name) => [
                            `${v} attendees`,
                            name === 'Others' ? `Others (${otherSeries.length} communities)` : name
                          ]} />
                          {topSeries.map((s, i) => (
                            <Bar key={s} dataKey={s} stackId="a" fill={COMMUNITY_COLORS[i % COMMUNITY_COLORS.length]} />
                          ))}
                          {hasOthers && (
                            <Bar key="Others" dataKey="Others" stackId="a" fill="#d1d5db" name="Others" />
                          )}
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Legend grouped by province */}
                      {(() => {
                        const branchToProv = {};
                        branchesData.forEach(b => { branchToProv[b.name] = b.province || 'Unknown'; });
                        const seriesByProv = {};
                        topSeries.forEach((s, i) => {
                          const prov = branchToProv[s] || 'Unknown';
                          if (!seriesByProv[prov]) seriesByProv[prov] = [];
                          seriesByProv[prov].push({ name: s, index: i, total: totals[s] });
                        });
                        return (
                          <div className="flex gap-8 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                            {Object.entries(seriesByProv).map(([prov, comms]) => (
                              <div key={prov} className="flex flex-col gap-2">
                                <div className="font-inter text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide border-b border-slate-100 dark:border-white/5 pb-1 mb-1">{prov}</div>
                                {comms.map(c => (
                                  <div key={c.name} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0 }}>
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMMUNITY_COLORS[c.index % COMMUNITY_COLORS.length] }} />
                                    <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{c.name}</span>
                                    <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '4px' }}>({c.total} attendees)</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                            {hasOthers && (
                              <div className="flex flex-col gap-2">
                                <div className="font-inter text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide border-b border-slate-100 dark:border-white/5 pb-1 mb-1">Others</div>
                                <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0 }}>
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#d1d5db' }} />
                                  <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{otherSeries.length} more communities</span>
                                  <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '4px' }}>
                                    ({otherSeries.reduce((s, k) => s + totals[k], 0)} attendees)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {hasOthers && (
                        <p className="block font-inter text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
                          ℹ️ Chart shows top 10 communities by total attendance. {otherSeries.length} smaller
                          communities are merged into "Others" for readability.
                        </p>
                      )}

                      <ChartFooter period={report.period} location={getLocationLabel()} />
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {/* Loans Section - Only for Loan Admin */}
          {report.loans && adminRole === 'loanAdmin' && (
            <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center gap-3">
                <h2 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white flex items-center gap-2">💳 Loans Portfolio</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Applications</span>
                  <span className="font-inter font-bold text-[32px] text-slate-900 dark:text-white mt-1">{report.loans.totalApplications}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Amount Applied</span>
                  <span className="font-inter font-bold text-[32px] text-blue-600 dark:text-blue-400 mt-1">{fmt(report.loans.totalAmountApplied)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Disbursed</span>
                  <span className="font-inter font-bold text-[32px] text-slate-900 dark:text-white mt-1">{fmt(report.loans.totalDisbursed)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Payments Received</span>
                  <span className="font-inter font-bold text-[32px] text-emerald-600 dark:text-emerald-400 mt-1">{fmt(report.loans.totalPaymentsReceived)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Interest Earned</span>
                  <span className="font-inter font-bold text-[32px] text-purple-600 dark:text-purple-400 mt-1">{fmt(report.loans.totalInterestEarned)}</span>
                </div>
              </div>

              {/* Loan Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '3fr 7fr' }}>
                {/* Loan Status Donut */}
                {report.loans.byStatus?.length > 0 && (
                  <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Loan Status Distribution</h3>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Total: <strong>{report.loans.totalApplications} applications</strong> · {report.loans.byStatus.length} statuses</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={report.loans.byStatus.map(s => ({ name: s.status, value: s.count }))}
                          cx="50%" cy="42%"
                          innerRadius={35} outerRadius={75}
                          paddingAngle={2}
                          dataKey="value"
                          label={renderSliceLabel}
                          labelLine={false}
                        >
                          {report.loans.byStatus.map((s, i) => (
                            <Cell key={i} fill={getStatusColor(s.status)} />
                          ))}
                          <Label value={report.loans.totalApplications} position="center" fill="#1e3a5f" style={{ fontSize: '18px', fontWeight: 'bold' }} />
                          <Label value="Total" position="center" dy={16} fill="#6B7280" style={{ fontSize: '10px' }} />
                        </Pie>
                        <Tooltip formatter={(v, name) => [v + ' loans', name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                      {report.loans.byStatus.map((s, i) => {
                        const total = report.loans.totalApplications || 1;
                        const pct = ((s.count / total) * 100).toFixed(0);
                        return (
                          <div key={i} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: getStatusColor(s.status) }} />
                            <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{s.status}</span>
                            <span className="font-bold text-slate-800 dark:text-white ml-1">{s.count} loans · {pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                    <ChartFooter period={report.period} location={getLocationLabel()} />
                  </div>
                )}

                {/* Monthly Disbursement vs Collection (Row 1) */}
                {(() => {
                  const { from, to } = getChartMonthRange();
                  const byMonthMap = {};
                  (report.loans.byMonth || []).forEach(d => { byMonthMap[d.month] = d; });
                  
                  const provDisbMap = report.loans.byMonthByProvince?.disbursed || {};
                  const provCollMap = report.loans.byMonthByProvince?.collected || {};
                  const availableProvinces = [...new Set([...Object.values(provDisbMap), ...Object.values(provCollMap)].flatMap(obj => Object.keys(obj)))].sort();
                  const showProvinceTrend = availableProvinces.length >= 2;
                  const disbMap = showProvinceTrend ? provDisbMap : (report.loans.byMonthByCommunity?.disbursed || {});
                  const collMap = showProvinceTrend ? provCollMap : (report.loans.byMonthByCommunity?.collected || {});
                  
                  let allSeries = [...new Set([...Object.values(disbMap), ...Object.values(collMap)].flatMap(obj => Object.keys(obj)))].sort();
                  const isMulti = allSeries.length >= 2;

                  // Filter communities/provinces with actual data
                  const seriesWithData = allSeries.filter(s => {
                    return Object.values(disbMap).some(monthObj => (monthObj[s] || 0) > 0) || Object.values(collMap).some(monthObj => (monthObj[s] || 0) > 0);
                  });

                  const chartTitle = `Monthly Disbursement vs Collection ${allSeries.length >= 2 ? (showProvinceTrend ? '(By Province)' : '(By Community)') : ''}`;

                  const trendData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                    const i = from + idx;
                    const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                    const existing = byMonthMap[key];
                    const row = { month: key, label, disbursed: existing?.disbursed || 0, received: existing?.received || 0 };
                    if (isMulti) {
                      allSeries.forEach(s => {
                        row[`disb_${s}`] = disbMap[key]?.[s] || 0;
                        row[`coll_${s}`] = collMap[key]?.[s] || 0;
                      });
                    }
                    return row;
                  });

                  return trendData.length > 0 ? (
                    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]" style={{ width: '100%' }}>
                      <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">{chartTitle}</h3>
                      <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Disbursed: <strong>{fmt(trendData.reduce((s, d) => s + d.disbursed, 0))}</strong> · Collected: <strong>{fmt(trendData.reduce((s, d) => s + d.received, 0))}</strong></p>
                      <ResponsiveContainer width="100%" height={isMulti ? 300 : 250}>
                        {isMulti ? (
                          <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                              <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                            </YAxis>
                            <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                            {seriesWithData.map((s) => {
                              const origIdx = allSeries.indexOf(s);
                              return <Bar key={`disb_${s}`} dataKey={`disb_${s}`} name={`${s} (Disbursed)`} fill={COMMUNITY_COLORS[origIdx % COMMUNITY_COLORS.length]} />;
                            })}
                            {seriesWithData.map((s) => {
                              const origIdx = allSeries.indexOf(s);
                              return <Bar key={`coll_${s}`} dataKey={`coll_${s}`} name={`${s} (Collected)`} fill={COMMUNITY_COLORS[origIdx % COMMUNITY_COLORS.length]} fillOpacity={0.6} />;
                            })}
                          </BarChart>
                        ) : (
                          <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                              <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                            </YAxis>
                            <Tooltip formatter={v => fmt(v)} labelFormatter={(v, payload) => payload?.[0]?.payload?.label || v} />
                            <Bar name="Disbursed" dataKey="disbursed" fill="#0D1F45" radius={[4, 4, 0, 0]} barSize={20}>
                              <LabelList dataKey="disbursed" position="top" formatter={v => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fill: '#6B7280' }} />
                            </Bar>
                            <Bar name="Collected" dataKey="received" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20}>
                              <LabelList dataKey="received" position="top" formatter={v => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fill: '#6B7280' }} />
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                      {isMulti && (() => {
                        const branchToProv = {};
                        branchesData.forEach(b => {
                          branchToProv[b.name] = b.province || (b.address ? b.address.split(',')[0].trim() : 'Unknown');
                        });
                        const seriesByProv = {};
                        allSeries.forEach((s, i) => {
                          const prov = showProvinceTrend ? s : (branchToProv[s] || 'Unknown');
                          if (!seriesByProv[prov]) seriesByProv[prov] = [];
                          const hasData = seriesWithData.includes(s);
                          seriesByProv[prov].push({ name: s, index: i, hasData });
                        });
                        
                        return (
                          <div className="flex gap-8 mt-6 pt-4 border-t border-slate-100 dark:border-white/5" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '16px' }}>
                            {Object.entries(seriesByProv).map(([prov, seriesList]) => {
                              const activeSeries = seriesList.filter(s => s.hasData);
                              if (activeSeries.length === 0) return null;
                              return (
                                <div key={prov} className="flex flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                                  {!showProvinceTrend && (
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '2px' }}>
                                      {prov}
                                    </div>
                                  )}
                                  {activeSeries.map((s) => {
                                    const totalDisb = trendData.reduce((sum, row) => sum + (row['disb_' + s.name] || 0), 0);
                                    const totalColl = trendData.reduce((sum, row) => sum + (row['coll_' + s.name] || 0), 0);
                                    return (
                                      <div key={s.name} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMMUNITY_COLORS[s.index % COMMUNITY_COLORS.length] }} />
                                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{s.name}</span>
                                          <span style={{ fontSize: '9px', color: '#4b5563', marginLeft: '6px' }}>(Disb: {fmt(totalDisb)} · Coll: {fmt(totalColl)})</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                            {allSeries.some(s => !seriesWithData.includes(s)) && (
                              <div style={{ width: '100%', fontSize: '11px', color: '#9CA3AF', marginTop: '8px', fontStyle: 'italic' }}>
                                No loans: {allSeries.filter(s => !seriesWithData.includes(s)).join(', ')}
                              </div>
                            )}
                            <div style={{ width: '100%', fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
                              <em>Note: For each month, the left bar is Disbursed (solid) and the right bar is Collected (lighter color).</em>
                            </div>
                          </div>
                        );
                      })()}
                      <ChartFooter period={report.period} location={getLocationLabel()} />
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Monthly Disbursement vs Collection (Row 2 - By Community) */}
              {(() => {
                const provDisbMap2 = report.loans.byMonthByProvince?.disbursed || {};
                const provCollMap2 = report.loans.byMonthByProvince?.collected || {};
                const availProv2 = [...new Set([...Object.values(provDisbMap2), ...Object.values(provCollMap2)].flatMap(obj => Object.keys(obj)))].sort();
                const shouldShowRow2 = availProv2.length >= 2;
                if (!shouldShowRow2) return null;
                return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '1fr' }}>
                  {(() => {
                    const { from, to } = getChartMonthRange();
                    const byMonthMap = {};
                    (report.loans.byMonth || []).forEach(d => { byMonthMap[d.month] = d; });
                    
                    const disbMap = report.loans.byMonthByCommunity?.disbursed || {};
                    const collMap = report.loans.byMonthByCommunity?.collected || {};
                    
                    let allSeries = [...new Set([...Object.values(disbMap), ...Object.values(collMap)].flatMap(obj => Object.keys(obj)))].sort();
                    const chartTitle = `Monthly Disbursement vs Collection (By Community)`;
                    const isMulti = allSeries.length >= 2;

                    // Filter communities with actual data
                    const seriesWithData = allSeries.filter(s => {
                      return Object.values(disbMap).some(monthObj => (monthObj[s] || 0) > 0) || Object.values(collMap).some(monthObj => (monthObj[s] || 0) > 0);
                    });

                    const trendData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                      const i = from + idx;
                      const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                      const existing = byMonthMap[key];
                      const row = { month: key, label, disbursed: existing?.disbursed || 0, received: existing?.received || 0 };
                      if (isMulti) {
                        seriesWithData.forEach(s => {
                          row[`disb_${s}`] = disbMap[key]?.[s] || 0;
                          row[`coll_${s}`] = collMap[key]?.[s] || 0;
                        });
                      }
                      return row;
                    });

                    return trendData.length > 0 ? (
                      <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]" style={{ width: '100%' }}>
                        <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">{chartTitle}</h3>
                        <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Detailed Community Breakdown · Disbursed: <strong>{fmt(trendData.reduce((s, d) => s + d.disbursed, 0))}</strong> · Collected: <strong>{fmt(trendData.reduce((s, d) => s + d.received, 0))}</strong></p>
                        <ResponsiveContainer width="100%" height={isMulti ? 300 : 250}>
                          {isMulti ? (
                            <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                                <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                              </YAxis>
                              <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                              {seriesWithData.map((s) => {
                                const origIdx = allSeries.indexOf(s);
                                return <Bar key={`disb_${s}`} dataKey={`disb_${s}`} name={`${s} (Disbursed)`} fill={COMMUNITY_COLORS[origIdx % COMMUNITY_COLORS.length]} />;
                              })}
                              {seriesWithData.map((s) => {
                                const origIdx = allSeries.indexOf(s);
                                return <Bar key={`coll_${s}`} dataKey={`coll_${s}`} name={`${s} (Collected)`} fill={COMMUNITY_COLORS[origIdx % COMMUNITY_COLORS.length]} fillOpacity={0.6} />;
                              })}
                            </BarChart>
                          ) : (
                            <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                                <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                              </YAxis>
                              <Tooltip formatter={v => fmt(v)} labelFormatter={(v, payload) => payload?.[0]?.payload?.label || v} />
                              <Bar name="Disbursed" dataKey="disbursed" fill="#0D1F45" radius={[4, 4, 0, 0]} barSize={20}>
                                <LabelList dataKey="disbursed" position="top" formatter={v => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fill: '#6B7280' }} />
                              </Bar>
                              <Bar name="Collected" dataKey="received" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20}>
                                <LabelList dataKey="received" position="top" formatter={v => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fill: '#6B7280' }} />
                              </Bar>
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                        {isMulti && (() => {
                          const branchToProv = {};
                          branchesData.forEach(b => {
                            branchToProv[b.name] = b.province || (b.address ? b.address.split(',')[0].trim() : 'Unknown');
                          });
                          const seriesByProv = {};
                          allSeries.forEach((s, i) => {
                            const prov = branchToProv[s] || 'Unknown';
                            if (!seriesByProv[prov]) seriesByProv[prov] = [];
                            const hasData = seriesWithData.includes(s);
                            seriesByProv[prov].push({ name: s, index: i, hasData });
                          });
                          
                          return (
                            <div className="flex gap-8 mt-6 pt-4 border-t border-slate-100 dark:border-white/5" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '16px' }}>
                              {Object.entries(seriesByProv).map(([prov, seriesList]) => {
                                const activeSeries = seriesList.filter(s => s.hasData);
                                if (activeSeries.length === 0) return null;
                                return (
                                  <div key={prov} className="flex flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '2px' }}>
                                      {prov}
                                    </div>
                                    {activeSeries.map((s) => {
                                      const totalDisb = trendData.reduce((sum, row) => sum + (row['disb_' + s.name] || 0), 0);
                                      const totalColl = trendData.reduce((sum, row) => sum + (row['coll_' + s.name] || 0), 0);
                                      return (
                                        <div key={s.name} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
                                          <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMMUNITY_COLORS[s.index % COMMUNITY_COLORS.length] }} />
                                            <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{s.name}</span>
                                            <span style={{ fontSize: '9px', color: '#4b5563', marginLeft: '6px' }}>(Disb: {fmt(totalDisb)} · Coll: {fmt(totalColl)})</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                              {allSeries.some(s => !seriesWithData.includes(s)) && (
                                <div style={{ width: '100%', fontSize: '11px', color: '#9CA3AF', marginTop: '8px', fontStyle: 'italic' }}>
                                  No loans: {allSeries.filter(s => !seriesWithData.includes(s)).join(', ')}
                                </div>
                              )}
                              <div style={{ width: '100%', fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
                                <em>Note: For each month, the left bar is Disbursed (solid) and the right bar is Collected (lighter color).</em>
                              </div>
                            </div>
                          );
                        })()}
                        <ChartFooter period={report.period} location={getLocationLabel()} />
                      </div>
                    ) : null;
                  })()}
                </div>
              );
              })()}

              {/* Application Trend + Repayment Performance Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '1fr' }}>
                {/* === Loan Application Trend (Row 1) === */}
                {(() => {
                  const { from, to } = getChartMonthRange();
                  const appsMap = {};
                  (report.loans.applicationsByMonth || []).forEach(d => { appsMap[d.month] = d.count; });
                  
                  const provAppMap = report.loans.applicationsByMonthByProvince || {};
                  const availableProvApps = [...new Set(Object.values(provAppMap).flatMap(obj => Object.keys(obj)))].sort();
                  const showProvinceTrend = availableProvApps.length >= 2;
                  const dataMap = showProvinceTrend ? provAppMap : (report.loans.applicationsByMonthByCommunity || {});
                  let allSeries = [...new Set(Object.values(dataMap).flatMap(obj => Object.keys(obj)))].sort();
                  const chartTitle = `Loan Application Trend ${allSeries.length >= 2 ? (showProvinceTrend ? '(By Province)' : '(By Community)') : ''}`;
                  const isMulti = allSeries.length >= 2;

                  const trendData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                    const i = from + idx;
                    const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                    const row = { month: key, label, applications: appsMap[key] || 0 };
                    if (isMulti && dataMap[key]) {
                      allSeries.forEach(s => { row[s] = dataMap[key][s] || 0; });
                    }
                    return row;
                  });
                  const totalApps = trendData.reduce((s, d) => s + d.applications, 0);
                  const peakIdx = trendData.reduce((maxI, d, i, arr) => d.applications > arr[maxI].applications ? i : maxI, 0);
                  return trendData.length > 0 ? (
                    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]" style={{ width: '100%' }}>
                      <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">{chartTitle}</h3>
                      <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Total: <strong>{totalApps} applications</strong> · Peak: <strong>{trendData[peakIdx]?.label}</strong> ({trendData[peakIdx]?.applications})</p>
                      <ResponsiveContainer width="100%" height={isMulti ? 300 : 250}>
                        {isMulti ? (
                          <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false}>
                              <Label value="No. of Applications" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                            </YAxis>
                            <Tooltip formatter={(v, name) => [v + ' applications', name === 'applications' ? 'Count' : name]} />
                            {allSeries.map((s, i) => (
                              <Bar key={s} dataKey={s} name={s} fill={COMMUNITY_COLORS[i % COMMUNITY_COLORS.length]} />
                            ))}
                          </BarChart>
                        ) : (
                          <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false}>
                              <Label value="No. of Applications" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                            </YAxis>
                            <Tooltip formatter={(v) => [v + ' applications']} labelFormatter={(v, payload) => payload?.[0]?.payload?.label || v} />
                            <Bar name="Applications" dataKey="applications" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={20}>
                              <LabelList dataKey="applications" position="top" style={{ fontSize: 9, fill: '#6B7280' }} />
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                      {isMulti && (() => {
                        const branchToProv = {};
                        branchesData.forEach(b => {
                          branchToProv[b.name] = b.province || (b.address ? b.address.split(',')[0].trim() : 'Unknown');
                        });
                        const seriesByProv = {};
                        allSeries.forEach((s, i) => {
                          const prov = showProvinceTrend ? s : (branchToProv[s] || 'Unknown');
                          if (!seriesByProv[prov]) seriesByProv[prov] = [];
                          seriesByProv[prov].push({ name: s, index: i });
                        });
                        
                        return (
                          <div className="flex gap-8 mt-6 pt-4 border-t border-slate-100 dark:border-white/5" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '16px' }}>
                            {Object.entries(seriesByProv).map(([prov, seriesList]) => (
                              <div key={prov} className="flex flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                                {!showProvinceTrend && (
                                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '2px' }}>
                                    {prov}
                                  </div>
                                )}
                                {seriesList.map((s) => (
                                  <div key={s.name} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMMUNITY_COLORS[s.index % COMMUNITY_COLORS.length] }} />
                                      <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{s.name}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <ChartFooter period={report.period} location={getLocationLabel()} />
                    </div>
                  ) : null;
                })()}
              </div>

              {(() => {
                const provAppMap2 = report.loans.applicationsByMonthByProvince || {};
                const availProvApps2 = [...new Set(Object.values(provAppMap2).flatMap(obj => Object.keys(obj)))].sort();
                const shouldShowRow2 = availProvApps2.length >= 2;
                if (!shouldShowRow2) return null;
                return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '1fr' }}>
                  {(() => {
                    const { from, to } = getChartMonthRange();
                    const appsMap = {};
                    (report.loans.applicationsByMonth || []).forEach(d => { appsMap[d.month] = d.count; });
                    
                    const dataMap = report.loans.applicationsByMonthByCommunity || {};
                    let allSeries = [...new Set(Object.values(dataMap).flatMap(obj => Object.keys(obj)))].sort();
                    const chartTitle = `Loan Application Trend (By Community)`;
                    const isMulti = allSeries.length >= 2;

                    // Filter communities with actual data
                    const seriesWithData = allSeries.filter(s => Object.values(dataMap).some(monthObj => (monthObj[s] || 0) > 0));

                    const trendData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                      const i = from + idx;
                      const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                      const row = { month: key, label, applications: appsMap[key] || 0 };
                      if (isMulti && dataMap[key]) {
                        seriesWithData.forEach(s => { row[s] = dataMap[key][s] || 0; });
                      }
                      return row;
                    });
                    const totalApps = trendData.reduce((s, d) => s + d.applications, 0);
                    const peakIdx = trendData.reduce((maxI, d, i, arr) => d.applications > arr[maxI].applications ? i : maxI, 0);

                    return trendData.length > 0 ? (
                      <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]" style={{ width: '100%' }}>
                        <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">{chartTitle}</h3>
                        <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Detailed Community Breakdown · Total: <strong>{totalApps} applications</strong> · Peak: <strong>{trendData[peakIdx]?.label}</strong> ({trendData[peakIdx]?.applications})</p>
                        <ResponsiveContainer width="100%" height={isMulti ? 300 : 250}>
                          {isMulti ? (
                            <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} allowDecimals={false}>
                                <Label value="No. of Applications" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                              </YAxis>
                              <Tooltip formatter={(v, name) => [v + ' applications', name === 'applications' ? 'Count' : name]} />
                              {seriesWithData.map((s) => {
                                const origIdx = allSeries.indexOf(s);
                                return <Bar key={s} dataKey={s} name={s} fill={COMMUNITY_COLORS[origIdx % COMMUNITY_COLORS.length]} />;
                              })}
                            </BarChart>
                          ) : (
                            <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} allowDecimals={false}>
                                <Label value="No. of Applications" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                              </YAxis>
                              <Tooltip formatter={(v) => [v + ' applications']} labelFormatter={(v, payload) => payload?.[0]?.payload?.label || v} />
                              <Bar name="Applications" dataKey="applications" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={20}>
                                <LabelList dataKey="applications" position="top" style={{ fontSize: 9, fill: '#6B7280' }} />
                              </Bar>
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                        {isMulti && (() => {
                          const branchToProv = {};
                          branchesData.forEach(b => {
                            branchToProv[b.name] = b.province || (b.address ? b.address.split(',')[0].trim() : 'Unknown');
                          });
                          const seriesByProv = {};
                          allSeries.forEach((s, i) => {
                            const prov = branchToProv[s] || 'Unknown';
                            if (!seriesByProv[prov]) seriesByProv[prov] = [];
                            const hasData = seriesWithData.includes(s);
                            seriesByProv[prov].push({ name: s, index: i, hasData });
                          });
                          
                          return (
                            <div className="flex gap-8 mt-6 pt-4 border-t border-slate-100 dark:border-white/5" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '16px' }}>
                              {Object.entries(seriesByProv).map(([prov, seriesList]) => {
                                const activeSeries = seriesList.filter(s => s.hasData);
                                if (activeSeries.length === 0) return null;
                                return (
                                  <div key={prov} className="flex flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '2px' }}>
                                      {prov}
                                    </div>
                                    {activeSeries.map((s) => {
                                      const totalVal = trendData.reduce((sum, row) => sum + (row[s.name] || 0), 0);
                                      return (
                                        <div key={s.name} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
                                          <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMMUNITY_COLORS[s.index % COMMUNITY_COLORS.length] }} />
                                            <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{s.name}</span>
                                            <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>({totalVal} apps)</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                              {allSeries.some(s => !seriesWithData.includes(s)) && (
                                <div style={{ width: '100%', fontSize: '11px', color: '#9CA3AF', marginTop: '8px', fontStyle: 'italic' }}>
                                  No applications: {allSeries.filter(s => !seriesWithData.includes(s)).join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <ChartFooter period={report.period} location={getLocationLabel()} />
                      </div>
                    ) : null;
                   })()}
                </div>
              );
              })()}

              {/* Approval Rate + Repayment Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '1fr' }}>
                {/* Approval Rate Per Month */}
                {(() => {
                  const { from, to } = getChartMonthRange();
                  const approvalMap = {};
                  (report.loans.approvalByMonth || []).forEach(d => { approvalMap[d.month] = d; });
                  const rateData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                    const i = from + idx;
                    const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                    const existing = approvalMap[key];
                    return { month: key, label, approvalRate: existing?.approvalRate || 0, rejectionRate: existing?.rejectionRate || 0, total: existing?.total || 0 };
                  });
                  const totalLoans = rateData.reduce((s, d) => s + d.total, 0);
                  const avgApproval = totalLoans > 0 ? Math.round(rateData.reduce((s, d) => s + d.approvalRate * d.total, 0) / totalLoans) : 0;
                  return (
                    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                      <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Approval Rate Per Month (%)</h3>
                      <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Avg: <strong style={{color: '#10B981'}}>{avgApproval}%</strong> approval · <strong style={{color: '#EF4444'}}>{100 - avgApproval}%</strong> rejection</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={rateData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]}>
                            <Label value="%" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                          </YAxis>
                          <Tooltip formatter={(v) => `${v}%`} labelFormatter={(v, payload) => payload?.[0]?.payload?.label || v} />
                          <Bar name="Approval %" dataKey="approvalRate" fill="#10B981" radius={[4, 4, 0, 0]} barSize={16} />
                          <Bar name="Rejection %" dataKey="rejectionRate" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5" style={{ justifyContent: 'center', display: 'flex', gap: '16px' }}>
                        <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ gap: '4px' }}>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#10B981' }} />
                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">Approval %</span>
                          <span className="font-bold text-slate-800 dark:text-white ml-1">{avgApproval}% avg</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ gap: '4px' }}>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#EF4444' }} />
                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">Rejection %</span>
                          <span className="font-bold text-slate-800 dark:text-white ml-1">{100 - avgApproval}% avg</span>
                        </div>
                      </div>
                      <ChartFooter period={report.period} location={getLocationLabel()} />
                    </div>
                  );
                })()}
              </div>


            </div>
          )}

          {/* Savings Section - Only for Loan Admin */}
          {report.savings && adminRole === 'loanAdmin' && (
            <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center gap-3">
                <h2 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white flex items-center gap-2">🏦 Savings Overview</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Saved</span>
                  <span className="font-inter font-bold text-[32px] text-emerald-600 dark:text-emerald-400 mt-1">{fmt(report.savings.totalSaved)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Targets</span>
                  <span className="font-inter font-bold text-[32px] text-slate-900 dark:text-white mt-1">{fmt(report.savings.totalTargets)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Overall Progress</span>
                  <span className="font-inter font-bold text-[32px] text-blue-600 dark:text-blue-400 mt-1">
                    {report.savings.overallProgress > 0 && report.savings.overallProgress < 1
                      ? `<1%`
                      : `${report.savings.overallProgress}%`}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Period Deposits</span>
                  <span className="font-inter font-bold text-[32px] text-slate-900 dark:text-white mt-1">{fmt(report.savings.periodDeposits)}</span>
                  <span className="font-inter text-sm text-slate-500 dark:text-slate-400 mt-1">{report.savings.periodDepositCount} transactions</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Active Goals</span>
                  <span className="font-inter font-bold text-[32px] text-slate-900 dark:text-white mt-1">{report.savings.activeGoals}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Completed Goals</span>
                  <span className="font-inter font-bold text-[32px] text-emerald-600 dark:text-emerald-400 mt-1">{report.savings.completedGoals}</span>
                </div>
              </div>

              {/* Savings Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '3fr 7fr' }}>
                {/* Savings Goals Donut */}
                {(report.savings.activeGoals > 0 || report.savings.completedGoals > 0) && (
                  <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Savings Goals Status</h3>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Total: <strong>{report.savings.activeGoals + report.savings.completedGoals} goals</strong> · Progress: <strong>{report.savings.overallProgress}%</strong></p>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Active', value: report.savings.activeGoals },
                            { name: 'Completed', value: report.savings.completedGoals },
                          ]}
                          cx="50%" cy="42%"
                          innerRadius={35} outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                          label={renderSliceLabel}
                          labelLine={false}
                        >
                          <Cell fill="#2563EB" />
                          <Cell fill="#10B981" />
                          <Label value={report.savings.activeGoals + report.savings.completedGoals} position="center" fill="#1e3a5f" style={{ fontSize: '18px', fontWeight: 'bold' }} />
                          <Label value="Goals" position="center" dy={16} fill="#6B7280" style={{ fontSize: '10px' }} />
                        </Pie>
                        <Tooltip formatter={(v, name) => [v + ' goals', name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                      {[
                        { name: 'Active', value: report.savings.activeGoals, color: '#2563EB' },
                        { name: 'Completed', value: report.savings.completedGoals, color: '#10B981' },
                      ].map((item, i) => {
                        const total = report.savings.activeGoals + report.savings.completedGoals || 1;
                        const pct = ((item.value / total) * 100).toFixed(0);
                        return (
                          <div key={i} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                            <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{item.name}</span>
                            <span className="font-bold text-slate-800 dark:text-white ml-1">{item.value} goals · {pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                    <ChartFooter period={report.period} location={getLocationLabel()} />
                  </div>
                )}

                {/* Savings Breakdown by Month */}
                {(() => {
                  const { from, to } = getChartMonthRange();
                  const byMonthMap = {};
                  (report.savings.byMonth || []).forEach(d => { byMonthMap[d.month] = d; });
                  
                  const savingsData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                    const i = from + idx;
                    const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                    const existing = byMonthMap[key];
                    return { month: key, label, deposits: existing?.deposits || 0, withdrawals: existing?.withdrawals || 0 };
                  });
                  
                  return (
                    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                      <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Savings Trend (Deposits vs Withdrawals)</h3>
                      <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Total Saved: <strong>{fmt(report.savings.totalSaved)}</strong> · Deposits: <strong style={{color: '#10B981'}}>{fmt(report.savings.periodDeposits)}</strong> · Withdrawals: <strong style={{color: '#EF4444'}}>{fmt(report.savings.periodWithdrawals)}</strong></p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={savingsData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                            <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                          </YAxis>
                          <Tooltip formatter={v => fmt(v)} labelFormatter={(v, payload) => payload?.[0]?.payload?.label || v} />
                          <Bar name="Deposits" dataKey="deposits" fill="#10B981" radius={[4, 4, 0, 0]} barSize={16}>
                            <LabelList dataKey="deposits" position="top" formatter={v => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fill: '#6B7280' }} />
                          </Bar>
                          <Bar name="Withdrawals" dataKey="withdrawals" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={16}>
                            <LabelList dataKey="withdrawals" position="top" formatter={v => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fill: '#6B7280' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5" style={{ justifyContent: 'center', display: 'flex', gap: '16px' }}>
                        <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ gap: '4px' }}>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#10B981' }} />
                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">Deposits</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ gap: '4px' }}>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#EF4444' }} />
                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">Withdrawals</span>
                        </div>
                      </div>
                      <ChartFooter period={report.period} location={getLocationLabel()} />
                    </div>
                  );
                })()}
              </div>

              {/* Savings Progress Bar */}
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5">
                <div className="flex justify-between items-end mb-2">
                  <span>Overall Savings Progress</span>
                  <span className="font-inter font-bold text-slate-800 dark:text-white">
                    {report.savings.overallProgress > 0 && report.savings.overallProgress < 1
                      ? '<1%'
                      : `${report.savings.overallProgress}%`}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.max(report.savings.overallProgress > 0 ? 1 : 0, Math.min(100, report.savings.overallProgress))}%` }} />
                </div>
                <p style={{fontSize: '10px', color: '#9ca3af', marginTop: '6px', marginBottom: 0}}>
                  {fmt(report.savings.totalSaved)} saved out of {fmt(report.savings.totalTargets)} target
                  {report.savings.totalTargets > 0 && report.savings.overallProgress < 1 && report.savings.totalSaved > 0
                    ? ` — Progress is less than 1% because the total target (${fmt(report.savings.totalTargets)}) is significantly larger than the amount saved so far.`
                    : ''}
                </p>
              </div>
            </div>
          )}

          {/* Member Growth & Attendance - Only for Super Admin */}
          {(report.memberGrowth || report.attendance) && adminRole === 'admin' && (report.reportType === 'all' || report.reportType === 'attendance') && (
            <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center gap-3">
                <h2 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white flex items-center gap-2">👥 Membership & Engagement</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {report.memberGrowth && (
                  <>
                    <div className="flex flex-col">
                      <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">New Members</span>
                      <span className="font-inter font-bold text-[32px] text-blue-600 dark:text-blue-400 mt-1">{report.memberGrowth.newMembers}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Members</span>
                      <span className="font-inter font-bold text-[32px] text-slate-900 dark:text-white mt-1">{report.memberGrowth.totalMembers}</span>
                    </div>
                  </>
                )}
                {report.attendance && (
                  <div className="flex flex-col">
                    <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Attendance Records</span>
                    <span className="font-inter font-bold text-[32px] text-emerald-600 dark:text-emerald-400 mt-1">{report.attendance.totalRecords}</span>
                  </div>
                )}
              </div>

              {/* Attendance Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Attendance By Community Chart */}
                {report.attendance?.byBranch?.length > 0 && (
                  <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Attendance By Community</h3>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Top: <strong>{report.attendance.byBranch[0]?.name}</strong> · {report.attendance.byBranch[0]?.value} attendees</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={report.attendance.byBranch.slice(0, 8)} margin={{ top: 15, right: 10, left: -10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, angle: -35, textAnchor: 'end' }} interval={0} height={50} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false}>
                          <Label value="Attendance Count" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                        </YAxis>
                        <Tooltip />
                        <Bar dataKey="value" fill="#0D1F45" radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="value" position="top" style={{ fontSize: 10, fill: '#6B7280' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <ChartFooter period={report.period} location={getLocationLabel()} />
                  </div>
                )}

                {/* Top Services Chart */}
                {report.attendance?.attendees?.length > 0 && (() => {
                  const serviceMap = {};
                  report.attendance.attendees.forEach(a => {
                    const svc = a.service || 'Unknown';
                    serviceMap[svc] = (serviceMap[svc] || 0) + 1;
                  });
                  const serviceData = Object.keys(serviceMap)
                    .map(svc => ({ service: svc, count: serviceMap[svc] }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5); // Top 5
                  
                  return serviceData.length > 0 ? (
                    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                      <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Top Services By Attendance</h3>
                      <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">
                        Top: <strong>{serviceData[0].service}</strong> · {serviceData[0].count} attendees
                      </p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={serviceData} layout="vertical" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="service" tick={{ fontSize: 10 }} width={90} />
                          <Tooltip formatter={v => [v, 'Attendees']} />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                            {serviceData.map((_, i) => (
                              <Cell key={i} fill={i === 0 ? '#2563eb' : '#0D1F45'} />
                            ))}
                            <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: '#6B7280' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <ChartFooter period={report.period} location={getLocationLabel()} />
                    </div>
                  ) : null;
                })()}
              </div>
              {/* === NEW: Monthly Attendance Trend (Row 1) === */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '1fr' }}>
                {(() => {
                  const byMonthMap = {};
                  (report.attendance.byMonth || []).forEach(d => { byMonthMap[d.month] = d.count; });
                  const { from, to } = getChartMonthRange();

                  const bmp = report.attendance.byMonthByProvince || {};
                  const bmc = report.attendance.byMonthByCommunity || {};
                  const availProvinces = [...new Set(Object.values(bmp).flatMap(obj => Object.keys(obj)))].sort();
                  const showProvinceTrend = availProvinces.length >= 2;

                  let allSeries = [];
                  let dataMap = {};
                  let chartTitle = 'Monthly Attendance Trend';

                  if (showProvinceTrend) {
                    allSeries = availProvinces;
                    dataMap = bmp;
                    chartTitle = `Monthly Attendance Trend (By Province)`;
                  } else {
                    allSeries = [...new Set(Object.values(bmc).flatMap(obj => Object.keys(obj)))].sort();
                    dataMap = bmc;
                    chartTitle = `Monthly Attendance Trend ${allSeries.length >= 2 ? '(By Community)' : ''}`;
                  }

                  const isMulti = allSeries.length >= 2;

                  // Filter series with actual data
                  const seriesWithData = allSeries.filter(s => Object.values(dataMap).some(monthObj => (monthObj[s] || 0) > 0));

                  const fullMonthData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                    const i = from + idx;
                    const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                    const row = { month: label, value: byMonthMap[key] || 0 };
                    if (isMulti && dataMap[key]) {
                      allSeries.forEach(s => { row[s] = dataMap[key][s] || 0; });
                    }
                    return row;
                  });

                  const totalAtt = fullMonthData.reduce((s, d) => s + d.value, 0);
                  const highestMon = fullMonthData.reduce((a, b) => b.value > a.value ? b : a, fullMonthData[0]);

                  return fullMonthData.some(d => d.value > 0) ? (
                    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]" style={{ width: '100%' }}>
                      <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">{chartTitle}</h3>
                      <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Total: <strong>{totalAtt}</strong> attendees · Highest: <strong>{highestMon?.month}</strong> ({highestMon?.value})</p>
                      <ResponsiveContainer width="100%" height={isMulti ? 300 : 250}>
                        {isMulti ? (
                          <BarChart data={fullMonthData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false}>
                              <Label value="Attendees" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                            </YAxis>
                            <Tooltip />
                            {seriesWithData.map((s) => {
                              const origIdx = allSeries.indexOf(s);
                              return <Bar key={s} dataKey={s} fill={COMMUNITY_COLORS[origIdx % COMMUNITY_COLORS.length]} />;
                            })}
                          </BarChart>
                        ) : (
                          <BarChart data={fullMonthData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false}>
                              <Label value="Attendees" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                            </YAxis>
                            <Tooltip />
                            <Bar dataKey="value" fill="#0D1F45" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="value" position="top" style={{ fontSize: 10, fill: '#6B7280' }} />
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                      {isMulti && (
                        <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                          {(() => {
                            const activeSeries = allSeries.filter(s => seriesWithData.includes(s));
                            return (
                              <>
                                {activeSeries.map((s, i) => {
                                  const totalVal = fullMonthData.reduce((sum, row) => sum + (row[s] || 0), 0);
                                  const origIdx = allSeries.indexOf(s);
                                  return (
                                    <div key={s} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMMUNITY_COLORS[origIdx % COMMUNITY_COLORS.length] }} />
                                      <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{s}</span>
                                      <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>({totalVal} attendees)</span>
                                    </div>
                                  );
                                })}
                                {allSeries.some(s => !seriesWithData.includes(s)) && (
                                  <div style={{ width: '100%', fontSize: '11px', color: '#9CA3AF', marginTop: '8px', fontStyle: 'italic' }}>
                                    No attendance: {allSeries.filter(s => !seriesWithData.includes(s)).join(', ')}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                      <ChartFooter period={report.period} location={getLocationLabel()} />
                    </div>
                  ) : null;
                })()}
              </div>

              {(() => {
                const bmpCheck = report.attendance.byMonthByProvince || {};
                const availProvCheck = [...new Set(Object.values(bmpCheck).flatMap(obj => Object.keys(obj)))].sort();
                const shouldShowRow2 = availProvCheck.length >= 2;
                if (!shouldShowRow2) return null;
                return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '1fr' }}>
                  {(() => {
                    const byMonthMap = {};
                    (report.attendance.byMonth || []).forEach(d => { byMonthMap[d.month] = d.count; });
                    const { from, to } = getChartMonthRange();
                    const bmc = report.attendance.byMonthByCommunity || {};
                    const allCommunities = [...new Set(Object.values(bmc).flatMap(obj => Object.keys(obj)))].sort();
                    const isMulti = allCommunities.length >= 2;

                    // Filter communities with actual data
                    const commsWithData = allCommunities.filter(c => Object.values(bmc).some(monthObj => (monthObj[c] || 0) > 0));

                    const fullMonthData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                      const i = from + idx;
                      const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                      const row = { month: label, value: byMonthMap[key] || 0 };
                      if (isMulti && bmc[key]) {
                        commsWithData.forEach(c => { row[c] = bmc[key][c] || 0; });
                      }
                      return row;
                    });
                    const totalAtt = fullMonthData.reduce((s, d) => s + d.value, 0);
                    const highestMon = fullMonthData.reduce((a, b) => b.value > a.value ? b : a, fullMonthData[0]);

                    return fullMonthData.some(d => d.value > 0) ? (
                      <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]" style={{ width: '100%' }}>
                        <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Monthly Attendance Trend {isMulti ? '(By Community)' : ''}</h3>
                        <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Detailed Community Breakdown · Total: <strong>{totalAtt}</strong> attendees · Highest: <strong>{highestMon?.month}</strong></p>
                        <ResponsiveContainer width="100%" height={isMulti ? 300 : 250}>
                          {isMulti ? (
                            <BarChart data={fullMonthData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} allowDecimals={false}>
                                <Label value="Attendees" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                              </YAxis>
                              <Tooltip />
                              {commsWithData.map((c) => {
                                const origIdx = allCommunities.indexOf(c);
                                return <Bar key={c} dataKey={c} fill={COMMUNITY_COLORS[origIdx % COMMUNITY_COLORS.length]} />;
                              })}
                            </BarChart>
                          ) : (
                            <BarChart data={fullMonthData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} allowDecimals={false}>
                                <Label value="Attendees" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                              </YAxis>
                              <Tooltip />
                              <Bar dataKey="value" fill="#0D1F45" radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="value" position="top" style={{ fontSize: 10, fill: '#6B7280' }} />
                              </Bar>
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                        {isMulti && (() => {
                          const branchToProv = {};
                          branchesData.forEach(b => {
                            branchToProv[b.name] = b.province || (b.address ? b.address.split(',')[0].trim() : 'Unknown');
                          });
                          const commsByProv = {};
                          allCommunities.forEach((c, i) => {
                            const prov = branchToProv[c] || 'Unknown';
                            if (!commsByProv[prov]) commsByProv[prov] = [];
                            const hasData = commsWithData.includes(c);
                            commsByProv[prov].push({ name: c, index: i, hasData });
                          });
                          
                          return (
                            <div className="flex gap-8 mt-6 pt-4 border-t border-slate-100 dark:border-white/5" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '16px' }}>
                              {Object.entries(commsByProv).map(([prov, comms]) => {
                                const activeComms = comms.filter(c => c.hasData);
                                if (activeComms.length === 0) return null;
                                return (
                                  <div key={prov} className="flex flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '2px' }}>
                                      {prov}
                                    </div>
                                    {activeComms.map((c) => {
                                      const totalVal = fullMonthData.reduce((sum, row) => sum + (row[c.name] || 0), 0);
                                      return (
                                        <div key={c.name} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0 }}>
                                          <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMMUNITY_COLORS[c.index % COMMUNITY_COLORS.length] }} />
                                            <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{c.name}</span>
                                            <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>({totalVal} attendees)</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                              {allCommunities.some(c => !commsWithData.includes(c)) && (
                                <div style={{ width: '100%', fontSize: '11px', color: '#9CA3AF', marginTop: '8px', fontStyle: 'italic' }}>
                                  No attendance: {allCommunities.filter(c => !commsWithData.includes(c)).join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <ChartFooter period={report.period} location={getLocationLabel()} />
                      </div>
                    ) : null;
                  })()}
                </div>
              );
              })()}

              {/* Attendee Names Table */}
              {report.attendance?.attendees?.length > 0 && (
                <div className="overflow-hidden">
                  <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Attendee List ({report.attendance.attendees.length} records)</h3>
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">#</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Member</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Community</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Service</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Date</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Time In</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.attendance.attendees.map((a, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{i + 1}</td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300" style={{ fontWeight: 600 }}>{a.name}</td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{a.branch}</td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{a.service}</td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{a.date}</td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{a.time}</td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">
                            <span className={`status-badge ${a.status.toLowerCase()}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Secretary Section - Only for Super Admin and Secretary Admin */}
          {report.secretary && (adminRole === 'admin' || adminRole === 'secretaryAdmin') && (
            <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center gap-3">
                <h2 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white flex items-center gap-2">📋 Disbursement Report</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="flex flex-col">
                  <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Amount Disbursed</span>
                  <span className="font-inter font-bold text-[32px] text-purple-600 dark:text-purple-400 mt-1">{fmt(report.secretary.disbursements.totalAmount)}</span>
                  <span className="font-inter text-sm text-slate-500 dark:text-slate-400 mt-1">{report.secretary.disbursements.count} releases processed</span>
                </div>
              </div>

              {/* Secretary Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '1fr' }}>
                {/* === Monthly Disbursements (Row 1) === */}
                {(() => {
                  const { from, to } = getChartMonthRange();
                  const byMonthMap = {};
                  (report.secretary.disbursements.byMonth || []).forEach(d => { byMonthMap[d.month] = d; });
                  
                  const provDataMap = report.secretary.disbursements.byMonthByProvince || {};
                  const availableProvinces = [...new Set(Object.values(provDataMap).flatMap(obj => Object.keys(obj)))].sort();
                  const showProvinceTrend = availableProvinces.length >= 2;
                  const dataMap = showProvinceTrend ? provDataMap : (report.secretary.disbursements.byMonthByCommunity || {});
                  let allSeries = [...new Set(Object.values(dataMap).flatMap(obj => Object.keys(obj)))].sort();
                  const isMulti = allSeries.length >= 2;

                  // Filter communities/provinces with actual data
                  const seriesWithData = allSeries.filter(s => Object.values(dataMap).some(monthObj => (monthObj[s] || 0) > 0));

                  const chartTitle = `Monthly Disbursements ${allSeries.length >= 2 ? (showProvinceTrend ? '(By Province)' : '(By Community)') : ''}`;

                  const trendData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                    const i = from + idx;
                    const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                    const existing = byMonthMap[key];
                    const row = { month: key, label, value: existing?.value || 0 };
                    if (isMulti && dataMap[key]) {
                      allSeries.forEach(s => { row[s] = dataMap[key][s] || 0; });
                    }
                    return row;
                  });
                  const totalDisb = trendData.reduce((s, d) => s + d.value, 0);
                  const highestMon = trendData.reduce((a, b) => b.value > a.value ? b : a, trendData[0]);
                  return trendData.length > 0 ? (
                    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]" style={{ width: '100%' }}>
                      <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">{chartTitle}</h3>
                      <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Total: <strong>{fmt(totalDisb)}</strong> · {report.secretary.disbursements.count} releases · Highest: <strong>{highestMon?.label}</strong></p>
                      <ResponsiveContainer width="100%" height={isMulti ? 300 : 250}>
                        {isMulti ? (
                          <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                              <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                            </YAxis>
                            <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                            {seriesWithData.map((s) => {
                              const origIdx = allSeries.indexOf(s);
                              return <Bar key={s} dataKey={s} name={s} fill={COMMUNITY_COLORS[origIdx % COMMUNITY_COLORS.length]} />;
                            })}
                          </BarChart>
                        ) : (
                          <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                              <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                            </YAxis>
                            <Tooltip formatter={v => fmt(v)} labelFormatter={(v, payload) => payload?.[0]?.payload?.label || v} />
                            <Bar name="Amount" dataKey="value" fill="#0D1F45" radius={[4, 4, 0, 0]} barSize={30}>
                              <LabelList dataKey="value" position="top" formatter={v => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 10, fill: '#6B7280' }} />
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                      {isMulti && (() => {
                        const branchToProv = {};
                        branchesData.forEach(b => {
                          branchToProv[b.name] = b.province || (b.address ? b.address.split(',')[0].trim() : 'Unknown');
                        });
                        const seriesByProv = {};
                        allSeries.forEach((s, i) => {
                          const prov = showProvinceTrend ? s : (branchToProv[s] || 'Unknown');
                          if (!seriesByProv[prov]) seriesByProv[prov] = [];
                          const hasData = seriesWithData.includes(s);
                          seriesByProv[prov].push({ name: s, index: i, hasData });
                        });
                        
                        return (
                          <div className="flex gap-8 mt-6 pt-4 border-t border-slate-100 dark:border-white/5" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '16px' }}>
                            {Object.entries(seriesByProv).map(([prov, seriesList]) => {
                              const activeSeries = seriesList.filter(s => s.hasData);
                              if (activeSeries.length === 0) return null;
                              return (
                                <div key={prov} className="flex flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                                  {!showProvinceTrend && (
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '2px' }}>
                                      {prov}
                                    </div>
                                  )}
                                  {activeSeries.map((s) => {
                                    const totalVal = trendData.reduce((sum, row) => sum + (row[s.name] || 0), 0);
                                    return (
                                      <div key={s.name} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMMUNITY_COLORS[s.index % COMMUNITY_COLORS.length] }} />
                                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{s.name}</span>
                                          <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>({fmt(totalVal)})</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                            {allSeries.some(s => !seriesWithData.includes(s)) && (
                              <div style={{ width: '100%', fontSize: '11px', color: '#9CA3AF', marginTop: '8px', fontStyle: 'italic' }}>
                                No disbursements: {allSeries.filter(s => !seriesWithData.includes(s)).join(', ')}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <ChartFooter period={report.period} location={getLocationLabel()} />
                    </div>
                  ) : null;
                })()}
              </div>

              {(() => {
                const provDataMap2 = report.secretary.disbursements.byMonthByProvince || {};
                const availProv2 = [...new Set(Object.values(provDataMap2).flatMap(obj => Object.keys(obj)))].sort();
                const shouldShowRow2 = availProv2.length >= 2;
                if (!shouldShowRow2) return null;
                return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '1fr' }}>
                  {(() => {
                    const { from, to } = getChartMonthRange();
                    const byMonthMap = {};
                    (report.secretary.disbursements.byMonth || []).forEach(d => { byMonthMap[d.month] = d; });
                    
                    const dataMap = report.secretary.disbursements.byMonthByCommunity || {};
                    let allSeries = [...new Set(Object.values(dataMap).flatMap(obj => Object.keys(obj)))].sort();
                    const chartTitle = `Monthly Disbursements (By Community)`;
                    const isMulti = allSeries.length >= 2;

                    // Filter communities with actual data
                    const seriesWithData = allSeries.filter(s => Object.values(dataMap).some(monthObj => (monthObj[s] || 0) > 0));

                    const trendData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                      const i = from + idx;
                      const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                      const existing = byMonthMap[key];
                      const row = { month: key, label, value: existing?.value || 0 };
                      if (isMulti && dataMap[key]) {
                        seriesWithData.forEach(s => { row[s] = dataMap[key][s] || 0; });
                      }
                      return row;
                    });
                    const totalDisb = trendData.reduce((s, d) => s + d.value, 0);
                    const highestMon = trendData.reduce((a, b) => b.value > a.value ? b : a, trendData[0]);

                    return trendData.length > 0 ? (
                      <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]" style={{ width: '100%' }}>
                        <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">{chartTitle}</h3>
                        <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Detailed Community Breakdown · Total: <strong>{fmt(totalDisb)}</strong> · Highest: <strong>{highestMon?.label}</strong></p>
                        <ResponsiveContainer width="100%" height={isMulti ? 300 : 250}>
                          {isMulti ? (
                            <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                                <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                              </YAxis>
                              <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                              {seriesWithData.map((s) => {
                                const origIdx = allSeries.indexOf(s);
                                return <Bar key={s} dataKey={s} name={s} fill={COMMUNITY_COLORS[origIdx % COMMUNITY_COLORS.length]} />;
                              })}
                            </BarChart>
                          ) : (
                            <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                                <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                              </YAxis>
                              <Tooltip formatter={v => fmt(v)} labelFormatter={(v, payload) => payload?.[0]?.payload?.label || v} />
                              <Bar name="Amount" dataKey="value" fill="#0D1F45" radius={[4, 4, 0, 0]} barSize={30}>
                                <LabelList dataKey="value" position="top" formatter={v => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 10, fill: '#6B7280' }} />
                              </Bar>
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                        {isMulti && (() => {
                          const branchToProv = {};
                          branchesData.forEach(b => {
                            branchToProv[b.name] = b.province || (b.address ? b.address.split(',')[0].trim() : 'Unknown');
                          });
                          const seriesByProv = {};
                          allSeries.forEach((s, i) => {
                            const prov = branchToProv[s] || 'Unknown';
                            if (!seriesByProv[prov]) seriesByProv[prov] = [];
                            const hasData = seriesWithData.includes(s);
                            seriesByProv[prov].push({ name: s, index: i, hasData });
                          });
                          
                          return (
                            <div className="flex gap-8 mt-6 pt-4 border-t border-slate-100 dark:border-white/5" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '16px' }}>
                              {Object.entries(seriesByProv).map(([prov, seriesList]) => {
                                const activeSeries = seriesList.filter(s => s.hasData);
                                if (activeSeries.length === 0) return null;
                                return (
                                  <div key={prov} className="flex flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '2px' }}>
                                      {prov}
                                    </div>
                                    {activeSeries.map((s) => {
                                      const totalVal = trendData.reduce((sum, row) => sum + (row[s.name] || 0), 0);
                                      return (
                                        <div key={s.name} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
                                          <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMMUNITY_COLORS[s.index % COMMUNITY_COLORS.length] }} />
                                            <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{s.name}</span>
                                            <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>({fmt(totalVal)})</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                              {allSeries.some(s => !seriesWithData.includes(s)) && (
                                <div style={{ width: '100%', fontSize: '11px', color: '#9CA3AF', marginTop: '8px', fontStyle: 'italic' }}>
                                  No disbursements: {allSeries.filter(s => !seriesWithData.includes(s)).join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <ChartFooter period={report.period} location={getLocationLabel()} />
                      </div>
                    ) : null;
                   })()}
                </div>
              );
              })()}

              {/* Top Communities Row (Full Width) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gridTemplateColumns: '1fr' }}>
                {/* Top 5 Communities by Disbursement */}
                {report.secretary.disbursements.byCommunity?.length > 0 && (
                  <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Top Communities By Disbursement</h3>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Top: <strong>{report.secretary.disbursements.byCommunity[0]?.community}</strong> · {fmt(report.secretary.disbursements.byCommunity[0]?.value)} ({report.secretary.disbursements.totalAmount > 0 ? ((report.secretary.disbursements.byCommunity[0]?.value / report.secretary.disbursements.totalAmount) * 100).toFixed(1) : 0}%)</p>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={report.secretary.disbursements.byCommunity} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="community" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                          <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                        </YAxis>
                        <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                        <Bar dataKey="value" fill="#0D1F45" radius={[4, 4, 0, 0]} barSize={40}>
                          {report.secretary.disbursements.byCommunity.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? '#2563eb' : '#0D1F45'} />
                          ))}
                          <LabelList dataKey="value" position="top" formatter={v => fmtShort(v)} style={{ fontSize: 10, fill: '#6B7280' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                      {report.secretary.disbursements.byCommunity.map((c, i) => (
                        <div key={i} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: i === 0 ? '#2563eb' : '#0D1F45' }} />
                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{c.community}</span>
                          <span className="font-bold text-slate-800 dark:text-white ml-1">{fmt(c.value)} · {report.secretary.disbursements.totalAmount > 0 ? ((c.value / report.secretary.disbursements.totalAmount) * 100).toFixed(0) : 0}%</span>
                        </div>
                      ))}
                    </div>
                    <ChartFooter period={report.period} location={getLocationLabel()} />
                  </div>
                )}
              </div>

              {/* Payment Method + Top Recipients Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment Method Distribution */}
                {report.secretary.disbursements.byMethod?.length > 0 && (() => {
                  const normalizedMethods = {};
                  report.secretary.disbursements.byMethod.forEach(m => {
                    const normalized = normalizeMethod(m.method);
                    normalizedMethods[normalized] = (normalizedMethods[normalized] || 0) + m.value;
                  });
                  const methodData = Object.entries(normalizedMethods).map(([method, value]) => ({ method, value })).sort((a, b) => b.value - a.value);
                  return (
                  <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Disbursement By Payment Method</h3>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Total: <strong>{fmt(report.secretary.disbursements.totalAmount)}</strong> · {methodData.length} methods</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={methodData.map(m => ({ name: m.method, value: m.value }))}
                          cx="50%" cy="45%"
                          innerRadius={35} outerRadius={68}
                          paddingAngle={2}
                          dataKey="value"
                          label={renderSliceLabel}
                          labelLine={false}
                        >
                          {methodData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <p className="font-inter text-[28px] font-bold text-blue-600 dark:text-blue-400 block mt-1">{fmt(report.secretary.disbursements.totalAmount)} Total</p>
                    <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                      {methodData.map((m, i) => (
                        <div key={i} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{m.method}</span>
                          <span className="font-bold text-slate-800 dark:text-white ml-1">{fmt(m.value)} · {report.secretary.disbursements.totalAmount > 0 ? ((m.value / report.secretary.disbursements.totalAmount) * 100).toFixed(0) : 0}%</span>
                        </div>
                      ))}
                    </div>
                    <ChartFooter period={report.period} location={getLocationLabel()} />
                  </div>
                  );
                })()}

                {/* Top 5 Recipients */}
                {report.secretary.disbursements.byUser?.length > 0 && (
                  <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-[400px]">
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Top Recipients By Disbursement</h3>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">#1: <strong>{report.secretary.disbursements.byUser[0]?.user}</strong> · {fmt(report.secretary.disbursements.byUser[0]?.value)} ({report.secretary.disbursements.totalAmount > 0 ? ((report.secretary.disbursements.byUser[0]?.value / report.secretary.disbursements.totalAmount) * 100).toFixed(1) : 0}%)</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={report.secretary.disbursements.byUser} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`}>
                          <Label value="Amount (₱)" position="bottom" offset={-5} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                        </XAxis>
                        <YAxis type="category" dataKey="user" tick={{ fontSize: 10 }} width={120} />
                        <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                        <Bar dataKey="value" fill="#1e3a8a" radius={[0, 4, 4, 0]} barSize={18}>
                          {report.secretary.disbursements.byUser.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? '#2563eb' : '#1e3a8a'} />
                          ))}
                          <LabelList dataKey="value" position="right" formatter={v => fmtShort(v)} style={{ fontSize: 10, fill: '#6B7280' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                      {report.secretary.disbursements.byUser.map((u, i) => (
                        <div key={i} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: i === 0 ? '#2563eb' : '#1e3a8a' }} />
                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{u.user}</span>
                          <span className="font-bold text-slate-800 dark:text-white ml-1">{fmt(u.value)} · {report.secretary.disbursements.totalAmount > 0 ? ((u.value / report.secretary.disbursements.totalAmount) * 100).toFixed(0) : 0}%</span>
                        </div>
                      ))}
                    </div>
                    <ChartFooter period={report.period} location={getLocationLabel()} />
                  </div>
                )}
              </div>

              {/* Disbursement List */}
              {report.secretary.disbursements.loans?.length > 0 && (
                <div className="overflow-hidden">
                  <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Detailed Disbursement Log</h3>
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Loan ID</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Member</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Amount</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.secretary.disbursements.loans.map((l, i) => (
                        <tr key={i}>
                          <td className="id">{l.id}</td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{l.member}</td>
                          <td className="amount">{fmt(l.amount)}</td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{new Date(l.date).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="text-center py-6 border-t border-slate-200 dark:border-white/10 mt-4">
            <p>Generated by IsangDiwa AI • {new Date(report.generatedAt).toLocaleString('en-US')}</p>
            <p>This report was generated using artificial intelligence. Please verify critical data points before making decisions.</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!report && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center mb-4">
            <FileText size={40} />
          </div>
          <h2>Generate an Automated Report</h2>
          <p>Select a time period and click "Generate Report" to create an AI-powered operational analysis.</p>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4" onClick={() => setShowConfirm(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[500px] shadow-2xl p-6 flex flex-col items-center text-center" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer bg-transparent border-none" onClick={() => setShowConfirm(false)}>
              <X size={18} />
            </button>
            <div className="w-16 h-16 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
              <AlertCircle size={28} />
            </div>
            <h3 className="m-0 font-inter text-xl font-bold text-slate-900 dark:text-white">Confirm Report Generation</h3>
            <p className="m-0 font-inter text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">Please review the details below before proceeding. AI report generation may take 10–15 seconds.</p>
            <div className="w-full bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl p-4 my-6 flex flex-col gap-3 text-left">
              {adminRole === 'admin' && (
                <div className="flex justify-between items-center text-sm font-inter">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Report Type</span>
                  <span className="text-slate-800 dark:text-white font-semibold">{getReportTypeName()}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm font-inter">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Period</span>
                <span className="text-slate-800 dark:text-white font-semibold">{getPeriodName()}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-inter">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Location</span>
                <span className="text-slate-800 dark:text-white font-semibold">
                  {getLocationLabel()}
                </span>
              </div>
            </div>
            <div className="flex w-full gap-3">
              <button className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="h-10 px-6 rounded-lg font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 shadow-sm flex items-center gap-2 cursor-pointer" onClick={handleConfirmGenerate}>
                <Sparkles size={16} />
                Generate Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
