import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Bell, Banknote, Heart, CalendarDays, Circle, X, Menu } from 'lucide-react';
import API from '../../utils/api';

export default function UserHeader({ toggleSidebar, collapsed }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const token = localStorage.getItem('token');
  const [notifItems, setNotifItems] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const dropdownRef = useRef(null);

  /* --- Notification Fetching --- */
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await fetch(`${API}/api/notifications/feed`, { headers });
      
      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        return;
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to fetch feed');

      const { readIds: readIdsFromData, payments, loans: loansDataFeed, donations: donationsDataFeed, attendance: attendanceDataFeed, savings: savingsDataFeed } = data;

      const currentReadIds = new Set(readIdsFromData || []);
      setReadIds(currentReadIds);

      const items = [];
      if (loansDataFeed) {
        loansDataFeed.forEach(l => {
          if (l.status === 'awaiting_member_approval') {
            items.push({ id: `loan-terms-${l._id}`, type: 'loan', title: 'Terms Modified', message: `Review proposed terms for loan ${l.loanId}.`, timestamp: l.updatedAt || l.createdAt });
          }
          if (l.status === 'approved') {
            items.push({ id: `loan-app-${l._id}`, type: 'loan', title: 'Loan Approved', message: `Your loan ${l.loanId} has been approved.`, timestamp: l.updatedAt || l.createdAt });
          }
          if (l.status === 'active' && l.disbursed) {
            const term = l.termMonths || 12;
            const paidMonths = l.paidMonths || 0;
            if (paidMonths < term && l.disbursementDate) {
              const startDate = new Date(l.disbursementDate);
              const nextDue = new Date(startDate);
              nextDue.setMonth(startDate.getMonth() + paidMonths + 1);
              const cutoffDate = new Date(nextDue);
              cutoffDate.setDate(nextDue.getDate() + 3);
              cutoffDate.setHours(23, 59, 59, 999);
              
              if (Date.now() > cutoffDate.getTime()) {
                items.push({ 
                  id: `loan-late-${l._id}-${paidMonths}`, 
                  type: 'loan', 
                  title: 'Payment Overdue', 
                  message: `Your payment for loan ${l.loanId} is late. Please settle to avoid further penalties.`, 
                  timestamp: cutoffDate.toISOString() 
                });
              }
            }
            items.push({ id: `loan-disbursed-${l._id}`, type: 'loan', title: 'Loan Disbursed', message: `Your loan ${l.loanId} has been successfully disbursed.`, timestamp: l.disbursementDate || l.updatedAt });
          }
          if (l.status === 'rejected') {
            items.push({ id: `loan-rejected-${l._id}`, type: 'loan', title: 'Loan Rejected', message: `Your loan application ${l.loanId} was rejected.`, timestamp: l.rejectedDate || l.updatedAt });
          }
        });
      }
      if (payments) {
        payments.forEach(p => {
          if (p.status === 'pending') {
            items.push({ id: `payment-pending-${p._id}`, type: 'payment_pending', title: 'Payment Submitted', message: `Month #${p.monthNumber} payment for ${p.loanId} is pending.`, timestamp: p.submittedAt || p.createdAt });
          }
          if (p.status === 'confirmed') {
            items.push({ id: `payment-confirmed-${p._id}`, type: 'payment_confirmed', title: 'Payment Confirmed', message: `Payment of ₱${p.amount.toLocaleString()} for ${p.loanId} confirmed.`, timestamp: p.confirmedAt || p.updatedAt });
          }
          if (p.status === 'rejected') {
            items.push({ id: `payment-rejected-${p._id}`, type: 'payment_rejected', title: 'Payment Rejected', message: `Your payment for ${p.loanId} was rejected.`, timestamp: p.rejectedAt || p.updatedAt });
          }
        });
      }
      if (donationsDataFeed) {
        donationsDataFeed.filter(d => d.status === 'confirmed').forEach(d => {
          items.push({ id: `don-${d._id}`, type: 'donation', title: 'Donation Received', message: `₱${d.amount.toLocaleString()} donation confirmed.`, timestamp: d.updatedAt || d.date || d.createdAt });
        });
      }
      if (attendanceDataFeed) {
        attendanceDataFeed.slice(0, 5).forEach(a => {
          items.push({ id: `att-${a._id}`, type: 'attendance', title: 'Attendance Recorded', message: `Attended ${a.service || 'Sunday Service'}.`, timestamp: a.createdAt || a.date });
        });
      }
      if (savingsDataFeed) {
        savingsDataFeed.filter(s => s.type === 'deposit' && s.status === 'confirmed').forEach(s => {
          items.push({ 
            id: `sav-${s._id}`, 
            type: 'savings', 
            title: 'Savings Validated', 
            message: `Your deposit of ₱${s.amount.toLocaleString()} is now confirmed.`, 
            timestamp: s.date || s.createdAt 
          });
        });
        savingsDataFeed.filter(s => s.type === 'withdrawal' && s.status === 'confirmed').forEach(s => {
          items.push({ 
            id: `sav-wd-${s._id}`, 
            type: 'savings_withdrawal', 
            title: 'Withdrawal Successful', 
            message: `Your withdrawal of ₱${s.amount.toLocaleString()} from ${s.goalName || 'your savings'} has been approved.`, 
            timestamp: s.confirmedAt || s.date || s.createdAt 
          });
        });
      }

      items.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
      setNotifItems(items.slice(0, 5));
      setUnreadNotifCount(items.filter(it => !currentReadIds.has(it.id)).length);
    } catch (err) {
      console.error('Failed to fetch header notifications:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 120000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (id) => {
    if (readIds.has(id)) return;
    try {
      await fetch(`${API}/api/read-notifications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      });
      setReadIds(prev => new Set([...prev, id]));
      setUnreadNotifCount(c => Math.max(0, c - 1));
    } catch (e) { console.error(e); }
  };

  const markAllAsRead = async () => {
    const unread = notifItems.filter(it => !readIds.has(it.id)).map(it => it.id);
    if (unread.length === 0) return;
    try {
      await fetch(`${API}/api/read-notifications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unread })
      });
      setReadIds(prev => new Set([...prev, ...unread]));
      setUnreadNotifCount(0);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const handleOutside = (e) => {
      if (showNotifDropdown && dropdownRef.current && !dropdownRef.current.contains(e.target) && !e.target.closest('.user-header-notify-btn')) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showNotifDropdown]);

  const formatTimeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 0) {
      if (diff > -60000) return 'Just now';
      return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <header className="flex items-center justify-between mb-6 pb-4 border-b border-border">
      <div className="flex items-center gap-3">
        <button 
          className="md:hidden w-10 h-10 rounded-xl bg-card dark:bg-[#1E2130] text-primary border border-border flex items-center justify-center shadow-sm cursor-pointer active:scale-95 transition-all p-0" 
          onClick={toggleSidebar}
        >
          {collapsed ? <Menu size={22} className="text-primary dark:text-blue-400" /> : <X size={22} className="text-primary dark:text-blue-400" />}
        </button>

        <div>
          <h1 className="font-inter text-xl sm:text-2xl font-bold text-foreground m-0 tracking-tight">
            Welcome back{profile?.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}!
          </h1>
        </div>
      </div>

      <div className="relative">
        <button 
          className="user-header-notify-btn relative w-10 h-10 rounded-xl bg-[#0D1F45] dark:bg-[#1E2130] hover:bg-[#162d61] dark:hover:bg-[#252A3E] border border-white/10 flex items-center justify-center cursor-pointer transition-all p-0 shadow-sm" 
          onClick={() => setShowNotifDropdown(!showNotifDropdown)}
          aria-label="Toggle notifications"
        >
          <Bell size={19} className="text-white" />
          {unreadNotifCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-inter text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-background animate-badgePop">
              {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
            </span>
          )}
        </button>

        {showNotifDropdown && (
          <div 
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-card dark:bg-[#1E2130] border border-border rounded-2xl shadow-2xl z-[1200] overflow-hidden animate-fadeIn" 
            ref={dropdownRef}
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
              <h3 className="font-inter text-sm font-bold text-foreground m-0">Notifications</h3>
              <button 
                className="font-inter text-xs text-blue-600 dark:text-blue-400 hover:underline bg-transparent border-none cursor-pointer p-0 font-medium" 
                onClick={markAllAsRead}
              >
                Mark all as read
              </button>
            </div>
            
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {notifItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                  <Bell size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-inter text-sm m-0">No notifications yet</p>
                </div>
              ) : (
                notifItems.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => { markAsRead(item.id); navigate('/notifications'); setShowNotifDropdown(false); }}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                      readIds.has(item.id) ? 'opacity-70' : 'bg-blue-50/40 dark:bg-blue-950/20'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center shrink-0 mt-0.5">
                      {item.type === 'loan' ? <Banknote size={15} className="text-blue-600 dark:text-blue-400" /> : 
                       item.type === 'donation' ? <Heart size={15} className="text-rose-500" /> :
                       item.type === 'attendance' ? <CalendarDays size={15} className="text-blue-600 dark:text-blue-400" /> :
                       item.type === 'savings' ? <Banknote size={15} className="text-emerald-600 dark:text-emerald-400" /> :
                       item.type === 'savings_withdrawal' ? <Banknote size={15} className="text-emerald-600 dark:text-emerald-400" /> :
                       <Circle size={8} className="text-blue-600 dark:text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="font-inter text-xs font-semibold text-foreground m-0 truncate">{item.title}</p>
                        {!readIds.has(item.id) && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                      </div>
                      <p className="font-inter text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 line-clamp-2 leading-relaxed">{item.message}</p>
                      <span className="font-inter text-[10px] text-slate-400 dark:text-slate-500">{formatTimeAgo(item.timestamp)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-border bg-slate-50/50 dark:bg-slate-900/30 text-center">
              <button 
                className="font-inter text-xs font-semibold text-primary dark:text-blue-400 hover:underline bg-transparent border-none cursor-pointer p-0" 
                onClick={() => { navigate('/notifications'); setShowNotifDropdown(false); }}
              >
                See all notifications
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
