import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Settings, Lock, CreditCard, Edit2, Moon, Bell, Database, Wrench, Download, LogOut, Eye, EyeOff, Save, CheckCircle2, AlertTriangle } from 'lucide-react';
import API from '../../utils/api';
import { useTheme } from '../../context/ThemeContext';

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

export default function AdminSettings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [settings, setSettings] = useState({
    adminName: 'Admin User',
    adminEmail: 'admin@church.com',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    approvalMethod: 'gateway',
    orgName: 'IsangDiwa Church',
    orgContact: '+63 912 345 6789',
    orgAddress: 'Metro Manila, Philippines',
    maintenanceMode: false,
    notifNewUser: true,
    notifDonation: true,
    notifLoan: true,
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [savedApprovalMethod, setSavedApprovalMethod] = useState('gateway');
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, section: null });
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [pendingMaintenanceState, setPendingMaintenanceState] = useState(false);

  useEffect(() => {
    const adminEmail = localStorage.getItem('adminEmail');
    if (!adminEmail) {
      navigate('/');
      return;
    }

    const token = localStorage.getItem('adminToken');
    if (token) {
      fetch(`${API}/api/admin/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSettings(prev => ({
            ...prev,
            adminName: data.admin.fullName,
            adminEmail: data.admin.email
          }));
          localStorage.setItem('adminName', data.admin.fullName);
          window.dispatchEvent(new Event('storage'));
        }
      })
      .catch(err => console.error(err));
    }
  }, [navigate]);

  const token = localStorage.getItem('adminToken');
  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());

  const { data: settingsData, mutate: refreshSettings } = useSWR(
    token ? `${API}/api/admin/settings` : null,
    fetcherSingle,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (settingsData && settingsData.success && settingsData.settings) {
        const s = settingsData.settings;
        const currentMethod = s.paymentApprovalMethod || 'gateway';
        setSettings(prev => ({ 
            ...prev, 
            approvalMethod: currentMethod,
            orgName: s.orgName || 'IsangDiwa Church',
            orgContact: s.orgContact || '+63 912 345 6789',
            orgAddress: s.orgAddress || 'Metro Manila, Philippines',
            maintenanceMode: s.maintenanceMode || false,
            notifNewUser: s.notifNewUser ?? true,
            notifDonation: s.notifDonation ?? true,
            notifLoan: s.notifLoan ?? true
        }));
        setSavedApprovalMethod(currentMethod);
    }
  }, [settingsData]);

  const handleSave = async (section, directPayload = null) => {
    try {
      const token = localStorage.getItem('adminToken');

      if (section === 'Account') {
        const res = await fetch(`${API}/api/admin/profile/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ fullName: settings.adminName })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('adminName', settings.adminName);
          window.dispatchEvent(new Event('storage'));
          toast.success('Profile updated successfully');
        } else {
          toast.error(data.message || 'Failed to update profile');
        }
        return;
      }

      if (section === 'Security') {
        if (!settings.currentPassword || !settings.newPassword || !settings.confirmPassword) {
          toast.error('Please fill in all password fields');
          return;
        }
        if (settings.newPassword !== settings.confirmPassword) {
          toast.error('Passwords do not match');
          return;
        }
        if (settings.newPassword.length < 8) {
          toast.error('Password must be at least 8 characters');
          return;
        }
        if (!/[A-Z]/.test(settings.newPassword)) {
          toast.error('Password must contain an uppercase letter');
          return;
        }
        if (!/[0-9]/.test(settings.newPassword)) {
          toast.error('Password must contain a number');
          return;
        }
        if (!/[^A-Za-z0-9]/.test(settings.newPassword)) {
          toast.error('Password must contain a symbol');
          return;
        }

        const res = await fetch(`${API}/api/admin/profile/change-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            currentPassword: settings.currentPassword,
            newPassword: settings.newPassword
          })
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Password updated successfully');
          setSettings(prev => ({
            ...prev,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          }));
        } else {
          toast.error(data.message || 'Failed to update password');
        }
        return;
      }
      
      const payload = directPayload || {
        paymentApprovalMethod: settings.approvalMethod,
        orgName: settings.orgName,
        orgContact: settings.orgContact,
        orgAddress: settings.orgAddress,
        maintenanceMode: settings.maintenanceMode,
        notifNewUser: settings.notifNewUser,
        notifDonation: settings.notifDonation,
        notifLoan: settings.notifLoan
      };
      
      const res = await fetch(`${API}/api/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        if (!directPayload) {
            toast.success(`${section} settings updated successfully`);
        }
        if (section === 'Payment') {
            setSavedApprovalMethod(settings.approvalMethod);
            setIsEditingPayment(false);
        }
        refreshSettings();
      } else {
        toast.error(data.message || 'Failed to update settings');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleToggleChange = (key, checked) => {
      setSettings(prev => ({ ...prev, [key]: checked }));
      handleSave('Toggles', { [key]: checked });
  };

  const handleMaintenanceToggleClick = (targetChecked) => {
    setPendingMaintenanceState(targetChecked);
    setShowMaintenanceModal(true);
  };

  const confirmMaintenanceToggle = () => {
    handleToggleChange('maintenanceMode', pendingMaintenanceState);
    setShowMaintenanceModal(false);
    toast.success(
      pendingMaintenanceState
        ? 'System Maintenance Mode enabled'
        : 'System Maintenance Mode disabled'
    );
  };

  const handleExportData = async () => {
    const toastId = toast.loading('Preparing master database export...');
    try {
      const token = localStorage.getItem('adminToken');
      
      let res = await fetch(`${API}/api/admin/export-master-csv`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => null);

      let blob;
      if (res && res.ok) {
        blob = await res.blob();
      } else {
        // Fallback: Fetch resources directly and compile CSV
        const [usersRes, donRes, loansRes] = await Promise.all([
          fetch(`${API}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({})),
          fetch(`${API}/api/admin/donations`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({})),
          fetch(`${API}/api/admin/loans`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({}))
        ]);

        const usersList = usersRes.users || [];
        const donList = donRes.donations || [];
        const loansList = loansRes.loans || [];

        let csv = "=== MEMBERS ===\nFull Name,Email,Phone,Branch,Position,Is Verified\n";
        usersList.forEach(u => {
          csv += `"${u.fullName || ''}","${u.email || ''}","${u.phone || ''}","${u.branch || ''}","${u.position || ''}","${u.isVerified ? 'Yes' : 'No'}"\n`;
        });

        csv += "\n=== DONATIONS ===\nDonor Name,Email,Amount,Category,Payment Method,Status\n";
        donList.forEach(d => {
          csv += `"${d.donorName || d.fullName || ''}","${d.email || ''}",${d.amount || 0},"${d.category || ''}","${d.paymentMethod || ''}","${d.status || ''}"\n`;
        });

        csv += "\n=== LOANS ===\nLoan ID,Member Name,Email,Type,Amount,Status\n";
        loansList.forEach(l => {
          csv += `"${l.loanId || ''}","${l.memberName || ''}","${l.email || ''}","${l.loanType || ''}",${l.amount || 0},"${l.status || ''}"\n`;
        });

        blob = new Blob([csv], { type: 'text/csv' });
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `isangdiwa_master_backup_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.dismiss(toastId);
      toast.success('Backup downloaded successfully');
    } catch (err) {
      console.error('Export CSV error:', err);
      toast.dismiss(toastId);
      toast.error('Failed to download database backup');
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

  if (!settingsData) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full min-h-screen bg-slate-100 dark:bg-[#161922] animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
          <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
        </div>

        {/* 4 Card Skeletons */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
              <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700/80"></div>
              <div className="flex flex-col gap-2">
                <div className="h-5 w-44 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                <div className="h-3.5 w-64 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-xl"></div>
              <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-xl"></div>
            </div>
            <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700/80 rounded-xl"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full min-h-screen bg-slate-100 dark:bg-[#161922]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="m-0 font-inter text-2xl font-bold text-slate-800 dark:text-white">Admin Settings</h1>
          <p className="m-0 font-inter text-sm text-slate-500 dark:text-slate-400 mt-1">Configure global organization preferences, security, and system defaults</p>
        </div>
      </div>



      {/* Account Settings Section */}
      <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/30">
            <Settings size={22} />
          </div>
          <div className="flex flex-col">
            <h2 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">Account Profile</h2>
            <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage your display name and registered email</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Admin Full Name</label>
            <input
              type="text"
              value={settings.adminName}
              onChange={(e) => setSettings({ ...settings, adminName: e.target.value })}
              className="h-10 px-3.5 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#161922] transition-all w-full"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Email Address</label>
            <input
              type="email"
              value={settings.adminEmail}
              disabled
              className="h-10 px-3.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-500 dark:text-slate-400 outline-none w-full opacity-70 cursor-not-allowed"
            />
          </div>
        </div>

        <button
          onClick={() => setConfirmModal({ show: true, section: 'Account' })}
          className="h-10 px-6 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm flex items-center justify-center gap-2 w-fit mt-1"
        >
          <Save size={16} />
          Save Changes
        </button>
      </div>

      {/* Security Settings Section */}
      <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/30">
            <Lock size={22} />
          </div>
          <div className="flex flex-col">
            <h2 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">Security & Password</h2>
            <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Keep your administrative account safe with a strong password</p>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Current Password</label>
          <div className="relative w-full">
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              value={settings.currentPassword}
              onChange={(e) => setSettings({ ...settings, currentPassword: e.target.value })}
              placeholder="Enter current password"
              className="h-10 pl-3.5 pr-10 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#161922] transition-all w-full"
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
                value={settings.newPassword}
                onChange={(e) => setSettings({ ...settings, newPassword: e.target.value })}
                placeholder="Min. 8 characters with upper, number, symbol"
                className="h-10 pl-3.5 pr-10 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#161922] transition-all w-full"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-0 flex items-center"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <StrengthBar password={settings.newPassword} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Confirm New Password</label>
            <div className="relative w-full">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={settings.confirmPassword}
                onChange={(e) => setSettings({ ...settings, confirmPassword: e.target.value })}
                placeholder="Repeat new password"
                className="h-10 pl-3.5 pr-10 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#161922] transition-all w-full"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-0 flex items-center"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {settings.confirmPassword && settings.newPassword !== settings.confirmPassword && (
              <p className="text-[11px] font-semibold text-rose-500 m-0 mt-1">Passwords do not match</p>
            )}
            {settings.confirmPassword && settings.newPassword === settings.confirmPassword && (
              <p className="text-[11px] font-semibold text-emerald-500 m-0 mt-1 flex items-center gap-1"><CheckCircle2 size={12} /> Passwords match</p>
            )}
          </div>
        </div>

        <button
          onClick={() => setConfirmModal({ show: true, section: 'Security' })}
          className="h-10 px-6 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm flex items-center justify-center gap-2 w-fit mt-1"
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
            <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose which system events trigger real-time alerts</p>
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
          <div className="flex flex-col gap-0.5">
            <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">New User Registrations</span>
            <span className="font-inter text-xs text-slate-500 dark:text-slate-400">Get notified when a new member registers an account.</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" className="sr-only peer" checked={settings.notifNewUser} onChange={(e) => handleToggleChange('notifNewUser', e.target.checked)} />
            <div className="w-11 h-6 bg-slate-200 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
          <div className="flex flex-col gap-0.5">
            <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">Large Donations</span>
            <span className="font-inter text-xs text-slate-500 dark:text-slate-400">Get notified for financial contributions above ₱5,000.</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" className="sr-only peer" checked={settings.notifDonation} onChange={(e) => handleToggleChange('notifDonation', e.target.checked)} />
            <div className="w-11 h-6 bg-slate-200 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">Loan Applications</span>
            <span className="font-inter text-xs text-slate-500 dark:text-slate-400">Get notified when new loan applications are submitted or approved.</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" className="sr-only peer" checked={settings.notifLoan} onChange={(e) => handleToggleChange('notifLoan', e.target.checked)} />
            <div className="w-11 h-6 bg-slate-200 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Payment Settings Section */}
      <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-cyan-50 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border border-cyan-200/50 dark:border-cyan-500/30">
            <CreditCard size={22} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">Payment Settings</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/30 text-[10px] font-bold uppercase tracking-wider">
                Coming Soon
              </span>
            </div>
            <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Configure transaction approval methods for donations and loans</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <label className="font-inter text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Payment Processing Mode</label>
            <button 
              disabled
              className="h-8 px-3 rounded-lg font-inter text-xs font-semibold border border-slate-200/80 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed flex items-center gap-1.5 opacity-70" 
              title="Automated payment gateway configuration is coming soon"
            >
              <Edit2 size={13} /> Edit (Coming Soon)
            </button>
          </div>
          
          <div className="p-4 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl flex items-center gap-3">
            <span className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 shrink-0">
              Manual Approval
            </span>
            <span className="font-inter text-sm text-slate-600 dark:text-slate-300">
              Admins manually review uploaded receipts. (Automated gateway integration coming soon)
            </span>
          </div>
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

      {/* Database Backup Section */}
      <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/30">
            <Database size={22} />
          </div>
          <div className="flex flex-col">
            <h2 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">Data Backup & Export</h2>
            <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Export a complete snapshot of system data</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl">
          <div className="flex flex-col gap-0.5">
            <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">Export Master Database</span>
            <span className="font-inter text-xs text-slate-500 dark:text-slate-400">Download a CSV backup of members, donations, and loan records.</span>
          </div>
          <button onClick={handleExportData} className="h-10 px-5 rounded-xl font-inter text-sm font-semibold transition-all border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 cursor-pointer flex items-center gap-2 shrink-0">
            <Download size={16} /> Download CSV
          </button>
        </div>
      </div>

      {/* System Maintenance Section */}
      <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-orange-50 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-200/50 dark:border-orange-500/30">
            <Wrench size={22} />
          </div>
          <div className="flex flex-col">
            <h2 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">System Maintenance</h2>
            <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Temporarily restrict user access for maintenance windows</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-rose-50/50 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-500/20 rounded-xl">
          <div className="flex flex-col gap-0.5">
            <span className="font-inter text-sm font-semibold text-rose-800 dark:text-rose-400">Enable Maintenance Mode</span>
            <span className="font-inter text-xs text-rose-700/80 dark:text-rose-400/80">Regular users will see a maintenance screen and cannot log in.</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" className="sr-only peer" checked={settings.maintenanceMode} onChange={(e) => handleMaintenanceToggleClick(e.target.checked)} />
            <div className="w-11 h-6 bg-slate-200 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
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
            <p className="m-0 font-inter text-xs text-rose-700/80 dark:text-rose-400/80 mt-0.5">Securely log out of your Main Admin account</p>
          </div>
        </div>
        <button 
          onClick={handleLogout} 
          className="h-10 px-6 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-sm flex items-center justify-center gap-2 shrink-0"
        >
          <LogOut size={16} /> Log Out Now
        </button>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[450px] shadow-2xl border border-slate-200 dark:border-white/10 p-6 flex flex-col gap-4">
            <h2 className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">Confirm Changes</h2>
            <p className="m-0 font-inter text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to save changes to your {confirmModal.section} settings?
            </p>
            <div className="bg-slate-50 dark:bg-[#161922] p-4 rounded-xl border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="block font-semibold mb-1 text-slate-800 dark:text-white">What happens next:</strong>
              {confirmModal.section === 'Account' && "Your admin profile details such as name and email address will be updated across the system."}
              {confirmModal.section === 'Organization' && "The church's official name, address, and contact details will be updated globally."}
              {confirmModal.section === 'Security' && "Your password will be updated immediately. Please make sure to remember your new password for your next login."}
              {confirmModal.section === 'Payment' && (
                settings.approvalMethod === 'manual' 
                  ? "Switching to Manual Approval will require users to upload proof of payment for their transactions. Administrators will need to manually review and approve pending transactions from the dashboard."
                  : "Switching to Automated Gateway Approval will redirect users to PayMongo to securely process their payments. Transactions will be automatically confirmed without requiring manual review."
              )}
            </div>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button 
                onClick={() => setConfirmModal({ show: false, section: null })} 
                className="h-10 px-5 rounded-xl font-inter text-sm font-semibold transition-all border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  handleSave(confirmModal.section);
                  setConfirmModal({ show: false, section: null });
                }} 
                className="h-10 px-5 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Mode Confirmation Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fadeIn font-inter">
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[460px] shadow-2xl border border-slate-200 dark:border-white/10 p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                pendingMaintenanceState 
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' 
                  : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
              }`}>
                <AlertTriangle size={24} />
              </div>
              <div className="flex flex-col">
                <h3 className="m-0 text-base font-bold text-slate-800 dark:text-white">
                  {pendingMaintenanceState ? 'Enable Maintenance Mode?' : 'Disable Maintenance Mode?'}
                </h3>
                <p className="m-0 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {pendingMaintenanceState ? 'Restrict regular member portal access' : 'Restore full regular member portal access'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#151821] p-4 rounded-xl border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="block font-semibold mb-1 text-slate-800 dark:text-white">Impact on system users:</strong>
              {pendingMaintenanceState
                ? 'Enabling Maintenance Mode will immediately restrict regular members. Regular users will see a full-screen maintenance overlay and cannot log in. Administrative accounts will bypass this restriction.'
                : 'Disabling Maintenance Mode will immediately restore normal login functionality and remove the maintenance overlay for regular members.'}
            </div>

            <div className="flex items-center justify-end gap-3 mt-1">
              <button
                type="button"
                onClick={() => setShowMaintenanceModal(false)}
                className="h-10 px-5 rounded-xl font-inter text-xs font-semibold transition-all border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMaintenanceToggle}
                className={`h-10 px-5 rounded-xl font-inter text-xs font-bold text-white transition-all shadow-md cursor-pointer border-none ${
                  pendingMaintenanceState ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {pendingMaintenanceState ? 'Yes, Enable Maintenance' : 'Yes, Disable Maintenance'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
