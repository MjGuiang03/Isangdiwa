/* eslint-disable no-unused-vars */
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  LayoutGrid, Bell, Users, Heart,
  Settings, LogOut,
  Megaphone, MapPin, Calendar, UserCog, BarChart,
  CreditCard, CalendarCheck, FileText, Shield, X, Menu
} from 'lucide-react';
import puacLogo from '../../assets/puaclogo.png';
import { useTheme } from '../../context/ThemeContext';

import API from '../../utils/api';
import { processNewNotifications } from '../../utils/desktopNotify';

export default function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarCounts, setSidebarCounts] = useState({ newMembers: 0, pendingDonations: 0 });
  const prevNotifIdsRef = useRef(new Set());
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [adminName, setAdminName] = useState(localStorage.getItem('adminName') || 'Admin');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true';
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('admin_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    const handleStorage = () => {
      setAdminName(localStorage.getItem('adminName') || 'Admin');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('adminRole');
    toast.success('Signed out successfully');
    setShowLogoutModal(false);
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const handleNav = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  /* ── Fetch admin unread count ── */
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    const calcUnread = async () => {
      try {
        const res = await fetch(`${API}/api/admin/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
          const readIds = new Set(data.readIds || []);
          const allNotifs = data.notifications || [];
          const count = allNotifs.filter(n => !readIds.has(n.id)).length;
          setUnreadCount(count);

          /* ── Desktop push notifications ── */
          const unreadNotifs = allNotifs.filter(n => !readIds.has(n.id));
          prevNotifIdsRef.current = processNewNotifications(
            prevNotifIdsRef.current,
            unreadNotifs,
            '/admin/notification',
            (path) => { window.location.href = path; }
          );
        }
      } catch { /* silent */ }
    };

    const calcCounts = async () => {
      try {
        const res = await fetch(`${API}/api/admin/sidebar-counts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.counts) {
          setSidebarCounts(data.counts);
        }
      } catch { /* silent */ }
    };

    calcUnread();
    calcCounts();

    const onUpdate = () => {
      calcUnread();
      calcCounts();
    };
    window.addEventListener('admin-notif-read-update', onUpdate);
    const intervalId = setInterval(() => {
      calcUnread();
      calcCounts();
    }, 30000);
    return () => {
      window.removeEventListener('admin-notif-read-update', onUpdate);
      clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-3.5 bg-navy text-white border-b border-white/10 sticky top-0 z-30 dark:bg-[#2C2F36]">
        <div className="flex items-center gap-3">
          <img src={puacLogo} alt="IsangDiwa Logo" className="w-8 h-8 rounded-full overflow-hidden bg-white object-cover" />
          <h1 className="text-lg font-semibold m-0 text-white font-cormorant tracking-[0.02em]"><span className="brand-text-isang">Isang</span><span className="brand-text-diwa">Diwa</span></h1>
        </div>
        <button
          className="p-2 rounded-lg bg-white/10 text-white border-none cursor-pointer flex items-center justify-center"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <LayoutGrid size={20} />
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-xs" 
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={`fixed md:sticky top-0 left-0 z-50 md:z-20 h-screen bg-navy text-white flex flex-col overflow-y-auto overflow-x-hidden dark:bg-[#2C2F36] dark:border-r dark:border-white/5 scrollbar-none transition-all duration-300 ${
        collapsed ? 'w-64 -translate-x-full md:translate-x-0 md:w-[72px]' : 'w-64 min-w-[256px] translate-x-0'
      }`}>
        <div className={`p-3.5 border-b border-white/5 shrink-0 flex items-center justify-between gap-3 ${collapsed ? 'md:justify-center md:px-2' : 'px-4'}`}>
          <div className={`flex items-center gap-3 min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
            <img src={puacLogo} alt="IsangDiwa Logo" className="w-10 h-10 rounded-full overflow-hidden bg-white object-cover shrink-0" />
            <div className="flex flex-col gap-0 min-w-0">
              <h1 className="text-xl font-semibold m-0 text-white font-cormorant tracking-[0.02em] leading-tight truncate"><span className="brand-text-isang">Isang</span><span className="brand-text-diwa">Diwa</span></h1>
              <p className="text-xs text-white/60 m-0 font-inter leading-tight truncate">Main Admin Portal</p>
            </div>
          </div>
          <button
            className={`w-[30px] h-[30px] rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white/70 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0 p-0 ${collapsed ? 'md:ml-0' : 'ml-auto'}`}
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileOpen(false);
              } else {
                toggleCollapsed();
              }
            }}
            title={collapsed ? "Expand sidebar" : "Close sidebar"}
          >
            {collapsed ? <Menu size={17} /> : <X size={17} />}
          </button>
        </div>

      <nav className={`flex-1 py-2 overflow-y-auto flex flex-col gap-[2px] scrollbar-none ${collapsed ? 'md:px-2 md:items-center' : 'px-2'}`}>

        {/* ── Dashboard ── */}
        <button
          onClick={() => handleNav('/admin/dashboard')}
          title={collapsed ? "Dashboard" : undefined}
          className={`flex items-center gap-3 px-3.5 h-[37px] bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-tight whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${isActive('/admin/dashboard') || location.pathname === '/admin' ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''} ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`}
        >
          <span><LayoutGrid size={18} className="w-[18px] h-[18px] flex items-center justify-center shrink-0" /></span>
          {!collapsed && <span className="font-inter text-sm">Dashboard</span>}
        </button>

        {/* ── Notification ── */}
        <button
          onClick={() => handleNav('/admin/notification')}
          title={collapsed ? "Notification" : undefined}
          className={`flex items-center gap-3 px-3.5 h-[37px] bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-tight whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${isActive('/admin/notification') ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''} ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`}
        >
          <span><Bell size={18} className="w-[18px] h-[18px] flex items-center justify-center shrink-0" /></span>
          {!collapsed && <span className="font-inter text-sm">Notification</span>}
          {unreadCount > 0 && (
            <span className={`ml-auto bg-red-500 text-white p-[1px_6px] rounded-[10px] text-xs font-inter font-bold leading-none min-w-[19px] h-[19px] flex items-center justify-center shrink-0 animate-badgePop ${collapsed ? 'md:absolute md:top-1 md:right-1 md:ml-0 md:text-[9px] md:h-3.5 md:min-w-[14px]' : ''}`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* ── People ── */}
        {!collapsed ? (
          <span className="px-3.5 mt-2.5 mb-1 text-[10px] font-semibold text-white/35 uppercase tracking-[0.08em] font-inter leading-none">People</span>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-white/15 my-1.5 mx-auto hidden md:block" />
        )}
        
        <button
          onClick={() => handleNav('/admin/members')}
          title={collapsed ? "Member List" : undefined}
          className={`flex items-center gap-3 px-3.5 h-[37px] bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-tight whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${isActive('/admin/members') ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''} ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`}
        >
          <span><Users size={18} className="w-[18px] h-[18px] flex items-center justify-center shrink-0" /></span>
          {!collapsed && <span className="font-inter text-sm">Member List</span>}
          {sidebarCounts.newMembers > 0 && (
            <span className={`ml-auto bg-red-500 text-white p-[1px_6px] rounded-[10px] text-xs font-inter font-bold leading-none min-w-[19px] h-[19px] flex items-center justify-center shrink-0 animate-badgePop ${collapsed ? 'md:absolute md:top-1 md:right-1 md:ml-0 md:text-[9px] md:h-3.5 md:min-w-[14px]' : ''}`}>
              {sidebarCounts.newMembers > 99 ? '99+' : sidebarCounts.newMembers}
            </span>
          )}
        </button>
        <button
          onClick={() => handleNav('/admin/branches')}
          title={collapsed ? "Communities" : undefined}
          className={`flex items-center gap-3 px-3.5 h-[37px] bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-tight whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${isActive('/admin/branches') ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''} ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`}
        >
          <span><MapPin size={18} className="w-[18px] h-[18px] flex items-center justify-center shrink-0" /></span>
          {!collapsed && <span className="font-inter text-sm">Communities</span>}
        </button>

        {!collapsed ? (
          <span className="px-3.5 mt-2.5 mb-1 text-[10px] font-semibold text-white/35 uppercase tracking-[0.08em] font-inter leading-none">Finance & Activity</span>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-white/15 my-1.5 mx-auto hidden md:block" />
        )}
        <button
          onClick={() => handleNav('/admin/donations')}
          title={collapsed ? "Donations" : undefined}
          className={`flex items-center gap-3 px-3.5 h-[37px] bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-tight whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${isActive('/admin/donations') ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''} ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`}
        >
          <span><CreditCard size={18} className="w-[18px] h-[18px] flex items-center justify-center shrink-0" /></span>
          {!collapsed && <span className="font-inter text-sm">Donations</span>}
          {sidebarCounts.pendingDonations > 0 && (
            <span className={`ml-auto bg-red-500 text-white p-[1px_6px] rounded-[10px] text-xs font-inter font-bold leading-none min-w-[19px] h-[19px] flex items-center justify-center shrink-0 animate-badgePop ${collapsed ? 'md:absolute md:top-1 md:right-1 md:ml-0 md:text-[9px] md:h-3.5 md:min-w-[14px]' : ''}`}>
              {sidebarCounts.pendingDonations > 99 ? '99+' : sidebarCounts.pendingDonations}
            </span>
          )}
        </button>

        {/* ── Tools ── */}
        {!collapsed ? (
          <span className="px-3.5 mt-2.5 mb-1 text-[10px] font-semibold text-white/35 uppercase tracking-[0.08em] font-inter leading-none">Tools</span>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-white/15 my-1.5 mx-auto hidden md:block" />
        )}
        <button
          onClick={() => handleNav('/admin/attendance')}
          title={collapsed ? "Attendance" : undefined}
          className={`flex items-center gap-3 px-3.5 h-[37px] bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-tight whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${isActive('/admin/attendance') ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''} ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`}
        >
          <span><CalendarCheck size={18} className="w-[18px] h-[18px] flex items-center justify-center shrink-0" /></span>
          {!collapsed && <span className="font-inter text-sm">Attendance</span>}
        </button>
        <button
          onClick={() => handleNav('/admin/announcements')}
          title={collapsed ? "Announcements" : undefined}
          className={`flex items-center gap-3 px-3.5 h-[37px] bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-tight whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${isActive('/admin/announcements') ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''} ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`}
        >
          <span><Megaphone size={18} className="w-[18px] h-[18px] flex items-center justify-center shrink-0" /></span>
          {!collapsed && <span className="font-inter text-sm">Announcements</span>}
        </button>
        <button
          onClick={() => handleNav('/admin/financial-report')}
          title={collapsed ? "Reports" : undefined}
          className={`flex items-center gap-3 px-3.5 h-[37px] bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-tight whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${isActive('/admin/financial-report') ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''} ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`}
        >
          <span><FileText size={18} className="w-[18px] h-[18px] flex items-center justify-center shrink-0" /></span>
          {!collapsed && <span className="font-inter text-sm">Reports</span>}
        </button>

        {/* ── System ── */}
        {!collapsed ? (
          <span className="px-3.5 mt-2.5 mb-1 text-[10px] font-semibold text-white/35 uppercase tracking-[0.08em] font-inter leading-none">System</span>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-white/15 my-1.5 mx-auto hidden md:block" />
        )}
        {localStorage.getItem('adminRole') === 'admin' && (
          <button
            onClick={() => handleNav('/admin/users')}
            title={collapsed ? "User Management" : undefined}
            className={`flex items-center gap-3 px-3.5 h-[37px] bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-tight whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${isActive('/admin/users') ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''} ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`}
          >
            <span><UserCog size={18} className="w-[18px] h-[18px] flex items-center justify-center shrink-0" /></span>
            {!collapsed && <span className="font-inter text-sm">User Management</span>}
          </button>
        )}
        <button
          onClick={() => handleNav('/admin/settings')}
          title={collapsed ? "Settings" : undefined}
          className={`flex items-center gap-3 px-3.5 h-[37px] bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-tight whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${isActive('/admin/settings') ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''} ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`}
        >
          <span><Settings size={18} className="w-[18px] h-[18px] flex items-center justify-center shrink-0" /></span>
          {!collapsed && <span className="font-inter text-sm">Settings</span>}
        </button>

      </nav>

      {/* Profile & Logout */}
      <div className={`p-3 border-t border-white/5 shrink-0 ${collapsed ? 'md:px-2' : 'px-3.5'}`}>
          <div 
            className={`flex items-center gap-3 mb-2.5 ${collapsed ? 'md:justify-center' : ''}`}
            title={collapsed ? adminName : undefined}
          >
              <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center font-bold text-white text-xs font-inter shrink-0 border border-white/10">
                  <p className="m-0 leading-none">{adminName ? adminName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'A'}</p>
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white m-0 font-inter leading-tight truncate">{adminName}</p>
                    <p className="text-[11px] text-white/50 m-0 font-inter leading-tight truncate">
                        {localStorage.getItem('adminEmail')}
                    </p>
                </div>
              )}
          </div>
          <button 
            onClick={() => setShowLogoutModal(true)} 
            title={collapsed ? "Sign Out" : undefined}
            className={`w-full flex items-center justify-center gap-2 h-[34px] p-[6px_12px] bg-transparent border border-white/[0.08] text-white/70 text-xs font-inter rounded-lg cursor-pointer transition-all hover:bg-red-500/10 hover:border-red-500 hover:text-red-300 ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:mx-auto' : ''}`}
          >
              <LogOut size={16} className="shrink-0" />
              {!collapsed && <span>Sign Out</span>}
          </button>
      </div>

      {/* Logout Modal */}
      {showLogoutModal && createPortal(
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
              <div className="bg-white dark:bg-[#1E2130] rounded-2xl p-8 max-w-[400px] w-full shadow-2xl border border-slate-200 dark:border-white/10">
                  <h2 className="font-inter text-xl font-bold text-slate-900 dark:text-white m-[0_0_12px_0]">Confirm Logout</h2>
                  <p className="font-inter text-base text-slate-600 dark:text-slate-400 leading-[1.6] m-[0_0_24px_0]">Are you sure you want to log out?</p>
                  <div className="flex gap-3 justify-end">
                      <button className="py-2.5 px-5 border-none rounded-lg font-inter text-sm font-semibold cursor-pointer transition-all bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10" onClick={() => setShowLogoutModal(false)}>Cancel</button>
                      <button className="py-2.5 px-5 border-none rounded-lg font-inter text-sm font-semibold cursor-pointer transition-all bg-red-500 text-white hover:bg-red-600" onClick={handleSignOut}>Sign Out</button>
                  </div>
              </div>
          </div>,
          document.body
      )}
    </div>
    </>
  );
}
