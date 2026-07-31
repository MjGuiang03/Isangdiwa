import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import LoanAdminSidebar from './loanAdminSidebar';
import PageHeader from '../components/PageHeader';

import API from '../../utils/api';
import { Banknote, PiggyBank, X, CheckCircle2, AlertCircle, User, DollarSign, Tag, ArrowRight } from 'lucide-react';
import Pagination from '../../components/Pagination';

const fmtTimestamp = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
    }) + ' ' + d.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
};

const getNotifMetaInfo = (notif) => {
    const titleLower = (notif.title || '').toLowerCase();
    const typeLower = (notif.type || '').toLowerCase();

    if (typeLower === 'savings') {
        return {
            icon: PiggyBank,
            colorClass: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
            badgeClass: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
            accentBorder: 'border-amber-500',
            calloutBg: 'bg-amber-50/60 dark:bg-amber-500/5',
        };
    }

    if (titleLower.includes('accepted') || titleLower.includes('approved') || titleLower.includes('processed')) {
        return {
            icon: CheckCircle2,
            colorClass: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
            badgeClass: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
            accentBorder: 'border-emerald-500',
            calloutBg: 'bg-emerald-50/60 dark:bg-emerald-500/5',
        };
    }

    if (titleLower.includes('declined') || titleLower.includes('rejected')) {
        return {
            icon: AlertCircle,
            colorClass: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
            badgeClass: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300',
            accentBorder: 'border-rose-500',
            calloutBg: 'bg-rose-50/60 dark:bg-rose-500/5',
        };
    }

    return {
        icon: Banknote,
        colorClass: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
        badgeClass: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
        accentBorder: 'border-blue-500',
        calloutBg: 'bg-blue-50/60 dark:bg-blue-500/5',
    };
};

