import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
    LayoutGrid, Bell, FileText, FolderOpen,
    Settings, LogOut, BarChart
} from 'lucide-react';
import puacLogo from '../../assets/puaclogo.png';
import API from '../../utils/api';
import { processNewNotifications } from '../../utils/desktopNotify';
import NotificationPrompt from '../../components/NotificationPrompt';

export default function SecretaryAdminSidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const currentPath = location.pathname;
    const [unreadCount, setUnreadCount] = useState(0);
    const prevNotifIdsRef = useRef(new Set());

    /* ── Reactive display name (updates when settings page saves) ── */
    const [displayName, setDisplayName] = useState(
        () => localStorage.getItem('adminName') || 'Secretary Admin'
    );
    const [displayEmail, setDisplayEmail] = useState(
        () => localStorage.getItem('adminEmail') || localStorage.getItem('secretaryEmail') || 'secretary@isangdiwa.com'
    );

    useEffect(() => {
        const onProfileUpdate = () => {
            setDisplayName(localStorage.getItem('adminName') || 'Secretary Admin');
            setDisplayEmail(localStorage.getItem('adminEmail') || localStorage.getItem('secretaryEmail') || 'secretary@isangdiwa.com');
        };
        window.addEventListener('admin-profile-updated', onProfileUpdate);
        return () => window.removeEventListener('admin-profile-updated', onProfileUpdate);
    }, []);


    /* ── Fetch admin unread count ── */
    useEffect(() => {
        const token = localStorage.getItem('secretaryToken') || localStorage.getItem('adminToken') || localStorage.getItem('token');
        if (!token) return;

        const calcUnread = async () => {
            try {
                const res  = await fetch(`${API}/api/admin/notifications`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (data.success) {
                    const readIds = new Set(data.readIds || []);
                    const allNotifs = data.notifications || [];
                    const count = allNotifs.filter(n => n.type === 'loan' && !readIds.has(n.id)).length;
                    setUnreadCount(count);

                    /* ── Desktop push notifications ── */
                    const unreadNotifs = allNotifs.filter(n => n.type === 'loan' && !readIds.has(n.id));
                    prevNotifIdsRef.current = processNewNotifications(
                      prevNotifIdsRef.current,
                      unreadNotifs,
                      '/secretary-admin/notifications',
                      (path) => { window.location.href = path; }
                    );
                }
            } catch { /* silent */ }
        };

        calcUnread();

        const onUpdate = () => calcUnread();
        window.addEventListener('admin-notif-read-update', onUpdate);
        
        // Poll every 30 seconds for live updates
        const intervalId = setInterval(calcUnread, 60000);
        
        return () => {
             window.removeEventListener('admin-notif-read-update', onUpdate);
             window.removeEventListener('storage', calcUnread);
             clearInterval(intervalId);
        };
    }, []);


    const [mobileOpen, setMobileOpen] = useState(false);

    const handleNav = (path) => {
        navigate(path);
        setMobileOpen(false);
    };

    const handleSignOut = () => {
        localStorage.removeItem('secretaryEmail');
        localStorage.removeItem('secretaryRole');
        toast.success('Signed out successfully');
        setShowLogoutModal(false);
        navigate('/');
    };

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

            <div className={`fixed md:sticky top-0 left-0 z-50 md:z-20 w-64 min-w-[256px] h-screen bg-navy text-white flex flex-col overflow-y-auto overflow-x-hidden dark:bg-[#2C2F36] dark:border-r dark:border-white/5 scrollbar-none transition-transform duration-300 ${
                mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            }`}>
                {/* Logo */}
                <div className="p-[16px_20px] border-b border-white/5 shrink-0 flex items-center gap-3">
                    <img src={puacLogo} alt="IsangDiwa Logo" className="w-11 h-11 rounded-full overflow-hidden bg-white object-cover shrink-0" />
                    <div className="flex flex-col gap-0">
                        <h1 className="text-2xl font-semibold m-0 text-white font-cormorant tracking-[0.02em]"><span className="brand-text-isang">Isang</span><span className="brand-text-diwa">Diwa</span></h1>
                        <p className="text-xs text-white/60 m-0 font-inter leading-4">Secretary Portal</p>
                    </div>
                </div>

            {/* Navigation */}
            <nav className="flex-1 py-2 flex flex-col gap-1">
                <span className="p-0 m-[14px_0_2px_20px] text-[9px] font-semibold text-white/20 uppercase tracking-[0.08em] font-inter leading-none">Core</span>
                <button
                    className={`flex items-center gap-3 pl-5 h-10 bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-5 whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${currentPath === '/secretary-admin/dashboard' ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''}`}
                    onClick={() => handleNav('/secretary-admin/dashboard')}
                >
                    <span ><LayoutGrid size={18} className="w-5 h-5 flex items-center justify-center shrink-0 w-5 h-5 shrink-0" /></span>
                    <span className="font-inter text-sm leading-5">Dashboard</span>
                </button>

                <button
                    className={`flex items-center gap-3 pl-5 h-10 bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-5 whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${currentPath === '/secretary-admin/notifications' ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''}`}
                    onClick={() => handleNav('/secretary-admin/notifications')}
                >
                    <span ><Bell size={18} className="w-5 h-5 flex items-center justify-center shrink-0 w-5 h-5 shrink-0" /></span>
                    <span className="font-inter text-sm leading-5">Notifications</span>
                    {unreadCount > 0 && (
                        <span className="ml-auto bg-red-500 text-white p-[2px_6px] rounded-[10px] text-xs font-inter font-bold leading-none min-w-[20px] h-5 flex items-center justify-center shrink-0 animate-badgePop mr-4">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>

                <span className="p-0 m-[14px_0_2px_20px] text-[9px] font-semibold text-white/20 uppercase tracking-[0.08em] font-inter leading-none">Management</span>
                <button
                    className={`flex items-center gap-3 pl-5 h-10 bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-5 whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${currentPath === '/secretary-admin/loan-process' ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''}`}
                    onClick={() => handleNav('/secretary-admin/loan-process')}
                >
                    <span ><FileText size={18} className="w-5 h-5 flex items-center justify-center shrink-0 w-5 h-5 shrink-0" /></span>
                    <span className="font-inter text-sm leading-5">Loan Processing</span>
                </button>

                <button
                    className={`flex items-center gap-3 pl-5 h-10 bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-5 whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${currentPath === '/secretary-admin/records' ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''}`}
                    onClick={() => handleNav('/secretary-admin/records')}
                >
                    <span ><FolderOpen size={18} className="w-5 h-5 flex items-center justify-center shrink-0 w-5 h-5 shrink-0" /></span>
                    <span className="font-inter text-sm leading-5">Records</span>
                </button>

                <span className="p-0 m-[14px_0_2px_20px] text-[9px] font-semibold text-white/20 uppercase tracking-[0.08em] font-inter leading-none">Analysis</span>
                <button
                    className={`flex items-center gap-3 pl-5 h-10 bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-5 whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${currentPath === '/admin/financial-report' ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''}`}
                    onClick={() => handleNav('/admin/financial-report')}
                >
                    <span ><BarChart size={18} className="w-5 h-5 flex items-center justify-center shrink-0 w-5 h-5 shrink-0" /></span>
                    <span className="font-inter text-sm leading-5">Automated Reports</span>
                </button>

                <span className="p-0 m-[14px_0_2px_20px] text-[9px] font-semibold text-white/20 uppercase tracking-[0.08em] font-inter leading-none">Admin</span>
                <button
                    className={`flex items-center gap-3 pl-5 h-10 bg-transparent border-none text-white/70 text-sm font-inter rounded-lg cursor-pointer transition-all w-full text-left leading-5 whitespace-nowrap relative hover:bg-white/10 dark:hover:bg-white/5 ${currentPath === '/secretary-admin/settings' ? 'bg-white/10 text-white font-semibold dark:bg-[#363940]' : ''}`}
                    onClick={() => handleNav('/secretary-admin/settings')}
                >
                    <span ><Settings size={18} className="w-5 h-5 flex items-center justify-center shrink-0 w-5 h-5 shrink-0" /></span>
                    <span className="font-inter text-sm leading-5">Settings</span>
                </button>
            </nav>

            {/* Profile + Sign Out */}
            <div className="p-[12px_16px] border-t border-white/5 shrink-0">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center font-bold text-white text-[13px] font-inter shrink-0">
                        <p>{displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'SA'}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-white m-0 font-inter leading-[18px]">{displayName}</p>
                        <p className="text-[11px] text-white/50 m-0 overflow-hidden text-ellipsis whitespace-nowrap font-inter leading-[14px]">
                            {displayEmail}
                        </p>
                    </div>
                </div>
                <button onClick={() => setShowLogoutModal(true)} className="w-full flex items-center justify-center gap-[6px] p-[8px_12px] bg-transparent border border-white/[0.06] text-white/70 text-[13px] font-inter rounded-lg cursor-pointer transition-all hover:bg-red-500/10 hover:border-red-500 hover:text-red-300">
                    <LogOut size={20} className="w-[18px] h-[18px]" />
                    Sign Out
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
            <NotificationPrompt />
        </div>
        </>
    );
}