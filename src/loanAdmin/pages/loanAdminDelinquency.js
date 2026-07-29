import { useState, useEffect } from 'react';
import useSWR from 'swr';
import LoanAdminSidebar from './loanAdminSidebar';


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
    const daysLate = getDaysLate(l.nextDueDate || l.approvedDate);
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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
      <LoanAdminSidebar />
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="font-inter text-xl font-bold text-slate-800 dark:text-white m-0">Delinquency Reports</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-2">
            <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">Total Flagged</p>
            <p className="font-inter font-bold text-3xl text-amber-500 m-0">{counts.total}</p>
          </div>
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-2">
            <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">Suspended</p>
            <p className="font-inter font-bold text-3xl text-orange-500 m-0">{counts.suspended}</p>
          </div>
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-2">
            <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">For Collection</p>
            <p className="font-inter font-bold text-3xl text-rose-500 m-0">{counts.collection}</p>
          </div>
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-2">
            <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">Recovery Rate</p>
            <p className="font-inter font-bold text-3xl text-emerald-500 m-0">{counts.recovery}%</p>
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

        {/* Flagged Accounts */}
        <h3 className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300 m-0">Flagged Accounts</h3>

        <div className="relative w-full max-w-[400px]">
          <Search size={20} color="#9CA3AF" />
          <input type="text" placeholder="Search flagged accounts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse min-w-[700px] text-[13px]">
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
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>No flagged accounts</td></tr>
              ) : (
                filtered.map(loan => (
                  <tr key={loan._id}>
                    <td className="px-4 py-3 font-inter text-sm font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">{loan.loanId}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">
                      <div className="flex flex-col">
                        <p className="font-inter text-sm font-semibold text-slate-800 dark:text-white m-0">{loan.memberName}</p>
                        <p className="font-inter text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">{loan.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-inter text-sm font-bold text-slate-800 dark:text-white">{fmt(loan.amount)}</td>
                    <td style={{ fontWeight: 600, color: '#DC2626' }}>{loan.daysLate} days</td>
                    <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300"><span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${loan.delinquency.cls === 'reminder' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : loan.delinquency.cls === 'delinquent' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' : loan.delinquency.cls === 'high-risk' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-red-900 text-white dark:bg-red-900 dark:text-red-100'}`}>{loan.delinquency.status}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap font-inter text-[13px] text-slate-700 dark:text-slate-300">{loan.delinquency.flag && <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${loan.delinquency.cls === 'high-risk' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-red-900 text-white'}`}>{loan.delinquency.flag}</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4 p-[12px_16px] bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10">
          <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 m-0">Showing {filtered.length} flagged accounts</p>
        </div>
      </div>
    </div>
  );
}
