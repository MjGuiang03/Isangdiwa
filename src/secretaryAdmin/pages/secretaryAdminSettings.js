import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import SecretaryAdminSidebar from '../components/secretaryAdminSidebar';
import PageHeader from '../components/PageHeader';
import { useTheme } from '../../context/ThemeContext';
import { User, Lock, Bell, Moon, LogOut, Eye, EyeOff, Save, CheckCircle2 } from 'lucide-react';
import API from '../../utils/api';

/* ── Password strength helper ────────────────────────────────────────────── */
function getStrength(pw) {
    if (!pw) return { level: 0, label: '' };
    let score = 0;
    if (pw.length >= 8)             score++;
    if (/[A-Z]/.test(pw))           score++;
    if (/[0-9]/.test(pw))           score++;
    if (/[^A-Za-z0-9]/.test(pw))   score++;
    if (score <= 1) return { level: 1, label: 'Weak' };
    if (score <= 2) return { level: 2, label: 'Medium' };
    return { level: 3, label: 'Strong' };
}

function StrengthBar({ password }) {
    const { level, label } = getStrength(password);
    if (!password) return null;
    return (
        <div className="mt-2">
            <div className="flex gap-1.5 h-1.5 mb-1">
                <div className={`flex-1 rounded-full transition-colors ${level >= 1 ? (level === 1 ? 'bg-rose-500' : level === 2 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200 dark:bg-white/10'}`} />
                <div className={`flex-1 rounded-full transition-colors ${level >= 2 ? (level === 1 ? 'bg-rose-500' : level === 2 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200 dark:bg-white/10'}`} />
                <div className={`flex-1 rounded-full transition-colors ${level >= 3 ? (level === 1 ? 'bg-rose-500' : level === 2 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200 dark:bg-white/10'}`} />
            </div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider m-0">{label} password</p>
        </div>
    );
}

/* ── Notification defaults ───────────────────────────────────────────────── */
const NOTIF_DEFAULTS = {
    newLoanApp:    true,
    disbursement:  true,
    paymentRecv:   false,
};

const NOTIF_META = [
    {
        key:   'newLoanApp',
        label: 'New Loan Application',
        desc:  'Get notified when a member submits a new loan request',
    },
    {
        key:   'disbursement',
        label: 'Loan Disbursement Approved',
        desc:  'Alert when main admin approves a disbursement',
    },
    {
        key:   'paymentRecv',
        label: 'Payment Received',
        desc:  'Alert when a member submits a loan payment',
    },
];

