/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import LoanAdminSidebar from './loanAdminSidebar';
import PageHeader from '../components/PageHeader';
import { useTheme } from '../../context/ThemeContext';
import API from '../../utils/api';

import { User, Moon, Lock, Bell, LogOut, Eye, EyeOff, Save, CheckCircle2 } from 'lucide-react';

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

export default function LoanAdminSettings() {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const [adminName, setAdminName] = useState(localStorage.getItem('adminName') || 'Loan Admin');
    const [adminEmail, setAdminEmail] = useState(localStorage.getItem('adminEmail') || 'loanadmin@church.com');

    // Security
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Notification prefs
    const [notifNewLoan, setNotifNewLoan] = useState(true);
    const [notifPayment, setNotifPayment] = useState(true);
    const [notifDelinquent, setNotifDelinquent] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            navigate('/');
            return;
        }

        // Fetch profile details
        fetch(`${API}/api/admin/profile/me`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                setAdminName(data.admin.fullName);
                setAdminEmail(data.admin.email);
                localStorage.setItem('adminName', data.admin.fullName);
                window.dispatchEvent(new Event('storage'));
            }
        })
        .catch(err => console.error(err));

        // Fetch global notification settings
        fetch(`${API}/api/admin/settings`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.settings) {
                setNotifNewLoan(data.settings.notifNewLoan ?? true);
                setNotifPayment(data.settings.notifPayment ?? true);
                setNotifDelinquent(data.settings.notifDelinquent ?? true);
            }
        })
        .catch(err => console.error(err));
    }, [navigate]);

    const handleSaveProfile = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`${API}/api/admin/profile/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ fullName: adminName })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('adminName', adminName);
                toast.success('Profile updated successfully');
                window.dispatchEvent(new Event('storage'));
            } else {
                toast.error(data.message || 'Failed to update profile');
            }
        } catch (err) {
            toast.error('Network error');
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error('Please fill in all password fields');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (newPassword.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        if (!/[A-Z]/.test(newPassword)) {
            toast.error('Password must contain an uppercase letter');
            return;
        }
        if (!/[0-9]/.test(newPassword)) {
            toast.error('Password must contain a number');
            return;
        }
        if (!/[^A-Za-z0-9]/.test(newPassword)) {
            toast.error('Password must contain a symbol');
            return;
        }

        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`${API}/api/admin/profile/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Password updated successfully');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                toast.error(data.message || 'Failed to update password');
            }
        } catch (err) {
            toast.error('Network error');
        }
    };

    const handleToggleChange = async (key, checked, setter) => {
        setter(checked);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`${API}/api/admin/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ [key]: checked })
            });
            const data = await res.json();
            if (!data.success) {
                toast.error('Failed to save notification preference');
                setter(!checked);
            }
        } catch (err) {
            toast.error('Network error saving preferences');
            setter(!checked);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminEmail');
        localStorage.removeItem('adminRole');
        localStorage.removeItem('adminName');
        toast.success('Signed out successfully');
        navigate('/');
    };

    return (
        <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
            <LoanAdminSidebar />

            <div className="flex-1 overflow-y-auto p-6 pb-16 bg-slate-100 dark:bg-[#161922] w-full">
                <div className="flex flex-col gap-6 max-w-[1000px] mx-auto w-full min-h-screen">
                    {/* Header */}
                    <PageHeader 
                        title="Loan Admin Settings" 
                        subtitle="Configure your personal account details, security, and notification preferences." 
                    />

                    {/* Personal Profile Section */}
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative">
                        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/30">
                                <User size={22} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">Personal Profile</h2>
                                <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage your display name and email address</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Full Name</label>
                                <input
                                    type="text"
                                    className="h-10 px-3.5 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#161922] transition-all w-full"
                                    value={adminName}
                                    onChange={(e) => setAdminName(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Email Address</label>
                                <input
                                    type="email"
                                    value={adminEmail}
                                    disabled
                                    className="h-10 px-3.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-500 dark:text-slate-400 outline-none w-full opacity-70 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <button
                            className="h-10 px-6 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm flex items-center justify-center gap-2 w-fit mt-1"
                            onClick={handleSaveProfile}
                        >
                            <Save size={16} />
                            Save Changes
                        </button>
                    </div>

                    {/* Security Section */}
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative">
                        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/30">
                                <Lock size={22} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">Security & Password</h2>
                                <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Keep your account secure by updating your password</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Current Password</label>
                            <div className="relative w-full">
                                <input
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    className="h-10 pl-3.5 pr-10 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#161922] transition-all w-full"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-0 flex items-center"
                                >
                                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">New Password</label>
                                <div className="relative w-full">
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        className="h-10 pl-3.5 pr-10 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#161922] transition-all w-full"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Min. 8 characters with upper, number, symbol"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-0 flex items-center"
                                    >
                                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <StrengthBar password={newPassword} />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Confirm New Password</label>
                                <div className="relative w-full">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        className="h-10 pl-3.5 pr-10 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#161922] transition-all w-full"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Repeat new password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-0 flex items-center"
                                    >
                                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {confirmPassword && newPassword !== confirmPassword && (
                                    <p className="text-[11px] font-semibold text-rose-500 m-0 mt-1">Passwords do not match</p>
                                )}
                                {confirmPassword && newPassword === confirmPassword && (
                                    <p className="text-[11px] font-semibold text-emerald-500 m-0 mt-1 flex items-center gap-1"><CheckCircle2 size={12} /> Passwords match</p>
                                )}
                            </div>
                        </div>

                        <button
                            className="h-10 px-6 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm flex items-center justify-center gap-2 w-fit mt-1"
                            onClick={handleChangePassword}
                        >
                            <Lock size={16} />
                            Update Password
                        </button>
                    </div>

                    {/* Notification Preferences Section */}
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative">
                        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200/50 dark:border-rose-500/30">
                                <Bell size={22} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">Notification Preferences</h2>
                                <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose which loan events trigger alerts</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">New Loan Applications</span>
                                <span className="font-inter text-xs text-slate-500 dark:text-slate-400">Get notified when a member submits a new loan request.</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" className="sr-only peer" checked={notifNewLoan} onChange={(e) => handleToggleChange('notifNewLoan', e.target.checked, setNotifNewLoan)} />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">Payment Submissions</span>
                                <span className="font-inter text-xs text-slate-500 dark:text-slate-400">Get notified when a borrower submits a repayment.</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" className="sr-only peer" checked={notifPayment} onChange={(e) => handleToggleChange('notifPayment', e.target.checked, setNotifPayment)} />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between py-3">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">Delinquency Alerts</span>
                                <span className="font-inter text-xs text-slate-500 dark:text-slate-400">Get notified when a borrower becomes delinquent or at risk.</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" className="sr-only peer" checked={notifDelinquent} onChange={(e) => handleToggleChange('notifDelinquent', e.target.checked, setNotifDelinquent)} />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    {/* Appearance Settings Section */}
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

                    {/* Logout Section */}
                    <div className="bg-rose-50/70 dark:bg-rose-500/10 border border-rose-200/80 dark:border-rose-500/20 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                                <LogOut size={22} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="m-0 font-inter text-base font-bold text-rose-900 dark:text-rose-300">Log Out Session</h2>
                                <p className="m-0 font-inter text-xs text-rose-700/80 dark:text-rose-400/80 mt-0.5">Securely log out of your Loan Admin session</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleLogout} 
                            className="h-10 px-6 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-sm flex items-center justify-center gap-2 shrink-0"
                        >
                            <LogOut size={16} /> Log Out Now
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
