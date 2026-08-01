import { useState, useEffect } from 'react';
import useSWR from 'swr';

import SavingsModals from '../components/SavingsModal';
import API from '../../utils/api';
import { Circle, PiggyBank, ArrowDownLeft, ArrowUpRight, TrendingUp, Target, Banknote, X, Search } from 'lucide-react';
import useSwipeToClose, { DragHandle } from '../hooks/useSwipeToClose';

const fmt = (n) =>
    n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '₱0.00';

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const GOAL_COLORS = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-950/40', bar: 'bg-[#1E3A8A] dark:bg-blue-500', text: 'text-blue-900 dark:text-blue-200' },
    green: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', bar: 'bg-emerald-600', text: 'text-emerald-900 dark:text-emerald-200' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', bar: 'bg-amber-600', text: 'text-amber-900 dark:text-amber-200' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-950/40', bar: 'bg-teal-600', text: 'text-teal-900 dark:text-teal-200' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950/40', bar: 'bg-purple-600', text: 'text-purple-900 dark:text-purple-200' },
    pink: { bg: 'bg-pink-50 dark:bg-pink-950/40', bar: 'bg-pink-600', text: 'text-pink-900 dark:text-pink-200' },
};

const TxnArrowIn = () => (
    <ArrowDownLeft size={14} className="text-[#0D1F45] dark:text-blue-400" />
);

const TxnArrowOut = () => (
    <ArrowUpRight size={14} className="text-[#0D1F45] dark:text-amber-400" />
);

