import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { Building2, Calendar, FileText, Heart, LayoutGrid, Menu, Settings, Wallet, X, LogOut, Bell } from 'lucide-react';
import puacLogo from '../../assets/optimized/puaclogo.webp';
import API from '../../utils/api';

import { isOfficerPosition } from '../../utils/officerPositions';

export default function Sidebar({ collapsed, setCollapsed, toggleCollapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user, signOut } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const token = localStorage.getItem('token');
  
  const handleSignOut = async () => {
    const result = await signOut();
    if (result.success) {
      navigate('/');
    }
  };

  // collapsed state moved to UserLayout
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      if (mobile) {
        setCollapsed(true); // Always keep folded on mobile initially
      } else if (window.innerWidth < 1024) {
        setCollapsed(true); // Keep folded on tablet
      } else {
        // Only expand automatically if they didn't manually collapse it
        const userPreference = localStorage.getItem('sidebar_collapsed');
        if (userPreference !== 'true') setCollapsed(false);
      }
    };

    // Run once on mount
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setCollapsed]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await fetch(`${API}/api/notifications/feed`, { headers });
      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) return;

      const data = await res.json();
      if (!data.success) return;

      const { readIds: readIdsFromData, payments, loans: loansDataFeed, donations: donationsDataFeed, attendance: attendanceDataFeed, savings: savingsDataFeed, securityNotifications: secDataFeed } = data;
      const currentReadIds = new Set(readIdsFromData || []);
      const items = [];

      if (loansDataFeed) {
        loansDataFeed.forEach(l => {
          if (l.status === 'awaiting_member_approval') items.push({ id: `loan-terms-${l._id}` });
          if (l.status === 'approved') items.push({ id: `loan-app-${l._id}` });
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
              if (Date.now() > cutoffDate.getTime()) items.push({ id: `loan-late-${l._id}-${paidMonths}` });
            }
            items.push({ id: `loan-disbursed-${l._id}` });
          }
          if (l.status === 'rejected') items.push({ id: `loan-rejected-${l._id}` });
        });
      }
      if (payments) {
        payments.forEach(p => {
          if (p.status === 'pending') items.push({ id: `payment-pending-${p._id}` });
          if (p.status === 'confirmed') items.push({ id: `payment-confirmed-${p._id}` });
          if (p.status === 'rejected') items.push({ id: `payment-rejected-${p._id}` });
        });
      }
      if (donationsDataFeed) {
        donationsDataFeed.filter(d => d.status === 'confirmed').forEach(d => {
          items.push({ id: `don-${d._id}` });
        });
      }
      if (attendanceDataFeed) {
        attendanceDataFeed.slice(0, 5).forEach(a => {
          items.push({ id: `att-${a._id}` });
        });
      }
      if (savingsDataFeed) {
        savingsDataFeed.filter(s => s.type === 'deposit' && s.status === 'confirmed').forEach(s => items.push({ id: `sav-${s._id}` }));
        savingsDataFeed.filter(s => s.type === 'withdrawal' && s.status === 'confirmed').forEach(s => items.push({ id: `sav-wd-${s._id}` }));
      }
      if (secDataFeed) {
        secDataFeed.forEach(s => items.push({ id: s.id }));
      }

      setUnreadNotifCount(items.filter(it => !currentReadIds.has(it.id)).length);
    } catch (err) {
      console.error('Failed to fetch sidebar notifications:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 120000); // Poll every 2 mins
    window.addEventListener("admin-notif-read-update", fetchNotifications);
    return () => {
      clearInterval(interval);
      window.removeEventListener("admin-notif-read-update", fetchNotifications);
    };
  }, [fetchNotifications]);

  const handleNavClick = (path) => {
    navigate(path);
    if (window.innerWidth < 768) {
      setCollapsed(true); // Auto-close sidebar on mobile after clicking link
    }
  };

  const isActive = (path) => location.pathname === path;
  const isOfficer = isOfficerPosition(profile?.position);

  const allNavItems = [
    { path: '/home', icon: <LayoutGrid size={20} />, label: 'Home' },
    { path: '/savings', icon: <Wallet size={20} />, label: 'Savings' },
    { path: '/loans', icon: <FileText size={20} />, label: 'Loans', officerOnly: true },
    { path: '/donation', icon: <Heart size={20} />, label: 'Donations' },
    { path: '/attendance', icon: <Calendar size={20} />, label: 'Attendance' },
    { path: '/branches', icon: <Building2 size={20} />, label: 'Communities' },
    { path: '/notifications', icon: <Bell size={20} />, label: 'Notifications' },
    { path: '/settings', icon: <Settings size={20} />, label: 'Settings' },
  ];

  const navItems = allNavItems.filter(item => !item.officerOnly || isOfficer);

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && !collapsed && (
        <div 
          className="fixed inset-0 bg-black/60 z-[1050] backdrop-blur-xs transition-opacity" 
          onClick={() => setCollapsed(true)} 
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed top-0 left-0 h-screen bg-[#0D1F45] dark:bg-[#1E2130] border-r border-white/10 text-white flex flex-col z-[1100] transition-all duration-300 ease-in-out scrollbar-none ${
          collapsed ? 'w-64 -translate-x-full md:translate-x-0 md:w-[72px]' : 'w-64 translate-x-0'
        }`}
      >
        {/* Logo Header */}
        <div className={`border-b border-white/10 flex-shrink-0 flex items-center ${collapsed ? 'md:justify-center p-3 md:p-0 md:h-[64px]' : 'p-3.5 px-4'}`}>
          <div className={`flex items-center gap-3 w-full ${collapsed ? 'md:justify-center' : ''}`}>
            {/* Logo — hidden when collapsed on desktop */}
            {(!collapsed || isMobile) && (
              <div className="w-10 h-10 rounded-full overflow-hidden bg-white/15 flex items-center justify-center shrink-0">
                <img alt="IsangDiwa Logo" src={puacLogo} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Brand name — only when expanded */}
            {(!collapsed || isMobile) && (
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold m-0 text-white font-cormorant tracking-wide whitespace-nowrap leading-tight">
                  <span className="font-inter font-semibold tracking-tight text-white">Isang</span>
                  <span className="font-inter font-semibold tracking-tight text-[#F5C800]">Diwa</span>
                </h1>
                <p className="text-xs text-white/60 m-0 font-inter whitespace-nowrap leading-tight">Member Portal</p>
              </div>
            )}

            {/* Hamburger toggle */}
            <button
              className={`w-7.5 h-7.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white/70 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0 p-0 ${collapsed ? 'md:ml-0' : 'ml-auto'}`}
              onClick={toggleCollapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <Menu size={17} /> : <X size={17} />}
            </button>
          </div>
        </div>


        {/* Navigation items */}
        <div className={`flex-1 py-2 overflow-y-auto flex flex-col gap-[2px] scrollbar-none ${collapsed ? 'md:px-2 md:items-center' : 'px-2'}`}>
          {/* Main */}
          {navItems.filter(n => ['/home'].includes(n.path)).map(({ path, icon, label }) => (
            <button 
              key={path} 
              onClick={() => handleNavClick(path)} 
              className={`flex items-center gap-3 h-[37px] px-3.5 rounded-lg border-none font-inter text-sm cursor-pointer transition-all duration-200 w-full text-left relative ${
                isActive(path) 
                  ? 'bg-white/15 text-white font-semibold shadow-sm' 
                  : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white'
              } ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`} 
              title={collapsed ? label : undefined}
            >
              <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0">{icon}</span>
              {(!collapsed || isMobile) && <span className="truncate">{label}</span>}
            </button>
          ))}

          {(!collapsed || isMobile) ? (
            <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1 select-none">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 font-inter whitespace-nowrap">Finance</span>
              <div className="flex-1 h-[1px] bg-white/10"></div>
            </div>
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-white/15 my-1 mx-auto" />
          )}
          {navItems.filter(n => ['/savings', '/loans', '/donation'].includes(n.path)).map(({ path, icon, label }) => (
            <button 
              key={path} 
              onClick={() => handleNavClick(path)} 
              className={`flex items-center gap-3 h-[37px] px-3.5 rounded-lg border-none font-inter text-sm cursor-pointer transition-all duration-200 w-full text-left relative ${
                isActive(path) 
                  ? 'bg-white/15 text-white font-semibold shadow-sm' 
                  : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white'
              } ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`} 
              title={collapsed ? label : undefined}
            >
              <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0">{icon}</span>
              {(!collapsed || isMobile) && <span className="truncate">{label}</span>}
            </button>
          ))}

          {(!collapsed || isMobile) ? (
            <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1 select-none">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 font-inter whitespace-nowrap">Activity</span>
              <div className="flex-1 h-[1px] bg-white/10"></div>
            </div>
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-white/15 my-1 mx-auto" />
          )}
          {navItems.filter(n => ['/attendance', '/branches'].includes(n.path)).map(({ path, icon, label }) => (
            <button 
              key={path} 
              onClick={() => handleNavClick(path)} 
              className={`flex items-center gap-3 h-[37px] px-3.5 rounded-lg border-none font-inter text-sm cursor-pointer transition-all duration-200 w-full text-left relative ${
                isActive(path) 
                  ? 'bg-white/15 text-white font-semibold shadow-sm' 
                  : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white'
              } ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`} 
              title={collapsed ? label : undefined}
            >
              <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0">{icon}</span>
              {(!collapsed || isMobile) && <span className="truncate">{label}</span>}
            </button>
          ))}

          {(!collapsed || isMobile) ? (
            <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1 select-none">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 font-inter whitespace-nowrap">System</span>
              <div className="flex-1 h-[1px] bg-white/10"></div>
            </div>
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-white/15 my-1 mx-auto" />
          )}
          {navItems.filter(n => ['/notifications', '/settings'].includes(n.path)).map(({ path, icon, label }) => (
            <button 
              key={path} 
              onClick={() => handleNavClick(path)} 
              className={`flex items-center gap-3 h-[37px] px-3.5 rounded-lg border-none font-inter text-sm cursor-pointer transition-all duration-200 w-full text-left relative ${
                isActive(path) 
                  ? 'bg-white/15 text-white font-semibold shadow-sm' 
                  : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white'
              } ${collapsed ? 'md:w-9 md:h-9 md:p-0 md:justify-center' : ''}`} 
              title={collapsed ? label : undefined}
            >
              <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0">{icon}</span>
              {(!collapsed || isMobile) && <span className="truncate">{label}</span>}
              {path === '/notifications' && unreadNotifCount > 0 && (
                <span className={`ml-auto bg-rose-600 text-white font-inter text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[19px] h-[19px] flex items-center justify-center animate-badgePop ${
                  collapsed ? 'md:absolute md:top-1 md:right-1 md:ml-0 md:text-[9px] md:h-3.5 md:min-w-[14px]' : ''
                }`}>
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Profile Section */}
        <div className="p-3 px-3.5 border-t border-white/10 shrink-0">
          <div 
            className={`flex items-center gap-3 p-1.5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors mb-2 ${
              collapsed ? 'md:justify-center md:p-1' : ''
            }`}
            onClick={() => handleNavClick('/profile')}
            title={collapsed ? 'Profile' : undefined}
          >
            <div className="w-8 h-8 rounded-full bg-[#F5C800] flex items-center justify-center font-bold text-[#0D1F45] shrink-0 overflow-hidden">
              {profile?.photoUrl ? (
                <img src={profile.photoUrl} alt="Profile" className="w-full h-full object-cover rounded-full" />
              ) : (
                <p className="m-0 text-xs font-inter text-[#1E3A8A] font-bold leading-none">{profile?.fullName?.charAt(0)?.toUpperCase() || 'M'}</p>
              )}
            </div>
            {(!collapsed || isMobile) && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white m-0 font-inter truncate leading-tight">{profile?.fullName || 'Member'}</p>
                <p className="text-[11px] text-white/60 truncate m-0 font-inter leading-tight">{user?.email || 'member@isangdiwa.org'}</p>
              </div>
            )}
          </div>
          <button 
            className={`w-full flex items-center justify-center gap-2 h-[34px] px-3 bg-transparent border border-white/15 hover:border-rose-500/50 hover:bg-rose-500/10 text-white/70 hover:text-rose-300 text-xs font-inter rounded-lg cursor-pointer transition-all ${
              collapsed ? 'md:w-9 md:h-9 md:p-0 md:mx-auto' : ''
            }`}
            onClick={() => setShowLogoutModal(true)}
            title={collapsed ? 'Sign out' : undefined}
          >
            <LogOut size={16} />
            {(!collapsed || isMobile) && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[2000] p-4 animate-fadeIn">
          <div className="bg-card dark:bg-[#1E2130] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border">
            <h2 className="font-inter text-xl font-bold text-foreground m-0 mb-3">Confirm Logout</h2>
            <p className="font-inter text-sm text-slate-500 dark:text-slate-400 m-0 mb-6 leading-relaxed">
              Are you sure you want to log out of your account?
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                className="px-5 py-2.5 bg-secondary dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-border hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-inter text-sm font-semibold cursor-pointer transition-colors" 
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button 
                className="px-5 py-2.5 bg-destructive hover:bg-red-700 text-white border-none rounded-xl font-inter text-sm font-semibold cursor-pointer transition-colors" 
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}