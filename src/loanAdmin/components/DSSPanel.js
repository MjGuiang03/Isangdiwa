import React, { useRef, useState } from 'react';
import { CheckCircle, XCircle, Info, AlertCircle, RefreshCw } from 'lucide-react';



const fmt = (n) =>
  n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '₱0.00';

const DSSPanel = ({ analysis, loading, onRefresh, memberName }) => {
  const panelRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const handleDownloadPDF = async () => {
    if (!panelRef.current) return;
    setExporting(true);
    try {
      const element = panelRef.current;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Loan_Risk_Assessment_${memberName || 'Member'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF Export Error:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/5 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px] h-full shadow-sm">
        <div className="w-10 h-10 border-4 border-slate-100 dark:border-white/5 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="font-inter text-sm text-slate-500 dark:text-slate-400 m-0 animate-pulse">Analyzing loan application...</p>
      </div>
    );
  }

  if (!analysis) return null;

  const { eligibility, capacity, risk, recommendation, isEligible } = analysis;

  return (
    <div className="bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/5 rounded-xl shadow-sm h-full flex flex-col" ref={panelRef}>
      <div className="flex items-center justify-between p-4 lg:p-6 border-b border-slate-200 dark:border-white/5 shrink-0">
        <h3 className="font-inter text-[15px] font-bold text-slate-800 dark:text-white m-0 tracking-tight">Decision Support Analysis</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 ${risk.color === 'green' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : risk.color === 'orange' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'}`}>
            {risk.tier}
          </div>
        </div>
      </div>

      {/* Eligibility Checklist */}
      <div className="px-4 lg:px-6 py-5 border-b border-slate-200 dark:border-white/5">
        <h4 className="font-inter text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 m-0 mb-4">Eligibility Verification</h4>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 font-inter text-[13px] text-slate-700 dark:text-slate-300">
            {eligibility.isActiveMember ? <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} /> : <XCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />}
            <span>Active Member (Attendance)</span>
          </div>
          <div className="flex items-start gap-3 font-inter text-[13px] text-slate-700 dark:text-slate-300">
            {eligibility.savingsOk ? <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} /> : <XCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />}
            <span>Savings ≥ ₱1,000 ({fmt(capacity.totalSavings)})</span>
          </div>
          <div className="flex items-start gap-3 font-inter text-[13px] text-slate-700 dark:text-slate-300">
            {eligibility.noActiveLoan ? <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} /> : <XCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />}
            <span>No Active Loans (One at a time)</span>
          </div>
          <div className="flex items-start gap-3 font-inter text-[13px] text-slate-700 dark:text-slate-300">
            {eligibility.infoValid ? <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} /> : <XCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />}
            <span>Valid Identity Documents</span>
          </div>
        </div>
      </div>

      {/* Loan Capacity */}
      <div className="px-4 lg:px-6 py-5 border-b border-slate-200 dark:border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-inter text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 m-0 mb-4">Loan Capacity</h4>
          <span className={`text-[12px] font-bold uppercase tracking-wider ${capacity.requestedOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {capacity.requestedOk ? 'Within Limit' : 'Over Limit'}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between font-inter text-[12px] text-slate-600 dark:text-slate-400 font-medium">
            <span>Requested: {fmt(capacity.requestedAmount)}</span>
            <span>Max: {fmt(capacity.maxLoanable)}</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 dark:bg-black/20 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${capacity.requestedOk ? 'bg-emerald-500' : 'bg-rose-500'}`} 
              style={{ width: `${Math.min(100, (capacity.requestedAmount / Math.max(1, capacity.maxLoanable)) * 100)}%` }}
            ></div>
          </div>
          <p className="font-inter text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-1">
            Limit: {capacity.multiplier}x Savings
          </p>
        </div>
      </div>

      {/* Recommendation */}
      <div className={`m-4 lg:m-6 p-4 rounded-xl border ${isEligible ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20'}`}>
        <div className="flex items-center gap-2 mb-2 font-inter text-[13px] font-bold text-slate-800 dark:text-white">
          {isEligible ? <Info size={18}  /> : <AlertCircle size={18} className="text-emerald-500 shrink-0 mt-0.5 text-amber-500 shrink-0 mt-0.5" />}
          <span>System Recommendation</span>
        </div>
        <p className="font-inter text-[13px] text-slate-700 dark:text-slate-300 m-0 leading-relaxed">{recommendation}</p>
      </div>

      {/* AI-Powered Analysis */}
      {analysis.aiSummary && (
        <div className="mx-4 lg:mx-6 mb-4 p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-100 dark:border-indigo-500/20 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/60 dark:bg-black/20 rounded text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              <span className="text-indigo-500 dark:text-indigo-400">✨</span>
              AI Analysis
            </div>
            {onRefresh && (
              <button 
                onClick={onRefresh} 
                className="bg-transparent border-none cursor-pointer font-inter text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-0"
                title="Force refresh AI analysis"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            )}
          </div>
          <p className="font-inter text-[12px] text-slate-700 dark:text-slate-300 mt-3 m-0 leading-relaxed">{analysis.aiSummary}</p>
        </div>
      )}

      <p className="px-4 lg:px-6 pb-6 pt-2 font-inter text-[11px] text-slate-400 dark:text-slate-500 italic m-0 mt-auto text-center">
        * This analysis is advisory only based on system policy and AI assessment. Final decision remains with the Loan Admin.
      </p>
    </div>
  );
};

export default DSSPanel;
