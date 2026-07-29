import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import API from '../../utils/api';
import { CalendarDays, Heart, Banknote } from 'lucide-react';
import Pagination from '../../components/Pagination';

const PER_PAGE = 10;

const fmtTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const datePart = d.toLocaleDateString('en-CA');
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${datePart} ${timePart}`;
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

  const unreadCount = enriched.filter(n => !n.isRead).length;

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




  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 font-inter bg-slate-50 dark:bg-[#0b0f19] min-h-screen">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-1 mb-6">
          <div className="flex items-center gap-3">
              <h1 className="font-inter text-2xl font-bold text-slate-900 dark:text-white m-0">Notifications</h1>
          </div>
          <p className="font-inter text-sm text-slate-500 dark:text-slate-400 m-0">
              Manage member registrations, donations, and attendance check-ins.
          </p>
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
                  const Icon = notification.type === 'loan' ? Banknote : (notification.type === 'donation' || notification.type === 'savings') ? Heart : CalendarDays;
                  return (
                      <div
                          key={notification.id}
                          className={`flex gap-3 px-4 py-3 rounded-lg border transition-all duration-200 cursor-pointer ${notification.isRead ? 'bg-white dark:bg-[#1E2130] border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5' : 'bg-blue-50/40 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30 hover:bg-blue-50/80 dark:hover:bg-blue-900/20'}`}
                          onClick={() => {
                              if (!notification.isRead) markAsRead(notification.id);
                              setDetailModal(notification);
                          }}
                      >
                          <div className="w-9 h-9 rounded-full bg-blue-100/50 dark:bg-blue-500/10 border border-blue-200/50 dark:border-transparent flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 mt-0.5">
                              <Icon size={16} strokeWidth={2.5} />
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col">
                              <div className="flex items-center gap-2 mb-0.5">
                                  <h3 className="font-inter text-[13px] font-semibold text-slate-900 dark:text-white m-0 truncate">{notification.title}</h3>
                                  {!notification.isRead && (
                                      <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full shrink-0"></span>
                                  )}
                              </div>

                              <p className="font-inter text-[13px] text-slate-600 dark:text-slate-300 m-0 truncate sm:whitespace-normal leading-snug">
                                  {notification.message}
                              </p>

                              <div className="flex items-center justify-between mt-1.5">
                                  <span className="font-inter text-[11px] text-slate-400 dark:text-slate-500 m-0">{fmtTime(notification.timestamp)}</span>
                                  {!notification.isRead ? (
                                      <span className="font-inter text-[10px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400">New</span>
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

      {/* ── Notification Detail Modal ── */}
      {detailModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-6" onClick={() => setDetailModal(null)}>
              <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[520px] flex flex-col shadow-2xl overflow-hidden relative border border-slate-200 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-4 p-6 pb-0">
                      <div className="shrink-0 w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-transparent flex items-center justify-center text-blue-600 dark:text-blue-400">
                          {detailModal.type === 'loan' ? <Banknote size={24} /> : (detailModal.type === 'donation' || detailModal.type === 'savings') ? <Heart size={24} /> : <CalendarDays size={24} />}
                      </div>
                      <div className="flex-1">
                          <div className="flex justify-between items-start">
                              <h2 className="font-inter text-lg font-bold m-0 mb-2 text-slate-900 dark:text-white leading-snug pr-4">{detailModal.title}</h2>
                              <button className="w-8 h-8 border-none bg-slate-100 dark:bg-white/5 rounded-lg cursor-pointer flex items-center justify-center text-slate-500 dark:text-slate-400 -mt-1 shrink-0 transition-colors hover:bg-slate-200 dark:hover:bg-white/10" onClick={() => setDetailModal(null)}>
                                  ×
                              </button>
                          </div>
                          <div className="flex items-center gap-2 mb-4">
                              <span className="text-[11px] text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md font-semibold capitalize tracking-wide">
                                  {detailModal.type}
                              </span>
                              <span className="text-[13px] text-slate-500 dark:text-slate-400 font-inter font-medium">
                                  {fmtTime(detailModal.timestamp)}
                              </span>
                          </div>
                      </div>
                  </div>
                  <div className="p-6 flex justify-center">
                      <div className="bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl p-5 w-full">
                          <p className="font-inter text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed m-0 text-center">
                              {detailModal.message}
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
