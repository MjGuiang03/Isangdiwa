import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';


import { useTheme } from '../../context/ThemeContext';

import API from '../../utils/api';
import { Mail, User, XCircle, Check, Bell, Lock, Eye, EyeOff, AlertTriangle, LogOut, ShieldCheck } from 'lucide-react';
import { subscribeToPushNotifications, unsubscribeFromPushNotifications } from '../../utils/desktopNotify';

/* ─── Community options removed in favor of dynamic fetching ─── */

/* ─── Signup-aligned Password Validators & Helpers ───────────────────── */
const passwordUppercase = /[A-Z]/;
const passwordLowercase = /[a-z]/;
const passwordNumber = /[0-9]/;
const passwordSymbol = /[^A-Za-z0-9]/;

function validateNewPassword(value) {
  const errs = [];
  if (!value) return ['New password is required'];
  if (value.length < 8) errs.push('at least 8 characters');
  if (value.length > 72) errs.push('maximum 72 characters');
  if (!passwordUppercase.test(value)) errs.push('1 uppercase letter');
  if (!passwordLowercase.test(value)) errs.push('1 lowercase letter');
  if (!passwordNumber.test(value)) errs.push('1 number');
  if (!passwordSymbol.test(value)) errs.push('1 symbol');
  return errs;
}

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (passwordUppercase.test(password)) score++;
  if (passwordNumber.test(password)) score++;
  if (passwordSymbol.test(password)) score++;

  if (score <= 1) return { score: 1, label: 'Weak', color: '#EF4444' };
  if (score === 2) return { score: 2, label: 'Fair', color: '#F59E0B' };
  if (score === 3) return { score: 3, label: 'Good', color: '#3B82F6' };
  return { score: 4, label: 'Strong', color: '#10B981' };
}

/* ─── Toast component ───────────────────────────────────────────────── */
function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`user-settings-toast user-settings-toast--${type}`}>
      {type === 'success'
        ? <Check size={15} />
        : <XCircle size={15} />}
      <span>{message}</span>
    </div>
  );
}

/* ─── Notification category groups ─────────────────────────────────── */
const NOTIF_GROUPS = [
  {
    group: 'Financial',
    items: [
      { key: 'loan', label: 'Loans' },
      { key: 'payment_pending', label: 'Payments' },
      { key: 'savings', label: 'Savings' },
    ],
  },
  {
    group: 'Community',
    items: [
      { key: 'announcement', label: 'Announcements' },
      { key: 'attendance', label: 'Attendance' },
      { key: 'donation', label: 'Donations' },
    ],
  },
];

const ALL_NOTIF_KEYS = NOTIF_GROUPS.flatMap(g => g.items.map(i => i.key));

