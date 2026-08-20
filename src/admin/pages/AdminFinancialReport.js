import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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

const COMMUNITY_TO_PROVINCE_MAP = {
  'Tabuk': 'Kalinga', 'Bliss': 'Kalinga', 'Libanon': 'Kalinga', 'Batong Buhay': 'Kalinga',
  'Balatoc': 'Kalinga', 'Lat-nog': 'Kalinga', 'Lamao': 'Kalinga', 'Lingey': 'Kalinga',
  'Cabaruyan': 'Kalinga', 'Ducligan': 'Kalinga', 'Gangal': 'Kalinga', 'Bila-Bila': 'Kalinga',
  'Naguillian': 'Kalinga', 'Ud-udiao': 'Kalinga', 'Villa Conchita': 'Kalinga', 'Ay-yeng Manabo': 'Kalinga',
  'Dao-angan': 'Kalinga', 'Kilong-olao': 'Kalinga', 'Bao-yan': 'Kalinga', 'Amti': 'Kalinga', 'Danac': 'Kalinga',
  'Bengued': 'Abra', 'Sappaac': 'Abra', 'Saccaang': 'Abra',
  'Baguio': 'Benguet',
  'Santiago City': 'Isabela',
  'Dagupan': 'Pangasinan', 'Mangatarem': 'Pangasinan', 'Laoak Langka': 'Pangasinan', 'Orbiztondo': 'Pangasinan',
  'Malasique, Bolaoit': 'Pangasinan', 'Taloyan': 'Pangasinan', 'Binmaley': 'Pangasinan', 'San Carlos': 'Pangasinan',
  'Manaoag': 'Pangasinan', 'Pozorrobio': 'Pangasinan', 'Alcala': 'Pangasinan', 'Pacpaco, San Manuel': 'Pangasinan',
  'Meycauayan City': 'Bulacan', 'San Jose Del Monte': 'Bulacan',
  'Camalig': 'Albay',
  'Victoria': 'Tarlac', 'Bambanaba, Cuyapo': 'Tarlac',
  'Zapote': 'Cavite', 'Valenzuela City': 'Metro Manila', 'Tandang Sora, Quezon City': 'Metro Manila',
  'COA, Quezon City': 'Metro Manila', 'Payatas, Quezon City': 'Metro Manila', 'Malaria, Caloocan': 'Metro Manila',
  'Montalban': 'Rizal',
  'Mandaue': 'Cebu', 'Li-loan': 'Cebu', 'Calero': 'Cebu', 'Compostela': 'Cebu',
  'Butuan City': 'Agusan del Norte', 'RTR': 'Agusan del Norte', 'Jabonga, Bangonay': 'Agusan del Norte',
  'Kasiklan': 'Agusan del Sur', 'San Mateo': 'Agusan del Sur', 'Fatima Kim.13': 'Agusan del Sur',
  'Bayugan': 'Agusan del Sur', 'Ibuan': 'Agusan del Sur', 'Balubo': 'Agusan del Sur', 'Alegria': 'Agusan del Sur',
  'Bonifacio': 'Agusan del Sur', 'Matin-ao': 'Agusan del Sur', 'Ipil': 'Agusan del Sur', 'Kinabigtasan Tago': 'Surigao del Sur'
};

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
const fmtNoDec = (n) => `₱${(Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtShort = (n) => { const v = Number(n) || 0; return v >= 1000 ? `₱${(v/1000).toFixed(1)}k` : `₱${v.toLocaleString()}`; };
const PIE_COLORS = ['#0D1F45', '#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

const METHOD_MAP = { 'bank': 'Bank Transfer', 'bank transfer': 'Bank Transfer', 'gcash': 'E-Wallet', 'maya': 'E-Wallet', 'grab_pay': 'E-Wallet', 'e-wallet': 'E-Wallet', 'ewallet': 'E-Wallet', 'cash': 'Cash', 'check': 'Check', 'cheque': 'Check', 'manual': 'Manual' };
const normalizeMethod = (m) => METHOD_MAP[(m || '').toLowerCase()] || m;

const ChartFooter = ({ period, location, generatedAt }) => (
  <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #f1f5f9', textAlign: 'center', lineHeight: '1.3' }}>
    <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>Source: IsangDiwa · {period} · {location}</p>
    {generatedAt && (
      <>
        <p style={{ margin: 0, fontSize: '10px', fontWeight: 600, color: '#64748b' }}>Generated by IsangDiwa AI · {new Date(generatedAt).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</p>
        <p style={{ margin: 0, fontSize: '9px', color: '#94a3b8' }}>This report was generated using artificial intelligence. Please verify critical data points before making decisions.</p>
      </>
    )}
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

const CustomNonZeroTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload || !payload.length) return null;
  const filtered = payload.filter(p => {
    if (p.value === null || p.value === undefined || p.value === 0 || p.value === '0') return false;
    if (typeof p.value === 'string' && (p.value === '₱0.00' || p.value === '₱0' || p.value.startsWith('₱0.'))) return false;
    return true;
  });

  if (!filtered.length) {
    return (
      <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 p-3 rounded-xl shadow-xl font-inter text-xs max-w-xs z-50">
        <p className="font-bold text-slate-800 dark:text-white m-0 border-b border-slate-100 dark:border-white/10 pb-1.5 mb-1.5">{label}</p>
        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
          <span className="text-[11.5px] font-medium">No activity recorded for {label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 p-3 rounded-xl shadow-xl font-inter text-xs max-w-xs z-50">
      <p className="font-bold text-slate-800 dark:text-white m-0 border-b border-slate-100 dark:border-white/10 pb-1.5 mb-1.5">{label}</p>
      <div className="flex flex-col gap-1.5">
        {filtered.map((item, idx) => {
          let displayVal = item.value;
          let displayName = item.name;
          if (formatter) {
            const res = formatter(item.value, item.name, item);
            if (Array.isArray(res)) {
              displayVal = res[0];
              displayName = res[1] || item.name;
            } else if (res) {
              displayVal = res;
            }
          }
          return (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color || item.fill }} />
                <span className="truncate max-w-[150px]">{displayName}</span>
              </span>
              <span className="font-semibold text-slate-800 dark:text-white tabular-nums">{displayVal}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const renderFormattedSummary = (text, compact = false) => {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  return (
    <div className={`${compact ? 'space-y-1 text-[11px]' : 'space-y-1.5 text-xs sm:text-[13px]'} font-inter text-slate-700 dark:text-slate-200 leading-snug`}>
      {lines.map((line, i) => {
        let isBullet = false;
        let content = line;

        if (content.startsWith('* ') || content.startsWith('- ') || content.startsWith('• ') || /^\d+\.\s+/.test(content)) {
          isBullet = true;
          content = content.replace(/^([*•-]|^\d+\.)\s+/, '');
        }

        const parts = content.split(/(\*\*.*?\*\*)/g);
        const formattedContent = parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={index} className="font-bold text-slate-900 dark:text-white">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        });

        if (isBullet) {
          return (
            <div key={i} className="flex items-start gap-2 pl-0.5" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', paddingLeft: '2px' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1 shrink-0" style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#2563eb', marginTop: '5px', flexShrink: 0, display: 'inline-block' }} />
              <div className="flex-1 text-slate-700 dark:text-slate-300 font-medium" style={{ flex: 1, color: '#374151', fontWeight: 500, fontSize: compact ? '11px' : undefined }}>
                {formattedContent}
              </div>
            </div>
          );
        }

        const isHeaderLine = i === 0 && !isBullet;
        const isFooterLine = i === lines.length - 1 && !isBullet && lines.length > 1;

        return (
          <p key={i} className={`m-0 ${isHeaderLine ? 'font-bold text-slate-900 dark:text-white' : isFooterLine ? 'font-medium text-slate-600 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-white/5' : 'font-medium text-slate-800 dark:text-slate-200'}`} style={{ margin: 0, fontSize: compact ? (isHeaderLine ? '11.5px' : isFooterLine ? '10.5px' : '11px') : undefined, color: isFooterLine ? '#4b5563' : undefined, paddingTop: isFooterLine ? '4px' : undefined, marginTop: isFooterLine ? '4px' : undefined, borderTop: isFooterLine ? '1px solid #f1f5f9' : undefined }}>
            {formattedContent}
          </p>
        );
      })}
    </div>
  );
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

  // Build location label from filters / report data
  const getLocationLabel = () => {
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

      // Find all .a4-page elements inside the report
      const pages = element.querySelectorAll('.a4-page');
      
      if (pages.length > 0) {
        // Page-by-page export for A4 paper layout
        const html2canvas = (await import('html2canvas')).default;
        const { jsPDF } = await import('jspdf');
        
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const pdfW = 210; // A4 width in mm
        const pdfH = 297; // A4 height in mm

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          // Temporarily remove box-shadow for clean capture
          const origShadow = page.style.boxShadow;
          page.style.boxShadow = 'none';
          
          const canvas = await html2canvas(page, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: 794,
            windowWidth: 794,
          });
          
          page.style.boxShadow = origShadow;
          
          const imgData = canvas.toDataURL('image/jpeg', 0.98);
          
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
        }
        
        pdf.save(filename);
      } else {
        // Fallback: legacy html2pdf for non-paper layouts
        const styleId = 'pdf-export-style';
        let styleEl = document.getElementById(styleId);
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = styleId;
          document.head.appendChild(styleEl);
        }
        styleEl.innerHTML = `
          .exporting-pdf .no-print { display: none !important; }
          .exporting-pdf { background: #ffffff !important; }
        `;
        const opt = {
          margin: [0, 0, 0, 0],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0, scrollX: 0, windowWidth: 794, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css'], before: '.a4-page-break' },
        };
        const html2pdf = (await import('html2pdf.js')).default;
        element.classList.add('exporting-pdf');
        await html2pdf().set(opt).from(element).save();
        element.classList.remove('exporting-pdf');
        if (styleEl) styleEl.innerHTML = '';
      }
      
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

  const a4W = 794;
  const a4Style = { width: `${a4W}px`, minHeight: '1120px', maxHeight: '1120px', padding: '32px 36px', background: '#ffffff', boxShadow: '0 2px 24px rgba(0,0,0,0.08)', borderRadius: '0', boxSizing: 'border-box', overflow: 'hidden', position: 'relative', fontFamily: "'Inter', sans-serif", color: '#0f172a', display: 'flex', flexDirection: 'column' };

  return (
    <div className="flex flex-col p-6 max-w-[1400px] mx-auto w-full min-h-screen bg-slate-100 dark:bg-[#161922] font-inter text-slate-800 dark:text-slate-200 gap-6">

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Header ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="m-0 font-inter text-2xl font-bold text-slate-800 dark:text-white">Automated Report</h1>
          <p className="m-0 font-inter text-sm text-slate-500 dark:text-slate-400 mt-1">AI-generated operational analysis with detailed breakdowns</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          {report && (
            <>
              <button
                className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 active:scale-[0.98] flex items-center gap-2 cursor-pointer disabled:opacity-80"
                onClick={handleExportPDF}
                disabled={exporting}
              >
                {exporting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
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

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Filter Bar ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
          className="h-10 px-6 rounded-lg font-inter text-sm font-semibold transition-all duration-200 border-none bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed"
          onClick={handleGenerateClick}
          disabled={loading}
        >
          {loading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate Report
            </>
          )}
        </button>
      </div>

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Specific Communities Selector ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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

      {/* ── Skeleton Loading State ── */}
      {loading && (() => {
        const skelW = typeof window !== 'undefined' ? window.innerWidth : 794;
        const skelScale = Math.min(1, (skelW - 48) / 794);
        const skelPageStyle = { ...a4Style, background: '#fff' };
        const shimmer = 'bg-slate-200 dark:bg-slate-700/80 rounded';
        const shimmerLg = 'bg-slate-100 dark:bg-slate-800/50 rounded-lg';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', transform: skelScale < 1 ? `scale(${skelScale})` : 'none', transformOrigin: 'top center', width: skelScale < 1 ? '794px' : 'auto', margin: skelScale < 1 ? '0 auto' : undefined }} className="animate-pulse">

            {/* PAGE 1 Skeleton — Executive Summary / YoY */}
            <div style={skelPageStyle}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>
                  <div className={`h-5 w-56 ${shimmer}`}></div>
                  <div className={`h-4 w-32 ${shimmer}`}></div>
                </div>

                {/* AI Summary block */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '14px' }}>
                  <div className={`h-3 w-32 ${shimmer} mb-3`}></div>
                  <div className="space-y-2">
                    <div className={`h-3 w-full ${shimmer}`}></div>
                    <div className={`h-3 w-11/12 ${shimmer}`}></div>
                    <div className={`h-3 w-4/5 ${shimmer}`}></div>
                    <div className={`h-3 w-3/4 ${shimmer}`}></div>
                  </div>
                </div>

                {/* 3 Stat Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ border: '1px solid #e2e8f0', padding: '10px' }}>
                      <div className={`h-2.5 w-20 ${shimmer} mb-2`}></div>
                      <div className={`h-6 w-24 ${shimmer}`}></div>
                    </div>
                  ))}
                </div>

                {/* 2 Charts side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ border: '1px solid #e2e8f0', padding: '12px' }}>
                      <div className={`h-3.5 w-40 ${shimmer} mb-1`}></div>
                      <div className={`h-3 w-56 ${shimmer} mb-3`}></div>
                      <div className={`h-52 w-full ${shimmerLg}`}></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PAGE 2 Skeleton — Attendance Overview */}
            <div style={skelPageStyle}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>
                  <div className={`h-5 w-44 ${shimmer}`}></div>
                  <div className={`h-4 w-28 ${shimmer}`}></div>
                </div>

                {/* Full width chart */}
                <div style={{ border: '1px solid #e2e8f0', padding: '12px' }}>
                  <div className={`h-3.5 w-64 ${shimmer} mb-1`}></div>
                  <div className={`h-3 w-80 ${shimmer} mb-3`}></div>
                  <div className={`h-64 w-full ${shimmerLg}`}></div>
                  {/* Legend dots */}
                  <div className="flex flex-wrap gap-4 mt-3 pt-3" style={{ borderTop: '1px solid #f1f5f9' }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${shimmer}`}></div>
                        <div className={`h-2.5 w-16 ${shimmer}`}></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2 Charts row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ border: '1px solid #e2e8f0', padding: '12px' }}>
                      <div className={`h-3.5 w-36 ${shimmer} mb-1`}></div>
                      <div className={`h-3 w-48 ${shimmer} mb-3`}></div>
                      <div className={`h-48 w-full ${shimmerLg}`}></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PAGE 3 Skeleton — Donations Overview */}
            <div style={skelPageStyle}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>
                  <div className={`h-5 w-40 ${shimmer}`}></div>
                  <div className={`h-4 w-28 ${shimmer}`}></div>
                </div>

                {/* 3 Stat Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ border: '1px solid #e2e8f0', padding: '10px' }}>
                      <div className={`h-2.5 w-24 ${shimmer} mb-2`}></div>
                      <div className={`h-6 w-20 ${shimmer}`}></div>
                    </div>
                  ))}
                </div>

                {/* Pie + Bar side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '4fr 6fr', gap: '8px' }}>
                  <div style={{ border: '1px solid #e2e8f0', padding: '12px' }}>
                    <div className={`h-3.5 w-36 ${shimmer} mb-3`}></div>
                    <div className={`h-44 w-44 rounded-full mx-auto ${shimmerLg}`}></div>
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', padding: '12px' }}>
                    <div className={`h-3.5 w-40 ${shimmer} mb-1`}></div>
                    <div className={`h-3 w-56 ${shimmer} mb-3`}></div>
                    <div className={`h-52 w-full ${shimmerLg}`}></div>
                  </div>
                </div>

                {/* Table skeleton */}
                <div style={{ border: '1px solid #e2e8f0', padding: '12px' }}>
                  <div className={`h-3.5 w-48 ${shimmer} mb-3`}></div>
                  <div className="space-y-2">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="flex gap-4">
                        <div className={`h-3 w-32 ${shimmer}`}></div>
                        <div className={`h-3 w-20 ${shimmer}`}></div>
                        <div className={`h-3 w-16 ${shimmer}`}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        );
      })()}


      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Error ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      {error && !loading && (
        <div className="p-6 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-xl font-inter text-sm flex items-center gap-3">
          <p>⚠️ {error}</p>
          <button onClick={generateReport}>Try Again</button>
        </div>
      )}

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Report Content ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      {report && !loading && (
        <div className="flex flex-col gap-3.5" ref={reportRef}>

          {/* Report Header (print/PDF) */}
          <div className="hidden print:block mb-4 pb-2 border-b-2 border-slate-800 dark:border-white">
            <h1 className="text-xl font-bold">IsangDiwa Financial Report</h1>
            <p className="text-xs">Period: {report.period}</p>
            {report.community && <p className="text-xs">Location: {report.community}</p>}
            <p className="text-xs">Generated: {new Date(report.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>


                    {/* Main Admin A4 Paper Layout Wrapper */}
          {(adminRole === 'admin') && (() => {
            const vpW = typeof window !== 'undefined' ? window.innerWidth : a4W;
            const scale = Math.min(1, (vpW - 48) / a4W);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', transform: scale < 1 ? `scale(${scale})` : 'none', transformOrigin: 'top center', width: scale < 1 ? `${a4W}px` : 'auto', margin: scale < 1 ? '0 auto' : undefined, marginBottom: '32px' }}>

          {/* === Year-over-Year Comparative Analysis === */}
          {report.comparison && (
            <div className="a4-page a4-page-break" style={a4Style}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0D1F45', paddingBottom: '8px', marginBottom: '4px' }}>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0D1F45' }}>Year-over-Year Comparison</h2>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>
                    {report.comparison.currentPeriod} vs {report.comparison.prevPeriod}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>

                {/* Donations Comparison */}
                {report.comparison.donations && (() => {
                  const d = report.comparison.donations;
                  const barData = [
                    { label: 'Total Amount', current: d.current, previous: d.previous },
                    { label: 'Transactions', current: d.currentCount, previous: d.previousCount },
                  ];
                  return (
                    <div style={{ border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Donations — Period Over Period</h3>
                      <p style={{ margin: '2px 0 4px', fontSize: '11px', color: '#6b7280' }}>
                        Current: <strong>{fmt(d.current)}</strong> · Previous: <strong>{fmt(d.previous)}</strong>
                        {d.change !== null && <> · Change: <strong className={d.change >= 0 ? 'fin-change-positive' : 'fin-change-negative'}>{d.change >= 0 ? '+' : ''}{d.change}%</strong></>}
                      </p>
                      <ResponsiveContainer width="100%" height={240}>
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
                      <div className="flex flex-wrap items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
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
                      
                    </div>
                  );
                })()}

                {/* Attendance Comparison */}
                {report.comparison.attendance && (() => {
                  const a = report.comparison.attendance;
                  const barData = [{ label: 'Total Attendance', current: a.current, previous: a.previous }];
                  return (
                    <div style={{ border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Attendance — Period Over Period</h3>
                      <p style={{ margin: '2px 0 4px', fontSize: '11px', color: '#6b7280' }}>
                        Current: <strong>{a.current} attendees</strong> · Previous: <strong>{a.previous} attendees</strong>
                        {a.change !== null && <> · Change: <strong className={a.change >= 0 ? 'fin-change-positive' : 'fin-change-negative'}>{a.change >= 0 ? '+' : ''}{a.change}%</strong></>}
                      </p>
                      <ResponsiveContainer width="100%" height={240}>
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
                      <div className="flex flex-wrap items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
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
                      
                    </div>
                  );
                })()}
              {/* Loans Comparison */}
              {report.comparison.loans && (
                <div style={{ border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Loans — Period Over Period</h3>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">
                      Applications: <strong>{report.comparison.loans.currentApps}</strong> vs <strong>{report.comparison.loans.previousApps}</strong>
                      {report.comparison.loans.changeApps !== null && <> (<strong className={report.comparison.loans.changeApps >= 0 ? 'fin-change-positive' : 'fin-change-negative'}>{report.comparison.loans.changeApps >= 0 ? '+' : ''}{report.comparison.loans.changeApps}%</strong>)</>}
                    </p>
                    <ResponsiveContainer width="100%" height={240}>
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
                    <div className="flex flex-wrap items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                      <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#0D1F45' }} />
                        <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{report.comparison.currentPeriod}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#93c5fd' }} />
                        <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{report.comparison.prevPeriod}</span>
                      </div>
                    </div>
                  </div>
                )}

              {/* Disbursements Comparison */}
              {report.comparison.disbursements && (
                <div style={{ border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h3 className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">Disbursements — Period Over Period</h3>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">
                      Current: <strong>{fmt(report.comparison.disbursements.current)}</strong> · Previous: <strong>{fmt(report.comparison.disbursements.previous)}</strong>
                      {report.comparison.disbursements.change !== null && <> · Change: <strong className={report.comparison.disbursements.change >= 0 ? 'fin-change-positive' : 'fin-change-negative'}>{report.comparison.disbursements.change >= 0 ? '+' : ''}{report.comparison.disbursements.change}%</strong></>}
                    </p>
                    <ResponsiveContainer width="100%" height={240}>
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
                    <div className="flex flex-wrap items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
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
                    
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

          {/* PAGE 2: Attendance Overview — A4 Paper Format */}
          {report.attendance && adminRole === 'admin' && (report.reportType === 'all' || report.reportType === 'attendance') && (
            <div className="a4-page a4-page-break" style={a4Style}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0D1F45', paddingBottom: '8px', marginBottom: '4px' }}>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0D1F45' }}>Attendance Overview</h2>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>{report.period}</span>
                </div>

              {/* Attendance Trends */}
              {report.attendance?.byMonth?.length > 0 && (() => {
                const byMonthMap = {};
                (report.attendance.byMonth || []).forEach(d => { byMonthMap[d.month] = d.count; });
                const { from, to } = getChartMonthRange();
                const bmc = report.attendance.byMonthByCommunity || {};
                const allCommunities = [...new Set(Object.values(bmc).flatMap(obj => Object.keys(obj)))].sort();
                const isMulti = allCommunities.length >= 2;

                if (!isMulti) return null;

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
                  <div style={{ gridTemplateColumns: '1fr', marginTop: '16px' }}>
                    <div style={{ border: "1px solid #e2e8f0", padding: "12px", background: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
                      <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>Monthly Attendance Trend (By Community)</h3>
                      <p style={{ margin: "2px 0 4px", fontSize: "11px", color: "#6b7280" }}>
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
                          <Tooltip content={<CustomNonZeroTooltip formatter={(v, name) => [
                            `${v} attendees`,
                            name === 'Others' ? `Others (${otherSeries.length} communities)` : name
                          ]} />} />
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
                          const totalVal = totals[s] || 0;
                          if (totalVal > 0) {
                            const prov = branchToProv[s] || 'Unknown';
                            if (!seriesByProv[prov]) seriesByProv[prov] = [];
                            seriesByProv[prov].push({ name: s, index: i, total: totalVal });
                          }
                        });
                        return (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #f1f5f9" }}>
                            {Object.entries(seriesByProv).map(([prov, comms]) => (
                              <div key={prov} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ fontSize: "10px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "3px", marginBottom: "3px" }}>{prov}</div>
                                {comms.map(c => (
                                  <div key={c.name} style={{ margin: 0 }}>
                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: COMMUNITY_COLORS[c.index % COMMUNITY_COLORS.length] }} />
                                    <span style={{ fontSize: "10px", color: "#4b5563" }}>{c.name}</span>
                                    <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '4px' }}>({c.total} attendees)</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                            {hasOthers && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ fontSize: "10px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "3px", marginBottom: "3px" }}>Others</div>
                                <div style={{ margin: 0 }}>
                                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: '#d1d5db' }} />
                                  <span style={{ fontSize: "10px", color: "#4b5563" }}>{otherSeries.length} more communities</span>
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
                        <p style={{ display: "block", fontSize: "10px", color: "#94a3b8", marginTop: "6px", textAlign: "center" }}>
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
              <ChartFooter period={report.period} location={getLocationLabel()} />
            </div>
        )}

          {/* PAGE 3: Donations Overview */}
          {report.donations && adminRole === 'admin' && (report.reportType === 'all' || report.reportType === 'donations') && (
            <div className="a4-page a4-page-break" style={a4Style}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0D1F45', paddingBottom: '8px', marginBottom: '4px' }}>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0D1F45' }}>Donations Overview</h2>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>{report.period}</span>
                </div>

              {/* Donation Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '6px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '7px 10px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Donations</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>{fmt(report.donations.total)}</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '7px 10px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transaction Count</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{report.donations.count}</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '7px 10px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg per Transaction</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                    {fmt(report.donations.count > 0 ? report.donations.total / report.donations.count : 0)}
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div style={{ display: 'grid', gridTemplateColumns: report.donations.byCategory?.length > 0 ? '4fr 6fr' : '1fr', gap: '8px' }}>
                {/* By Category */}
                {report.donations.byCategory?.length > 0 && (
                  <div style={{ border: "1px solid #e2e8f0", padding: "12px", background: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>Donations By Category</h3>
                    <p style={{ margin: "2px 0 4px", fontSize: "11px", color: "#6b7280" }}>Total: <strong>{fmt(report.donations.total)}</strong> · {report.donations.byCategory.length} categories</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={report.donations.byCategory} cx="50%" cy="45%" innerRadius={38} outerRadius={82} paddingAngle={2} dataKey="value" nameKey="name" label={renderSliceLabel} labelLine={false}>
                          {report.donations.byCategory.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #f1f5f9" }}>
                      {report.donations.byCategory.map((cat, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "#4b5563" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span style={{ fontSize: "10px", color: "#4b5563" }}>{cat.name}</span>
                          <span style={{ fontWeight: 700, color: "#0f172a", marginLeft: "4px" }}>{fmt(cat.value)} · {report.donations.total > 0 ? ((cat.value / report.donations.total) * 100).toFixed(0) : 0}%</span>
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
                  let topDonCommName = '';
                  let topDonCommVal = 0;
                  if (highestMon && isMulti && allSeries.length > 0) {
                    allSeries.forEach(s => {
                      const val = highestMon[s] || 0;
                      if (val > topDonCommVal) {
                        topDonCommVal = val;
                        topDonCommName = s;
                      }
                    });
                  }
                  
                  return (
                    <div style={{ border: "1px solid #e2e8f0", padding: "12px", background: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>{chartTitle}</h3>
                      <p style={{ margin: "2px 0 4px", fontSize: "11px", color: "#6b7280" }}>Total: <strong>{fmt(totalDon)}</strong> · Highest: <strong>{highestMon?.month} ({fmt(highestMon?.value || 0)})</strong>{topDonCommName ? <> · Top Community: <strong>{topDonCommName} ({fmt(topDonCommVal)})</strong></> : null}</p>
                      <ResponsiveContainer width="100%" height={isMulti ? 280 : 265}>
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
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '16px' }}>
                            {Object.entries(seriesByProv).map(([prov, seriesList]) => {
                              const activeSeries = seriesList.filter(s => seriesWithData.includes(s.name));
                              if (activeSeries.length === 0) return null;
                              return (
                                <div key={prov} style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                                  {!showProvinceTrend && (
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '2px' }}>
                                      {prov}
                                    </div>
                                  )}
                                  {activeSeries.map((s) => {
                                    const totalVal = fullMonthData.reduce((sum, row) => sum + (row[s.name] || 0), 0);
                                    return (
                                      <div key={s.name} style={{ display: 'inline-flex', alignItems: 'center', margin: '3px 0', lineHeight: '14px' }}>
                                        <span style={{ width: '8px', height: '8px', minWidth: '8px', minHeight: '8px', borderRadius: '50%', backgroundColor: COMMUNITY_COLORS[s.index % COMMUNITY_COLORS.length], display: 'inline-block', flexShrink: 0, marginRight: '6px' }} />
                                        <span style={{ fontSize: '11px', fontWeight: 500, color: '#374151', lineHeight: '14px' }}>{s.name}</span>
                                        <span style={{ fontSize: '10px', color: '#6b7280', marginLeft: '5px', lineHeight: '14px' }}>({fmt(totalVal)})</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}

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
                  <div style={{ gridTemplateColumns: '1fr', marginTop: '16px' }}>
                    <div style={{ border: "1px solid #e2e8f0", padding: "12px", background: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "space-between", width: '100%' }}>
                      <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>Monthly Donation Trend (By Community)</h3>
                      <p style={{ margin: "2px 0 4px", fontSize: "11px", color: "#6b7280" }}>
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
                          <Tooltip content={<CustomNonZeroTooltip formatter={(v, name) => [fmt(v), name === 'Others' ? `Others (${otherSeries.length} communities)` : name]} />} />
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
                          const totalVal = totals[s] || 0;
                          if (totalVal > 0) {
                            const prov = branchToProv[s] || 'Unknown';
                            if (!seriesByProv[prov]) seriesByProv[prov] = [];
                            seriesByProv[prov].push({ name: s, index: i, total: totalVal });
                          }
                        });
                        return (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #f1f5f9" }}>
                            {Object.entries(seriesByProv).map(([prov, seriesList]) => (
                              <div key={prov} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ fontSize: "10px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "3px", marginBottom: "3px" }}>{prov}</div>
                                {seriesList.map(s => (
                                  <div key={s.name} style={{ margin: 0 }}>
                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: COMMUNITY_COLORS[s.index % COMMUNITY_COLORS.length] }} />
                                    <span style={{ fontSize: "10px", color: "#4b5563" }}>{s.name}</span>
                                    <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '4px' }}>({fmt(s.total)})</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                            {hasOthers && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ fontSize: "10px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "3px", marginBottom: "3px" }}>Others</div>
                                <div style={{ margin: 0 }}>
                                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: '#d1d5db' }} />
                                  <span style={{ fontSize: "10px", color: "#4b5563" }}>{otherSeries.length} more communities</span>
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
                        <p style={{ display: "block", fontSize: "10px", color: "#94a3b8", marginTop: "6px", textAlign: "center" }}>
                          ℹ️ Chart shows top 10 communities by total donation. {otherSeries.length} smaller communities
                          ({otherSeries.join(', ')}) are merged into "Others".
                        </p>
                      )}

                      <ChartFooter period={report.period} location={getLocationLabel()} />
                    </div>
                  </div>
                );
              })()}

              {/* Top Communities & Top 8 Donators Side-by-Side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {/* Top Donor Communities Bar Chart */}
                {report.donations.byBranch?.length > 0 && (
                  <div style={{ border: "1px solid #e2e8f0", padding: "12px", background: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>Top Donor Communities</h3>
                    <p style={{ margin: "2px 0 4px", fontSize: "11px", color: "#6b7280" }}>Top: <strong>{report.donations.byBranch[0]?.branch}</strong> · {fmt(report.donations.byBranch[0]?.value)} ({report.donations.total > 0 ? ((report.donations.byBranch[0]?.value / report.donations.total) * 100).toFixed(1) : 0}%)</p>
                    <ResponsiveContainer width="100%" height={265}>
                      <BarChart data={report.donations.byBranch.slice(0, 8)} margin={{ top: 15, right: 10, left: -10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="branch" tick={{ fontSize: 9, angle: -35, textAnchor: 'end' }} interval={0} height={50} />
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
                  <div style={{ border: "1px solid #e2e8f0", padding: "12px", background: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>Top {topDonors.length} Donators</h3>
                    <p style={{ margin: "2px 0 4px", fontSize: "11px", color: "#6b7280" }}>#1: <strong>{topDonors[0]?.donor}</strong> · {fmt(topDonors[0]?.value)} ({report.donations.total > 0 ? ((topDonors[0]?.value / report.donations.total) * 100).toFixed(0) : 0}%)</p>
                    <ResponsiveContainer width="100%" height={Math.max(220, topDonors.length * 30)}>
                      <BarChart data={topDonors} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`}>
                          <Label value="Amount (₱)" position="bottom" offset={-5} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                        </XAxis>
                        <YAxis type="category" dataKey="donor" tick={{ fontSize: 10 }} width={140} />
                        <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                          {topDonors.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? '#2563eb' : '#0D1F45'} />
                          ))}
                          <LabelList dataKey="value" position="right" formatter={v => fmtShort(v)} style={{ fontSize: 10, fill: '#6B7280' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "8px", paddingTop: "6px", borderTop: "1px solid #f1f5f9" }}>
                      {topDonors.slice(0, 5).map((d, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "#4b5563" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: i === 0 ? '#2563eb' : '#0D1F45' }} />
                          <span style={{ fontSize: "10px", color: "#4b5563" }}>{d.donor}</span>
                          <span style={{ fontWeight: 700, color: "#0f172a", marginLeft: "4px" }}>{fmt(d.value)} · {report.donations.total > 0 ? ((d.value / report.donations.total) * 100).toFixed(0) : 0}%</span>
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
                <div style={{ gridTemplateColumns: '1fr', marginTop: '16px' }}>
                  <div style={{ border: "1px solid #e2e8f0", padding: "12px", background: "#ffffff", display: "flex", flexDirection: "column" }}>
                    <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>Donations Breakdown By Community</h3>
                    <div style={{ width: "100%", overflow: "hidden", maxHeight: '400px' }}>
                      <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 600, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", whiteSpace: "nowrap" }}>Community</th>
                            <th style={{ padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 600, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", whiteSpace: "nowrap" }}>Amount</th>
                            <th style={{ padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 600, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", whiteSpace: "nowrap" }}>% of Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.donations.byBranch.map((b, i) => (
                            <tr key={i}>
                              <td style={{ padding: "6px 12px", borderBottom: "1px solid #f1f5f9", fontSize: "11px", color: "#374151" }}>{b.branch}</td>
                              <td style={{ padding: "6px 12px", borderBottom: "1px solid #f1f5f9", fontSize: "11px", color: "#374151", fontWeight: 600 }}>{fmt(b.value)}</td>
                              <td style={{ padding: "6px 12px", borderBottom: "1px solid #f1f5f9", fontSize: "11px", color: "#374151" }}>{report.donations.total > 0 ? ((b.value / report.donations.total) * 100).toFixed(1) : 0}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              <ChartFooter period={report.period} location={getLocationLabel()} />
            </div>
          </div>
        )}

          {/* Attendee List Pages */}
          {report.attendance?.attendees?.length > 0 && adminRole === 'admin' && (report.reportType === 'all' || report.reportType === 'attendance') && (() => {
                const ROWS_PER_PAGE = 50;
                const pages = [];
                for (let i = 0; i < report.attendance.attendees.length; i += ROWS_PER_PAGE) {
                  pages.push(report.attendance.attendees.slice(i, i + ROWS_PER_PAGE));
                }
                return pages.map((pageRows, pageIdx) => (
                  <div key={pageIdx} className="a4-page a4-page-break" style={a4Style}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0D1F45', paddingBottom: '8px', marginBottom: '4px' }}>
                        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0D1F45' }}>Attendee List {pages.length > 1 ? `(${pageIdx + 1}/${pages.length})` : ''}</h2>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>{report.period} · {report.attendance.attendees.length} records</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            {['#', 'Member', 'Community', 'Service', 'Date', 'Time In', 'Status'].map(h => (
                              <th key={h} style={{ padding: '2px 6px', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 700, fontSize: '8px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((a, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '3px 6px', color: '#6b7280' }}>{pageIdx * ROWS_PER_PAGE + i + 1}</td>
                              <td style={{ padding: '3px 6px', fontWeight: 600, color: '#0f172a' }}>{a.name}</td>
                              <td style={{ padding: '3px 6px', color: '#374151' }}>{a.branch}</td>
                              <td style={{ padding: '3px 6px', color: '#374151' }}>{a.service}</td>
                              <td style={{ padding: '3px 6px', color: '#374151' }}>{a.date}</td>
                              <td style={{ padding: '3px 6px', color: '#374151' }}>{a.time}</td>
                              <td style={{ padding: '3px 6px' }}>
                                <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '3px', background: a.status === 'Present' ? '#dcfce7' : '#fee2e2', color: a.status === 'Present' ? '#166534' : '#991b1b', fontWeight: 600 }}>{a.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>{/* end list page flex */}
                    <ChartFooter period={report.period} location={getLocationLabel()} generatedAt={report.generatedAt} />
                  </div>
                ));
              })()}

          {/* Close Main Admin A4 Layout Wrapper */}
              </div>
            );
          })()}

          {/* Loans Section - Only for Loan Admin — A4 Paper Format */}
          {report.loans && adminRole === 'loanAdmin' && (
            <React.Fragment>

              {/* PAGE 1 — Loan Portfolio Executive Overview */}
              <div className="a4-page" style={a4Style}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Page Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0D1F45', paddingBottom: '8px', marginBottom: '4px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0D1F45' }}>Loan Staff Report</h2>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>{report.period}</span>
                  </div>

                  {/* AI Executive Summary */}
                  {report.executiveSummary && (
                    <div style={{ border: '1px solid #e2e8f0', padding: '10px 14px', marginBottom: '4px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>AI Executive Summary</div>
                      {renderFormattedSummary(report.executiveSummary, true)}
                    </div>
                  )}

                  {/* KPI Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '4px' }}>
                    {[
                      { label: 'Total Applications', value: report.loans.totalApplications, color: '#0f172a' },
                      { label: 'Amount Applied', value: fmt(report.loans.totalAmountApplied), color: '#2563eb' },
                      { label: 'Total Disbursed', value: fmt(report.loans.totalDisbursed), color: '#0f172a' },
                      { label: 'Payments Received', value: fmt(report.loans.totalPaymentsReceived), color: '#059669' },
                      { label: 'Interest Earned', value: fmt(report.loans.totalInterestEarned), color: '#7c3aed' },
                    ].map((k, i) => (
                      <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '0' }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: k.color, marginTop: '2px' }}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Loan Charts Row - Status + Disbursement */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', flex: 1 }}>
                    {/* Loan Status Donut */}
                {report.loans.byStatus?.length > 0 && (
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Loan Status Distribution</h3>
                    <p style={{ margin: '2px 0 4px', fontSize: '11px', color: '#6b7280' }}>Total: <strong>{report.loans.totalApplications} applications</strong> · {report.loans.byStatus.length} statuses</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={report.loans.byStatus.map(s => ({ name: s.status, value: s.count }))}
                          cx="50%" cy="45%"
                          innerRadius={28} outerRadius={60}
                          paddingAngle={2}
                          dataKey="value"
                          label={renderSliceLabel}
                          labelLine={false}
                        >
                          {report.loans.byStatus.map((s, i) => (
                            <Cell key={i} fill={getStatusColor(s.status)} />
                          ))}
                          <Label value={report.loans.totalApplications} position="center" fill="#1e3a5f" style={{ fontSize: '14px', fontWeight: 'bold' }} />
                          <Label value="Total" position="center" dy={14} fill="#6B7280" style={{ fontSize: '9px' }} />
                        </Pie>
                        <Tooltip formatter={(v, name) => [v + ' loans', name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                      {report.loans.byStatus.map((s, i) => {
                        const total = report.loans.totalApplications || 1;
                        const pct = ((s.count / total) * 100).toFixed(0);
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#4b5563' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: getStatusColor(s.status), display: 'inline-block' }} />
                            <span>{s.status}</span>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{s.count} · {pct}%</span>
                          </div>
                        );
                      })}
                    </div>
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

                  const chartTitle = `Monthly Disbursement ${allSeries.length >= 2 ? (showProvinceTrend ? '(By Province)' : '(By Community)') : ''}`;

                  const trendData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                    const i = from + idx;
                    const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                    const existing = byMonthMap[key];
                    const row = { month: key, label, disbursed: existing?.disbursed || 0 };
                    if (isMulti) {
                      allSeries.forEach(s => {
                        row[`disb_${s}`] = disbMap[key]?.[s] || 0;
                      });
                    }
                    return row;
                  });

                  return trendData.length > 0 ? (
                    <div style={{ border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{chartTitle}</h3>
                      <p style={{ margin: '2px 0 4px', fontSize: '11px', color: '#6b7280' }}>Total Disbursed: <strong>{fmt(trendData.reduce((s, d) => s + d.disbursed, 0))}</strong></p>
                      <ResponsiveContainer width="100%" height={isMulti ? 220 : 200}>
                        {isMulti ? (
                          <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                              <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                            </YAxis>
                            <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Disbursed' : name]} />
                            {seriesWithData.map((s) => {
                              const origIdx = allSeries.indexOf(s);
                              return <Bar key={`disb_${s}`} dataKey={`disb_${s}`} name={s} stackId="disb" fill={COMMUNITY_COLORS[origIdx % COMMUNITY_COLORS.length]} />;
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
                            <Bar name="Disbursed" dataKey="disbursed" fill="#0D1F45" radius={[4, 4, 0, 0]} barSize={24}>
                              <LabelList dataKey="disbursed" position="top" formatter={v => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fill: '#6B7280' }} />
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
                                    return (
                                      <div key={s.name} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMMUNITY_COLORS[s.index % COMMUNITY_COLORS.length] }} />
                                          <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{s.name}</span>
                                          <span style={{ fontSize: '9px', color: '#4b5563', marginLeft: '6px' }}>({fmt(totalDisb)})</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                      <ChartFooter period={report.period} location={getLocationLabel()} />
                    </div>
                  ) : null;
                })()}
                  </div>{/* end charts grid */}
                </div>{/* end page 1 flex */}
                <ChartFooter period={report.period} location={getLocationLabel()} generatedAt={report.generatedAt} />
              </div>{/* end page 1 a4 */}

              {/* PAGE 2 — Loan Trends & Analysis */}
              <div className="a4-page a4-page-break" style={a4Style}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0D1F45', paddingBottom: '8px', marginBottom: '4px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0D1F45' }}>Loan Trends &amp; Analysis</h2>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>{report.period}</span>
                  </div>

              {/* Monthly Collection chart on page 2 */}
              {(() => {
                const { from, to } = getChartMonthRange();
                const byMonthMap = {};
                (report.loans.byMonth || []).forEach(d => { byMonthMap[d.month] = d; });
                const collMap2 = report.loans.byMonthByCommunity?.collected || {};
                let allSeries2 = [...new Set(Object.values(collMap2).flatMap(obj => Object.keys(obj)))].sort();
                const seriesWithData2 = allSeries2.filter(s => Object.values(collMap2).some(m => (m[s]||0) > 0));
                if (seriesWithData2.length < 2) return null;
                const trendData2 = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                  const i = from + idx;
                  const key = `${reportYear}-${String(i+1).padStart(2,'0')}`;
                  const row = { label, received: byMonthMap[key]?.received||0 };
                  seriesWithData2.forEach(s => { row[`coll_${s}`] = collMap2[key]?.[s]||0; });
                  return row;
                });
                return (
                  <div style={{ border: '1px solid #e2e8f0', padding: '12px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Monthly Collection (By Community)</h3>
                    <p style={{ margin: '2px 0 6px', fontSize: '11px', color: '#6b7280' }}>Total Collected: <strong>{fmt(trendData2.reduce((s,d)=>s+d.received,0))}</strong></p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={trendData2} margin={{ top: 12, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false} />
                        <Tooltip content={<CustomNonZeroTooltip formatter={(v,name) => [fmt(v), name]} />} />
                        {seriesWithData2.map((s) => { const oi = allSeries2.indexOf(s); return <Bar key={`c2_${s}`} dataKey={`coll_${s}`} name={s} stackId="coll" fill={COMMUNITY_COLORS[oi % COMMUNITY_COLORS.length]} />; })}
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px 12px', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                      {seriesWithData2.map((s, i) => {
                        const oi = allSeries2.indexOf(s);
                        const totalColl = trendData2.reduce((sum, row) => sum + (row['coll_' + s] || 0), 0);
                        return (
                          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: COMMUNITY_COLORS[oi % COMMUNITY_COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ color: '#374151', fontWeight: 500 }}>{s}</span>
                            <span style={{ fontSize: '9px', color: '#6b7280' }}>({fmt(totalColl)})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Application Trend + Repayment Performance Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
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
                    <div style={{ border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{chartTitle}</h3>
                      <p style={{ margin: '2px 0 4px', fontSize: '11px', color: '#6b7280' }}>Total: <strong>{totalApps} applications</strong> · Peak: <strong>{trendData[peakIdx]?.label}</strong> ({trendData[peakIdx]?.applications})</p>
                      <ResponsiveContainer width="100%" height={isMulti ? 190 : 170}>
                        {isMulti ? (
                          <BarChart data={trendData} margin={{ top: 12, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                            <Tooltip formatter={(v, name) => [v + ' applications', name === 'applications' ? 'Count' : name]} />
                            {allSeries.map((s, i) => (
                              <Bar key={s} dataKey={s} name={s} stackId="a" fill={COMMUNITY_COLORS[i % COMMUNITY_COLORS.length]} />
                            ))}
                          </BarChart>
                        ) : (
                          <BarChart data={trendData} margin={{ top: 12, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                            <Tooltip formatter={(v) => [v + ' applications']} labelFormatter={(v, payload) => payload?.[0]?.payload?.label || v} />
                            <Bar name="Applications" dataKey="applications" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={18}>
                              <LabelList dataKey="applications" position="top" style={{ fontSize: 9, fill: '#6B7280' }} />
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                      {isMulti && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                          {allSeries.map((s, i) => (
                            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#4b5563' }}>
                              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: COMMUNITY_COLORS[i % COMMUNITY_COLORS.length], display: 'inline-block' }} />
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>
                      )}
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
                <div style={{ marginTop: '8px' }}>
                  {(() => {
                    const { from, to } = getChartMonthRange();
                    const appsMap = {};
                    (report.loans.applicationsByMonth || []).forEach(d => { appsMap[d.month] = d.count; });
                    
                    const dataMap = report.loans.applicationsByMonthByCommunity || {};
                    let allSeries = [...new Set(Object.values(dataMap).flatMap(obj => Object.keys(obj)))].sort();
                    const chartTitle = `Loan Application Trend (By Community)`;
                    const isMulti = allSeries.length >= 2;

                    // Filter communities with actual data and calculate totals
                    const seriesWithData = allSeries.filter(s => Object.values(dataMap).some(monthObj => (monthObj[s] || 0) > 0));
                    const commTotals = {};
                    seriesWithData.forEach(s => {
                      commTotals[s] = Object.values(dataMap).reduce((sum, monthObj) => sum + (monthObj[s] || 0), 0);
                    });
                    const sortedSeries = [...seriesWithData].sort((a, b) => (commTotals[b] || 0) - (commTotals[a] || 0));
                    const isGrouped = sortedSeries.length > 5;
                    const topSeries = isGrouped ? sortedSeries.slice(0, 5) : sortedSeries;
                    const otherSeries = isGrouped ? sortedSeries.slice(5) : [];

                    const trendData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                      const i = from + idx;
                      const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                      const row = { month: key, label, applications: appsMap[key] || 0 };
                      if (isMulti && dataMap[key]) {
                        topSeries.forEach(s => { row[s] = dataMap[key][s] || 0; });
                        if (isGrouped) {
                          row['Others'] = otherSeries.reduce((sum, s) => sum + (dataMap[key][s] || 0), 0);
                        }
                      }
                      return row;
                    });
                    const totalApps = trendData.reduce((s, d) => s + d.applications, 0);
                    const peakIdx = trendData.reduce((maxI, d, i, arr) => d.applications > arr[maxI].applications ? i : maxI, 0);
                    const peakMon = trendData[peakIdx];
                    let topAppCommName = sortedSeries[0] || '';
                    let topAppCommVal = commTotals[topAppCommName] || 0;

                    return trendData.length > 0 ? (
                      <div style={{ border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{chartTitle}</h3>
                        <p style={{ margin: '2px 0 4px', fontSize: '11px', color: '#6b7280' }}>Total: <strong>{totalApps} applications</strong> · Peak: <strong>{peakMon?.label} ({peakMon?.applications || 0})</strong>{topAppCommName ? <> · Top Community: <strong>{topAppCommName} ({topAppCommVal})</strong></> : null}</p>
                        <ResponsiveContainer width="100%" height={isMulti ? 200 : 180}>
                          {isMulti ? (
                            <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} allowDecimals={false}>
                                <Label value="No. of Applications" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                              </YAxis>
                              <Tooltip content={<CustomNonZeroTooltip formatter={(v, name) => [v + ' applications', name === 'applications' ? 'Count' : name]} />} />
                              {topSeries.map((s) => {
                                const origIdx = allSeries.indexOf(s);
                                return <Bar key={s} dataKey={s} name={s} stackId="a" fill={COMMUNITY_COLORS[origIdx % COMMUNITY_COLORS.length]} />;
                              })}
                              {isGrouped && (
                                <Bar key="Others" dataKey="Others" name={`Others (${otherSeries.length} communities)`} stackId="a" fill="#94a3b8" />
                              )}
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
                          topSeries.forEach((s) => {
                            const origIdx = allSeries.indexOf(s);
                            const prov = branchToProv[s] || 'Unknown';
                            if (!seriesByProv[prov]) seriesByProv[prov] = [];
                            seriesByProv[prov].push({ name: s, index: origIdx, count: commTotals[s] || 0 });
                          });
                          
                          return (
                            <div className="flex gap-8 mt-6 pt-4 border-t border-slate-100 dark:border-white/5" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '16px' }}>
                              {Object.entries(seriesByProv).map(([prov, seriesList]) => (
                                <div key={prov} className="flex flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '2px' }}>
                                    {prov}
                                  </div>
                                  {seriesList.map((s) => (
                                    <div key={s.name} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
                                      <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMMUNITY_COLORS[s.index % COMMUNITY_COLORS.length] }} />
                                        <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{s.name}</span>
                                        <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>({s.count} apps)</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ))}
                              {isGrouped && (
                                <div className="flex flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '2px' }}>
                                    Others
                                  </div>
                                  <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#94a3b8' }} />
                                      <span className="font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">{otherSeries.length} more communities</span>
                                      <span style={{ fontSize: '10px', color: '#4B5563', marginLeft: '6px' }}>
                                        ({otherSeries.reduce((sum, k) => sum + (commTotals[k] || 0), 0)} apps)
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {isGrouped && (
                          <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>
                            ℹ️ Chart shows top 5 communities by application volume. {otherSeries.length} smaller communities are grouped into "Others" for readability.
                          </p>
                        )}
                      </div>
                    ) : null;
                   })()}
                </div>
              );
              })()}

              {/* Approval Rate + Repayment Row on page 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                {/* Approval Rate Per Month */}
                {(() => {
                  const { from, to } = getChartMonthRange();
                  const approvalMap = {};
                  (report.loans.approvalByMonth || []).forEach(d => { approvalMap[d.month] = d; });
                  const rateData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                    const i = from + idx;
                    const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                    const existing = approvalMap[key];
                    return { label, approvalRate: existing?.approvalRate || 0, rejectionRate: existing?.rejectionRate || 0, total: existing?.total || 0 };
                  });
                  const totalLoans = rateData.reduce((s, d) => s + d.total, 0);
                  const avgApproval = totalLoans > 0 ? Math.round(rateData.reduce((s, d) => s + d.approvalRate * d.total, 0) / totalLoans) : 0;
                  return (
                    <div style={{ border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Approval Rate Per Month (%)</h3>
                      <p style={{ margin: '2px 0 4px', fontSize: '11px', color: '#6b7280' }}>Avg: <strong style={{color: '#10B981'}}>{avgApproval}%</strong> approval · <strong style={{color: '#EF4444'}}>{100 - avgApproval}%</strong> rejection</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={rateData} margin={{ top: 12, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                          <Tooltip formatter={(v) => `${v}%`} labelFormatter={(v, payload) => payload?.[0]?.payload?.label || v} />
                          <Bar name="Approval %" dataKey="approvalRate" fill="#10B981" radius={[4, 4, 0, 0]} barSize={14} />
                          <Bar name="Rejection %" dataKey="rejectionRate" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={14} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} /><span>Approval %</span><strong style={{ color: '#0f172a', marginLeft: '4px' }}>{avgApproval}% avg</strong></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} /><span>Rejection %</span><strong style={{ color: '#0f172a', marginLeft: '4px' }}>{100 - avgApproval}% avg</strong></div>
                      </div>
                    </div>
                  );
                })()}

                {/* Repayment Rate Per Month */}
                {(() => {
                  const { from, to } = getChartMonthRange();
                  const repMap = {};
                  (report.loans.repaymentByMonth || []).forEach(d => { repMap[d.month] = d; });
                  const repData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                    const i = from + idx;
                    const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                    const ex = repMap[key];
                    return { label, onTimeRate: ex?.onTimeRate || 0, lateRate: ex?.lateRate || 0, total: ex?.total || 0 };
                  });
                  const totalPay = repData.reduce((s, d) => s + d.total, 0);
                  const avgOnTime = totalPay > 0 ? Math.round(repData.reduce((s, d) => s + d.onTimeRate * d.total, 0) / totalPay) : 0;
                  return (
                    <div style={{ border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Repayment Performance (%)</h3>
                      <p style={{ margin: '2px 0 4px', fontSize: '11px', color: '#6b7280' }}>Avg: <strong style={{color: '#2563eb'}}>{avgOnTime}%</strong> on-time · <strong style={{color: '#F59E0B'}}>{100 - avgOnTime}%</strong> late</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={repData} margin={{ top: 12, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                          <Tooltip formatter={(v) => `${v}%`} labelFormatter={(v, payload) => payload?.[0]?.payload?.label || v} />
                          <Bar name="On-Time %" dataKey="onTimeRate" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={14} />
                          <Bar name="Late %" dataKey="lateRate" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={14} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} /><span>On-Time</span><strong style={{ color: '#0f172a', marginLeft: '4px' }}>{avgOnTime}% avg</strong></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} /><span>Late</span><strong style={{ color: '#0f172a', marginLeft: '4px' }}>{100 - avgOnTime}% avg</strong></div>
                      </div>
                    </div>
                  );
                })()}
              </div>

                </div>{/* end page 2 flex */}
                <ChartFooter period={report.period} location={getLocationLabel()} generatedAt={report.generatedAt} />
              </div>{/* end page 2 a4 */}


              {/* PAGE 3 — Savings Overview */}
              {report.savings && (
              <div className="a4-page a4-page-break" style={a4Style}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0D1F45', paddingBottom: '8px', marginBottom: '4px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0D1F45' }}>Savings Overview</h2>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>{report.period}</span>
                  </div>

                  {/* Savings KPIs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginBottom: '6px' }}>
                    {[
                      { label: 'Total Saved', value: fmt(report.savings.totalSaved), color: '#059669' },
                      { label: 'Total Targets', value: fmt(report.savings.totalTargets), color: '#0f172a' },
                      { label: 'Overall Progress', value: report.savings.overallProgress > 0 && report.savings.overallProgress < 1 ? '<1%' : `${report.savings.overallProgress}%`, color: '#2563eb' },
                      { label: 'Period Deposits', value: fmt(report.savings.periodDeposits), color: '#0f172a' },
                      { label: 'Active Goals', value: report.savings.activeGoals, color: '#0f172a' },
                      { label: 'Completed Goals', value: report.savings.completedGoals, color: '#059669' },
                    ].map((k, i) => (
                      <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '7px 10px' }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: k.color, marginTop: '2px' }}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Savings Progress Bar */}
                  <div style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                      <span>Overall Savings Progress</span>
                      <strong style={{ color: '#0f172a' }}>{report.savings.overallProgress > 0 && report.savings.overallProgress < 1 ? '<1%' : `${report.savings.overallProgress}%`}</strong>
                    </div>
                    <div style={{ height: '8px', width: '100%', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#2563eb', borderRadius: '4px', width: `${Math.max(report.savings.overallProgress > 0 ? 1 : 0, Math.min(100, report.savings.overallProgress))}%` }} />
                    </div>
                    <p style={{ fontSize: '9px', color: '#9ca3af', margin: '3px 0 0' }}>{fmt(report.savings.totalSaved)} saved out of {fmt(report.savings.totalTargets)} target</p>
                  </div>

                  {/* Savings Charts */}
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 7fr', gap: '8px' }}>
                    {/* Goals Donut */}
                    {(report.savings.activeGoals > 0 || report.savings.completedGoals > 0) && (
                      <div style={{ border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Savings Goals Status</h3>
                        <p style={{ margin: '2px 0 4px', fontSize: '11px', color: '#6b7280' }}>Total: <strong>{report.savings.activeGoals + report.savings.completedGoals} goals</strong> · Progress: <strong>{report.savings.overallProgress}%</strong></p>
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie data={[{ name: 'Active', value: report.savings.activeGoals }, { name: 'Completed', value: report.savings.completedGoals }]} cx="50%" cy="42%" innerRadius={28} outerRadius={60} paddingAngle={3} dataKey="value" label={renderSliceLabel} labelLine={false}>
                              <Cell fill="#2563EB" />
                              <Cell fill="#10B981" />
                              <Label value={report.savings.activeGoals + report.savings.completedGoals} position="center" fill="#1e3a5f" style={{ fontSize: '14px', fontWeight: 'bold' }} />
                              <Label value="Goals" position="center" dy={14} fill="#6B7280" style={{ fontSize: '9px' }} />
                            </Pie>
                            <Tooltip formatter={(v, name) => [v + ' goals', name]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                          {[{ name: 'Active', color: '#2563EB', val: report.savings.activeGoals }, { name: 'Completed', color: '#10B981', val: report.savings.completedGoals }].map((item, i) => {
                            const total = report.savings.activeGoals + report.savings.completedGoals || 1;
                            return (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#4b5563' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: item.color, display: 'inline-block' }} /><span>{item.name}</span><strong style={{ color: '#0f172a' }}> {item.val} · {((item.val/total)*100).toFixed(0)}%</strong></div>);
                          })}
                        </div>
                      </div>
                    )}

                    {/* Monthly Savings Trend */}
                    {(() => {
                      const { from, to } = getChartMonthRange();
                      const byMonthMap = {};
                      (report.savings.byMonth || []).forEach(d => { byMonthMap[d.month] = d; });
                      const savingsData = MONTH_SHORT.slice(from, to + 1).map((label, idx) => {
                        const i = from + idx;
                        const key = `${reportYear}-${String(i + 1).padStart(2, '0')}`;
                        const ex = byMonthMap[key];
                        return { label, deposits: ex?.deposits || 0, withdrawals: ex?.withdrawals || 0 };
                      });
                      return (
                        <div style={{ border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Savings Trend (Deposits vs Withdrawals)</h3>
                          <p style={{ margin: '2px 0 4px', fontSize: '11px', color: '#6b7280' }}>Total Saved: <strong>{fmt(report.savings.totalSaved)}</strong> · Deposits: <strong style={{color: '#10B981'}}>{fmt(report.savings.periodDeposits)}</strong> · Withdrawals: <strong style={{color: '#EF4444'}}>{fmt(report.savings.periodWithdrawals)}</strong></p>
                          <ResponsiveContainer width="100%" height={190}>
                            <BarChart data={savingsData} margin={{ top: 12, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false} />
                              <Tooltip formatter={v => fmt(v)} labelFormatter={(v, payload) => payload?.[0]?.payload?.label || v} />
                              <Bar name="Deposits" dataKey="deposits" fill="#10B981" radius={[4, 4, 0, 0]} barSize={14}><LabelList dataKey="deposits" position="top" formatter={v => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fill: '#6B7280' }} /></Bar>
                              <Bar name="Withdrawals" dataKey="withdrawals" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={14}><LabelList dataKey="withdrawals" position="top" formatter={v => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fill: '#6B7280' }} /></Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} /><span>Deposits</span></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} /><span>Withdrawals</span></div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>{/* end page 3 flex */}
                <ChartFooter period={report.period} location={getLocationLabel()} generatedAt={report.generatedAt} />
              </div>
              )}{/* end page 3 savings */}

            </React.Fragment>
          )}




          {/* Secretary Section - A4 Paper Sheet Layout */}
          {report.secretary && (adminRole === 'admin' || adminRole === 'secretaryAdmin') && (() => {
            const a4W = 794;
            const vpW = typeof window !== 'undefined' ? window.innerWidth : a4W;
            const scale = Math.min(1, (vpW - 48) / a4W);
            const a4Style = { width: `${a4W}px`, minHeight: '1120px', maxHeight: '1120px', padding: '32px 36px', background: '#ffffff', boxShadow: '0 2px 24px rgba(0,0,0,0.08)', borderRadius: '0', boxSizing: 'border-box', overflow: 'hidden', position: 'relative', fontFamily: "'Inter', sans-serif", color: '#0f172a', display: 'flex', flexDirection: 'column' };
            return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', paddingTop: '8px', paddingBottom: '24px', transform: scale < 1 ? `scale(${scale})` : 'none', transformOrigin: 'top center', width: scale < 1 ? `${a4W}px` : 'auto', margin: scale < 1 ? `0 auto` : undefined }}>

              {/* ÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚Â PAGE 1 ÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚Â */}
              {/* ÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚Â PAGE 1: EXECUTIVE OVERVIEW ÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚Â */}
              <div className="a4-page" style={a4Style}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0D1F45', paddingBottom: '8px', marginBottom: '4px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0D1F45' }}>Disbursement Report</h2>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>{report.period}</span>
                  </div>
                
                  {/* AI Executive Summary (Inside Paper Container) */}
                  {(report.executiveSummary || report.secretary?.summary) && (
                    <div className="bg-white dark:bg-[#1E2130] rounded-none border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden p-3 flex flex-col gap-2 pdf-page-card" style={{ marginBottom: '2px' }}>
                      <div className="border-b border-slate-100 dark:border-white/10 pb-1 mb-1" style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          AI Executive Summary
                        </span>
                      </div>
                      <div>
                        {report.executiveSummary ? renderFormattedSummary(report.executiveSummary, true) : (
                          <p style={{ margin: 0, fontSize: '11px', color: '#334155', lineHeight: '1.45' }}>
                            {report.secretary.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Total Amount Disbursed KPI */}
                  <div style={{ background: '#f8fafc', padding: '8px 14px', borderRadius: '0px', border: '1px solid #e2e8f0', marginBottom: '2px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Amount Disbursed</span>
                      <span style={{ fontSize: '22px', fontWeight: 800, color: '#7c3aed', marginTop: '1px' }}>{fmt(report.secretary.disbursements.totalAmount)}</span>
                      <span style={{ fontSize: '10.5px', fontWeight: 500, color: '#6b7280', marginTop: '1px' }}>{report.secretary.disbursements.count} releases processed</span>
                    </div>
                  </div>

                  {/* Top 5 Communities by Disbursement */}
                  {report.secretary.disbursements.byCommunity?.length > 0 && (
                    <div className="bg-white dark:bg-[#1E2130] rounded-none border border-slate-200 dark:border-white/10 shadow-sm p-3 flex flex-col justify-between gap-1 min-h-[150px] h-auto pdf-page-card">
                      <h3 className="m-0 font-inter text-[13px] font-bold text-slate-800 dark:text-white">Top Communities By Disbursement</h3>
                      <p className="font-inter text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Top: <strong>{report.secretary.disbursements.byCommunity[0]?.community}</strong> · {fmt(report.secretary.disbursements.byCommunity[0]?.value)} ({report.secretary.disbursements.totalAmount > 0 ? ((report.secretary.disbursements.byCommunity[0]?.value / report.secretary.disbursements.totalAmount) * 100).toFixed(1) : 0}%)</p>
                      <ResponsiveContainer width="100%" height={125}>
                        <BarChart data={report.secretary.disbursements.byCommunity} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="community" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                            <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 8, fill: '#9CA3AF' }} />
                          </YAxis>
                          <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                          <Bar dataKey="value" fill="#0D1F45" radius={[4, 4, 0, 0]} barSize={28}>
                            {report.secretary.disbursements.byCommunity.map((_, i) => (
                              <Cell key={i} fill={i === 0 ? '#2563eb' : '#0D1F45'} />
                            ))}
                            <LabelList dataKey="value" position="top" formatter={v => fmtShort(v)} style={{ fontSize: 9, fill: '#6B7280' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mt-1 pt-1 border-t border-slate-100 dark:border-white/5">
                        {report.secretary.disbursements.byCommunity.map((c, i) => (
                          <div key={i} className="flex items-center gap-1 font-inter text-[10px] font-medium text-slate-600 dark:text-slate-400">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: i === 0 ? '#2563eb' : '#0D1F45' }} />
                            <span className="font-inter text-[10px] font-medium text-slate-600 dark:text-slate-400">{c.community}</span>
                            <span className="font-bold text-slate-800 dark:text-white ml-0.5">{fmtNoDec(c.value)} · {report.secretary.disbursements.totalAmount > 0 ? ((c.value / report.secretary.disbursements.totalAmount) * 100).toFixed(0) : 0}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment Method + Top Recipients Row (Strict 2-Column) */}
                  <div className="pdf-grid-2col grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Payment Method Distribution */}
                    {report.secretary.disbursements.byMethod?.length > 0 && (() => {
                      const normalizedMethods = {};
                      report.secretary.disbursements.byMethod.forEach(m => {
                        const normalized = normalizeMethod(m.method);
                        normalizedMethods[normalized] = (normalizedMethods[normalized] || 0) + m.value;
                      });
                      const methodData = Object.entries(normalizedMethods).map(([method, value]) => ({ method, value })).sort((a, b) => b.value - a.value);
                      return (
                      <div className="bg-white dark:bg-[#1E2130] rounded-none border border-slate-200 dark:border-white/10 shadow-sm p-3 flex flex-col justify-start gap-1 min-h-[160px] h-auto pdf-page-card">
                        <h3 className="m-0 font-inter text-[13px] font-bold text-slate-800 dark:text-white">Disbursement By Payment Method</h3>
                        <p className="font-inter text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Total: <strong>{fmt(report.secretary.disbursements.totalAmount)}</strong> · {methodData.length} methods</p>
                        <ResponsiveContainer width="100%" height={140}>
                          <PieChart>
                            <Pie
                              data={methodData.map(m => ({ name: m.method, value: m.value }))}
                              cx="50%" cy="45%"
                              innerRadius={25} outerRadius={55}
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
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                          {methodData.map((m, i) => (
                            <div key={i} className="flex items-center gap-1 font-inter text-[10px] font-medium text-slate-600 dark:text-slate-400">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="font-inter text-[10px] font-medium text-slate-600 dark:text-slate-400">{m.method}</span>
                              <span className="font-bold text-slate-800 dark:text-white ml-0.5">{fmtNoDec(m.value)} · {report.secretary.disbursements.totalAmount > 0 ? ((m.value / report.secretary.disbursements.totalAmount) * 100).toFixed(0) : 0}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      );
                    })()}

                    {/* Top 5 Recipients */}
                    {report.secretary.disbursements.byUser?.length > 0 && (
                      <div className="bg-white dark:bg-[#1E2130] rounded-none border border-slate-200 dark:border-white/10 shadow-sm p-3 flex flex-col justify-start gap-1 min-h-[160px] h-auto pdf-page-card">
                        <h3 className="m-0 font-inter text-[13px] font-bold text-slate-800 dark:text-white">Top Recipients By Disbursement</h3>
                        <p className="font-inter text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">#1: <strong>{report.secretary.disbursements.byUser[0]?.user}</strong> · {fmt(report.secretary.disbursements.byUser[0]?.value)} ({report.secretary.disbursements.totalAmount > 0 ? ((report.secretary.disbursements.byUser[0]?.value / report.secretary.disbursements.totalAmount) * 100).toFixed(1) : 0}%)</p>
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={report.secretary.disbursements.byUser} layout="vertical" margin={{ top: 5, right: 25, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`}>
                              <Label value="Amount (₱)" position="bottom" offset={-5} style={{ fontSize: 8, fill: '#9CA3AF' }} />
                            </XAxis>
                            <YAxis type="category" dataKey="user" tick={{ fontSize: 9 }} width={90} />
                            <Tooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />
                            <Bar dataKey="value" fill="#1e3a8a" radius={[0, 4, 4, 0]} barSize={16}>
                              {report.secretary.disbursements.byUser.map((_, i) => (
                                <Cell key={i} fill={i === 0 ? '#2563eb' : '#1e3a8a'} />
                              ))}
                              <LabelList dataKey="value" position="right" formatter={v => fmtShort(v)} style={{ fontSize: 9, fill: '#6B7280' }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                          {report.secretary.disbursements.byUser.map((u, i) => (
                            <div key={i} className="flex items-center gap-1 font-inter text-[10px] font-medium text-slate-600 dark:text-slate-400">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: i === 0 ? '#2563eb' : '#1e3a8a' }} />
                              <span className="font-inter text-[10px] font-medium text-slate-600 dark:text-slate-400">{u.user}</span>
                              <span className="font-bold text-slate-800 dark:text-white ml-0.5">{fmtNoDec(u.value)} · {report.secretary.disbursements.totalAmount > 0 ? ((u.value / report.secretary.disbursements.totalAmount) * 100).toFixed(0) : 0}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <ChartFooter period={report.period} location={getLocationLabel()} generatedAt={report.generatedAt} />
              </div>

              {/* ÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚Â PAGE 2: MONTHLY DISBURSEMENT TRENDS ÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚Â */}
              <div className="a4-page a4-page-break" style={a4Style}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Page 2 Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0D1F45', paddingBottom: '8px', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0D1F45' }}>Disbursement Trends & Geographic Breakdown</h2>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>{report.period}</span>
                  </div>

                  {/* Monthly Disbursements Chart */}
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
                    let topCommName1 = '';
                    let topCommVal1 = 0;
                    if (highestMon && isMulti && seriesWithData.length > 0) {
                      seriesWithData.forEach(s => {
                        const val = highestMon[s] || 0;
                        if (val > topCommVal1) {
                          topCommVal1 = val;
                          topCommName1 = s;
                        }
                      });
                    }
                    return trendData.length > 0 ? (
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '0px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{chartTitle}</h3>
                        <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Total: <strong>{fmt(totalDisb)}</strong> · {report.secretary.disbursements.count} releases · Highest: <strong>{highestMon?.label} ({fmt(highestMon?.value || 0)})</strong>{topCommName1 ? <> · Top {showProvinceTrend ? 'Province' : 'Community'}: <strong>{topCommName1} ({fmt(topCommVal1)})</strong></> : null}</p>
                        <ResponsiveContainer width="100%" height={isMulti ? 220 : 200}>
                          {isMulti ? (
                            <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} allowDecimals={false}>
                                <Label value="Amount (₱)" angle={-90} position="insideLeft" offset={20} style={{ fontSize: 9, fill: '#9CA3AF' }} />
                              </YAxis>
                              <Tooltip content={<CustomNonZeroTooltip formatter={(v, name) => [fmt(v), name === 'value' ? 'Amount' : name]} />} />
                              {seriesWithData.map((s) => {
                                const origIdx = allSeries.indexOf(s);
                                return <Bar key={s} dataKey={s} name={s} stackId="a" fill={COMMUNITY_COLORS[origIdx % COMMUNITY_COLORS.length]} />;
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
                          const seriesByProv = {};
                          allSeries.forEach((s, i) => {
                            const prov = showProvinceTrend ? s : (COMMUNITY_TO_PROVINCE_MAP[s] || 'Other Provinces');
                            if (!seriesByProv[prov]) seriesByProv[prov] = [];
                            const hasData = seriesWithData.includes(s);
                            seriesByProv[prov].push({ name: s, index: i, hasData });
                          });
                          
                          return (
                            <div className="pdf-avoid-break mt-4 pt-3 border-t border-slate-100 dark:border-white/5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px 16px', marginTop: '16px' }}>
                              {Object.entries(seriesByProv).map(([prov, seriesList]) => {
                                const activeSeries = seriesList.filter(s => s.hasData);
                                if (activeSeries.length === 0) return null;
                                return (
                                  <div key={prov} className="flex flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {!showProvinceTrend && (
                                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '2px' }}>
                                        {prov}
                                      </div>
                                    )}
                                    {activeSeries.map((s) => {
                                      const totalVal = trendData.reduce((sum, row) => sum + (row[s.name] || 0), 0);
                                      return (
                                        <div key={s.name} style={{ display: 'inline-flex', alignItems: 'center', margin: '3px 0', lineHeight: '14px' }}>
                                          <span style={{ width: '8px', height: '8px', minWidth: '8px', minHeight: '8px', borderRadius: '50%', backgroundColor: COMMUNITY_COLORS[s.index % COMMUNITY_COLORS.length], display: 'inline-block', flexShrink: 0, marginRight: '6px' }} />
                                          <span style={{ fontSize: '11px', fontWeight: 500, color: '#374151', lineHeight: '14px' }}>{s.name}</span>
                                          <span style={{ fontSize: '10px', color: '#6b7280', marginLeft: '5px', lineHeight: '14px' }}>({fmtNoDec(totalVal)})</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    ) : null;
                  })()}
                </div>
                <ChartFooter period={report.period} location={getLocationLabel()} generatedAt={report.generatedAt} />
              </div>

              {/* ÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚Â PAGE 3+ (Paginated Detailed Disbursement Log) ÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚ÂÃƒÂ¢•Ã‚Â */}
              {(() => {
                const loans = report.secretary.disbursements.loans || [];
                if (loans.length === 0) return null;

                const ROWS_PER_PAGE = 25;
                const pageChunks = [];
                for (let i = 0; i < loans.length; i += ROWS_PER_PAGE) {
                  pageChunks.push(loans.slice(i, i + ROWS_PER_PAGE));
                }

                return pageChunks.map((chunk, pageIdx) => (
                  <div key={`log-page-${pageIdx}`} className="a4-page a4-page-break" style={a4Style}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Detailed Disbursement Log</h3>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>
                          Page {3 + pageIdx} of {2 + pageChunks.length}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[700px] font-inter">
                          <thead>
                            <tr>
                              <th className="px-4 py-2 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap">Loan ID</th>
                              <th className="px-4 py-2 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap">Member</th>
                              <th className="px-4 py-2 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap">Amount</th>
                              <th className="px-4 py-2 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chunk.map((l, i) => (
                              <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-4 py-2 border-b border-slate-100 dark:border-white/5 text-[12px] font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">{l.id}</td>
                                <td className="px-4 py-2 border-b border-slate-100 dark:border-white/5 text-[12px] text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">{l.member}</td>
                                <td className="px-4 py-2 border-b border-slate-100 dark:border-white/5 text-[12px] font-bold text-slate-900 dark:text-white whitespace-nowrap">{fmt(l.amount)}</td>
                                <td className="px-4 py-2 border-b border-slate-100 dark:border-white/5 text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(l.date).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <ChartFooter period={report.period} location={getLocationLabel()} generatedAt={report.generatedAt} />
                  </div>
                ));
              })()}

            </div>
          );
          })()}


        </div>
      )}

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Empty State ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      {!report && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-white dark:bg-[#1E2130] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm transition-all">
          {/* Icon Container */}
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-5 shadow-sm">
            <FileText size={32} strokeWidth={1.75} />
          </div>

          {/* Heading & Description */}
          <h2 className="font-inter text-lg sm:text-xl font-bold text-slate-900 dark:text-white m-0 tracking-tight">
            Generate an Automated Report
          </h2>
          <p className="font-inter text-xs sm:text-sm text-slate-500 dark:text-slate-400 m-0 max-w-md leading-relaxed mt-2">
            Select a time period and click <span className="font-semibold text-slate-700 dark:text-slate-200">"Generate Report"</span> to create an AI-powered operational analysis.
          </p>
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
              <button 
                className="h-10 px-6 rounded-lg font-inter text-sm font-semibold transition-all duration-200 border-none bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed" 
                onClick={handleConfirmGenerate}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