export default function Savings() {
    /* ── modal state ── */
    const [modal, setModal] = useState(null);
    const [modalData, setModalData] = useState(null);
    const [showAllTxnsModal, setShowAllTxnsModal] = useState(false);

    /* ── page data ── */
    const [goals, setGoals] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [stats, setStats] = useState({
        totalSavings: 0,
        thisMonth: 0,
        activeGoals: 0,
        completedGoals: 0,
    });
    const [txnPage] = useState(1);
    // eslint-disable-next-line no-unused-vars
    const [txnTotal, setTxnTotal] = useState(0);
    const TXN_LIMIT = 4;
    
    // Goals Pagination
    const [goalPage, setGoalPage] = useState(1);
    const [loadingMoreGoals, setLoadingMoreGoals] = useState(false);
    const GOAL_LIMIT = 5;

    const [showInstruction, setShowInstruction] = useState(false);
    const [hasClosedInstruction, setHasClosedInstruction] = useState(false);

    const fetcher = async (url) => {
        const token = localStorage.getItem('token');
        if (!token) return null;
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/';
            return null;
        }
        return res.json();
    };

    const { data: overviewData, error: overviewError, isValidating: overviewValidating, mutate: mutateOverview } = useSWR(
        txnPage === 1 ? `${API}/api/savings/overview?txnLimit=${TXN_LIMIT}` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 5000 }
    );

    const { data: txnData, error: txnError, isValidating: txnValidating, mutate: mutateTxn } = useSWR(
        txnPage > 1 ? `${API}/api/savings/transactions?page=${txnPage}&limit=${TXN_LIMIT}` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 5000 }
    );

    const dataLoading = (txnPage === 1 && overviewValidating && !overviewData) || (txnPage > 1 && txnValidating && !txnData);
    const error = (overviewError || txnError) ? (overviewError?.message || txnError?.message || 'Failed to load savings data') : '';

    useEffect(() => {
        if (txnPage === 1 && overviewData?.success) {
            setGoals(overviewData.goals || []);
            setGoalPage(1);
            setTransactions(overviewData.transactions || []);
            setTxnTotal(overviewData.txnTotal || 0);
            setStats(overviewData.stats || {});
            
            if ((overviewData.stats?.totalSavings || 0) <= 0 && !hasClosedInstruction) {
                setShowInstruction(true);
            }
        } else if (txnPage > 1 && txnData?.success) {
            setTransactions(txnData.transactions || []);
            setTxnTotal(txnData.totalCount || 0);
        }
    }, [overviewData, txnData, txnPage, hasClosedInstruction]);

    const fetchMoreGoals = async () => {
        setLoadingMoreGoals(true);
        try {
            const token = localStorage.getItem('token');
            const nextPage = goalPage + 1;
            const res = await fetch(`${API}/api/savings/goals?page=${nextPage}&limit=${GOAL_LIMIT}`, {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setGoals(prev => [...prev, ...data.goals]);
                setGoalPage(nextPage);
                if (data.totalCount !== undefined) {
                    setStats(prev => ({ ...prev, totalGoalCount: data.totalCount }));
                }
            }
        } catch (err) {
            console.error('Failed to fetch more goals', err);
        } finally {
            setLoadingMoreGoals(false);
        }
    };

    const openDeposit = () => setModal('deposit');
    const openWithdraw = () => setModal('withdraw');
    const openNewGoal = () => setModal('newGoal');
    const closeModal = () => { setModal(null); setModalData(null); mutateOverview(); mutateTxn(); };

    const hasGoals = goals.length > 0;

    const handleViewLess = () => {
        setGoals(prev => prev.slice(0, GOAL_LIMIT));
        setGoalPage(1);
    };



    /* ── goals list ── */
    const renderGoals = () => {
        if (!hasGoals) return (
            <div className="text-center py-6 px-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 my-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2">
                    <PiggyBank size={20} />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white font-inter mb-0.5">No savings goals yet</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-inter max-w-xs mx-auto mb-3">
                    Set a goal to start saving for emergency funds or big purchases.
                </p>
                <button 
                    onClick={openNewGoal}
                    className="h-8 px-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white text-xs font-semibold font-inter transition-all cursor-pointer border-none"
                >
                    + Create goal
                </button>
            </div>
        );

        return (
            <div className="mt-3 mb-1">
                <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                    {goals.map((goal) => {
                        const colorKey = goal.color || 'blue';
                        const colors = GOAL_COLORS[colorKey] || GOAL_COLORS.blue;
                        const pct = goal.targetAmount > 0
                            ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100))
                            : 0;
                        const isDone = goal.status === 'completed' || pct >= 100;
                        return (
                            <div 
                                key={goal._id} 
                                onClick={() => { setModal('goalInfo'); setModalData(goal); }}
                                className="p-3.5 rounded-xl bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all cursor-pointer flex items-center justify-between gap-3"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-slate-900 dark:text-white font-inter truncate mb-0.5">{goal.name}</div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-inter truncate mb-1.5">
                                        Target {fmt(goal.targetAmount)}
                                        {goal.monthlyContribution > 0 && ` · Monthly ${fmt(goal.monthlyContribution)}`}
                                        {isDone && ' · Completed'}
                                        {goal.targetDate && !isDone && ` · Due ${fmtDate(goal.targetDate)}`}
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${colors.bar}`} style={{ width: `${Math.max(isDone ? 100 : 2, pct)}%` }} />
                                    </div>
                                </div>

                                <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                                    <div className="text-xs font-bold font-dm text-slate-900 dark:text-white">{fmt(goal.savedAmount)}</div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-inter">
                                        <span className={`font-semibold ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                            {isDone ? 'Completed' : `${pct}%`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {(stats.totalGoalCount > goals.length || goalPage > 1) && (
                    <div className="flex justify-center gap-4 py-1.5 font-inter text-[11px] font-semibold">
                        {goalPage > 1 && (
                            <button onClick={handleViewLess} className="text-slate-500 hover:text-slate-800 dark:hover:text-white">
                                View less
                            </button>
                        )}
                        {stats.totalGoalCount > goals.length && (
                            <button onClick={fetchMoreGoals} disabled={loadingMoreGoals} className="text-[#1E3A8A] dark:text-blue-400 hover:underline">
                                {loadingMoreGoals ? 'Loading...' : 'View more goals'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    /* ── transactions ── */
    const renderTransactions = () => {
        if (transactions.length === 0) return (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 font-inter">
                <Circle size={20} className="mx-auto mb-2 opacity-50" />
                <div className="text-xs font-semibold">No transactions yet</div>
                <div className="text-[11px]">Your deposits and withdrawals will appear here.</div>
            </div>
        );

        return (
            <div className="mt-3 mb-1">
                <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                    {transactions.map((txn) => {
                        const isIn = txn.type === 'deposit';
                        return (
                            <div 
                                key={txn._id} 
                                onClick={() => { setModal('transactionInfo'); setModalData(txn); }}
                                className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all cursor-pointer gap-3"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                        isIn ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                                    }`}>
                                        {isIn ? <TxnArrowIn /> : <TxnArrowOut />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-semibold text-slate-900 dark:text-white font-inter truncate">
                                            {txn.description || (isIn ? 'Deposit' : 'Withdrawal')}{txn.goalName ? ` — ${txn.goalName}` : ''}
                                        </div>
                                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-inter truncate">
                                            {fmtDate(txn.date)}{txn.source ? ` · ${txn.source}` : ''}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                    <div className={`text-xs font-bold font-dm ${isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                        {isIn ? '+' : '-'}{fmt(txn.amount)}
                                    </div>
                                    <span className={`px-1.5 py-0.5 rounded font-semibold uppercase text-[9px] tracking-wider leading-none ${
                                        txn.status === 'confirmed' 
                                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30' 
                                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/30'
                                    }`}>
                                        {txn.status === 'confirmed' ? 'Successful' : txn.status === 'rejected' ? 'Failed' : 'Incomplete'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="space-y-2.5 w-full pb-8">

                {dataLoading && (
                    <div className="space-y-4 w-full pb-8 animate-pulse font-inter">
                        {/* Header Skeleton */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-white/10">
                            <div className="space-y-2">
                                <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
                                <div className="h-7 w-44 bg-slate-200 dark:bg-slate-700/80 rounded-lg" />
                                <div className="h-3.5 w-56 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                                <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700/80 rounded-xl" />
                                <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700/80 rounded-xl" />
                            </div>
                        </div>

                        {/* Loan Eligibility Card Skeleton */}
                        <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700/80 rounded" />
                            <div className="flex flex-wrap gap-2">
                                <div className="h-6 w-36 bg-slate-200 dark:bg-slate-700/80 rounded-full" />
                                <div className="h-6 w-36 bg-slate-200 dark:bg-slate-700/80 rounded-full" />
                                <div className="h-6 w-36 bg-slate-200 dark:bg-slate-700/80 rounded-full" />
                            </div>
                        </div>

                        {/* 4 Stat Cards Skeleton */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/80 rounded" />
                                        <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700/80 shrink-0" />
                                    </div>
                                    <div className="h-7 w-32 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
                                    <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700/80 rounded" />
                                </div>
                            ))}
                        </div>

                        {/* 60/40 Grid Skeleton (Goals & Transactions) */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                            {/* Goals section (60%) */}
                            <div className="lg:col-span-3 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-white/5">
                                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700/80 rounded" />
                                    <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700/80 rounded" />
                                </div>
                                {[1, 2, 3].map((j) => (
                                    <div key={j} className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                                ))}
                            </div>

                            {/* Transaction history (40%) */}
                            <div className="lg:col-span-2 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-white/5">
                                    <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700/80 rounded" />
                                    <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700/80 rounded" />
                                </div>
                                {[1, 2, 3, 4].map((k) => (
                                    <div key={k} className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {!dataLoading && (
                    <>
                        {/* Savings Page Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-white/10">
                            <div>
                                <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-inter mb-0.5">Personal Savings</p>
                                <h1 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 dark:text-white font-dm leading-none tracking-tight">My Savings</h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-inter mt-1">Goals, deposits &amp; transactions</p>
                            </div>

                            {/* Right: action buttons */}
                            <div className="flex items-center gap-2.5 shrink-0">
                                {stats.totalSavings <= 0 && (
                                    <button
                                        onClick={() => setShowInstruction(true)}
                                        className="h-10 px-4 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 text-xs font-semibold font-inter transition-all cursor-pointer border-none"
                                    >
                                        How it works
                                    </button>
                                )}
                                <button
                                    onClick={openWithdraw}
                                    className="h-10 px-4 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold font-inter flex items-center gap-2 transition-all cursor-pointer border-none"
                                >
                                    <ArrowUpRight size={15} /> Withdraw
                                </button>
                                <button
                                    onClick={openDeposit}
                                    className="h-10 px-4 rounded-xl bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white text-xs font-bold font-inter flex items-center gap-2 transition-all cursor-pointer border-none shadow-md active:scale-95"
                                >
                                    <span className="text-base leading-none">+</span> Deposit
                                </button>
                            </div>
                        </div>

                        {/* Separate Loan Eligibility Card */}
                        <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-inter">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Loan Eligibility</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">Based on savings balance</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-100 dark:border-blue-900/30">
                                    Personal up to {fmt((stats.totalSavings || 0) * 2)}
                                </span>
                                <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-100 dark:border-amber-900/30">
                                    Emergency up to {fmt((stats.totalSavings || 0) * 1.5)}
                                </span>
                                <span className="px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-xs font-semibold border border-teal-100 dark:border-teal-900/30">
                                    Short-Term up to {fmt(stats.totalSavings || 0)}
                                </span>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 text-xs flex justify-between items-center font-inter">
                                <span>{error}</span>
                                <button onClick={() => { mutateOverview(); mutateTxn(); }} className="font-bold underline">Retry</button>
                            </div>
                        )}

                        {!error && (
                            <>
                                {/* Stats Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Total Savings */}
                                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col gap-2.5 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Total Savings</span>
                                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100/60 dark:border-emerald-900/30 shrink-0 group-hover:scale-105 transition-transform">
                                                <PiggyBank size={16} />
                                            </div>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight">
                                            {fmt(stats.totalSavings)}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-inter">
                                            {stats.totalSavings > 0 ? 'Current balance' : 'No balance yet'}
                                        </p>
                                    </div>

                                    {/* This Month */}
                                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col gap-2.5 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">This Month</span>
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100/60 dark:border-blue-900/30 shrink-0 group-hover:scale-105 transition-transform">
                                                <TrendingUp size={16} />
                                            </div>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight">
                                            {stats.thisMonth > 0 ? fmt(stats.thisMonth) : '₱0.00'}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-inter">
                                            {stats.thisMonth > 0 ? `Deposited in ${new Date().toLocaleDateString('en-PH', { month: 'short' })}` : 'No deposits this month'}
                                        </p>
                                    </div>

                                    {/* Active Goals */}
                                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col gap-2.5 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Active Goals</span>
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100/60 dark:border-indigo-900/30 shrink-0 group-hover:scale-105 transition-transform">
                                                <Target size={16} />
                                            </div>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight">
                                            {(stats.totalGoalCount || 0) > 0 ? (stats.activeGoals || 0) : '0'}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-inter">
                                            {(stats.totalGoalCount || 0) > 0 ? `${stats.activeGoals || 0} in progress · ${stats.completedGoals || 0} done` : 'No goals set'}
                                        </p>
                                    </div>

                                    {/* Max Loanable */}
                                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col gap-2.5 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Max Loanable</span>
                                            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100/60 dark:border-amber-900/30 shrink-0 group-hover:scale-105 transition-transform">
                                                <Banknote size={16} />
                                            </div>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight">
                                            {stats.totalSavings > 0 ? fmt(stats.totalSavings * 2) : '₱0.00'}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-inter">
                                            {stats.totalSavings > 0 ? 'Personal Loan limit' : 'Deposit to unlock'}
                                        </p>
                                    </div>
                                </div>

                                {/* Goals & Transaction History 60/40 Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                                    {/* Goals section (60%) */}
                                    <div className="lg:col-span-3 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-center mb-4">
                                                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">
                                                    Savings Goals
                                                </h2>
                                                <button onClick={openNewGoal} className="text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 hover:underline">
                                                    + New Goal
                                                </button>
                                            </div>

                                            {renderGoals()}
                                        </div>
                                    </div>

                                    {/* Transaction history (40%) */}
                                    <div className="lg:col-span-2 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-center mb-3">
                                                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">
                                                    Transaction History
                                                </h2>
                                                <button 
                                                    onClick={() => setShowAllTxnsModal(true)} 
                                                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 border-none bg-transparent cursor-pointer"
                                                >
                                                    View All →
                                                </button>
                                            </div>

                                            {renderTransactions()}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            <SavingsModals
                modal={modal}
                modalData={modalData}
                goals={goals}
                onClose={closeModal}
                onOpenDeposit={() => setModal('deposit')}
                onEdit={(goal) => {
                    setModal('editGoal');
                    setModalData(goal);
                }}
                onTransfer={(goal) => {
                    setModal('transfer');
                    setModalData(goal);
                }}
                onQuickDeposit={(goal) => {
                    setModal('quickDeposit');
                    setModalData(goal);
                }}
            />

            <AllTransactionsModal
                isOpen={showAllTxnsModal}
                onClose={() => setShowAllTxnsModal(false)}
                onSelectTxn={(txn) => {
                    setModal('transactionInfo');
                    setModalData(txn);
                }}
            />

            <SavingsInstructionModal 
                isOpen={showInstruction} 
                onClose={() => {
                    setShowInstruction(false);
                    setHasClosedInstruction(true);
                }}
                onDeposit={openDeposit}
                onGoal={openNewGoal}
            />
        </>
    );
}

function AllTransactionsModal({ isOpen, onClose, onSelectTxn }) {
    const { modalStyle, touchHandlers } = useSwipeToClose(onClose);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const LIMIT = 5;

    const fetchTxns = async (p = 1) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/api/savings/transactions?page=${p}&limit=${LIMIT}`, {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setTransactions(data.transactions || []);
                setTotal(data.totalCount || 0);
                setPage(p);
            }
        } catch (err) {
            console.error('Failed to fetch transactions modal data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchTxns(1);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const filtered = transactions.filter(t => {
        const matchesFilter = filter === 'all' || t.type === filter;
        const matchesSearch = !search.trim() || 
            (t.description || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.goalName || '').toLowerCase().includes(search.toLowerCase()) ||
            String(t.amount || '').includes(search);
        return matchesFilter && matchesSearch;
    });

    const totalPages = Math.max(1, Math.ceil(total / LIMIT));

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden sm:overflow-y-auto transition-all duration-300" onClick={onClose}>
            <div className="bg-white dark:bg-[#1E2130] rounded-t-3xl sm:rounded-2xl w-full h-auto max-h-[92dvh] sm:max-h-[85vh] sm:max-w-2xl overflow-hidden border-t sm:border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col font-inter mobile-slide-up-modal" style={modalStyle} {...touchHandlers} onClick={e => e.stopPropagation()}>
                <DragHandle />
                {/* Modal Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/5 shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white font-dm">All Transactions</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Complete record of your deposits and withdrawals</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-white/10 border-none cursor-pointer transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Search & Filter Bar */}
                <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#1E2130] shrink-0">
                    <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl w-full sm:w-auto">
                        {['all', 'deposit', 'withdrawal'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setFilter(t)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border-none cursor-pointer ${
                                    filter === t 
                                        ? 'bg-white dark:bg-[#1E3A8A] text-slate-900 dark:text-white shadow-xs' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                {t === 'all' ? 'All Types' : t + 's'}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-60">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search transactions..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* List Container - Scrollable */}
                <div className="p-4 space-y-2.5 flex-1 overflow-y-auto min-h-0">
                    {loading ? (
                        <div className="py-12 text-center text-xs text-slate-400 font-medium">Loading transactions...</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center text-xs text-slate-400 font-medium">No transactions found</div>
                    ) : (
                        filtered.map((txn) => {
                            const isIn = txn.type === 'deposit';
                            return (
                                <div
                                    key={txn._id}
                                    onClick={() => { onSelectTxn(txn); }}
                                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 hover:border-blue-500/50 transition-all cursor-pointer gap-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                            isIn ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                                        }`}>
                                            {isIn ? <TxnArrowIn /> : <TxnArrowOut />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-semibold text-slate-900 dark:text-white font-inter truncate">
                                                {txn.description || (isIn ? 'Deposit' : 'Withdrawal')}{txn.goalName ? ` — ${txn.goalName}` : ''}
                                            </div>
                                            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-inter truncate">
                                                {fmtDate(txn.date)}{txn.source ? ` · ${txn.source}` : ''}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                        <div className={`text-xs font-bold font-dm ${isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                            {isIn ? '+' : '-'}{fmt(txn.amount)}
                                        </div>
                                        <span className={`px-1.5 py-0.5 rounded font-semibold uppercase text-[9px] tracking-wider leading-none ${
                                            txn.status === 'confirmed' 
                                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30' 
                                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/30'
                                        }`}>
                                            {txn.status === 'confirmed' ? 'Successful' : txn.status === 'rejected' ? 'Failed' : 'Incomplete'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-3 sm:px-5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-white/5 shrink-0">
                    <span>Page {page} of {totalPages} ({total} total)</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => fetchTxns(page - 1)}
                            disabled={page <= 1}
                            className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 cursor-pointer transition-all"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => fetchTxns(page + 1)}
                            disabled={page >= totalPages}
                            className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 cursor-pointer transition-all"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SavingsInstructionModal({ isOpen, onClose, onDeposit, onGoal }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden sm:overflow-y-auto transition-all duration-300" onClick={onClose}>
            <div className="bg-white dark:bg-[#1E2130] rounded-t-3xl sm:rounded-2xl w-full h-auto sm:max-w-lg overflow-hidden border-t sm:border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col font-inter mobile-slide-up-modal" onClick={e => e.stopPropagation()}>
                <div className="p-6 bg-gradient-to-br from-[#0D1F45] to-[#1E3A8A] text-white flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold font-dm mb-1">Welcome to Savings</h2>
                        <p className="text-xs text-white/80 leading-relaxed">Follow these simple steps to begin growing your funds.</p>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white">
                        <X size={18} />
                    </button>
                </div>
                
                <div className="p-6 space-y-4 text-xs">
                    <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 text-[#1E3A8A] dark:text-blue-300 font-bold flex items-center justify-center shrink-0">1</div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white mb-0.5">Set a Savings Goal</h4>
                            <p className="text-slate-500 dark:text-slate-400 mb-1.5">Give your savings a purpose like an emergency fund or purchase.</p>
                            <button onClick={() => { onClose(); onGoal(); }} className="text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 hover:underline">
                                Create your first goal →
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0">2</div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white mb-0.5">Deposit Funds</h4>
                            <p className="text-slate-500 dark:text-slate-400 mb-1.5">Click "+ Deposit", enter your amount, and upload proof of payment.</p>
                            <button onClick={() => { onClose(); onDeposit(); }} className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                                Make a deposit now →
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="p-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="h-10 px-5 rounded-xl bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white text-xs font-semibold"
                    >
                        Got it, let's start!
                    </button>
                </div>
            </div>
        </div>
    );
}