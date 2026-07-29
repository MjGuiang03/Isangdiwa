import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import useDebounce from '../../hooks/useDebounce';

import API from '../../utils/api';
import { Banknote, Search, Heart } from 'lucide-react';
import CommunityDonationChart from '../components/CommunityDonationChart';
import DonationCategoriesPie from '../components/DonationCategoriesPie';
import Pagination from '../../components/Pagination';

const fmt = (n) =>
  n != null ? `₱${Number(n).toLocaleString('en-PH')}` : '₱0';

const fmtDate = (d) => {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'numeric', day: 'numeric', year: 'numeric',
  });
};

const StatusBadge = ({ status }) => {
  const map = {
    confirmed: { label: 'Successful', cls: 'admin-don-status-confirmed' },
    rejected:  { label: 'Failed',  cls: 'admin-don-status-rejected'  },
    pending:   { label: 'Pending Review',   cls: 'admin-don-status-pending'   },
  };
  const s = map[status] || map.pending;
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${s.label === 'Successful' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : s.label === 'Failed' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'}`}>{s.label}</span>;
};

export default function AdminDonationsNew() {
  const navigate = useNavigate();

  const [donations, setDonations] = useState([]);
  const [stats, setStats] = useState({
    totalThisMonth: 0,
    totalDonors: 0,
    avgDonation: 0,
    thisWeek: 0,
    pendingCount: 0,
    percentageChange: '0%',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); 
  const [showRejectedModal, setShowRejectedModal] = useState(false);
  const rejectedLoading = false;
  const rejectedList = [];
  const debouncedSearch = useDebounce(search, 400);
  const ITEMS_PER_PAGE = 10;

  /* ── Detail modal ── */
  const [detailModal, setDetailModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleApprove = async (id) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API}/api/admin/donations/${id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Donation approved successfully');
        setDetailModal(null);
        fetchDonations();
      } else {
        toast.error(data.message || 'Failed to approve donation');
      }
    } catch {
      toast.error('Network error. Could not approve.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id) => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection.');
      return;
    }
    setActionLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API}/api/admin/donations/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rejectReason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Donation rejected successfully');
        setDetailModal(null);
        setRejectReason('');
        setShowRejectInput(false);
        fetchDonations();
      } else {
        toast.error(data.message || 'Failed to reject donation');
      }
    } catch {
      toast.error('Network error. Could not reject.');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Auth guard ── */
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) navigate('/');
  }, [navigate]);

  /* ── Fetch ── */
  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }).then(res => {
    if (res.status === 401 || res.status === 403) { navigate('/'); return { success: false }; }
    return res.json();
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', currentPage);
    params.set('limit', ITEMS_PER_PAGE);
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    return params.toString();
  }, [debouncedSearch, currentPage, statusFilter]);

  const { data, isValidating: loading, mutate: fetchDonations } = useSWR(
    `${API}/api/admin/donations?${queryParams}`,
    fetcherSingle,
    { revalidateOnFocus: false, revalidateIfStale: true }
  );

  useEffect(() => {
    if (data && data.success !== false && !data.message) {
      setDonations(data.donations || []);
      setTotalCount(data.totalCount || 0);
      setStats({
        totalCount: data.stats?.totalCount || 0,
        totalThisMonth: data.stats?.thisMonth || 0,
        totalDonors: data.stats?.totalDonors || 0,
        avgDonation: data.stats?.avgDonation || 0,
        rejectedCount: data.stats?.rejectedCount || 0,
        percentageChange: data.stats?.percentageChange || '0%',
        communityBreakdown: data.stats?.communityBreakdown || {},
        categoryBreakdown: data.stats?.categoryBreakdown || {}
      });
    } else if (data && data.message) {
      toast.error(data.message);
    }
  }, [data]);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, statusFilter]);

  /* ── Pagination math ── */
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const goTo   = (p) => setCurrentPage(Math.max(1, Math.min(p, totalPages)));
  const goPrev = () => goTo(currentPage - 1);
  const goNext = () => goTo(currentPage + 1);

  /* ── Render ── */
  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full h-full bg-slate-100 dark:bg-[#161922]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <h1 className="m-0 font-inter text-2xl font-bold text-slate-800 dark:text-white">Donations</h1>

      </div>



      {/* Main Content Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {/* Total This Month */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20 rounded-2xl p-5 flex flex-col gap-1 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="flex items-center justify-between relative z-10">
            <span className="font-inter font-bold text-[11px] tracking-widest text-slate-500 dark:text-slate-400 uppercase">Total This Month</span>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm bg-emerald-600 text-white">
              <Banknote size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className="font-inter font-extrabold text-[28px] tracking-tight text-slate-900 dark:text-white m-0 mt-2 relative z-10">{fmt(stats.totalThisMonth)}</p>
          <p className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 relative z-10">{stats.percentageChange} from last month</p>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>

        {/* Total Donors */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-1 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-blue-500/30">
          <div className="flex items-center justify-between relative z-10">
            <span className="font-inter font-bold text-[11px] tracking-widest text-slate-500 dark:text-slate-400 uppercase">Total Donors</span>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/20 dark:to-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/30">
              <Heart size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className="font-inter font-extrabold text-[28px] tracking-tight text-slate-900 dark:text-white m-0 mt-2 relative z-10">{stats.totalDonors.toLocaleString()}</p>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>

        {/* Average Donation */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-1 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-indigo-500/30">
          <div className="flex items-center justify-between relative z-10">
            <span className="font-inter font-bold text-[11px] tracking-widest text-slate-500 dark:text-slate-400 uppercase">Average Donation</span>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-500/20 dark:to-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/30">
              <Banknote size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className="font-inter font-extrabold text-[28px] tracking-tight text-slate-900 dark:text-white m-0 mt-2 relative z-10">{fmt(stats.avgDonation)}</p>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>

        {/* Pending Review */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-1 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-amber-500/30">
          <div className="flex items-center justify-between relative z-10">
            <span className="font-inter font-bold text-[11px] tracking-widest text-slate-500 dark:text-slate-400 uppercase">Pending Review</span>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-500/20 dark:to-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/30">
              <Search size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className="font-inter font-extrabold text-[28px] tracking-tight text-slate-900 dark:text-white m-0 mt-2 relative z-10">{stats.pendingCount || stats.rejectedCount || 0}</p>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <CommunityDonationChart communityBreakdown={stats.communityBreakdown || {}} />
        </div>
        <div className="lg:col-span-1">
          <DonationCategoriesPie categoryBreakdown={stats.categoryBreakdown || {}} />
        </div>
      </div>

      {/* Donations Table */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden min-h-[500px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 shrink-0">
          <div className="relative flex-1 max-w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            <input
              type="text"
              className="w-full h-10 pl-10 pr-4 bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
              placeholder="Search member, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="flex items-center gap-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Forms</option>
            <option value="active">Confirmed Only</option>
            <option value="pending">Pending</option>
            <option value="rejected">Failed</option>
          </select>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr>
                <th className="px-4 py-2 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Donation ID</th>
                <th className="px-4 py-2 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Member</th>
                <th className="px-4 py-2 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Community</th>
                <th className="px-4 py-2 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Amount</th>
                <th className="px-4 py-2 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Purpose</th>
                <th className="px-4 py-2 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Date</th>
                <th className="px-4 py-2 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Status</th>
                <th className="px-4 py-2 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Proof</th>
                <th className="px-4 py-2 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    Loading donations…
                  </td>
                </tr>
              ) : donations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    No donations found
                  </td>
                </tr>
              ) : (
                donations.map((donation, index) => (
                  <tr key={donation._id || index} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-100 dark:border-white/5">
                    <td className="px-4 py-2 text-[13px] font-inter font-semibold text-slate-800 dark:text-white">
                      {donation.donationId || `D-${String(index + 1).padStart(3, '0')}`}
                    </td>
                    <td className="px-4 py-2 text-[13px] font-inter text-slate-700 dark:text-slate-300">
                      {donation.member || '—'}
                    </td>
                    <td className="px-4 py-2 text-[13px] font-inter text-slate-500 dark:text-slate-400">
                      {donation.community || 'General'}
                    </td>
                    <td className="px-4 py-2 text-[13px] font-inter font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {fmt(donation.amount)}
                    </td>
                    <td className="px-4 py-2 text-[13px] font-inter text-slate-500 dark:text-slate-400">
                      {donation.category || donation.purpose || 'General Fund'}
                    </td>
                    <td className="px-4 py-2 text-[13px] font-inter text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {fmtDate(donation.createdAt || donation.date)}
                    </td>
                    <td className="px-4 py-2 text-[13px] font-inter text-slate-700 dark:text-slate-300">
                      <StatusBadge status={donation.status || 'pending'} />
                    </td>
                    <td className="px-4 py-2 text-[13px] font-inter text-slate-700 dark:text-slate-300">
                      {(donation.proofData || donation.proofOfPayment) ? (
                        <img 
                          src={donation.proofData || donation.proofOfPayment} 
                          alt="Proof" 
                          style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #E5E7EB' }} 
                          onClick={(e) => { e.stopPropagation(); const win = window.open(); win.document.write(`<img src="${donation.proofData || donation.proofOfPayment}" style="max-width:100%;" />`); }}
                        />
                      ) : (
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>No Proof</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-[13px] font-inter text-slate-700 dark:text-slate-300">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors border-none bg-transparent cursor-pointer"
                          onClick={() => setDetailModal(donation)}
                          title="View Details"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="border-t border-slate-200 dark:border-white/10 shrink-0 bg-white dark:bg-[#1E2130]">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalCount}
              itemsPerPage={ITEMS_PER_PAGE}
              itemName="donations"
            />
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => !actionLoading && setDetailModal(null)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[850px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shadow-sm shrink-0">
                    <Heart size={24} />
                </div>
                <div>
                  <h2 className="m-0 font-inter text-xl font-bold text-slate-800 dark:text-white">Donation Details</h2>
                  <span className="font-mono text-sm text-slate-500 dark:text-slate-400 mt-1">Reference: {detailModal.donationId}</span>
                </div>
              </div>
              <button 
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 cursor-pointer" 
                onClick={() => setDetailModal(null)}
              >
                ×
              </button>
            </div>

            <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar">
              {detailModal.rejectReason && (
                <div className="m-6 mb-0 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300">
                  <span className="font-inter text-sm font-bold uppercase tracking-wide block mb-1">Reject Reason</span>
                  <p className="m-0 font-inter text-sm">{detailModal.rejectReason}</p>
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-6 p-6">
                
                {/* Left Column: Details Grid */}
                <div className="flex-1 flex flex-col gap-6">
                  <div className="bg-white dark:bg-[#161922] rounded-xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
                    <h3 className="m-0 font-inter text-xs font-bold text-slate-800 dark:text-white mb-4 uppercase tracking-widest border-b border-slate-100 dark:border-white/5 pb-3">Donation Information</h3>
                    <div className="grid grid-cols-2 gap-y-5 gap-x-6">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-inter text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</span>
                        <div className="flex items-center">
                          <StatusBadge status={detailModal.status || 'pending'} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="font-inter text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Amount</span>
                        <span className="m-0 font-inter text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{fmt(detailModal.amount)}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="font-inter text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Member</span>
                        <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">{detailModal.member}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="font-inter text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Community</span>
                        <span className="font-inter text-sm font-medium text-slate-700 dark:text-slate-300">{detailModal.community || 'General'}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="font-inter text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Purpose</span>
                        <span className="font-inter text-sm font-medium text-slate-700 dark:text-slate-300">{detailModal.category || 'General Fund'}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="font-inter text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Date Submitted</span>
                        <span className="font-inter text-sm font-medium text-slate-700 dark:text-slate-300">{fmtDate(detailModal.createdAt || detailModal.date)}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="font-inter text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Type</span>
                        <span className="font-inter text-sm font-medium text-slate-700 dark:text-slate-300">{detailModal.type || 'One-time'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#161922] rounded-xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
                    <h3 className="m-0 font-inter text-xs font-bold text-slate-800 dark:text-white mb-4 uppercase tracking-widest border-b border-slate-100 dark:border-white/5 pb-3">Payment Details</h3>
                    <div className="grid grid-cols-2 gap-y-5 gap-x-6">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-inter text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Method</span>
                        <span className="font-inter text-sm font-medium text-slate-800 dark:text-white">
                          {detailModal.method || '—'} {detailModal.subMethod ? ` (${detailModal.subMethod})` : ''}
                        </span>
                      </div>
                      {detailModal.referenceNumber && (
                        <div className="flex flex-col gap-1.5">
                          <span className="font-inter text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Reference No.</span>
                          <span className="font-inter text-sm font-medium text-slate-800 dark:text-white">{detailModal.referenceNumber}</span>
                        </div>
                      )}
                      {detailModal.accountName && (
                        <div className="flex flex-col gap-1.5">
                          <span className="font-inter text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Account Name</span>
                          <span className="font-inter text-sm font-medium text-slate-800 dark:text-white">{detailModal.accountName}</span>
                        </div>
                      )}
                      {detailModal.accountNumber && (
                        <div className="flex flex-col gap-1.5">
                          <span className="font-inter text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Account No.</span>
                          <span className="font-inter text-sm font-medium text-slate-800 dark:text-white">{detailModal.accountNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Proof */}
                <div className="flex-1 max-w-full md:max-w-[350px] flex flex-col gap-6">
                  <div className="bg-white dark:bg-[#161922] rounded-xl border border-slate-200 dark:border-white/10 p-5 shadow-sm flex flex-col h-full">
                    <h3 className="m-0 font-inter text-xs font-bold text-slate-800 dark:text-white mb-4 uppercase tracking-widest border-b border-slate-100 dark:border-white/5 pb-3 text-center">Proof of Payment</h3>
                    <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-black/20 rounded-lg border border-slate-100 dark:border-white/5 overflow-hidden p-2 min-h-[250px]">
                      {(detailModal.proofData || detailModal.proofOfPayment) ? (
                        <img 
                          src={detailModal.proofData || detailModal.proofOfPayment} 
                          alt="Proof" 
                          className="max-w-full max-h-[300px] object-contain rounded cursor-pointer hover:opacity-90 transition-opacity" 
                          onClick={(e) => { e.stopPropagation(); const win = window.open(); win.document.write(`<img src="${detailModal.proofData || detailModal.proofOfPayment}" style="max-width:100%;" />`); }}
                        />
                      ) : (
                        <div className="text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center gap-2 py-10 text-sm font-inter">
                          No proof provided
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Footer Actions */}
            {detailModal.status === 'pending' && (
              <div className="border-t border-slate-200 dark:border-white/10 p-5 bg-slate-50 dark:bg-black/20 flex flex-col gap-4 shrink-0">
                {!showRejectInput ? (
                  <div className="flex items-center justify-end gap-3">
                    <button 
                      onClick={() => setShowRejectInput(true)} 
                      disabled={actionLoading}
                      className="px-5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 font-inter font-semibold text-sm cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors">
                      Reject
                    </button>
                    <button 
                      onClick={() => handleApprove(detailModal._id)} 
                      disabled={actionLoading}
                      className="px-6 py-2.5 rounded-xl border-none bg-emerald-600 text-white font-inter font-semibold text-sm cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm">
                      {actionLoading ? 'Approving...' : 'Approve Donation'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      className="w-full p-4 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#161922] text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 resize-none transition-all"
                      rows={3}
                    />
                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
                        className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 font-inter font-semibold text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleReject(detailModal._id)} 
                        disabled={actionLoading || !rejectReason.trim()}
                        className="px-6 py-2.5 rounded-xl border-none bg-rose-600 text-white font-inter font-semibold text-sm cursor-pointer hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                        {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Rejected List Modal ── */}
      {showRejectedModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowRejectedModal(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[800px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
            <div className="relative p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 shrink-0 flex items-center justify-between">
              <h2 className="m-0 font-inter text-xl font-bold text-slate-800 dark:text-white">Rejected Donations</h2>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 cursor-pointer" onClick={() => setShowRejectedModal(false)}>×</button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {rejectedLoading ? (
                <p>Loading...</p>
              ) : rejectedList.length === 0 ? (
                <p>No rejected donations found.</p>
              ) : (
                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">ID</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Member</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Amount</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Reason</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rejectedList.map(r => (
                        <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-100 dark:border-white/5">
                          <td className="px-4 py-3 text-sm font-inter font-semibold text-slate-800 dark:text-white">{r.donationId}</td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{r.member}</td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{fmt(r.amount)}</td>
                          <td className="text-rose-500">{r.rejectReason || 'Admin review'}</td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{fmtDate(r.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-end gap-3 shrink-0">
               <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors border-none bg-transparent cursor-pointer" onClick={() => setShowRejectedModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
