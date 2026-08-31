import { useEffect, useState, useMemo } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import API from '../../utils/api';

import {
  Heart, CalendarDays, PiggyBank, FileText, Award,
  MapPin, Mail, Phone, Clock, Shield,
  Star, Flame, Target, Edit2, XCircle, Camera, CheckCircle2, AlertCircle
} from 'lucide-react';
import VerifyEmailModal from '../components/VerifyEmail';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { isOfficerPosition } from '../../utils/officerPositions';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Profile() {
  const navigate = useNavigate();
  const { profile, user, updateProfile, requestEmailChange, verifyEmailChange } = useAuth();
  const token = localStorage.getItem('token');
  const isOfficer = profile?.position && isOfficerPosition(profile.position);

  /* ── Personal Info State ── */
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);

  const [editForm, setEditForm] = useState({
    fullName: profile?.fullName || '',
    email: user?.email || '',
    phone: profile?.phone || '',
    community: profile?.branch || profile?.community || '',
    photoFile: null,
  });

  const [showEmailOtp, setShowEmailOtp] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [photoToUpload, setPhotoToUpload] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  


  const [dynamicBranches, setDynamicBranches] = useState([]);
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await fetch(`${API}/api/public/branches`);
        const data = await res.json();
        if (data.success) setDynamicBranches(data.branches || []);
      } catch (e) { console.error('Failed to load branches', e); }
    };
    loadBranches();
  }, []);

  const groupedBranches = dynamicBranches.reduce((acc, b) => {
    let province = b.province;
    if (!province && b.address) {
      const parts = b.address.split(', ');
      if (parts.length > 0) province = parts[0];
    }
    province = province || 'Other Provinces';
    if (!acc[province]) acc[province] = [];
    acc[province].push(b.name);
    return acc;
  }, {});
  const provinceOrder = Object.keys(groupedBranches).sort();

  const handleEditChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
    if (formError) setFormError('');
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoToUpload({ file, name: file.name, base64: ev.target.result });
      setShowPhotoModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleConfirmPhotoUpload = async () => {
    if (!photoToUpload?.base64) return;
    setIsUploadingPhoto(true);
    try {
      const token = localStorage.getItem('token');
      const photoRes = await fetch(`${API}/api/upload-photo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ photoBase64: photoToUpload.base64 })
      });
      const photoData = await photoRes.json();
      if (photoRes.ok && photoData.photoUrl) {
        await updateProfile({ photoUrl: photoData.photoUrl });
        setShowPhotoModal(false);
        setPhotoToUpload(null);
      } else {
        setFormError(photoData.message || 'Failed to upload photo');
      }
    } catch (err) {
      console.error('Failed to upload photo:', err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveClick = () => {
    setFormError('');
    if (!editForm.fullName.trim()) { setFormError('Full name is required.'); return; }
    const emailChanged = editForm.email.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase();
    if (emailChanged && (!editForm.email.includes('@') || !editForm.email.includes('.'))) {
      setFormError('Please enter a valid email address.'); return;
    }
    setShowSaveConfirmModal(true);
  };

  const executeSaveChanges = async () => {
    setShowSaveConfirmModal(false);
    setFormError('');
    if (!editForm.fullName.trim()) { setFormError('Full name is required.'); return; }
    setIsSaving(true);
    try {
      const emailChanged = editForm.email.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase();
      if (emailChanged) {
        if (!editForm.email.includes('@') || !editForm.email.includes('.')) {
          setFormError('Please enter a valid email address.'); return;
        }
        const reqResult = await requestEmailChange(editForm.email.trim());
        if (!reqResult.success) { setFormError(reqResult.message || 'Failed to send verification email.'); return; }
        setPendingEmail(editForm.email.trim());
        setShowEmailOtp(true);
        return;
      }
      const result = await updateProfile({
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim(),
        branch: editForm.community,
      });
      if (!result.success) { setFormError(result.message || 'Failed to update profile.'); return; }
      setIsEditing(false);
    } catch (err) {
      setFormError(err.message || 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyEmailOtp = async (otp) => {
    const verifyResult = await verifyEmailChange(pendingEmail, otp);
    if (!verifyResult.success) return { success: false, message: verifyResult.message };
    await updateProfile({ fullName: editForm.fullName.trim(), phone: editForm.phone.trim(), branch: editForm.community });
    setShowEmailOtp(false);
    setIsEditing(false);
    return { success: true };
  };

  const handleResendEmailOtp = async () => await requestEmailChange(pendingEmail);
  const handleCancelEmailOtp = () => { setShowEmailOtp(false); setPendingEmail(''); setIsSaving(false); };

  const handleCancelClick = () => {
    const hasChanges =
      editForm.email.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase() ||
      editForm.phone.trim() !== (profile?.phone || '').trim() ||
      editForm.community !== (profile?.branch || profile?.community || '');

    if (hasChanges) {
      setShowCancelConfirmModal(true);
    } else {
      confirmCancelEdit();
    }
  };

  const confirmCancelEdit = () => {
    setShowCancelConfirmModal(false);
    setEditForm({ fullName: profile?.fullName || '', email: user?.email || '', phone: profile?.phone || '', community: profile?.branch || profile?.community || '', photoFile: null });
    setPhotoPreview(null);
    setFormError('');
    setIsEditing(false);
  };
  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(res => res.ok ? res.json() : { success: false });

  const { data: dData } = useSWR(token ? `${API}/api/donations/my-donations` : null, fetcherSingle, { revalidateOnFocus: false, dedupingInterval: 5000 });
  const { data: attData } = useSWR(token ? `${API}/api/attendance/my-attendance` : null, fetcherSingle, { revalidateOnFocus: false, dedupingInterval: 5000 });
  const { data: loanData } = useSWR(token ? `${API}/api/loans/my-loans` : null, fetcherSingle, { revalidateOnFocus: false, dedupingInterval: 5000 });
  const { data: savData } = useSWR(token ? `${API}/api/savings/stats` : null, fetcherSingle, { revalidateOnFocus: false, dedupingInterval: 5000 });
  const { data: savGoalsData } = useSWR(token ? `${API}/api/savings/goals` : null, fetcherSingle, { revalidateOnFocus: false, dedupingInterval: 5000 });

  const loading = !dData && !attData && !loanData && !savData && !savGoalsData;

  const donations = useMemo(() => dData?.donations?.filter(d => d.status === 'confirmed') || [], [dData]);
  const attendance = useMemo(() => attData?.attendance || [], [attData]);
  const loanStats = useMemo(() => {
    const loans = loanData?.loans || [];
    return {
      completed: loans.filter(l => l.status === 'completed').length,
      active: loans.filter(l => l.status === 'active').length,
      total: loans.length
    };
  }, [loanData]);
  const savingsStats = useMemo(() => {
    const goals = savGoalsData?.success ? (savGoalsData.goals || []) : [];
    return {
      totalSavings: savData?.stats?.totalSavings || 0,
      completedGoals: goals.filter(g => g.status === 'completed').length,
      activeGoals: goals.filter(g => g.status === 'active').length,
    };
  }, [savData, savGoalsData]);
  


  // 12-month donation trend
  const donationTrend = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const monthData = MONTHS_SHORT.slice(0, currentMonth + 1).map((label, i) => ({ label, amount: 0, month: i }));
    donations.forEach(d => {
      const dt = new Date(d.createdAt);
      if (dt.getFullYear() === year && dt.getMonth() <= currentMonth) {
        monthData[dt.getMonth()].amount += Number(d.amount) || 0;
      }
    });
    return monthData;
  }, [donations]);

  const totalDonated = donations.reduce((s, d) => s + (Number(d.amount) || 0), 0);

  // Attendance heatmap data (last 12 months)
  const attendanceByMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const currentMonth = now.getMonth();
    const monthCounts = MONTHS_SHORT.slice(0, currentMonth + 1).map((label, i) => ({ label, count: 0, month: i }));
    attendance.forEach(a => {
      const dt = new Date(a.createdAt);
      if (dt.getFullYear() === year && dt.getMonth() <= currentMonth) {
        monthCounts[dt.getMonth()].count += 1;
      }
    });
    return monthCounts;
  }, [attendance]);

  // Achievements logic
  const achievements = useMemo(() => {
    const list = [];
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Faithful Giver — donated at least 3 different months this year
    const donMonths = new Set();
    donations.forEach(d => {
      const dt = new Date(d.createdAt);
      if (dt.getFullYear() === thisYear) donMonths.add(dt.getMonth());
    });
    if (donMonths.size >= 3) {
      list.push({ icon: <Heart size={18} />, title: 'Faithful Giver', desc: `Donated in ${donMonths.size} months this year`, color: '#E11D48' });
    }

    // Active Attendee — attended 5+ services this year
    const thisYearAtt = attendance.filter(a => new Date(a.createdAt).getFullYear() === thisYear);
    if (thisYearAtt.length >= 5) {
      list.push({ icon: <Flame size={18} />, title: 'Active Attendee', desc: `${thisYearAtt.length} services attended this year`, color: '#F59E0B' });
    }

    // Savings Champion — completed at least 1 goal
    if (savingsStats.completedGoals > 0) {
      list.push({ icon: <Target size={18} />, title: 'Savings Champion', desc: `${savingsStats.completedGoals} goal${savingsStats.completedGoals > 1 ? 's' : ''} completed`, color: '#10B981' });
    }

    // Community Pillar — is an officer
    if (isOfficer) {
      list.push({ icon: <Shield size={18} />, title: 'Community Pillar', desc: `Officer: ${profile?.position}`, color: '#2563EB' });
    }

    // This Month Donor
    const thisMonthDonations = donations.filter(d => {
      const dt = new Date(d.createdAt);
      return dt.getMonth() === thisMonth && dt.getFullYear() === thisYear;
    });
    if (thisMonthDonations.length > 0) {
      list.push({ icon: <Star size={18} />, title: 'Monthly Contributor', desc: `${thisMonthDonations.length} donation${thisMonthDonations.length > 1 ? 's' : ''} this month`, color: '#8B5CF6' });
    }

    return list;
  }, [donations, attendance, savingsStats.completedGoals, isOfficer, profile?.position]);

  const fmt = (val) => `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const displayName = profile?.fullName || 'Member';
  const avatarSrc = photoPreview || profile?.photoUrl || null;
  const memberSince = user?.created_at || user?.createdAt
    ? new Date(user.created_at || user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  if (loading) {
    return (
      <div className="space-y-6 w-full pb-8 animate-pulse font-inter">
        {/* Header Skeleton */}
        <div className="pb-2.5 border-b border-slate-200/80 dark:border-white/10 space-y-2">
          <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
          <div className="h-7 w-40 bg-slate-200 dark:bg-slate-700/80 rounded-lg" />
          <div className="h-3.5 w-72 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
        </div>

        {/* Identity Banner Skeleton */}
        <div className="h-36 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 rounded-3xl p-6 flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-7 w-48 bg-slate-300 dark:bg-slate-600 rounded-lg" />
            <div className="h-4 w-64 bg-slate-300 dark:bg-slate-600 rounded-md" />
          </div>
        </div>

        {/* Account Details Skeleton */}
        <div className="p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl space-y-4">
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700/80 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />)}
          </div>
        </div>

        {/* 4 Stat Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4" />)}
        </div>

        {/* Analytics Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-6" />
          <div className="h-64 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-8 font-inter">
      {showEmailOtp && (
        <VerifyEmailModal
          isOpen={showEmailOtp}
          onClose={handleCancelEmailOtp}
          email={pendingEmail}
          onVerify={handleVerifyEmailOtp}
          onResend={handleResendEmailOtp}
        />
      )}

      {/* ── Save Confirmation Modal ── */}
      {showSaveConfirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-inter">Save Profile Changes?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-inter mt-0.5">Are you sure you want to update your profile details?</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSaveConfirmModal(false)}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border-none"
              >
                Cancel
              </button>
              <button
                onClick={executeSaveChanges}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer border-none shadow-sm"
              >
                {isSaving ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel / Discard Confirmation Modal ── */}
      {showCancelConfirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-inter">Discard Unsaved Changes?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-inter mt-0.5">You have modified your profile details. Are you sure you want to discard these edits?</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCancelConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border-none"
              >
                Keep Editing
              </button>
              <button
                onClick={confirmCancelEdit}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer border-none shadow-sm"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Separate Dedicated Upload Photo Modal ── */}
      {showPhotoModal && photoToUpload && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-inter">Update Profile Photo</h3>
              <button
                onClick={() => { setShowPhotoModal(false); setPhotoToUpload(null); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-none bg-transparent cursor-pointer p-1"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Circular Image Preview */}
            <div className="flex flex-col items-center justify-center space-y-3 py-2">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-blue-500/20 shadow-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <img src={photoToUpload.base64} alt="Preview" className="w-full h-full object-cover" />
              </div>
              {photoToUpload.name && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full text-[11px] font-semibold max-w-[260px] truncate border border-slate-200/60 dark:border-white/10" title={photoToUpload.name}>
                  <FileText size={13} className="text-blue-500 shrink-0" />
                  <span className="truncate">{photoToUpload.name}</span>
                </span>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 font-inter px-2">
                Are you sure you want to set this image as your new profile photo?
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
              <button
                onClick={() => { setShowPhotoModal(false); setPhotoToUpload(null); }}
                disabled={isUploadingPhoto}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border-none"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPhotoUpload}
                disabled={isUploadingPhoto}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer border-none shadow-sm flex items-center gap-1.5"
              >
                {isUploadingPhoto ? (
                  <span>Uploading...</span>
                ) : (
                  <>
                    <Camera size={14} />
                    <span>Upload &amp; Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header (Matching Portal Standards) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-white/10 font-inter">
        <div>
          <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-inter mb-0.5">Account &amp; Personal Info</p>
          <h1 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 dark:text-white font-dm leading-none tracking-tight">My Profile</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-inter mt-1">Manage your identity, personal details, achievements &amp; engagement activity</p>
        </div>
      </div>

      {/* ── 1. MOST IMPORTANT: Profile Identity Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0D1F45] via-[#162B5B] to-[#1E3A8A] text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-white/10">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Avatar - Clickable for Photo Upload */}
            <div 
              className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-full overflow-hidden bg-white/10 border-4 border-white/20 shadow-xl flex items-center justify-center shrink-0 text-white font-bold font-dm text-2xl group cursor-pointer" 
              onClick={() => document.getElementById('up-hero-photo-input').click()} 
              title="Click to upload profile photo"
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="tracking-wider">
                  {displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-black/60 group-hover:bg-black/80 py-1 flex items-center justify-center text-white transition-colors cursor-pointer border-none" title="Upload profile photo">
                <Camera size={14} />
              </div>
              <input id="up-hero-photo-input" type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            </div>

            {/* Name & Quick Metadata */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h2 className="font-inter text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">{displayName}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-xs ${isOfficer ? 'bg-[#F5C800] text-slate-950' : 'bg-white/20 text-white backdrop-blur-xs'}`}>
                  <Shield size={12} />
                  {isOfficer ? `Officer · ${profile?.position}` : 'Member'}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-white/80 font-inter">
                {profile?.branch && (
                  <span className="flex items-center gap-1 font-medium">
                    <MapPin size={13} className="text-[#F5C800]" /> {profile.branch}
                  </span>
                )}
                {memberSince && (
                  <span className="flex items-center gap-1 font-medium">
                    <Clock size={13} className="text-emerald-400" /> Member since {memberSince}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. CORE PERSONAL & ACCOUNT DETAILS (Top Priority Info) ── */}
      <div className="p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">
              Personal &amp; Account Details
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your core membership contact and community profile</p>
          </div>
          {!isEditing && (
            <button 
              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border-none shrink-0 whitespace-nowrap" 
              onClick={() => setIsEditing(true)}
            >
              <Edit2 size={13} className="shrink-0" />
              <span className="hidden sm:inline">Edit Information</span>
              <span className="inline sm:hidden">Edit</span>
            </button>
          )}
        </div>
        
        {formError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-900/40 rounded-xl p-3 mb-4">
            <XCircle size={16} className="text-red-500 shrink-0" />
            <span className="text-xs text-red-700 dark:text-red-300 font-medium">{formError}</span>
          </div>
        )}

        {isEditing ? (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Full Name</label>
                <input type="text" className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none opacity-60 cursor-not-allowed font-medium" value={editForm.fullName} disabled={true} />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Email Address</label>
                <input type="email" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all font-medium" value={editForm.email} onChange={e => handleEditChange('email', e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Phone Number</label>
                <input type="tel" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all font-medium" value={editForm.phone} onChange={e => handleEditChange('phone', e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Community Branch</label>
                <select className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all font-medium" value={editForm.community} onChange={e => handleEditChange('community', e.target.value)}>
                  <option value="">— Select Community —</option>
                  {provinceOrder.map(prov => (
                    <optgroup key={prov} label={prov}>
                      {groupedBranches[prov].map(p => <option key={p}>{p}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <button onClick={handleCancelClick} disabled={isSaving} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs border-none cursor-pointer hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={handleSaveClick} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs border-none cursor-pointer hover:bg-blue-700 transition-colors">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Mail size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Email Address</span>
                <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">{user?.email || '—'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Phone size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Phone Number</span>
                <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">{profile?.phone || 'Not set'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400">
              <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <MapPin size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Community Branch</span>
                <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">{profile?.branch || 'Not assigned'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400">
              <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <CalendarDays size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Birthday</span>
                <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                  {profile?.birthday || profile?.dateOfBirth
                    ? new Date(profile.birthday || profile.dateOfBirth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : 'Not set'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. KEY MEMBERSHIP & FINANCIAL STATS SUMMARY ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs flex items-center gap-3.5 cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-white/20 transition-all group" onClick={() => navigate('/donation')}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 group-hover:scale-105 transition-transform"><Heart size={18} /></div>
          <div className="min-w-0 flex-1">
            <span className="block text-lg font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-tight">{loading ? '—' : fmt(totalDonated)}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 font-medium">Total Donated</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs flex items-center gap-3.5 cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-white/20 transition-all group" onClick={() => navigate('/attendance')}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform"><CalendarDays size={18} /></div>
          <div className="min-w-0 flex-1">
            <span className="block text-lg font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-tight">{loading ? '—' : attendance.length}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 font-medium">Services Attended</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs flex items-center gap-3.5 cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-white/20 transition-all group" onClick={() => navigate('/savings')}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform"><PiggyBank size={18} /></div>
          <div className="min-w-0 flex-1">
            <span className="block text-lg font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-tight">{loading ? '—' : fmt(savingsStats.totalSavings)}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 font-medium">Total Savings</span>
          </div>
        </div>

        {isOfficer ? (
          <div className="p-4 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs flex items-center gap-3.5 cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-white/20 transition-all group" onClick={() => navigate('/loans')}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform"><FileText size={18} /></div>
            <div className="min-w-0 flex-1">
              <span className="block text-lg font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-tight">{loading ? '—' : loanStats.completed}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 font-medium">Loans Completed</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── 4. ACHIEVEMENTS & ANALYTICS GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-6">

        {/* Column 1: Achievements & Badges */}
        <div className="p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">
              Achievements &amp; Badges
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-inter">{achievements.length} Earned</span>
          </div>

          {achievements.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-2 text-xs font-inter bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
              <Award size={28} strokeWidth={1.5} className="mx-auto opacity-40 text-amber-500" />
              <p>Keep participating in church activities to unlock badges!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {achievements.map((a, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 shadow-xs text-blue-600 dark:text-blue-400">{a.icon}</div>
                  <div className="space-y-0.5 min-w-0">
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">{a.title}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">{a.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Financial & Activity Analytics */}
        <div className="space-y-6">

          {/* Giving Trend Chart */}
          <div className="p-4 sm:p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">
                Giving Trend
              </h2>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 font-inter">{new Date().getFullYear()}</span>
            </div>
            <div className="pt-1 -ml-2 -mr-2">
              {loading ? (
                <div className="h-[210px] w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={donationTrend} margin={{ top: 10, right: 5, bottom: 0, left: -22 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000000 ? `₱${(v / 1000000).toFixed(1).replace(/\.0$/, '')}M` : v > 0 ? `₱${(v / 1000).toFixed(0)}k` : '0'} />
                    <Tooltip
                      formatter={(v) => [fmt(v), 'Donated']}
                      contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="amount" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Attendance Overview Chart */}
          <div className="p-4 sm:p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">
                Attendance Overview
              </h2>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 font-inter">{attendance.length} total</span>
            </div>
            <div className="pt-1 -ml-2 -mr-2">
              {loading ? (
                <div className="h-[210px] w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={attendanceByMonth} margin={{ top: 10, right: 5, bottom: 0, left: -30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v) => [`${v} service${v !== 1 ? 's' : ''}`, 'Attended']}
                      contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="#0D9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
