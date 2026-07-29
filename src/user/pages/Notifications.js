import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';

import API from '../../utils/api';
import { Banknote, Bell, CalendarDays, Circle, Heart, ChevronDown, ChevronUp, Check, CircleCheck, AlertCircle, PiggyBank, BadgeCheck, Landmark, X } from 'lucide-react';


const fmt = (n) =>
  n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '₱0.00';

const fmtTime = (date, isReminder) => {
  if (!date) return '';
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  const diffAgo = now.getTime() - target.getTime();

  if (isReminder) {
    const days = Math.ceil(diff / 86400000);
    if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
    if (days === 0) return 'Due today';
    if (days > 0 && days <= 14) return `Due in ${days} day${days !== 1 ? 's' : ''}`;
  }

  const mins = Math.floor(diffAgo / 60000);
  const hours = Math.floor(diffAgo / 3600000);
  const daysAgo = Math.floor(diffAgo / 86400000);

  const dateStrFull = target.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const dateStrShort = target.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const timeStr = target.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago · ${dateStrShort}, ${timeStr}`;
  if (daysAgo < 7) return `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago · ${dateStrShort}, ${timeStr}`;
  
  return `${dateStrFull} · ${timeStr}`;
};

// Persisted read access via db

export default function Notifications() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [readIds, setReadIds] = useState(new Set());
  const [detailModal, setDetailModal] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [expandedSimple, setExpandedSimple] = useState(new Set());

  /* ── Modal swipe-down-to-close touch gesture state ── */
  const [modalDragY, setModalDragY] = useState(0);
  const [modalTouchStartY, setModalTouchStartY] = useState(null);
  const [isDraggingModal, setIsDraggingModal] = useState(false);

  const handleModalTouchStart = (e) => {
    setModalTouchStartY(e.touches[0].clientY);
    setIsDraggingModal(true);
  };

  const handleModalTouchMove = (e) => {
    if (modalTouchStartY === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - modalTouchStartY;
    if (deltaY > 0) {
      setModalDragY(deltaY);
    }
  };

  const handleModalTouchEnd = () => {
    if (modalDragY > 70) {
      setDetailModal(null);
    }
    setModalDragY(0);
    setModalTouchStartY(null);
    setIsDraggingModal(false);
  };

  const [prefs] = useState(() => {
    const saved = localStorage.getItem('notif_prefs');
    return saved ? JSON.parse(saved) : {
      loan: true,
      payment_pending: true,
      announcement: true,
      attendance: true,
      savings: true,
      donation: true
    };
  });

  /* ── Terms review modal state ── */
  const [termsModal, setTermsModal] = useState(null);  // the loan object
  const [termsLoading, setTermsLoading] = useState(false);

  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(res => res.ok ? res.json() : { success: false });

  const { data: lData, isValidating: lValidating } = useSWR(`${API}/api/loans/my-loans`, fetcherSingle, { revalidateOnFocus: false });
  const { data: dData, isValidating: dValidating } = useSWR(`${API}/api/donations/my-donations`, fetcherSingle, { revalidateOnFocus: false });
  const { data: aData, isValidating: aValidating } = useSWR(`${API}/api/attendance/my-attendance`, fetcherSingle, { revalidateOnFocus: false });
  const { data: sData, isValidating: sValidating } = useSWR(`${API}/api/savings/transactions`, fetcherSingle, { revalidateOnFocus: false });
  const { data: ppData, isValidating: ppValidating } = useSWR(`${API}/api/loans/my-payments`, fetcherSingle, { revalidateOnFocus: false });
  const { data: readData, isValidating: readValidating, mutate: mutateRead } = useSWR(`${API}/api/read-notifications`, fetcherSingle, { revalidateOnFocus: false });

  const loading = (!lData && lValidating) || 
                  (!dData && dValidating) ||
                  (!aData && aValidating) ||
                  (!sData && sValidating) ||
                  (!ppData && ppValidating) ||
                  (!readData && readValidating);

  useEffect(() => {
    if (readData && readData.readIds) {
      setReadIds(new Set(readData.readIds));
    }
  }, [readData]);

  const rawItems = useMemo(() => {
    const items = [];

    /* Loans → notifications */
    if (lData && lData.loans) {
      lData.loans.forEach((l) => {
        const base = { id: `loan-${l._id}`, type: 'loan', timestamp: l.appliedDate || l.createdAt };

        if (l.status === 'awaiting_member_approval' && l.modifiedTerms) {
          items.push({
            ...base,
            id: `loan-terms-${l._id}`,
            type: 'loan',
            title: 'Loan Terms Modified — Review Required',
            message: `The loan officer has proposed new terms for your loan ${l.loanId ? `#${l.loanId}` : ''}. Tap to review and respond.`,
            timestamp: l.modifiedTerms.proposedDate || l.updatedAt,
            actionRequired: true,
            loanData: l,
          });
        }

        if (l.statusHistory && l.statusHistory.length > 0) {
          l.statusHistory.forEach((history) => {
            const hBase = { ...base, timestamp: history.date, loanData: { ...l, status: history.status } };
            if (history.status === 'pending') {
              items.push({
                ...hBase, id: `loan-pending-${l._id}`,
                title: 'Loan Application Submitted',
                message: `Your loan application ${l.loanId ? `#${l.loanId}` : ''} for ₱${Number(l.amount).toLocaleString()} is under review.`,
              });
            } else if (history.status === 'approved') {
              items.push({
                ...hBase, id: `loan-approved-${l._id}`,
                title: 'Loan Application Approved',
                message: `₱${Number(l.amount).toLocaleString()} approved — disbursement incoming`,
              });
            } else if (history.status === 'rejected') {
              items.push({
                ...hBase, id: `loan-rejected-${l._id}`,
                title: 'Loan Application Rejected',
                message: `Your loan application ${l.loanId ? `#${l.loanId}` : ''} was not approved.${history.reason ? ` Reason: ${history.reason}` : ''}`,
              });
            } else if (history.status === 'processed') {
              items.push({
                ...hBase, id: `loan-processed-${l._id}`,
                title: 'Loan Disbursed',
                message: `Your loan ${l.loanId ? `#${l.loanId}` : ''} for ₱${Number(l.amount).toLocaleString()} has been disbursed via ${(l.paymentMethod || 'cash').toUpperCase()}. Funds should reflect within 1–2 banking days.`,
                proofData: l.proofData || null,
              });
            }
          });
        } else {
          if (l.status === 'approved' || l.status === 'active') {
            items.push({
              ...base, id: `loan-approved-${l._id}`,
              title: 'Loan Application Approved',
              message: `₱${Number(l.amount).toLocaleString()} approved — disbursement incoming`,
            });
          } else if (l.status === 'pending') {
            items.push({
              ...base, id: `loan-pending-${l._id}`,
              title: 'Loan Application Submitted',
              message: `Your loan application ${l.loanId ? `#${l.loanId}` : ''} for ₱${Number(l.amount).toLocaleString()} is under review.`,
            });
          } else if (l.status === 'rejected') {
            items.push({
              ...base, id: `loan-rejected-${l._id}`,
              title: 'Loan Application Update',
              message: `Your loan application ${l.loanId ? `#${l.loanId}` : ''} for ₱${Number(l.amount).toLocaleString()} was not approved.`,
            });
          } else if (l.status === 'completed') {
            items.push({
              ...base, id: `loan-done-${l._id}`,
              title: 'Loan Completed',
              message: `Your loan ${l.loanId ? `#${l.loanId}` : ''} has been fully paid. Thank you!`,
            });
          }
        }

        if ((l.status === 'active') && l.nextPaymentDate) {
          const isOverdue = new Date(l.nextPaymentDate) < new Date();
          items.push({
            ...base,
            id: `loan-reminder-${l._id}`,
            title: 'Payment Reminder',
            timestamp: l.nextPaymentDate,
            isReminder: true,
            isUrgent: isOverdue,
            loanData: l,
            message: `Your loan payment of ₱${Number(l.monthlyPayment || l.amount).toLocaleString()} is due on ${new Date(l.nextPaymentDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}. Please settle on time to avoid penalties.`,
          });
        }
      });
    }

    /* Payments → notifications */
    if (ppData && ppData.payments) {
      ppData.payments.forEach((p) => {
        items.push({
          id: `payment-${p.status}-${p._id}`,
          type: 'payment_pending',
          timestamp: p.submittedAt || p.confirmedAt || p.createdAt,
          title: p.status === 'pending' ? 'Payment Submitted — Awaiting Confirmation' : (p.status === 'confirmed' ? 'Payment Confirmed' : 'Payment Rejected'),
          message: p.status === 'pending'
            ? `Month #${p.monthNumber || ''} payment of ₱${Number(p.amount).toLocaleString()} via ${(p.paymentMethod || 'cash').toUpperCase()} is awaiting confirmation.`
            : (p.status === 'confirmed'
               ? `Month #${p.monthNumber || ''} · ₱${Number(p.amount).toLocaleString()} via ${(p.paymentMethod || 'cash').toUpperCase()} · Confirmed`
               : `Your Month #${p.monthNumber || ''} payment of ₱${Number(p.amount).toLocaleString()} via ${(p.paymentMethod || 'cash').toUpperCase()} was rejected.`),
          paymentData: p,
          isUrgent: p.status === 'rejected',
        });
      });
    }

    /* Donations → notifications */
    if (dData && dData.donations) {
      dData.donations.forEach((d) => {
        if (d.status === 'confirmed') {
          items.push({
            id: `donation-confirmed-${d._id}`,
            type: 'donation',
            timestamp: d.confirmedAt || d.createdAt || d.date,
            title: 'Donation Confirmed — Thank You!',
            message: `Blessings! Your donation of ₱${Number(d.amount).toLocaleString()} for ${d.category} has been confirmed. We truly appreciate your support for the ministry.`,
            amount: d.amount,
            category: d.category
          });
        } else if (d.status === 'rejected') {
          items.push({
            id: `donation-rejected-${d._id}`,
            type: 'donation',
            timestamp: d.rejectedAt || d.updatedAt || d.date,
            title: 'Donation Update — Action Required',
            message: `We were unable to confirm your donation of ₱${Number(d.amount).toLocaleString()} for ${d.category}. ${d.rejectReason ? `Reason: ${d.rejectReason}` : 'Please review your submission details.'}`,
            amount: d.amount,
            category: d.category,
            isUrgent: true
          });
        }
      });
    }

    /* Savings → notifications */
    if (sData && sData.transactions) {
      sData.transactions.filter(t => t.type === 'deposit' && t.status === 'confirmed').forEach((s) => {
        items.push({
          id: `savings-${s._id}`,
          type: 'savings',
          timestamp: s.date,
          title: 'Savings Validated',
          message: `Your deposit of ₱${Number(s.amount).toLocaleString()} is now confirmed.`,
          amount: s.amount,
          goalName: s.goalName
        });
      });
    }

    /* Attendance → notifications */
    if (aData && aData.attendance) {
      aData.attendance.forEach((a) => {
        items.push({
          id: `attendance-${a._id}`,
          type: 'attendance',
          timestamp: a.createdAt || a.date,
          title: 'Attendance Recorded',
          message: `Your attendance for ${a.service || 'Sunday Service'} at ${a.branch || 'Unknown Community'}${a.date ? ` on ${new Date(a.date || a.createdAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''} has been successfully recorded.`,
          service: a.service,
          branch: a.branch,
          recordedBy: a.recordedBy // if available
        });
      });
    }

    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return items;
  }, [lData, ppData, dData, sData, aData]);

  /* ── Derived state ── */
  const notifications = rawItems
    .map((n) => ({ ...n, isRead: readIds.has(n.id) }))
    .filter(n => prefs[n.type] !== false);

  const getFilteredItems = () => {
    let base = notifications;
    if (activeFilter === 'unread') return base.filter(n => !n.isRead);
    if (activeFilter === 'loans_payments') return base.filter(n => ['loan', 'payment_pending'].includes(n.type));
    if (activeFilter === 'activity') return base.filter(n => ['attendance', 'savings', 'donation'].includes(n.type));
    return base;
  };

  const filtered = getFilteredItems();

  const getUnreadCount = (tabKey) => {
    if (tabKey === 'all') return notifications.filter(n => !n.isRead).length;
    if (tabKey === 'unread') return notifications.filter(n => !n.isRead).length;
    if (tabKey === 'loans_payments') return notifications.filter(n => !n.isRead && ['loan', 'payment_pending'].includes(n.type)).length;
    if (tabKey === 'activity') return notifications.filter(n => !n.isRead && ['attendance', 'savings', 'donation'].includes(n.type)).length;
    return 0;
  };

  const performReadUpdate = async (idsArray) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API}/api/read-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: idsArray })
      });
      // Ping the sidebar so it re-fetches its unread
      window.dispatchEvent(new Event("admin-notif-read-update"));
    } catch { /* silent */ }
  };

  const markAsRead = (id) => {
    setReadIds((prev) => {
      const s = new Set(prev);
      s.add(id);
      performReadUpdate([id]);
      return s;
    });
  };

  const markAllAsRead = () => {
    const idsToMark = notifications.filter(n => !n.isRead).map(n => n.id);
    if (idsToMark.length === 0) return;
    performReadUpdate(idsToMark);
    setReadIds((prev) => {
      const s = new Set(prev);
      idsToMark.forEach(id => s.add(id));
      return s;
    });
  };

  /* ── UI helpers ── */
  const getIcon = (type, title = '') => {
    const wrap = (bgClass, iconColorClass, Icon) => (
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bgClass}`}>
        <Icon size={18} className={iconColorClass} />
      </div>
    );

    if (type === 'loan') {
      if (title.includes('Disbursed'))  return wrap('bg-blue-100 dark:bg-blue-950/60', 'text-blue-600 dark:text-blue-400', Landmark);
      if (title.includes('Approved'))   return wrap('bg-emerald-100 dark:bg-emerald-950/60', 'text-emerald-600 dark:text-emerald-400', BadgeCheck);
      if (title.includes('Reminder'))   return wrap('bg-rose-100 dark:bg-rose-950/60', 'text-rose-600 dark:text-rose-400', AlertCircle);
      return wrap('bg-blue-100 dark:bg-blue-950/60', 'text-blue-600 dark:text-blue-400', Banknote);
    }
    if (type === 'payment_pending')     return wrap('bg-emerald-100 dark:bg-emerald-950/60', 'text-emerald-600 dark:text-emerald-400', CircleCheck);
    if (type === 'savings')             return wrap('bg-[#F0D89A]/30 dark:bg-amber-950/60', 'text-amber-700 dark:text-amber-300', PiggyBank);
    if (type === 'donation')            return wrap('bg-pink-100 dark:bg-pink-950/60', 'text-pink-600 dark:text-pink-400', Heart);
    if (type === 'attendance')          return wrap('bg-teal-100 dark:bg-teal-950/60', 'text-teal-600 dark:text-teal-400', CalendarDays);
    return wrap('bg-blue-100 dark:bg-blue-950/60', 'text-blue-600 dark:text-blue-400', Bell);
  };

  const badgeClass = (type) =>
    type === 'loan' ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
      : type === 'donation' ? 'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300'
        : type === 'savings' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
          : type === 'payment_pending' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
            : 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300';

  const cardClass = (n) => {
    let classes = 'relative z-10 p-4 sm:p-5 bg-white dark:bg-[#1E2130] text-slate-900 dark:text-white rounded-2xl flex items-start gap-4 transition-transform cursor-pointer border border-transparent shadow-sm';
    if (!n.isRead) classes += ' bg-blue-50/60 dark:bg-blue-950/30 border-blue-200/80 dark:border-blue-900/50 font-semibold';
    if (n.actionRequired) classes += ' border-amber-300 dark:border-amber-700/60 bg-amber-50/60 dark:bg-amber-950/30';
    if (n.isRead) classes += ' opacity-90 dark:opacity-80';
    if (n.type === 'announcement') classes += ' border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30';
    if (n.isUrgent) classes += ' border-red-300 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/30';
    return classes;
  };

  const handleTermsResponse = async (accepted) => {
    if (!termsModal) return;
    setTermsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/loans/${termsModal._id}/respond-terms`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Failed'); return; }
      setTermsModal(null);
      // Wait for re-fetch or rely on SWR revalidation
      mutateRead();
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setTermsLoading(false);
    }
  };

  const badgeLabel = (type) =>
    type === 'loan' ? 'Loan'
      : type === 'donation' ? 'Donation'
        : type === 'savings' ? 'Savings'
          : type === 'payment_pending' ? 'Payment'
            : type === 'announcement' ? 'Announcement'
              : 'Attendance';

  /* ── Grouping & Collapsing Logic ── */
  const { pinned, groups } = (() => {
    const pinnedItems = notifications.filter(n => n.actionRequired);
    const others = filtered.filter(n => !n.actionRequired);

    const g = { today: [], yesterday: [], earlier: [] };
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    others.forEach(item => {
      const date = new Date(item.timestamp);
      if (date >= startOfToday) g.today.push(item);
      else if (date >= startOfYesterday) g.yesterday.push(item);
      else g.earlier.push(item);
    });

    const collapse = (list) => {
      return list;
    };

    return {
      pinned: pinnedItems,
      groups: {
        today: collapse(g.today),
        yesterday: collapse(g.yesterday),
        earlier: collapse(g.earlier)
      }
    };
  })();

  const emptyStates = {
    all: { msg: "You're all caught up!", hint: "Check back later for updates." },
    loans_payments: { msg: "No loan updates or payments yet.", hint: "Visit the Loans page to apply for a loan or manage payments." },
    announcements: { msg: "No new announcements.", hint: "Stay tuned for church-wide updates." },
    activity: { msg: "No recent activity recorded.", hint: "Visit the Donations, Savings or Attendance pages to get started." },
    unread: { msg: "No unread notifications.", hint: "Good job! You've seen everything." }
  };
  const simpleTypes = ['attendance', 'savings', 'donation', 'announcement'];

  const renderCard = (n) => {
    const isSimple = simpleTypes.includes(n.type) && !n.actionRequired;
    const isExpanded = expandedSimple.has(n.id);

    return (
      <NotificationCard
        key={n.id}
        n={n}
        isSimple={isSimple}
        isExpanded={isExpanded}
        onMarkRead={() => markAsRead(n.id)}
        onClick={() => {
          if (!n.isRead) markAsRead(n.id);
          if (n.actionRequired && n.loanData) {
            setTermsModal(n.loanData);
          } else if (isSimple) {
            setExpandedSimple(prev => {
              const next = new Set(prev);
              if (next.has(n.id)) next.delete(n.id);
              else next.add(n.id);
              return next;
            });
          } else {
            setDetailModal(n);
          }
        }}
      />
    );
  };

  const renderSummary = (summary) => {
    const isExpanded = expandedGroups.has(summary.id);
    return (
      <div key={summary.id} className="space-y-2 mb-3">
        <div
          className={`p-4 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all shadow-sm ${isExpanded ? 'ring-2 ring-blue-500/50' : ''}`}
          onClick={() => {
            setExpandedGroups(prev => {
              const next = new Set(prev);
              if (next.has(summary.id)) next.delete(summary.id);
              else next.add(summary.id);
              return next;
            });
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              {getIcon(summary.type)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-bold mr-1.5">{summary.count}</span> new {badgeLabel(summary.type).toLowerCase()}{summary.count > 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-slate-400">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
        {isExpanded && (
          <div className="pl-4 sm:pl-6 space-y-3 pt-1 border-l-2 border-slate-200 dark:border-white/10 ml-4">
            {summary.items.map(n => renderCard(n))}
          </div>
        )}
      </div>
    );
  };

  const NotificationCard = ({ n, isSimple, isExpanded, onMarkRead, onClick }) => {
    const [touchStart, setTouchStart] = useState(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);

    const handleTouchStart = (e) => {
      setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e) => {
      if (touchStart === null) return;
      const currentTouch = e.targetTouches[0].clientX;
      const diff = currentTouch - touchStart;
      if (diff < -10) {
        setIsSwiping(true);
        setSwipeOffset(Math.max(diff, -100));
      } else {
        setSwipeOffset(0);
      }
    };

    const handleTouchEnd = () => {
      if (swipeOffset <= -80) {
        onMarkRead();
      }
      setSwipeOffset(0);
      setTouchStart(null);
      setTimeout(() => setIsSwiping(false), 50);
    };

    const renderCTA = (n) => {
      let text = '';
      let link = '';
      if (n.type === 'payment_pending') {
        text = 'View Receipt →';
        link = '/loans';
      } else if (n.type === 'loan' && (n.title.includes('Approved') || n.title.includes('Disbursed'))) {
        text = 'View Loan →';
        link = '/loans';
      } else if (n.type === 'loan' && (n.title.includes('Reminder') || n.isUrgent)) {
        text = 'Pay Now →';
        link = '/loans';
      } else if (n.type === 'savings') {
        text = 'View Savings →';
        link = '/savings';
      } else if (n.type === 'donation') {
        text = 'View Donations →';
        link = '/donations';
      }
      
      if (!text) return null;
      
      return (
        <span 
          onClick={(e) => { e.stopPropagation(); window.location.href = link; }}
          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer inline-block"
        >
          {text}
        </span>
      );
    };

    return (
      <div className={`relative overflow-hidden rounded-2xl border transition-all mb-3 font-inter ${
        isExpanded ? 'ring-2 ring-blue-500/50' : ''
      } ${
        n.isUrgent
          ? 'border-rose-200/90 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20'
          : n.actionRequired
          ? 'border-amber-200/90 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20'
          : !n.isRead
          ? 'border-blue-200/90 dark:border-blue-900/40 bg-white dark:bg-[#1E2130] shadow-sm shadow-blue-100/50 dark:shadow-none'
          : 'border-slate-200/70 dark:border-white/10 bg-slate-50/60 dark:bg-[#1E2130]/60'
      }`}>
        {/* Swipe-to-read blue bg (ONLY visible when swiping left) */}
        {swipeOffset < 0 && (
          <div className="absolute inset-0 bg-blue-600 flex items-center justify-end px-6 z-0 rounded-2xl">
            <div className="flex items-center gap-1.5 text-white text-xs font-bold font-inter">
              <Check size={16} color="white" />
              <span>Mark Read</span>
            </div>
          </div>
        )}

        <div
          className={`relative z-10 flex items-start gap-3 p-3.5 sm:p-4 transition-transform ${
            n.isUrgent
              ? 'bg-rose-50/40 dark:bg-rose-950/30 border-l-4 border-l-rose-500'
              : n.actionRequired
              ? 'bg-amber-50/40 dark:bg-amber-950/30 border-l-4 border-l-amber-500'
              : !n.isRead
              ? 'bg-white dark:bg-[#1E2130] border-l-4 border-l-blue-600 dark:border-l-blue-500'
              : 'bg-slate-50/60 dark:bg-[#1E2130]/60 border-l-4 border-l-transparent'
          } rounded-2xl`}
          style={{ transform: `translateX(${swipeOffset}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => {
            if (!n.isRead) markAsRead(n.id);
            if (!isSwiping) onClick();
          }}
        >
          {/* Icon Badge */}
          <div className="shrink-0 mt-0.5">
            {getIcon(n.type, n.title)}
          </div>

          {/* Main Card Content */}
          <div className="flex-1 min-w-0 font-inter">
            {/* Header Row: Title + Category Badge + Read/Unread Status */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                <h3 className={`text-xs sm:text-sm leading-tight ${n.isRead ? 'font-semibold text-slate-700 dark:text-slate-300' : 'font-extrabold text-slate-900 dark:text-white'}`}>
                  {n.title}
                </h3>
                {!n.isRead && (
                  <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" title="Unread" />
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-1">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${badgeClass(n.type)}`}>
                  {badgeLabel(n.type)}
                </span>
              </div>
            </div>

            {/* Message Body */}
            <p className={`text-xs leading-relaxed mb-2.5 ${n.isRead ? 'text-slate-500 dark:text-slate-400 font-normal' : 'text-slate-600 dark:text-slate-300 font-medium'}`}>
              {n.message}
            </p>

            {/* Footer Row: Timestamp + CTA + Mark Read Action */}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100/80 dark:border-white/5">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                {fmtTime(n.timestamp, n.isReminder)}
              </span>

              <div className="flex items-center gap-2 ml-auto shrink-0">
                {renderCTA(n)}
                {n.actionRequired && (
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer">
                    Review Terms →
                  </span>
                )}

                {/* Mark as read button */}
                {!n.isRead && (
                  <button
                    className="h-6 px-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border border-blue-100 dark:border-blue-900/40 shrink-0"
                    onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
                    title="Mark as read"
                  >
                    <Check size={12} />
                    <span>Mark as read</span>
                  </button>
                )}

                {isSimple && (
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                )}
              </div>
            </div>

            {/* Expandable detail content for simple items */}
            {isSimple && (
              <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96 pt-3 mt-2 border-t border-slate-100 dark:border-white/5' : 'max-h-0'}`}>
                <div className="space-y-2 font-inter">
                  {n.type === 'attendance' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                      <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Service</label><span className="font-bold text-slate-800 dark:text-slate-200">{n.service || 'Sunday Service'}</span></div>
                      <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Community</label><span className="font-bold text-slate-800 dark:text-slate-200">{n.branch || 'Unknown Community'}</span></div>
                      <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Recorded On</label><span className="font-bold text-slate-800 dark:text-slate-200">{new Date(n.timestamp).toLocaleDateString()}</span></div>
                    </div>
                  )}
                  {n.type === 'savings' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                      <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Goal</label><span className="font-bold text-slate-800 dark:text-slate-200">{n.goalName || 'General Savings'}</span></div>
                      <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Amount</label><span className="font-bold text-blue-600 dark:text-blue-400">₱{Number(n.amount || 0).toLocaleString()}</span></div>
                      <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Date</label><span className="font-bold text-slate-800 dark:text-slate-200">{new Date(n.timestamp).toLocaleDateString()}</span></div>
                    </div>
                  )}
                  {n.type === 'donation' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                      <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Category</label><span className="font-bold text-slate-800 dark:text-slate-200">{n.category || 'Tithe'}</span></div>
                      <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Amount</label><span className="font-bold text-pink-600 dark:text-pink-400">₱{Number(n.amount || 0).toLocaleString()}</span></div>
                      <div><label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Date</label><span className="font-bold text-slate-800 dark:text-slate-200">{new Date(n.timestamp).toLocaleDateString()}</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-4 font-inter pb-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-white/10 font-inter">
          <div>
            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-inter mb-0.5">System &amp; Activity Updates</p>
            <h1 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 dark:text-white font-dm leading-none tracking-tight">Notifications</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-inter mt-1">Stay updated with your applications and account activity</p>
          </div>
        </div>

        {/* Controls Row: Filters + Mark All */}
        <div className="flex flex-wrap items-center justify-between gap-2 font-inter pt-1 pb-1">
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap min-w-0">
            {[
              { key: 'all', label: 'All', shortLabel: 'All' },
              { key: 'loans_payments', label: 'Loans & Payments', shortLabel: 'Loans & Pay' },
              { key: 'activity', label: 'Activity', shortLabel: 'Activity' },
              { key: 'unread', label: 'Unread', shortLabel: 'Unread' },
            ].map(({ key, label, shortLabel }) => (
              <button
                key={key}
                className={`px-2 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 border-none ${
                  activeFilter === key 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                    : 'bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
                onClick={() => setActiveFilter(key)}
              >
                <span className="hidden sm:inline">{label}</span>
                <span className="inline sm:hidden">{shortLabel}</span>
                {getUnreadCount(key) > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    activeFilter === key ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
                  }`}>
                    {getUnreadCount(key)}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button 
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer border-none bg-transparent shrink-0 ml-auto" 
            onClick={markAllAsRead}
          >
            Mark all as read
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-4 sm:p-5 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl flex items-start gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl text-center space-y-3 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <Bell size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{emptyStates[activeFilter]?.msg}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{emptyStates[activeFilter]?.hint}</p>
            {activeFilter !== 'all' && (
              <button className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-blue-700 transition-all cursor-pointer mt-2 border-none" onClick={() => setActiveFilter('all')}>
                Show all notifications
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">

            {/* Pinned Section */}
            {pinned.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Action Required</div>
                <div className="space-y-3">
                  {pinned.map(n => renderCard(n))}
                </div>
              </div>
            )}

            {/* Time-based Sections */}
            {['today', 'yesterday', 'earlier'].map(key => (
              groups[key].length > 0 && (
                <div key={key} className="space-y-3">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </div>
                  <div className="space-y-3">
                    {groups[key].map(n => n.isSummary ? renderSummary(n) : renderCard(n))}
                  </div>
                </div>
              )
            ))}

            <div className="h-6" />
          </div>
        )}

      </div>

      {/* ── Terms Review Modal ── */}
      {termsModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden sm:overflow-y-auto" onClick={() => !termsLoading && setTermsModal(null)}>
          <div className="relative w-full max-w-xl bg-white dark:bg-[#1E2130] rounded-t-3xl sm:rounded-2xl p-6 sm:p-8 shadow-2xl border-t sm:border border-slate-200 dark:border-white/10 max-h-[90vh] overflow-y-auto text-left space-y-4 font-inter" onClick={(e) => e.stopPropagation()}>
            {/* Mobile Drag Indicator Pill */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-2 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Loan Terms Modified</h2>
              <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full transition-colors" onClick={() => setTermsModal(null)}>
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              The loan officer has proposed new terms for your loan application
              <strong className="text-blue-600 dark:text-blue-400"> {termsModal.loanId}</strong>. Please review the changes below.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Original */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-white/5 space-y-2 text-xs">
                <h4 className="font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/5 pb-1">Original Terms</h4>
                <div className="flex justify-between"><span>Amount</span><strong>{fmt(termsModal.amount)}</strong></div>
                <div className="flex justify-between"><span>Term</span><strong>{termsModal.termMonths} months</strong></div>
                <div className="flex justify-between"><span>Monthly Payment</span><strong>{fmt(termsModal.monthlyPayment)}</strong></div>
                <div className="flex justify-between"><span>Total Interest</span><strong>{fmt(termsModal.totalInterest)}</strong></div>
                <div className="flex justify-between"><span>Total Repayment</span><strong>{fmt(termsModal.totalRepayment)}</strong></div>
              </div>

              {/* Proposed */}
              <div className="p-4 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-200/60 dark:border-blue-800/40 space-y-2 text-xs">
                <h4 className="font-bold text-blue-600 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800/40 pb-1">Proposed Terms</h4>
                <div className="flex justify-between text-slate-700 dark:text-slate-200"><span>Amount</span><strong className="text-blue-600 dark:text-blue-400">{fmt(termsModal.modifiedTerms?.approvedAmount)}</strong></div>
                <div className="flex justify-between text-slate-700 dark:text-slate-200"><span>Term</span><strong>{termsModal.modifiedTerms?.repaymentTerm} months</strong></div>
                <div className="flex justify-between text-slate-700 dark:text-slate-200"><span>Monthly Payment</span><strong>{fmt(termsModal.modifiedTerms?.monthlyPayment)}</strong></div>
                <div className="flex justify-between text-slate-700 dark:text-slate-200"><span>Total Interest</span><strong>{fmt(termsModal.modifiedTerms?.totalInterest)}</strong></div>
                <div className="flex justify-between text-slate-700 dark:text-slate-200"><span>Total Repayment</span><strong>{fmt(termsModal.modifiedTerms?.totalRepayment)}</strong></div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all text-xs cursor-pointer border-none"
                onClick={() => handleTermsResponse(false)}
                disabled={termsLoading}
              >
                Decline
              </button>
              <button
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all text-xs flex items-center justify-center cursor-pointer border-none"
                onClick={() => handleTermsResponse(true)}
                disabled={termsLoading}
              >
                {termsLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : 'Agree to Terms'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notification Detail Modal (Loans/Payments Receipt Slider) ── */}
      {detailModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden sm:overflow-y-auto" onClick={() => setDetailModal(null)}>
          <div
            className={`relative w-full max-w-sm sm:max-w-md bg-white dark:bg-[#1E2130] rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl border-t sm:border border-slate-200/80 dark:border-white/10 max-h-[92vh] overflow-y-auto text-left space-y-2.5 font-inter ${
              isDraggingModal ? '' : 'transition-transform duration-200'
            }`}
            style={{ transform: modalDragY > 0 ? `translateY(${modalDragY}px)` : 'none' }}
            onTouchStart={handleModalTouchStart}
            onTouchMove={handleModalTouchMove}
            onTouchEnd={handleModalTouchEnd}
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Mobile Drag Handle Pill */}
            <div className="w-full pt-0.5 pb-1 flex justify-center sm:hidden cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full shrink-0" />
            </div>

            {/* Top Close Button */}
            <button className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-none bg-transparent cursor-pointer" onClick={() => setDetailModal(null)}>
              <X size={16} />
            </button>

            {/* Receipt Icon Badge */}
            <div className="text-center pt-0.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-1.5 border border-emerald-100 dark:border-emerald-900/30 shadow-xs">
                <BadgeCheck size={22} />
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-dm tracking-tight leading-tight">
                {detailModal.type === 'payment_pending' ? 'Payment Confirmed' : detailModal.title}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {detailModal.timestamp
                  ? new Date(detailModal.timestamp).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : ''}
              </p>
            </div>

            {/* PAYMENT PENDING RECEIPT CONTENT */}
            {detailModal.type === 'payment_pending' && detailModal.paymentData && (
              <div className="space-y-2.5 pt-0.5">
                {/* Hero Amount Box */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-white/5 text-center">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">Total Amount Paid</span>
                  <div className="text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight">
                    ₱{Number(detailModal.paymentData.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                    <Check size={10} /> Confirmed Payment
                  </div>
                </div>

                {/* Ticket Details Rows */}
                <div className="space-y-1 pt-1 text-[11px] border-t border-dashed border-slate-200 dark:border-white/10">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Loan ID</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{detailModal.paymentData.loanId || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-t border-slate-100 dark:border-white/5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Installment</span>
                    <span className="font-bold text-slate-900 dark:text-white">Month #{detailModal.paymentData.monthNumber}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-t border-slate-100 dark:border-white/5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Payment Method</span>
                    <span className="font-bold text-slate-900 dark:text-white capitalize">{detailModal.paymentData.paymentMethod}</span>
                  </div>
                </div>

                {/* Proof of Payment Image - Fully Visible (object-contain) */}
                {detailModal.paymentData.proofData && (
                  <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-white/5">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">Proof of Payment</label>
                    <div 
                      className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 cursor-pointer bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-1"
                      onClick={() => setPreviewImage(detailModal.paymentData.proofData)}
                    >
                      <img
                        src={detailModal.paymentData.proofData}
                        alt="Payment proof"
                        className="w-full max-h-36 sm:max-h-40 object-contain rounded-lg group-hover:scale-102 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1 rounded-lg">
                        <span>Tap to open full image</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-xs cursor-pointer border-none flex items-center justify-center gap-1 mt-1.5"
                  onClick={() => window.location.href = '/loans'}
                >
                  View Loan Details →
                </button>
              </div>
            )}

            {/* LOAN NOTIFICATION SPECIFIC CONTENT */}
            {detailModal.type === 'loan' && (
              <div className="space-y-3 pt-0.5">
                <div className="grid grid-cols-2 gap-2 text-xs p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-white/5">
                  <div><label className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Loan ID</label><span className="font-bold text-slate-900 dark:text-white font-mono">{detailModal.loanData?.loanId || '—'}</span></div>
                  <div><label className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Amount</label><span className="font-extrabold text-blue-600 dark:text-blue-400">₱{Number(detailModal.loanData?.amount || 0).toLocaleString()}</span></div>
                  <div><label className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Interest</label><span className="font-bold text-slate-900 dark:text-white">{fmt(detailModal.loanData?.totalInterest)}</span></div>
                  <div><label className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Status</label><span className="font-bold capitalize text-slate-900 dark:text-white">{detailModal.loanData?.status || 'Pending'}</span></div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{detailModal.message}</p>

                <button
                  className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-xs cursor-pointer border-none"
                  onClick={() => window.location.href = '/loans'}
                >
                  View Loan Details →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Fullscreen Image Preview Lightbox ── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border-none cursor-pointer z-10"
            onClick={() => setPreviewImage(null)}
            title="Close preview"
          >
            <X size={24} />
          </button>
          <div className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage}
              alt="Proof of payment detail"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}