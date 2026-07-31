import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import useDebounce from '../../hooks/useDebounce';
import SecretaryAdminSidebar from '../components/secretaryAdminSidebar';
import PageHeader from '../components/PageHeader';

import API from '../../utils/api';
import { Banknote, CalendarDays, Search } from 'lucide-react';
import Pagination from '../../components/Pagination';

export default function SecretaryLoanRecords() {
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 400);
    const [activeFilter, setActiveFilter] = useState('all');

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const LIMIT = 10;

    const token = localStorage.getItem('secretaryToken') || localStorage.getItem('adminToken') || localStorage.getItem('token');

    const fetcherSingle = (url) => fetch(url, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }).then(res => res.json());

    const queryParams = useMemo(() => {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('limit', LIMIT);
        params.set('disbursed', 'true');
        if (activeFilter !== 'all') params.set('method', activeFilter);
        if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
        return params.toString();
    }, [page, activeFilter, debouncedSearch]);

    const { data: recordsData, isValidating: loadingRecords } = useSWR(
        token ? `${API}/api/admin/loans?${queryParams}` : null,
        fetcherSingle,
        { revalidateOnFocus: false, revalidateIfStale: true }
    );

    useEffect(() => {
        if (recordsData && recordsData.success && recordsData.loans) {
            const results = recordsData.loans.map(l => ({
                id: l.loanId,
                member: l.memberName,
                amount: `₱${Number(l.amount).toLocaleString()}`,
                purpose: l.purpose,
                processedDate: l.disbursementDate ? new Date(l.disbursementDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A',
                processedTime: l.disbursementDate ? new Date(l.disbursementDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
                paymentMethod: l.paymentMethod ? (l.paymentMethod.toLowerCase() === 'e-wallet' ? 'E-Wallet' : l.paymentMethod.toLowerCase() === 'bank' ? 'Bank Transfer' : 'Cash') : 'Cash',
                reference: l.reference || ''
            }));

            setRecords(results);
            setTotalCount(recordsData.totalCount || 0);
        }
    }, [recordsData]);

    useEffect(() => {
        setLoading(loadingRecords);
    }, [loadingRecords]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, activeFilter]);

    const totalProcessed = totalCount;
    // These need to be fetched from backend for accuracy if we want filtered counts
    // For now keep them as totalCount or similar
    const cashCount = records.filter(r => r.paymentMethod === 'Cash').length;
    const gcashCount = records.filter(r => r.paymentMethod === 'E-Wallet').length; 
    const bankTransferCount = records.filter(r => r.paymentMethod === 'Bank Transfer').length;

    const filteredRecords = records;

    if (!recordsData && loadingRecords) {
        return (
            <div className="flex h-screen bg-slate-100 dark:bg-[#161922] overflow-hidden font-inter">
                <SecretaryAdminSidebar />
                <div className="flex-1 overflow-y-auto p-6 pb-16 w-full animate-pulse flex flex-col gap-6">
                    {/* Header Skeleton */}
                    <div className="flex flex-col gap-2">
                        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
                        <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
                    </div>

                    {/* Stat Cards Skeleton */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm h-20 flex flex-col justify-between">
                                <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                                <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                            </div>
                        ))}
                    </div>

                    {/* Table Skeleton */}
                    <div className="w-full bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm p-4 flex flex-col gap-4">
                        <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-[#161922] overflow-hidden font-inter">
            <SecretaryAdminSidebar />

            <div className="flex-1 overflow-y-auto p-6 pb-16 w-full">
                    {/* Header */}
                    <PageHeader 
                        title="Processing Records" 
                        subtitle="View all processed loan disbursements with date and time stamps." 
                    />

                    {/* Status Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm flex flex-col gap-1 transition-transform hover:-translate-y-0.5">
                            <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">Total Processed</p>
                            <p className="font-inter font-bold text-2xl text-navy dark:text-blue-400 m-0">{totalProcessed}</p>
                        </div>
                        <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm flex flex-col gap-1 transition-transform hover:-translate-y-0.5">
                            <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">Cash Payments</p>
                            <p className="font-inter font-bold text-2xl text-amber-500 m-0">{cashCount}</p>
                        </div>
                        <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm flex flex-col gap-1 transition-transform hover:-translate-y-0.5">
                            <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">E-Wallet Transfers</p>
                            <p className="font-inter font-bold text-2xl text-blue-600 dark:text-blue-400 m-0">{gcashCount}</p>
                        </div>
                        <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm flex flex-col gap-1 transition-transform hover:-translate-y-0.5">
                            <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">Bank Transfers</p>
                            <p className="font-inter font-bold text-2xl text-emerald-600 m-0">{bankTransferCount}</p>
                        </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-6">
                        <div className="relative w-full md:w-96">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by loan ID or member name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-10 pl-11 pr-4 py-2 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-navy dark:focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <div className="flex gap-1 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg p-1 w-full md:w-fit h-auto items-center overflow-x-auto overflow-y-hidden">
                            <button
                                className={`flex items-center justify-center gap-2 h-8 px-4 rounded-md font-inter text-sm cursor-pointer transition-all border-none whitespace-nowrap ${activeFilter === 'all' ? 'bg-navy text-white shadow-sm dark:bg-[#0D1F45]' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                onClick={() => setActiveFilter('all')}
                            >
                                All
                            </button>
                            <button
                                className={`flex items-center justify-center gap-2 h-8 px-4 rounded-md font-inter text-sm cursor-pointer transition-all border-none whitespace-nowrap ${activeFilter === 'cash' ? 'bg-navy text-white shadow-sm dark:bg-[#0D1F45]' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                onClick={() => setActiveFilter('cash')}
                            >
                                Cash
                            </button>
                            <button
                                className={`flex items-center justify-center gap-2 h-8 px-4 rounded-md font-inter text-sm cursor-pointer transition-all border-none whitespace-nowrap ${activeFilter === 'e-wallet' ? 'bg-navy text-white shadow-sm dark:bg-[#0D1F45]' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                onClick={() => setActiveFilter('e-wallet')}
                            >
                                E-Wallet
                            </button>
                            <button
                                className={`flex items-center justify-center gap-2 h-8 px-4 rounded-md font-inter text-sm cursor-pointer transition-all border-none whitespace-nowrap ${activeFilter === 'bank' ? 'bg-navy text-white shadow-sm dark:bg-[#0D1F45]' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                onClick={() => setActiveFilter('bank')}
                            >
                                Bank Transfer
                            </button>
                        </div>
                    </div>

                    {/* Records Table */}
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto overflow-y-hidden shadow-sm">
                        {loading ? (
                            <div className="p-10 text-center text-slate-500 font-inter text-sm">Loading records...</div>
                        ) : (
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead>
                                    <tr>
                                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Loan ID</th>
                                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Member</th>
                                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Purpose</th>
                                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Processed Date & Time</th>
                                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Payment Method</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="text-center p-10 text-slate-500 font-inter text-sm">
                                                No records found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRecords.map(record => (
                                            <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-900 dark:text-white font-medium align-middle">{record.id}</td>
                                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-900 dark:text-white font-medium align-middle">{record.member}</td>
                                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-900 dark:text-white font-semibold align-middle">{record.amount}</td>
                                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-900 dark:text-slate-200 align-middle">{record.purpose}</td>
                                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-inter align-middle">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                                            <CalendarDays size={14} className="text-slate-400" />
                                                            {record.processedDate}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                                            <CalendarDays size={14} className="text-slate-400" />
                                                            {record.processedTime}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-inter align-middle">
                                                    {record.paymentMethod === 'Cash' && (
                                                        <div className="flex items-center gap-2 w-fit px-3 py-1.5 rounded-lg border font-medium text-[12px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-800/30">
                                                            <Banknote size={16} />
                                                            <span>Cash</span>
                                                        </div>
                                                    )}
                                                    {record.paymentMethod === 'E-Wallet' && (
                                                        <div className="flex items-center gap-2 w-fit px-3 py-1.5 rounded-lg border font-medium text-[12px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-800/30">
                                                            <Banknote size={16} />
                                                            <span>E-Wallet</span>
                                                            {record.reference && <span className="ml-1 text-[10px] text-slate-500 dark:text-slate-400 tracking-wide bg-white/50 dark:bg-black/20 px-1.5 rounded">{record.reference}</span>}
                                                        </div>
                                                    )}
                                                    {record.paymentMethod === 'Bank Transfer' && (
                                                        <div className="flex items-center gap-2 w-fit px-3 py-1.5 rounded-lg border font-medium text-[12px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800/30">
                                                            <Banknote size={16} />
                                                            <span>Bank Transfer</span>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalCount > LIMIT && (
                        <div className="mt-6 bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
                            <Pagination
                                currentPage={page}
                                totalPages={Math.ceil(totalCount / LIMIT)}
                                onPageChange={setPage}
                                totalItems={totalCount}
                                itemsPerPage={LIMIT}
                                itemName="records"
                            />
                        </div>
                    )}
                </div>
        </div>
    );
}
