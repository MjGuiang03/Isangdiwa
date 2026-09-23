import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router';
import LoanAdminSidebar from './loanAdminSidebar';
import PageHeader from '../components/PageHeader';
import useDebounce from '../../hooks/useDebounce';
import API from '../../utils/api';
import Pagination from '../../components/Pagination';
import { Search, X, Users, PiggyBank, Banknote, AlertTriangle, ChevronRight, ChevronDown, ChevronUp, ArrowLeft, Loader2, History } from 'lucide-react';

const fmt = (n) =>
    n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₱0.00';

const fmtDate = (d) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
};

const fetcherSingle = (url) => {
    const token = localStorage.getItem('adminToken');
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => {
        if (res.status === 401 || res.status === 403) return { success: false, _authError: true };
        return res.json();
    });
};

export default function LoanAdminUserManagement() {
    const navigate = useNavigate();
    const token = localStorage.getItem('adminToken');

    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 400);
    const [filter, setFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [selectedUser, setSelectedUser] = useState(null);
    const [expandedLoanId, setExpandedLoanId] = useState(null);
    const [expandedPayments, setExpandedPayments] = useState([]);
    const [expandedLoading, setExpandedLoading] = useState(false);
    const [paymentPage, setPaymentPage] = useState(1);
    const [paymentsCache, setPaymentsCache] = useState({});
    const PAYMENTS_PER_PAGE = 5;
    const LIMIT = 10;

    const queryParams = useMemo(() => {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('limit', LIMIT);
        if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
        if (filter !== 'all') params.set('filter', filter);
        return params.toString();
    }, [page, debouncedSearch, filter]);
    const { data: usersData, isValidating: loadingUsers } = useSWR(
        token ? `${API}/api/admin/loan-users?${queryParams}` : null,
        fetcherSingle,
        { revalidateOnFocus: false, dedupingInterval: 60000, keepPreviousData: true }
    );

    const { data: profileDataResponse, isValidating: loadingProfile } = useSWR(
        token && selectedUser ? `${API}/api/admin/loan-users/${encodeURIComponent(selectedUser)}/profile` : null,
        fetcherSingle,
        { revalidateOnFocus: false, dedupingInterval: 60000, keepPreviousData: true }
    );

    // Handle auth errors from stable fetcher
    useEffect(() => {
        if (usersData?._authError || profileDataResponse?._authError) navigate('/');
    }, [usersData, profileDataResponse, navigate]);

    const stats = usersData?.stats || {
        totalUsersWithLoansOrSavings: 0,
        activeBorrowers: 0,
        totalSavingsPool: 0,
        delinquentMembers: 0
    };

    const users = usersData?.users || [];
    const totalUsers = usersData?.pagination?.totalUsers || 0;
    const totalPages = usersData?.pagination?.totalPages || 1;
    const profileData = profileDataResponse?.data || profileDataResponse;

    useEffect(() => { setPage(1); }, [debouncedSearch]);

    const toggleLoanDetail = async (loanId) => {
        if (expandedLoanId === loanId) {
            setExpandedLoanId(null);
            setPaymentPage(1);
            return;
        }
        setExpandedLoanId(loanId);
        setPaymentPage(1);

        // Instant load from cache if already fetched during this session
        if (paymentsCache[loanId]) {
            setExpandedPayments(paymentsCache[loanId]);
            setExpandedLoading(false);
            return;
        }

        setExpandedLoading(true);
        setExpandedPayments([]);
        try {
            const res = await fetch(`${API}/api/admin/loan-payments?loanId=${loanId}&limit=100`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            const list = data?.payments || [];
            setExpandedPayments(list);
            setPaymentsCache(prev => ({ ...prev, [loanId]: list }));
        } catch {
            setExpandedPayments([]);
        }
        setExpandedLoading(false);
    };

    if (!usersData && loadingUsers && !selectedUser) {
        return (
            <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
                <LoanAdminSidebar />
                <div className="p-6 pb-16 flex-1 overflow-y-auto w-full animate-pulse flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <div className="h-8 w-56 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
                        <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
                    </div>
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
                        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-slate-200 dark:divide-white/10">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="p-5 min-h-[90px] flex flex-col justify-between">
                                    <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                                    <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700/80 rounded mt-2"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="w-full bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm p-4 flex flex-col gap-4">
                        <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
            <LoanAdminSidebar />
            <div className="p-6 pb-16 flex-1 overflow-y-auto w-full">
                {!selectedUser && (
                    <PageHeader title="User Management" subtitle="Manage members, savings, and loan activity" />
                )}

                {!selectedUser ? (
                    <>
                        <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden mb-6">
                            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-white/10">
                                <div className="p-5 flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                                            <Users size={16} className="text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-inter">Total Members</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white font-inter m-0">{stats.totalUsersWithLoansOrSavings || 0}</p>
                                </div>
                                <div className="p-5 flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                                            <Banknote size={16} className="text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-inter">Active Borrowers</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white font-inter m-0">{stats.activeBorrowers || 0}</p>
                                </div>
                                <div className="p-5 flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                                            <PiggyBank size={16} className="text-violet-600 dark:text-violet-400" />
                                        </div>
                                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-inter">Total Savings Pool</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white font-inter m-0">{fmt(stats.totalSavingsPool)}</p>
                                </div>
                                <div className="p-5 flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                                            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
                                        </div>
                                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-inter">Delinquent Members</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white font-inter m-0">{stats.delinquentMembers || 0}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 rounded-lg p-1">
                                    {['all', 'hasLoans', 'hasSavings', 'delinquent'].map(f => (
                                        <button key={f} onClick={() => { setFilter(f); setPage(1); }}
                                            className={`px-3 py-1.5 rounded-md text-xs font-semibold font-inter transition-all border-none cursor-pointer ${
                                                filter === f 
                                                    ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' 
                                                    : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            {f === 'all' ? 'All' : f === 'hasLoans' ? 'Has Loans' : f === 'hasSavings' ? 'Has Savings' : 'Delinquent'}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative flex-1 max-w-xs ml-auto">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Search by name or email..."
                                        className="w-full h-9 pl-9 pr-8 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                    {searchQuery && (
                                        <button className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0 bg-transparent border-none text-slate-400 hover:text-slate-600 cursor-pointer" onClick={() => setSearchQuery('')}>
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200/80 dark:border-white/10">
                                            <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-inter">Member</th>
                                            <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-inter hidden sm:table-cell">Branch</th>
                                            <th className="text-right px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-inter">Savings</th>
                                            <th className="text-center px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-inter">Active Loans</th>
                                            <th className="text-center px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-inter hidden md:table-cell">History</th>
                                            <th className="text-center px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-inter">Status</th>
                                            <th className="px-5 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.length > 0 ? users.map((user, i) => (
                                            <tr key={i} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => setSelectedUser(user.email)}>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center text-xs font-bold font-inter shrink-0">
                                                            {user.fullName?.slice(0, 2).toUpperCase() || '??'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white font-inter m-0">{user.fullName || 'Unknown'}</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-inter m-0 mt-0.5">{user.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 hidden sm:table-cell">
                                                    <span className="text-sm text-slate-600 dark:text-slate-300 font-inter">{user.branch || '—'}</span>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className="text-sm font-medium text-slate-900 dark:text-white font-inter">{fmt(user.totalSavings)}</span>
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full text-xs font-bold font-inter ${
                                                        user.activeLoans > 0 
                                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' 
                                                            : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                                                    }`}>
                                                        {user.activeLoans || 0}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-center hidden md:table-cell">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-inter">{user.completedLoans || 0} / {user.totalLoans || 0}</span>
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    {user.hasDelinquency ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-inter bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400">Delinquent</span>
                                                    ) : user.activeLoans > 0 || user.completedLoans > 0 ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-inter bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">Good</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-inter bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400">No Loans</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors inline-block" />
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="7">
                                                    <div className="flex flex-col items-center justify-center py-16">
                                                        <Users size={40} className="text-slate-300 dark:text-slate-600 mb-3" />
                                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 font-inter m-0">No members found</p>
                                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-inter m-0 mt-1">Try adjusting your search or filters</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {users.length > 0 && (
                                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalUsers} itemsPerPage={LIMIT} itemName="members" embedded />
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4 bg-transparent border-none cursor-pointer font-inter font-medium">
                            <ArrowLeft size={16} /> Back to User List
                        </button>

                        {loadingProfile && !profileData ? (
                            <div className="animate-pulse flex flex-col gap-6">
                                <div className="h-24 bg-white dark:bg-[#1E2130] rounded-2xl border border-slate-200 dark:border-white/10"></div>
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                    <div className="lg:col-span-5 flex flex-col gap-6">
                                        <div className="h-28 bg-white dark:bg-[#1E2130] rounded-2xl border border-slate-200 dark:border-white/10"></div>
                                        <div className="h-64 bg-white dark:bg-[#1E2130] rounded-2xl border border-slate-200 dark:border-white/10"></div>
                                    </div>
                                    <div className="lg:col-span-7 h-96 bg-white dark:bg-[#1E2130] rounded-2xl border border-slate-200 dark:border-white/10"></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-6 mb-6 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-navy flex items-center justify-center text-white text-lg font-bold font-inter shrink-0">
                                            {profileData?.user?.fullName?.slice(0, 2).toUpperCase() || '??'}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-inter m-0">{profileData?.user?.fullName || 'Unknown'}</h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-inter m-0 mt-0.5">{profileData?.user?.email || selectedUser}</p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="text-xs text-slate-400 dark:text-slate-500 font-inter">ID: {profileData?.user?.memberId || '—'}</span>
                                                <span className="text-xs text-slate-400 dark:text-slate-500 font-inter">Branch: {profileData?.user?.branch || '—'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                    {/* Left Column: Active Loan (since at most 1 loan can be active) + Savings Overview */}
                                    <div className="lg:col-span-5 flex flex-col gap-6">
                                        {/* Active Loan Card */}
                                        {(() => {
                                            const activeLoan = profileData?.loans?.active?.[0];
                                            return (
                                                <div className={`bg-white dark:bg-[#1E2130] border ${activeLoan ? 'border-emerald-500/30' : 'border-slate-200/80 dark:border-white/10'} rounded-2xl p-5 shadow-sm transition-all`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`w-8 h-8 rounded-lg ${activeLoan ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/5 text-slate-400'} flex items-center justify-center`}>
                                                                <Banknote size={17} />
                                                            </div>
                                                            <div>
                                                                <h3 className="font-inter text-sm font-bold text-slate-900 dark:text-white m-0">Active Loan</h3>
                                                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-inter m-0 mt-0.5">
                                                                    {activeLoan ? `${activeLoan.loanType || 'Personal'} Loan` : 'No ongoing loan obligations'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {activeLoan ? (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-inter bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium font-inter bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                                                                None
                                                            </span>
                                                        )}
                                                    </div>

                                                    {activeLoan && (
                                                        <div className="mt-4">
                                                            <div className="grid grid-cols-2 gap-2.5 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200/50 dark:border-white/5 mb-3">
                                                                <div>
                                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-inter m-0 uppercase tracking-wider mb-0.5">Loan ID</p>
                                                                    <p className="text-xs font-bold text-slate-800 dark:text-white font-inter m-0">{activeLoan.loanId || '—'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-inter m-0 uppercase tracking-wider mb-0.5">Loan Amount</p>
                                                                    <p className="text-xs font-bold text-slate-900 dark:text-white font-inter m-0">{fmt(activeLoan.amount)}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-inter m-0 uppercase tracking-wider mb-0.5">Remaining Balance</p>
                                                                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-inter m-0">{fmt(activeLoan.remainingBalance)}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-inter m-0 uppercase tracking-wider mb-0.5">Monthly Due</p>
                                                                    <p className="text-xs font-bold text-slate-800 dark:text-white font-inter m-0">{fmt(activeLoan.monthlyPayment)}</p>
                                                                </div>
                                                                <div className="col-span-2 pt-2 border-t border-slate-200/40 dark:border-white/5 flex items-center justify-between">
                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-inter uppercase tracking-wider">Next Due Date</span>
                                                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-inter">{fmtDate(activeLoan.nextPaymentDate || activeLoan.nextDueDate)}</span>
                                                                </div>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => toggleLoanDetail(activeLoan.loanId || activeLoan._id)}
                                                                className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold font-inter border border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                                            >
                                                                {expandedLoanId === (activeLoan.loanId || activeLoan._id) ? (
                                                                    <>
                                                                        <ChevronUp size={14} /> Hide Payments
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <ChevronDown size={14} /> View Payments
                                                                    </>
                                                                )}
                                                            </button>

                                                            {expandedLoanId === (activeLoan.loanId || activeLoan._id) && (
                                                                <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-white/10">
                                                                    {expandedLoading ? (
                                                                        <div className="flex items-center gap-2 py-3 justify-center">
                                                                            <Loader2 size={14} className="animate-spin text-slate-400" />
                                                                            <span className="text-xs text-slate-400 font-inter">Loading payments...</span>
                                                                        </div>
                                                                    ) : expandedPayments.length === 0 ? (
                                                                        <p className="text-xs text-slate-400 font-inter text-center py-3 m-0">No payments recorded</p>
                                                                    ) : (
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <div className="flex items-center justify-between mb-1">
                                                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-inter uppercase tracking-wider">Payment History ({expandedPayments.length})</span>
                                                                            </div>
                                                                            {expandedPayments.slice((paymentPage - 1) * PAYMENTS_PER_PAGE, paymentPage * PAYMENTS_PER_PAGE).map((p, j) => (
                                                                                <div key={j} className="flex items-center justify-between py-1.5 px-2.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-inter">{fmt(p.amount)}</span>
                                                                                        <span className="text-[10px] text-slate-400 font-inter">{fmtDate(p.paymentDate || p.date || p.createdAt)} • {p.paymentMethod || 'cash'}</span>
                                                                                    </div>
                                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-inter ${
                                                                                        p.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                                                                        p.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                                                                                        'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'
                                                                                    }`}>{p.status || 'unknown'}</span>
                                                                                </div>
                                                                            ))}
                                                                            {expandedPayments.length > PAYMENTS_PER_PAGE && (
                                                                                <div className="flex items-center justify-between pt-2 px-1 border-t border-slate-200/60 dark:border-white/10 mt-1 text-[11px] font-inter text-slate-500 dark:text-slate-400">
                                                                                    <span className="text-[10px]">
                                                                                        {(paymentPage - 1) * PAYMENTS_PER_PAGE + 1}–{Math.min(paymentPage * PAYMENTS_PER_PAGE, expandedPayments.length)} of {expandedPayments.length}
                                                                                    </span>
                                                                                    <div className="flex items-center gap-1">
                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={paymentPage <= 1}
                                                                                            onClick={(e) => { e.stopPropagation(); setPaymentPage(p => p - 1); }}
                                                                                            className="px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                                                                                        >
                                                                                            Prev
                                                                                        </button>
                                                                                        <span className="px-1 text-[10px] font-medium">{paymentPage}/{Math.ceil(expandedPayments.length / PAYMENTS_PER_PAGE)}</span>
                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={paymentPage >= Math.ceil(expandedPayments.length / PAYMENTS_PER_PAGE)}
                                                                                            onClick={(e) => { e.stopPropagation(); setPaymentPage(p => p + 1); }}
                                                                                            className="px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                                                                                        >
                                                                                            Next
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* Savings Overview Card */}
                                        <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
                                                        <PiggyBank size={17} />
                                                    </div>
                                                    <h3 className="font-inter text-sm font-bold text-slate-900 dark:text-white m-0">Savings Overview</h3>
                                                </div>
                                                <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 font-inter">
                                                    {profileData?.savings?.goals?.length || 0} {profileData?.savings?.goals?.length === 1 ? 'Goal' : 'Goals'}
                                                </span>
                                            </div>
                                            <div className="mb-4">
                                                <p className="text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-inter m-0 mb-0.5">Total Savings Balance</p>
                                                <p className="text-2xl font-bold text-slate-900 dark:text-white font-inter m-0">{fmt(profileData?.savings?.totalBalance)}</p>
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                {profileData?.savings?.goals?.length > 0 ? profileData.savings.goals.map((goal, i) => (
                                                    <div key={i} className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                                        <div className="flex justify-between items-center mb-1.5">
                                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-inter">{goal.goalName || 'Savings Goal'}</span>
                                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-inter">{fmt(goal.savedAmount)} / {fmt(goal.targetAmount)}</span>
                                                        </div>
                                                        <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                            <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${Math.min(100, ((goal.savedAmount || 0) / (goal.targetAmount || 1)) * 100)}%` }} />
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <p className="text-sm text-slate-400 dark:text-slate-500 font-inter text-center py-4 m-0">No savings goals</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Loan History */}
                                    <div className="lg:col-span-7 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                    <History size={17} />
                                                </div>
                                                <h3 className="font-inter text-sm font-bold text-slate-900 dark:text-white m-0">Loan History</h3>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">
                                                {profileData?.loans?.history?.length || 0} {profileData?.loans?.history?.length === 1 ? 'Record' : 'Records'}
                                            </span>
                                        </div>

                                        {profileData?.loans?.history?.length > 0 ? (
                                            <div className="flex flex-col gap-2.5">
                                                {profileData.loans.history.map((loan, i) => (
                                                    <div key={i} className="border border-slate-200/60 dark:border-white/5 rounded-xl overflow-hidden transition-all">
                                                        <div
                                                            onClick={() => toggleLoanDetail(loan.loanId || loan._id)}
                                                            className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                                        >
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-xs font-bold text-slate-800 dark:text-white font-inter">
                                                                    {loan.loanType || 'Personal'} Loan — {fmt(loan.amount)}
                                                                </span>
                                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-inter">
                                                                    Applied {fmtDate(loan.appliedDate)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-inter ${
                                                                    loan.status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                                                                    loan.status === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' :
                                                                    loan.status === 'cancelled' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                                                                    'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'
                                                                }`}>
                                                                    {loan.status ? loan.status.charAt(0).toUpperCase() + loan.status.slice(1) : 'Unknown'}
                                                                </span>
                                                                {expandedLoanId === (loan.loanId || loan._id) ? (
                                                                    <ChevronUp size={15} className="text-slate-400" />
                                                                ) : (
                                                                    <ChevronDown size={15} className="text-slate-400" />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {expandedLoanId === (loan.loanId || loan._id) && (
                                                            <div className="p-4 bg-white dark:bg-[#161922] border-t border-slate-200/60 dark:border-white/5">
                                                                {/* Loan Specs */}
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-white/5">
                                                                    <div>
                                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-inter m-0 uppercase tracking-wider mb-0.5">Loan ID</p>
                                                                        <p className="text-xs font-bold text-slate-800 dark:text-white font-inter m-0">{loan.loanId || '—'}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-inter m-0 uppercase tracking-wider mb-0.5">Amount</p>
                                                                        <p className="text-xs font-bold text-slate-800 dark:text-white font-inter m-0">{fmt(loan.amount)}</p>
                                                                    </div>
                                                                    {loan.term && <div>
                                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-inter m-0 uppercase tracking-wider mb-0.5">Term</p>
                                                                        <p className="text-xs font-bold text-slate-800 dark:text-white font-inter m-0">{loan.term} months</p>
                                                                    </div>}
                                                                    {loan.interestRate != null && <div>
                                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-inter m-0 uppercase tracking-wider mb-0.5">Interest</p>
                                                                        <p className="text-xs font-bold text-slate-800 dark:text-white font-inter m-0">{(loan.interestRate <= 1 ? loan.interestRate * 100 : loan.interestRate).toFixed(1)}%</p>
                                                                    </div>}
                                                                    {loan.approvedDate && <div>
                                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-inter m-0 uppercase tracking-wider mb-0.5">Approved</p>
                                                                        <p className="text-xs font-bold text-slate-800 dark:text-white font-inter m-0">{fmtDate(loan.approvedDate)}</p>
                                                                    </div>}
                                                                    {loan.disbursementDate && <div>
                                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-inter m-0 uppercase tracking-wider mb-0.5">Disbursed</p>
                                                                        <p className="text-xs font-bold text-slate-800 dark:text-white font-inter m-0">{fmtDate(loan.disbursementDate)}</p>
                                                                    </div>}
                                                                </div>

                                                                {/* Payments List */}
                                                                {expandedLoading ? (
                                                                    <div className="flex items-center gap-2 py-3 justify-center">
                                                                        <Loader2 size={14} className="animate-spin text-slate-400" />
                                                                        <span className="text-xs text-slate-400 font-inter">Loading payments...</span>
                                                                    </div>
                                                                ) : expandedPayments.length === 0 ? (
                                                                    <p className="text-xs text-slate-400 font-inter text-center py-3 m-0">No payments recorded</p>
                                                                ) : (
                                                                    <div className="flex flex-col gap-1.5">
                                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-inter uppercase tracking-wider mb-0.5">Payments ({expandedPayments.length})</span>
                                                                        {expandedPayments.slice((paymentPage - 1) * PAYMENTS_PER_PAGE, paymentPage * PAYMENTS_PER_PAGE).map((p, j) => (
                                                                            <div key={j} className="flex items-center justify-between py-1.5 px-2.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-inter">{fmt(p.amount)}</span>
                                                                                    <span className="text-[10px] text-slate-400 font-inter">{fmtDate(p.paymentDate || p.date || p.createdAt)} • {p.paymentMethod || 'cash'}</span>
                                                                                </div>
                                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-inter ${
                                                                                    p.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                                                                    p.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                                                                                    'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'
                                                                                }`}>{p.status || 'unknown'}</span>
                                                                            </div>
                                                                        ))}
                                                                        {expandedPayments.length > PAYMENTS_PER_PAGE && (
                                                                            <div className="flex items-center justify-between pt-2 px-1 border-t border-slate-200/60 dark:border-white/10 mt-1 text-[11px] font-inter text-slate-500 dark:text-slate-400">
                                                                                <span className="text-[10px]">
                                                                                    {(paymentPage - 1) * PAYMENTS_PER_PAGE + 1}–{Math.min(paymentPage * PAYMENTS_PER_PAGE, expandedPayments.length)} of {expandedPayments.length}
                                                                                </span>
                                                                                <div className="flex items-center gap-1">
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={paymentPage <= 1}
                                                                                        onClick={(e) => { e.stopPropagation(); setPaymentPage(p => p - 1); }}
                                                                                        className="px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                                                                                    >
                                                                                        Prev
                                                                                    </button>
                                                                                    <span className="px-1 text-[10px] font-medium">{paymentPage}/{Math.ceil(expandedPayments.length / PAYMENTS_PER_PAGE)}</span>
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={paymentPage >= Math.ceil(expandedPayments.length / PAYMENTS_PER_PAGE)}
                                                                                        onClick={(e) => { e.stopPropagation(); setPaymentPage(p => p + 1); }}
                                                                                        className="px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                                                                                    >
                                                                                        Next
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-400 dark:text-slate-500 font-inter text-center py-8 m-0">No loan history</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
