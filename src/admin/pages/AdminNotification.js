import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import API from '../../utils/api';
import { CalendarDays, Heart, Banknote, Users, Bell, X } from 'lucide-react';
import Pagination from '../../components/Pagination';

const PER_PAGE = 10;

const fmtTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const datePart = d.toLocaleDateString('en-CA');
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${datePart} ${timePart}`;
};

const getTypeConfig = (type) => {
  switch (type) {
    case 'attendance':
      return { 
        Icon: CalendarDays, 
        colorCls: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20', 
        badgeCls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300', 
        label: 'Attendance' 
      };
    case 'donation':
      return { 
        Icon: Heart, 
        colorCls: 'bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-500/15 dark:text-pink-400 dark:border-pink-500/20', 
        badgeCls: 'bg-pink-50 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300', 
        label: 'Donation' 
      };
    case 'loan':
      return { 
        Icon: Banknote, 
        colorCls: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/20', 
        badgeCls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300', 
        label: 'Loan' 
      };
    case 'member':
      return { 
        Icon: Users, 
        colorCls: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20', 
        badgeCls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', 
        label: 'Member' 
      };
    default:
      return { 
        Icon: Bell, 
        colorCls: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20', 
        badgeCls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300', 
        label: 'Notification' 
      };
  }
};

export default function AdminNotifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [readIds,       setReadIds]       = useState(new Set());
  const [typeFilter,    setTypeFilter]    = useState('all');
  const [page,          setPage]          = useState(1);
  const [loading,       setLoading]       = useState(true);
  const [detailModal,   setDetailModal]   = useState(null);

  const token = localStorage.getItem('adminToken');
  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());

  const { data: notifData, isValidating: loadingNotifs } = useSWR(
    token ? `${API}/api/admin/notifications` : null,
    fetcherSingle,
    { revalidateOnFocus: false, revalidateIfStale: true }
  );

  useEffect(() => {
    if (notifData) {
        if (notifData.success) {
            setNotifications(notifData.notifications || []);
            setReadIds(new Set(notifData.readIds || []));
        } else {
            toast.error('Failed to load notifications');
        }
    }
  }, [notifData]);

  useEffect(() => {
    setLoading(loadingNotifs && !notifData);
  }, [loadingNotifs, notifData]);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/');
    }
  }, [navigate]);

  // Derive isRead from state set
  const enriched = notifications.map(n => ({ ...n, isRead: readIds.has(n.id) }));

  const filtered = enriched.filter(n => {
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    return true;
  });

  const totalPages   = Math.ceil(filtered.length / PER_PAGE);
  const paginated    = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const performReadUpdate = async (idsArray) => {
    try {
      const token = localStorage.getItem('adminToken');
      await fetch(`${API}/api/admin/notifications/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ids: idsArray })
      });
      // Fire an event in case AdminSidebar wants to re-fetch
      window.dispatchEvent(new Event("admin-notif-read-update"));
    } catch (err) {
      console.error(err);
    }
  };

  const markAsRead = useCallback((id) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      performReadUpdate([id]);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    const allIds = notifications.map(n => n.id);
    setReadIds(new Set(allIds));
    performReadUpdate(allIds);
  }, [notifications]);




  if (!notifData && loadingNotifs) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-[#161922] p-6 max-w-[1400px] mx-auto w-full gap-6 font-inter animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-2">
          <div className="h-8 w-44 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
          <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
        </div>

        {/* Filter bar Skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="h-10 w-80 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg"></div>
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
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-[#161922] p-6 max-w-[1400px] mx-auto w-full gap-6 font-inter">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="m-0 font-inter text-2xl font-bold text-slate-800 dark:text-white">Notifications</h1>
          <p className="m-0 font-inter text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage member registrations, donations, and attendance check-ins.
          </p>
        </div>
      </div>

      {/* Filters + Action Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex gap-1 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg p-1 w-full sm:w-fit h-auto items-center overflow-x-auto overflow-y-hidden">
              {[
                { key: 'all',        label: 'All' },
                { key: 'member',     label: 'Members' },
                { key: 'donation',   label: 'Donations' },
                { key: 'attendance', label: 'Attendance' }
              ].map(({ key, label }) => {
                  const count = enriched.filter(n => (key === 'all' ? true : n.type === key) && !n.isRead).length;
                  const isActive = typeFilter === key;
                  return (
                      <button
                          key={key}
                          className={`flex items-center justify-center gap-2 h-8 px-4 rounded-md font-inter text-sm cursor-pointer transition-all border-none ${isActive ? 'bg-navy text-white shadow-sm dark:bg-[#0D1F45]' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                          onClick={() => { setTypeFilter(key); setPage(1); }}
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
          ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-5 gap-4 text-slate-400 dark:text-slate-500">
                  <p className="font-inter text-sm m-0">No notifications found.</p>
              </div>
          ) : (
              paginated.map(notification => {
                  const typeConfig = getTypeConfig(notification.type);
                  const Icon = typeConfig.Icon;
                  return (
                      <div
                          key={notification.id}
                          className={`flex gap-3.5 px-4 py-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${notification.isRead ? 'bg-white dark:bg-[#1E2130] border-slate-200/80 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5' : 'bg-blue-50/40 dark:bg-blue-900/10 border-blue-200/80 dark:border-blue-800/30 hover:bg-blue-50/80 dark:hover:bg-blue-900/20'}`}
                          onClick={() => {
                              if (!notification.isRead) markAsRead(notification.id);
                              setDetailModal(notification);
                          }}
                      >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 shadow-xs ${typeConfig.colorCls}`}>
                              <Icon size={18} strokeWidth={2} />
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <div className="flex items-center gap-2 mb-0.5">
                                  <h3 className="font-inter text-sm font-semibold text-slate-900 dark:text-white m-0 truncate">{notification.title}</h3>
                                  {!notification.isRead && (
                                      <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full shrink-0"></span>
                                  )}
                              </div>

                              <p className="font-inter text-xs text-slate-600 dark:text-slate-300 m-0 truncate sm:whitespace-normal leading-relaxed">
                                  {notification.message}
                              </p>

                              <div className="flex items-center justify-between mt-2">
                                  <span className="font-inter text-[11px] text-slate-400 dark:text-slate-500 m-0">{fmtTime(notification.timestamp)}</span>
                                  {!notification.isRead ? (
                                      <span className="font-inter text-[10px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400">New</span>
                                  ) : (
                                      <span className="font-inter text-[10px] uppercase tracking-wider font-medium text-slate-400 dark:text-slate-500">Read</span>
                                  )}
                              </div>
                          </div>
                      </div>
                  );
              })
          )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
          <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filtered.length}
              itemsPerPage={PER_PAGE}
              itemName="notifications"
          />
      )}

      {/* ── Notification Detail Modal Redesign ── */}
      {detailModal && (() => {
        const typeConfig = getTypeConfig(detailModal.type);
        const IconComponent = typeConfig.Icon;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 sm:p-6" onClick={() => setDetailModal(null)}>
            <div className="bg-white dark:bg-[#1E2130] rounded-3xl w-full max-w-lg flex flex-col shadow-2xl p-6 sm:p-7 relative border border-slate-200/80 dark:border-white/10 font-inter space-y-4" onClick={(e) => e.stopPropagation()}>
              
              {/* Header Section: Icon + Title + Badge + Close Button */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 shadow-xs ${typeConfig.colorCls}`}>
                    <IconComponent size={24} />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <h2 className="m-0 text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                      {detailModal.title}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold tracking-wide capitalize ${typeConfig.badgeCls}`}>
                        {typeConfig.label}
                      </span>
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                        {fmtTime(detailModal.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button 
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/20 transition-colors flex items-center justify-center border-none cursor-pointer shrink-0" 
                  onClick={() => setDetailModal(null)}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Main Content Box */}
              <div className="bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5 p-5 sm:p-6">
                <p className="m-0 text-sm sm:text-base font-normal text-slate-700 dark:text-slate-200 leading-relaxed">
                  {detailModal.message}
                </p>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