/* ── Main Component ──────────────────────────────────────────────────────── */
export default function SecretaryLoanSettings() {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

    const token = localStorage.getItem('secretaryToken')
               || localStorage.getItem('adminToken')
               || localStorage.getItem('token');

    /* Profile */
    const [secName,  setSecName]  = useState('');
    const [secEmail, setSecEmail] = useState('');
    const [profileSaving, setProfileSaving] = useState(false);

    /* Password */
    const [currentPw,  setCurrentPw]  = useState('');
    const [newPw,       setNewPw]       = useState('');
    const [confirmPw,   setConfirmPw]   = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew,     setShowNew]     = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [pwSaving,    setPwSaving]    = useState(false);

    /* Notification prefs (persisted to localStorage) */
    const [notifPrefs, setNotifPrefs] = useState(() => {
        try {
            const stored = localStorage.getItem('sec_notif_prefs');
            return stored ? JSON.parse(stored) : NOTIF_DEFAULTS;
        } catch {
            return NOTIF_DEFAULTS;
        }
    });

    const [loadingProfile, setLoadingProfile] = useState(true);

    /* ── Load profile from API ─────────────────────────────────────────── */
    useEffect(() => {
        if (!token) { navigate('/'); return; }
        fetch(`${API}/api/admin/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(data => {
                if (data.success && data.admin) {
                    setSecName(data.admin.fullName || '');
                    setSecEmail(data.admin.email || '');
                }
            })
            .catch(() => {
                setSecName(localStorage.getItem('adminName') || '');
                setSecEmail(localStorage.getItem('adminEmail') || '');
            })
            .finally(() => {
                setLoadingProfile(false);
            });
    }, [token, navigate]);

    /* ── Handlers ──────────────────────────────────────────────────────── */

    const handleSaveProfile = async () => {
        if (!secName.trim()) return toast.error('Name cannot be empty');
        setProfileSaving(true);
        try {
            const res = await fetch(`${API}/api/admin/profile/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ fullName: secName.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('adminName', secName.trim());
                window.dispatchEvent(new Event('admin-profile-updated'));
                toast.success('Profile updated successfully');
            } else {
                toast.error(data.message || 'Failed to update profile');
            }
        } catch {
            toast.error('Network error. Could not save profile.');
        } finally {
            setProfileSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPw || !newPw || !confirmPw)
            return toast.error('Please fill in all password fields');
        if (newPw !== confirmPw)
            return toast.error('New passwords do not match');
        if (newPw.length < 8)
            return toast.error('New password must be at least 8 characters');
        if (getStrength(newPw).level < 2)
            return toast.error('Please choose a stronger password');

        setPwSaving(true);
        try {
            const res = await fetch(`${API}/api/admin/profile/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Password changed successfully');
                setCurrentPw(''); setNewPw(''); setConfirmPw('');
            } else {
                toast.error(data.message || 'Failed to change password');
            }
        } catch {
            toast.error('Network error. Could not change password.');
        } finally {
            setPwSaving(false);
        }
    };

    const toggleNotif = (key) => {
        setNotifPrefs(prev => {
            const updated = { ...prev, [key]: !prev[key] };
            localStorage.setItem('sec_notif_prefs', JSON.stringify(updated));
            toast.success('Notification preferences saved');
            return updated;
        });
    };

    const handleLogout = () => {
        localStorage.removeItem('secAdminToken');
        localStorage.removeItem('secretaryToken');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminEmail');
        localStorage.removeItem('adminName');
        toast.success('Signed out successfully');
        navigate('/');
    };

    if (loadingProfile) {
        return (
            <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
                <SecretaryAdminSidebar />
                <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-slate-100 dark:bg-[#161922]">
                    <div className="flex flex-col gap-6 max-w-[1000px] mx-auto w-full animate-pulse">
                        <div className="flex flex-col gap-2">
                            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
                            <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-56 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                    <div className="h-6 w-36 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                                    <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-xl"></div>
                                    <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-xl"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ── Render ────────────────────────────────────────────────────────── */
    return (
        <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
            <SecretaryAdminSidebar />

            <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-slate-100 dark:bg-[#161922]">
                <div className="flex flex-col gap-6 max-w-[1000px] mx-auto w-full min-h-screen">

                    {/* Header */}
                    <PageHeader 
                        title="Secretary Settings" 
                        subtitle="Manage your profile, security credentials, appearance, and notification preferences." 
                    />

                    {/* ── 1. Personal Profile ──────────────────────────────── */}
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative">
                        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/30">
                                <User size={22} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">Personal Profile</h2>
                                <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Update your display name and registered email address</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Full Name</label>
                                <input
                                    type="text"
                                    className="h-10 px-3.5 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#161922] transition-all w-full"
                                    placeholder="Your full name"
                                    value={secName}
                                    onChange={(e) => setSecName(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Email Address</label>
                                <input
                                    type="email"
                                    className="h-10 px-3.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-500 dark:text-slate-400 outline-none w-full opacity-70 cursor-not-allowed"
                                    value={secEmail}
                                    disabled
                                />
                            </div>
                        </div>

                        <button
                            className="h-10 px-6 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm flex items-center justify-center gap-2 w-fit mt-1"
                            onClick={handleSaveProfile}
                            disabled={profileSaving}
                        >
                            <Save size={16} />
                            {profileSaving ? 'Saving…' : 'Save Profile'}
                        </button>
                    </div>

                    {/* ── 2. Security & Password ───────────────────────────────── */}
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative">
                        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/30">
                                <Lock size={22} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">Security & Password</h2>
                                <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose a strong password to keep your account protected</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Current Password</label>
                            <div className="relative w-full">
                                <input
                                    type={showCurrent ? 'text' : 'password'}
                                    className="h-10 pl-3.5 pr-10 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#161922] transition-all w-full"
                                    placeholder="Enter current password"
                                    value={currentPw}
                                    onChange={(e) => setCurrentPw(e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 p-0 flex items-center justify-center"
                                    onClick={() => setShowCurrent(v => !v)}
                                >
                                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">New Password</label>
                                <div className="relative w-full">
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        className="h-10 pl-3.5 pr-10 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#161922] transition-all w-full"
                                        placeholder="Min. 8 characters"
                                        value={newPw}
                                        onChange={(e) => setNewPw(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 p-0 flex items-center justify-center"
                                        onClick={() => setShowNew(v => !v)}
                                    >
                                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <StrengthBar password={newPw} />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Confirm New Password</label>
                                <div className="relative w-full">
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        className="h-10 pl-3.5 pr-10 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#161922] transition-all w-full"
                                        placeholder="Repeat new password"
                                        value={confirmPw}
                                        onChange={(e) => setConfirmPw(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 p-0 flex items-center justify-center"
                                        onClick={() => setShowConfirm(v => !v)}
                                    >
                                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {confirmPw && newPw !== confirmPw && (
                                    <p className="text-[11px] font-semibold text-rose-500 m-0 mt-1">Passwords do not match</p>
                                )}
                                {confirmPw && newPw === confirmPw && (
                                    <p className="text-[11px] font-semibold text-emerald-500 m-0 mt-1 flex items-center gap-1"><CheckCircle2 size={12} /> Passwords match</p>
                                )}
                            </div>
                        </div>

                        <button
                            className="h-10 px-6 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm flex items-center justify-center gap-2 w-fit mt-1"
                            onClick={handleChangePassword}
                            disabled={pwSaving}
                        >
                            <Lock size={16} />
                            {pwSaving ? 'Updating…' : 'Update Password'}
                        </button>
                    </div>

                    {/* ── 3. Notification Preferences ──────────────────────── */}
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative">
                        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200/50 dark:border-rose-500/30">
                                <Bell size={22} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">Notification Preferences</h2>
                                <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose which in-app events you want to be alerted about</p>
                            </div>
                        </div>

                        {NOTIF_META.map(({ key, label, desc }, idx) => (
                            <div key={key} className={`flex items-center justify-between py-3 ${idx < NOTIF_META.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : ''}`}>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">{label}</span>
                                    <span className="font-inter text-xs text-slate-500 dark:text-slate-400">{desc}</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={notifPrefs[key]}
                                        onChange={() => toggleNotif(key)}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        ))}
                    </div>

                    {/* ── 4. Appearance Settings Section ──────────────────────── */}
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative">
                        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-purple-50 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-200/50 dark:border-purple-500/30">
                                <Moon size={22} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">Appearance Settings</h2>
                                <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize theme preferences for low-light environments</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">Dark Mode Theme</span>
                                <span className="font-inter text-xs text-slate-500 dark:text-slate-400">Enable dark theme scheme across your admin dashboard.</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={theme === 'dark'}
                                    onChange={toggleTheme}
                                />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    {/* ── 5. Logout ─────────────────────────────────────────── */}
                    <div className="bg-rose-50/70 dark:bg-rose-500/10 border border-rose-200/80 dark:border-rose-500/20 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                                <LogOut size={22} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="m-0 font-inter text-base font-bold text-rose-900 dark:text-rose-300">Log Out Session</h2>
                                <p className="m-0 font-inter text-xs text-rose-700/80 dark:text-rose-400/80 mt-0.5">Securely log out of your Secretary Admin session</p>
                            </div>
                        </div>
                        <button 
                            className="h-10 px-6 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-sm flex items-center justify-center gap-2 shrink-0"
                            onClick={handleLogout}
                        >
                            <LogOut size={16} /> Log Out Now
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