export default function Settings() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => setToast({ message, type });

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  /* ── Password ────────────────────────────────────────────────────────── */
  const [passForm, setPassForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  /* ── Show/hide password toggles ──────────────────────────────────────── */
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showPasswordConfirmModal, setShowPasswordConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [emailConfirmModal, setEmailConfirmModal] = useState({ show: false, names: '' });
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleSignOut = async () => {
    const result = await signOut();
    if (result.success) {
      navigate('/');
    }
  };

  /* ── Notification prefs ──────────────────────────────────────────────── */
  const [notifPrefs, setNotifPrefs] = useState({
    loan: true,
    payment_pending: true,
    announcement: true,
    attendance: true,
    savings: true,
    donation: true
  });

  useEffect(() => {
    if (profile) {
      if (profile.emailNotifications !== undefined) setEmailNotifications(profile.emailNotifications);
      if (profile.pushNotifications !== undefined) setPushNotifications(profile.pushNotifications);
      if (profile.notifPrefs) setNotifPrefs(profile.notifPrefs);
    }
  }, [profile]);

  const allSelected = ALL_NOTIF_KEYS.every(k => notifPrefs[k]);


  const savePreferencesToBackend = async (updates) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API}/api/update-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates)
      });
    } catch (e) { console.error('Failed to save settings', e); }
  };

  const handleTogglePref = (key) => {
    const newVal = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(newVal);
    savePreferencesToBackend({ notifPrefs: newVal });
    showToast('Preferences saved');
  };

  const handleSelectAll = () => {
    const newVal = ALL_NOTIF_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setNotifPrefs(newVal);
    savePreferencesToBackend({ notifPrefs: newVal });
    showToast('All notifications enabled');
  };

  const handleDeselectAll = () => {
    const newVal = ALL_NOTIF_KEYS.reduce((acc, k) => ({ ...acc, [k]: false }), {});
    setNotifPrefs(newVal);
    savePreferencesToBackend({ notifPrefs: newVal });
    showToast('All notifications disabled');
  };

  /* ── Email master toggle with dim ───────────────────────────────────── */
  const handleEmailToggle = (checked) => {
    if (!checked) {
      const active = ALL_NOTIF_KEYS.filter(k => notifPrefs[k]);
      if (active.length > 0) {
        const names = active.map(k => {
          const flat = NOTIF_GROUPS.flatMap(g => g.items);
          return flat.find(i => i.key === k)?.label || k;
        });
        setEmailConfirmModal({ show: true, names: names.join(', ') });
        return;
      }
    }
    setEmailNotifications(checked);
    savePreferencesToBackend({ emailNotifications: checked });
  };

  const handlePushToggle = async (checked) => {
    setPushNotifications(checked);
    if (checked) {
      const sub = await subscribeToPushNotifications();
      savePreferencesToBackend({ pushNotifications: true, pushSubscription: sub });
      showToast('Push notifications enabled');
    } else {
      await unsubscribeFromPushNotifications();
      savePreferencesToBackend({ pushNotifications: false, pushSubscription: null });
      showToast('Push notifications disabled');
    }
  };

  const handleUpdatePassword = (e) => {
    if (e) e.preventDefault();
    setPassError('');

    if (!passForm.current || !passForm.new || !passForm.confirm) {
      setPassError('Please fill in all password fields.');
      return;
    }

    const passErrs = validateNewPassword(passForm.new);
    if (passErrs.length > 0) {
      setPassError(`New password requires: ${passErrs.join(', ')}.`);
      return;
    }

    if (passForm.new !== passForm.confirm) {
      setPassError('New passwords do not match.');
      return;
    }

    /* Open confirmation modal before proceeding */
    setShowPasswordConfirmModal(true);
  };

  const executePasswordUpdate = async () => {
    setShowPasswordConfirmModal(false);
    setPassLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/user/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passForm.current,
          newPassword: passForm.new
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update password');

      setShowSuccessModal(true);
      setPassForm({ current: '', new: '', confirm: '' });
      setIsChangingPassword(false);
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      showToast('Password updated successfully');
    } catch (err) {
      setPassError(err.message);
    } finally {
      setPassLoading(false);
    }
  };


  /* ── Password strength ───────────────────────────────────────────────── */
  const strength = getPasswordStrength(passForm.new);
  const passwordsMatch = passForm.confirm.length > 0 && passForm.new === passForm.confirm;
  const passwordsMismatch = passForm.confirm.length > 0 && passForm.new !== passForm.confirm;


  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Main Content */}
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage your account preferences</p>
        </div>

        <div className="space-y-6">

          {/* ── Appearance ─────────────────────────────────────────── */}
          <div className="p-6 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <User size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Appearance</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Customize your interface theme</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Dark Mode</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Switch between light and dark themes</p>
                </div>
                <button 
                  onClick={toggleTheme}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Notifications ─────────────────────────────────────────── */}
          <div className="p-6 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Bell size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Notifications</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Manage how you receive updates</p>
              </div>
            </div>
            <div className="space-y-5">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Communication channels</h3>

              {/* Email toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Email notifications</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email || 'Receive updates via email'}</p>
                </div>
                <button 
                  onClick={() => handleEmailToggle(!emailNotifications)}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${emailNotifications ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${emailNotifications ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Push Notifications */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Push notifications</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Browser &amp; mobile alerts</p>
                </div>
                <button 
                  onClick={() => handlePushToggle(!pushNotifications)}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${pushNotifications ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${pushNotifications ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* SMS — coming soon */}
              <div className="flex items-center justify-between opacity-50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    SMS
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold rounded-full uppercase">Coming soon</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Text message alerts</p>
                </div>
                <div className="w-12 h-6 rounded-full bg-slate-200 dark:bg-slate-700 relative p-0.5">
                  <div className="w-5 h-5 rounded-full bg-white" />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-white/5 pt-4" />

              {/* Categories header + select all */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Notification categories</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose which activity you want to be notified about.</p>
                </div>
                <button
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  onClick={allSelected ? handleDeselectAll : handleSelectAll}
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* Grouped pill categories */}
              <div className={`space-y-4 ${!emailNotifications ? 'opacity-40 pointer-events-none' : ''}`}>
                {NOTIF_GROUPS.map(({ group, items }) => (
                  <div key={group} className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{group}</p>
                    <div className="flex flex-wrap gap-2">
                      {items.map(({ key, label }) => (
                        <button
                          key={key}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
                            notifPrefs[key]
                              ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                          }`}
                          onClick={() => !(!emailNotifications) && handleTogglePref(key)}
                          disabled={!emailNotifications}
                        >
                          <span className={`w-2 h-2 rounded-full ${notifPrefs[key] ? 'bg-blue-600 dark:bg-blue-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* ── Security & Password ────────────────────────────────────── */}
          <div className="p-6 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xs space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/60 dark:to-indigo-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 flex items-center justify-center shrink-0 shadow-xs">
                <Lock size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Security &amp; Password</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Manage your password and account authentication</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Account Password</h3>
              </div>

              {passError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                  <XCircle size={16} className="shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              {!isChangingPassword ? (
                /* Collapsed View: Info Banner + Change Password CTA */
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Current Password</span>
                      <span className="font-mono text-xs text-slate-400 tracking-widest">••••••••••••</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      It is recommended to use a strong, unique password to secure your account.
                    </p>
                  </div>
                  <button
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border-none shrink-0 self-start sm:self-auto"
                    onClick={() => setIsChangingPassword(true)}
                  >
                    <Lock size={14} />
                    <span>Change Password</span>
                  </button>
                </div>
              ) : (
                /* Expanded View: Password Form Card */
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/10 space-y-4">
                  <div className="pb-2 border-b border-slate-200/60 dark:border-white/5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Update Account Password</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Current password */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Current Password</label>
                        <button 
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold border-none bg-transparent" 
                          type="button" 
                          onClick={() => setShowResetModal(true)}
                        >
                          <Mail size={11} /> Forgot current password?
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <Lock size={15} />
                        </div>
                        <input
                          type={showCurrent ? 'text' : 'password'}
                          className="w-full pl-9 pr-10 py-2.5 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all font-inter"
                          value={passForm.current}
                          onChange={e => setPassForm({ ...passForm, current: e.target.value })}
                          placeholder="Enter your current password"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1"
                          onClick={() => setShowCurrent(v => !v)}
                        >
                          {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* New password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">New Password</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <Lock size={15} />
                        </div>
                        <input
                          type={showNew ? 'text' : 'password'}
                          className="w-full pl-9 pr-10 py-2.5 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all font-inter"
                          value={passForm.new}
                          onChange={e => setPassForm({ ...passForm, new: e.target.value })}
                          placeholder="At least 6 characters"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1"
                          onClick={() => setShowNew(v => !v)}
                        >
                          {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {/* Strength indicator */}
                      {passForm.new.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          <div className="flex gap-1 flex-1">
                            {[1, 2, 3, 4].map(n => (
                              <div
                                key={n}
                                className="h-1.5 flex-1 rounded-full transition-all duration-300"
                                style={{
                                  background: n <= strength.score ? strength.color : 'rgba(203, 213, 225, 0.4)'
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: strength.color }}>
                            {strength.label}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Confirm new password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Confirm New Password</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <Lock size={15} />
                        </div>
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          className="w-full pl-9 pr-10 py-2.5 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all font-inter"
                          value={passForm.confirm}
                          onChange={e => setPassForm({ ...passForm, confirm: e.target.value })}
                          placeholder="Re-enter new password"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1"
                          onClick={() => setShowConfirm(v => !v)}
                        >
                          {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {/* Match feedback */}
                      {passwordsMatch && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 pt-0.5">
                          <Check size={12} /> Passwords match
                        </span>
                      )}
                      {passwordsMismatch && (
                        <span className="text-[11px] text-red-500 dark:text-red-400 font-semibold flex items-center gap-1 pt-0.5">
                          <XCircle size={12} /> Passwords don't match
                        </span>
                      )}
                    </div>

                    {/* Password Requirements Checklist Box (Matched with Signup) */}
                    <div className="p-3.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/10 space-y-1.5 sm:col-span-2">
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Password must include:</p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                        <li className={!passForm.new ? 'text-slate-400' : (passForm.new.length >= 8 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-500 font-semibold')}>
                          ✓ Minimum 8 characters
                        </li>
                        <li className={!passForm.new ? 'text-slate-400' : (passwordUppercase.test(passForm.new) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-500 font-semibold')}>
                          ✓ At least 1 uppercase letter (A–Z)
                        </li>
                        <li className={!passForm.new ? 'text-slate-400' : (passwordLowercase.test(passForm.new) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-500 font-semibold')}>
                          ✓ At least 1 lowercase letter (a–z)
                        </li>
                        <li className={!passForm.new ? 'text-slate-400' : (passwordNumber.test(passForm.new) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-500 font-semibold')}>
                          ✓ At least 1 number (0–9)
                        </li>
                        <li className={!passForm.new ? 'text-slate-400' : (passwordSymbol.test(passForm.new) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-500 font-semibold')}>
                          ✓ At least 1 symbol (@ # $ % * _)
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/60 dark:border-white/5">
                    <button
                      type="button"
                      className="px-4 py-2.5 bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-300/70 dark:hover:bg-slate-700 transition-colors cursor-pointer border-none"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPassForm({ current: '', new: '', confirm: '' });
                        setPassError('');
                        setShowCurrent(false);
                        setShowNew(false);
                        setShowConfirm(false);
                      }}
                      disabled={passLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md text-xs transition-all cursor-pointer border-none flex items-center gap-1.5"
                      onClick={handleUpdatePassword}
                      disabled={passLoading || passwordsMismatch}
                    >
                      {passLoading ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ── Sign Out ────────────────────────────────────────── */}
          <div className="p-6 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sign Out</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">You will be redirected to the welcome page.</p>
            </div>
            <button
              className="px-4 py-2.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-semibold rounded-xl text-xs flex items-center gap-2 border border-red-200/60 dark:border-red-800/40 transition-all cursor-pointer self-start sm:self-auto"
              onClick={() => setShowLogoutModal(true)}
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>

        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" onClick={() => setShowLogoutModal(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-white/10 font-inter" onClick={e => e.stopPropagation()}>
            <h2 className="font-inter text-xl font-bold text-slate-900 dark:text-white m-0 mb-3">Confirm Logout</h2>
            <p className="font-inter text-sm text-slate-500 dark:text-slate-400 m-0 mb-6 leading-relaxed">
              Are you sure you want to log out of your account?
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-inter text-sm font-semibold cursor-pointer transition-colors" 
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button 
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white border-none rounded-xl font-inter text-sm font-semibold cursor-pointer transition-colors" 
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Confirmation Modal */}
      {showPasswordConfirmModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowPasswordConfirmModal(false)}>
          <div className="relative w-full max-w-sm bg-white dark:bg-[#1E2130] rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 my-auto text-left space-y-4 font-inter" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Confirm Password Change</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Security Verification</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to update your password? You will be required to sign in with your new password next time.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-white/5">
              <button 
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all text-xs border-none cursor-pointer" 
                onClick={() => setShowPasswordConfirmModal(false)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-xs border-none cursor-pointer"
                onClick={executePasswordUpdate}
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Update Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" onClick={() => setShowSuccessModal(false)}>
          <div className="relative w-full max-w-sm bg-white dark:bg-[#1E2130] rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 my-auto text-center space-y-4 font-inter" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto shadow-xs">
              <ShieldCheck size={30} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Password Updated!</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Your account password has been changed successfully. A security notification has been sent to your email and added to your notification feed.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-white/5">
              <button 
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-xs border-none cursor-pointer"
                onClick={() => setShowSuccessModal(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowResetModal(false)}>
          <div className="relative w-full max-w-md bg-white dark:bg-[#1E2130] rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 my-auto text-left space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Reset Password</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">A password reset link will be sent to your registered email address (<strong className="text-blue-600 dark:text-blue-400">{user?.email || 'your email'}</strong>). Please check your inbox.</p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all text-xs" 
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all text-xs"
                onClick={() => {
                  setShowResetModal(false);
                  showToast('Reset link sent to your email');
                }}
              >
                Send Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Disable Confirm Modal */}
      {emailConfirmModal.show && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-disable-title"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEmailConfirmModal({ show: false, names: '' });
          }}
          ref={(el) => { if (el) el.focus(); }}
        >
          <div className="relative w-full max-w-md bg-white dark:bg-[#1E2130] rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 my-auto text-left space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-800/40 flex items-center justify-center text-red-600 dark:text-red-400 flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <h2 id="email-disable-title" className="text-lg font-bold text-slate-900 dark:text-white">Disable email notifications?</h2>
            </div>
            
            <div className="space-y-2 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                {emailConfirmModal.names 
                  ? "You'll stop receiving email alerts for these categories:"
                  : "No active categories will be affected."}
              </p>
              {emailConfirmModal.names && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {emailConfirmModal.names.split(', ').map(name => (
                    <span key={name} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-[11px]">{name}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
              <button 
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all text-xs" 
                onClick={() => setEmailConfirmModal({ show: false, names: '' })}
                autoFocus
              >
                Keep enabled
              </button>
              <button 
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-md transition-all text-xs" 
                onClick={() => {
                  setEmailNotifications(false);
                  setEmailConfirmModal({ show: false, names: '' });
                }}
              >
                Yes, disable
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}