export default function LoanAdminNotif() {
    const navigate = useNavigate();
    const [activeFilter, setActiveFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detailModal, setDetailModal] = useState(null);

    const token = localStorage.getItem('adminToken');
    const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(async res => {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) throw new Error('AuthError');
            const data = await res.json();
            throw new Error(data.message || 'Failed to fetch notifications');
        }
        return res.json();
    });

    const { data: notifData, error: notifError, isValidating: loadingNotifs } = useSWR(
        token ? `${API}/api/admin/notifications` : null,
        fetcherSingle,
        { revalidateOnFocus: false, revalidateIfStale: true }
    );

    useEffect(() => {
        if (notifError) {
            if (notifError.message === 'AuthError') {
                navigate('/');
            } else {
                toast.error(notifError.message || 'Network error. Could not load notifications.');
            }
        }
    }, [notifError, navigate]);

    useEffect(() => {
        if (notifData) {
            const readIds = new Set(notifData.readIds || []);
            const activeNotifs = (notifData.notifications || [])
                .filter(n => n.type === 'loan' || n.type === 'savings')
                .map(n => ({ ...n, isRead: readIds.has(n.id) }));
            setNotifications(activeNotifs);
        }
    }, [notifData]);

    useEffect(() => {
        setLoading(loadingNotifs && !notifData);
    }, [loadingNotifs, notifData]);

    useEffect(() => {
        if (!token) { navigate('/'); }
    }, [navigate, token]);

    const getFilteredNotifications = () => {
        if (activeFilter === 'all') return notifications;
        if (activeFilter === 'unread') return notifications.filter(n => !n.isRead);
        if (activeFilter === 'read') return notifications.filter(n => n.isRead);
        return notifications;
    };

    const getUnreadCount = () => {
        return notifications.filter(n => !n.isRead).length;
    };

    const performReadUpdate = async (idsArray) => {
        try {
            const token = localStorage.getItem('adminToken');
            await fetch(`${API}/api/admin/notifications/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ids: idsArray })
            });
            window.dispatchEvent(new Event("admin-notif-read-update"));
        } catch { /* silent */ }
    };

    const markAsRead = (id) => {
        setNotifications(notifications.map(n =>
            n.id === id ? { ...n, isRead: true } : n
        ));
        performReadUpdate([id]);
    };

    const markAllAsRead = () => {
        const ids = notifications.filter(n => !n.isRead).map(n => n.id);
        setNotifications(notifications.map(n => ({ ...n, isRead: true })));
        if (ids.length > 0) performReadUpdate(ids);
    };

    const filteredNotifications = getFilteredNotifications();
    const totalPages = Math.ceil(filteredNotifications.length / ITEMS_PER_PAGE);
    const paginatedNotifications = filteredNotifications.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleFilterChange = (key) => {
        setActiveFilter(key);
        setCurrentPage(1);
    };

    if (loading) {
        return (
            <div className="flex h-screen bg-slate-100 dark:bg-[#161922] overflow-hidden font-inter">
                <LoanAdminSidebar />
                <div className="flex-1 overflow-y-auto p-6 pb-16 w-full animate-pulse flex flex-col gap-6">
                    {/* Header Skeleton */}
                    <div className="flex flex-col gap-2">
                        <div className="h-8 w-44 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
                        <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
                    </div>

                    {/* Filter bar Skeleton */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div className="h-10 w-64 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg"></div>
                        <div className="h-10 w-36 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg"></div>
                    </div>

                    {/* List Skeleton */}
                    <div className="flex flex-col gap-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-20 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700/80 shrink-0"></div>
                                <div className="flex-1 flex flex-col gap-2">
                                    <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                                    <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-[#161922] overflow-hidden font-inter">
            <LoanAdminSidebar />

            <div className="flex-1 overflow-y-auto p-6 pb-16 w-full">
                    {/* ── Page Header ── */}
                    <PageHeader 
                        title="Notifications" 
                        subtitle="Manage loan applications and system notifications." 
                    />

                    {/* Filters + Action Row */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div className="flex gap-1 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg p-1 w-full sm:w-fit h-auto items-center overflow-x-auto overflow-y-hidden">
                            {[
                                { key: 'all',    label: 'All' },
                                { key: 'unread', label: 'Unread' },
                                { key: 'read',   label: 'Read' }
                            ].map(({ key, label }) => {
                                const count = key === 'unread' ? getUnreadCount() : 0;
                                return (
                                    <button
                                        key={key}
                                        className={`flex items-center justify-center gap-2 h-8 px-4 rounded-md font-inter text-sm cursor-pointer transition-all border-none ${activeFilter === key ? 'bg-navy text-white shadow-sm dark:bg-[#0D1F45]' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                        onClick={() => handleFilterChange(key)}
                                    >
                                        {label}
                                        {count > 0 && (
                                            <span className="bg-red-500 text-white font-inter text-[10px] font-bold px-1.5 rounded-full min-w-[16px] h-4 inline-flex items-center justify-center leading-none">
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <button className="bg-white dark:bg-[#363940] border border-slate-200 dark:border-white/10 rounded-lg px-4 h-10 font-inter text-sm font-semibold text-slate-900 dark:text-white cursor-pointer flex items-center justify-center gap-2 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-navy dark:hover:border-white/20 whitespace-nowrap w-full sm:w-auto" onClick={markAllAsRead}>
                            Mark all as read
                        </button>
                    </div>

                    {/* ── List ── */}
                    <div className="flex flex-col gap-2">
                        {loading ? (
                            <p className="text-slate-400 text-[13px] py-10 text-center font-inter">Loading notifications…</p>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-5 gap-4 text-slate-400 dark:text-slate-500">
                                <p className="font-inter text-sm m-0">No notifications found.</p>
                            </div>
                        ) : (
                            paginatedNotifications.map(notification => {
                                const metaInfo = getNotifMetaInfo(notification);
                                const IconComp = metaInfo.icon;
                                return (
                                    <div
                                        key={notification.id}
                                        className={`flex gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${notification.isRead ? 'bg-white dark:bg-[#1E2130] border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5' : 'bg-blue-50/40 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30 hover:bg-blue-50/80 dark:hover:bg-blue-900/20 shadow-xs'}`}
                                        onClick={() => {
                                            if (!notification.isRead) markAsRead(notification.id);
                                            setDetailModal(notification);
                                        }}
                                    >
                                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${metaInfo.colorClass}`}>
                                            <IconComp size={18} strokeWidth={2.2} />
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h3 className="font-inter text-[13.5px] font-bold text-slate-900 dark:text-white m-0 truncate">{notification.title}</h3>
                                                {!notification.isRead && (
                                                    <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full shrink-0 animate-pulse"></span>
                                                )}
                                            </div>

                                            <p className="font-inter text-[13px] text-slate-600 dark:text-slate-300 m-0 truncate sm:whitespace-normal leading-snug">
                                                {notification.message}
                                            </p>

                                            <div className="flex items-center justify-between mt-2">
                                                <span className="font-inter text-[11px] text-slate-400 dark:text-slate-500 m-0">{fmtTimestamp(notification.timestamp)}</span>
                                                {!notification.isRead ? (
                                                    <span className="font-inter text-[10px] uppercase tracking-wider font-extrabold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20 px-2 py-0.5 rounded">New</span>
                                                ) : (
                                                    <span className="font-inter text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">Read</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* ── Pagination ── */}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={filteredNotifications.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        itemName="notifications"
                    />
                </div>

            {/* ── Notification Detail Modal ── */}
            {detailModal && (() => {
                const metaInfo = getNotifMetaInfo(detailModal);
                const IconComp = metaInfo.icon;
                const meta = detailModal.meta || {};

                return (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[10000] p-4" onClick={() => setDetailModal(null)}>
                        <div
                            className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 font-inter transition-all"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/5 flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3.5">
                                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-sm ${metaInfo.colorClass}`}>
                                        <IconComp size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug m-0">
                                            {detailModal.title}
                                        </h2>
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${metaInfo.badgeClass}`}>
                                                {detailModal.type}
                                            </span>
                                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                                {fmtTimestamp(detailModal.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className="w-8 h-8 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                                    onClick={() => setDetailModal(null)}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Body Content */}
                            <div className="p-6 space-y-4">
                                {/* Main Callout Box */}
                                <div className={`p-4 rounded-xl border-l-4 ${metaInfo.accentBorder} ${metaInfo.calloutBg}`}>
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed m-0">
                                        {detailModal.message}
                                    </p>
                                </div>

                                {/* Detailed Metadata Grid */}
                                {(meta.loanId || meta.memberName || meta.member || meta.amount || meta.purpose || meta.goalName) && (
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-white/5 space-y-3">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block">
                                            Notification Details
                                        </span>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            {(meta.memberName || meta.member) && (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-400 flex items-center gap-1">
                                                        <User size={11} /> Member / Account
                                                    </span>
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                        {meta.memberName || meta.member}
                                                    </span>
                                                </div>
                                            )}

                                            {meta.loanId && (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-400 flex items-center gap-1">
                                                        <Tag size={11} /> Loan Reference
                                                    </span>
                                                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                                        {meta.loanId}
                                                    </span>
                                                </div>
                                            )}

                                            {meta.amount && (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-400 flex items-center gap-1">
                                                        <DollarSign size={11} /> Amount Involved
                                                    </span>
                                                    <span className="font-bold text-slate-900 dark:text-white">
                                                        ₱{Number(meta.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            )}

                                            {(meta.purpose || meta.goalName) && (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-400 flex items-center gap-1">
                                                        <Tag size={11} /> Category / Purpose
                                                    </span>
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                        {meta.purpose || meta.goalName}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="p-4 px-6 bg-slate-50/50 dark:bg-black/20 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3">
                                <button
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-all cursor-pointer border-none"
                                    onClick={() => setDetailModal(null)}
                                >
                                    Close
                                </button>

                                {(meta.loanId || detailModal.type === 'loan') && (
                                    <button
                                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-all shadow-md cursor-pointer border-none flex items-center gap-1.5"
                                        onClick={() => {
                                            setDetailModal(null);
                                            navigate('/loan-admin/loan-management');
                                        }}
                                    >
                                        Go to Loan Management
                                        <ArrowRight size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
