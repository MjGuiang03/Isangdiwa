import { useState, useEffect } from 'react';
import useSWR from 'swr';
import LoanAdminSidebar from './loanAdminSidebar';
import PageHeader from '../components/PageHeader';


import API from '../../utils/api';
import { Search } from 'lucide-react';


const fmt = (n) => n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '₱0.00';

function getDaysLate(dueDate) {
  if (!dueDate) return 0;
  const diff = Math.floor((new Date() - new Date(dueDate)) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function getDelinquencyInfo(daysLate) {
  if (daysLate <= 7) return { status: 'Reminder', action: 'Notification sent', cls: 'reminder', flag: null };
  if (daysLate <= 30) return { status: 'Delinquent', action: 'Penalty applied', cls: 'delinquent', flag: 'Penalty Applied' };
  if (daysLate <= 60) return { status: 'High Risk', action: 'Loan privileges suspended', cls: 'high-risk', flag: 'Suspended' };
  return { status: 'Default', action: 'Account for collection', cls: 'default', flag: 'For Collection' };
}

const POLICY_TABLE = [
  { range: '1 – 7 days', status: 'Reminder', action: 'Notification sent' },
  { range: '8 – 30 days', status: 'Delinquent', action: 'Penalty applied' },
  { range: '31 – 60 days', status: 'High Risk', action: 'Loan privileges suspended' },
  { range: '60+ days', status: 'Default', action: 'Account for collection' },
];

export default function LoanAdminDelinquency() {
  const [loans, setLoans] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('adminToken');
  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());

  const { data: loansData, isValidating: loadingLoans } = useSWR(
    token ? `${API}/api/admin/loans` : null,
    fetcherSingle,
    { revalidateOnFocus: false, revalidateIfStale: true }
  );

  useEffect(() => {
    if (loansData && loansData.success) {
      setLoans((loansData.loans || []).filter(l => l.status === 'active'));
    }
  }, [loansData]);

  useEffect(() => {
    setLoading(loadingLoans && !loansData);
  }, [loadingLoans, loansData]);

  const flagged = loans.map(l => {
    let dueDate = l.nextDueDate;
    if (!dueDate) {
      // No nextDueDate set — calculate first due date as 1 month after disbursement/approval
      const baseDate = new Date(l.disbursementDate || l.approvedDate);
      baseDate.setMonth(baseDate.getMonth() + 1);
      dueDate = baseDate;
    }
    const daysLate = getDaysLate(dueDate);
    if (daysLate < 1) return null;
    const info = getDelinquencyInfo(daysLate);
    return { ...l, daysLate, delinquency: info };
  }).filter(Boolean);

  const filtered = flagged.filter(l =>
    (l.memberName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.loanId || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const counts = {
    total: flagged.length,
    suspended: flagged.filter(l => l.delinquency.cls === 'high-risk').length,
    collection: flagged.filter(l => l.delinquency.cls === 'default').length,
    recovery: loans.length > 0 ? Math.round(((loans.length - flagged.length) / loans.length) * 100) : 100,
  };

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
        <LoanAdminSidebar />
        <div className="flex-1 overflow-y-auto p-6 pb-16 w-full animate-pulse flex flex-col gap-6">
          {/* Header Skeleton */}
          <div className="flex flex-col gap-2">
            <div className="h-8 w-56 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
            <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
          </div>

          {/* 4 Cards Skeleton */}
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

          {/* Policy Table Skeleton */}
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
            <div className="h-32 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
          </div>

          {/* Table Skeleton */}
          <div className="w-full bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm p-4 flex flex-col gap-4">
            <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
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
          title="Delinquency Reports" 
          subtitle="Monitor overdue accounts, delinquency policies, and collection status." 
        />

        {/* Unified Metric Bar */}
        <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 dark:divide-white/10">
            <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] flex flex-col justify-between min-h-[90px]">
              <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">Total Flagged</span>
              <p className="font-inter font-extrabold text-2xl text-amber-500 dark:text-amber-400 m-0 mt-2">{counts.total}</p>
            </div>
            <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] flex flex-col justify-between min-h-[90px]">
              <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">Suspended</span>
              <p className="font-inter font-extrabold text-2xl text-orange-500 dark:text-orange-400 m-0 mt-2">{counts.suspended}</p>
            </div>
            <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] flex flex-col justify-between min-h-[90px]">
              <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">For Collection</span>
              <p className="font-inter font-extrabold text-2xl text-rose-500 dark:text-rose-400 m-0 mt-2">{counts.collection}</p>
            </div>
            <div className="group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] flex flex-col justify-between min-h-[90px]">
              <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">Recovery Rate</span>
              <p className="font-inter font-extrabold text-2xl text-emerald-500 dark:text-emerald-400 m-0 mt-2">{counts.recovery}%</p>
            </div>
          </div>
        </div>

        {/* Delinquency Policy Reference */}
        <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm">
          <h3 className="font-inter text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 m-0">Delinquency Policy</h3>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr><th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Days Late</th><th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Status</th><th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Action</th></tr>
            </thead>
            <tbody>
              {POLICY_TABLE.map((row, i) => (
                <tr key={i}><td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">{row.range}</td><td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300"><span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${row.status.toLowerCase().replace(' ', '-') === 'reminder' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : row.status.toLowerCase().replace(' ', '-') === 'delinquent' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' : row.status.toLowerCase().replace(' ', '-') === 'high-risk' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-red-900 text-white dark:bg-red-900 dark:text-red-100'}`}>{row.status}</span></td><td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">{row.action}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-start gap-2 text-[13px] text-slate-600 dark:text-slate-400">
              <span className="shrink-0 mt-0.5">🔹</span>
              <div><strong>Member defaults?</strong> Account flagged, loan privileges suspended, subject to collection process.</div>
            </div>
            <div className="flex items-start gap-2 text-[13px] text-slate-600 dark:text-slate-400">
              <span className="shrink-0 mt-0.5">🔹</span>
              <div><strong>Risky behavior detected?</strong> Account flagged as high risk, requires manual approval for future loans.</div>
            </div>
          </div>
        </div>

        {/* Flagged Accounts Card */}
        <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#1E2130]">
            <div className="flex items-center gap-2">
              <h3 className="font-inter text-sm font-bold text-slate-800 dark:text-white m-0">Flagged Accounts</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                {filtered.length} flagged
              </span>
            </div>
            <div className="relative max-w-[320px] w-full flex items-center">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
              <input 
                type="text" 
                placeholder="Search flagged accounts..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full h-9 pl-9 pr-3 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-lg text-xs font-inter text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors shadow-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Loan ID</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Member</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Days Late</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Status</th>
                  <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Flag</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center p-8 text-slate-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-8 text-slate-400 font-inter text-xs">No flagged accounts found</td></tr>
                ) : (
                  filtered.map(loan => (
                    <tr key={loan._id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-inter text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">{loan.loanId}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-inter text-xs text-slate-700 dark:text-slate-300">
                        <div className="flex flex-col">
                          <p className="font-inter text-xs font-semibold text-slate-800 dark:text-white m-0">{loan.memberName}</p>
                          <p className="font-inter text-[10.5px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">{loan.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-inter text-xs font-bold text-slate-800 dark:text-white">{fmt(loan.amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-inter text-xs font-bold text-rose-600 dark:text-rose-400">{loan.daysLate} days</td>
                      <td className="px-4 py-3 whitespace-nowrap font-inter text-xs">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[10.5px] font-bold tracking-wide uppercase ${loan.delinquency.cls === 'reminder' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : loan.delinquency.cls === 'delinquent' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' : loan.delinquency.cls === 'high-risk' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-red-900 text-white dark:bg-red-900 dark:text-red-100'}`}>
                          {loan.delinquency.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-inter text-xs">
                        {loan.delinquency.flag && (
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${loan.delinquency.cls === 'high-risk' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-red-900 text-white'}`}>
                            {loan.delinquency.flag}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-3.5 px-4 bg-slate-50/50 dark:bg-black/10 border-t border-slate-200 dark:border-white/10">
            <p className="font-inter text-xs text-slate-500 dark:text-slate-400 m-0">Showing {filtered.length} flagged accounts</p>
          </div>
        </div>
      </div>
    </div>
  );
}
