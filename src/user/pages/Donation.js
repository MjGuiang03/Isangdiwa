import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '../../context/AuthContext';
import { Banknote, CalendarDays, ChevronDown, Download, Heart, Receipt, Share2, X, UploadCloud, FileCheck2, ZoomIn, AlertCircle, CheckCircle2, ShieldCheck, Edit3, Clock } from 'lucide-react';
import useSwipeToClose, { DragHandle } from '../hooks/useSwipeToClose';

import { branchData, REGION_ORDER } from '../components/branchData';
import ewalletLogo from '../../assets/gcashlogo.png';
import bank from '../../assets/bank.png';
import iconGeneral from '../../assets/icon_general.png';
import iconChildren from '../../assets/icon_children.png';
import iconBuilding from '../../assets/icon_building.png';
import iconYouth from '../../assets/icon_youth.png';
import iconMission from '../../assets/icon_mission.png';


import API from '../../utils/api';

const fmt = (n) =>
  n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0 })}` : '₱0';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const QUICK_AMOUNTS = [25, 50, 100, 250];

const CATEGORIES = [
  { name: 'General Fund', description: 'Church operations and ministry', icon: <img src={iconGeneral} alt="General Fund" className="user-3d-cat-icon" /> },
  { name: 'Children\'s Department', description: "Children's programs and activities", icon: <img src={iconChildren} alt="Children's Department" className="user-3d-cat-icon" /> },
  { name: 'Men\'s Department', description: 'Men\'s programs and activities', icon: <img src={iconBuilding} alt="Men's Department" className="user-3d-cat-icon" /> },
  { name: 'Women\'s Department', description: 'Women\'s programs and activities', icon: <img src={iconGeneral} alt="Women's Department" className="user-3d-cat-icon" /> },
  { name: 'Youth Department', description: 'Youth programs and events', icon: <img src={iconYouth} alt="Youth Department" className="user-3d-cat-icon" /> },
  { name: 'Mission Fund', description: 'Missionary work and outreach programs', icon: <img src={iconMission} alt="Mission Fund" className="user-3d-cat-icon" /> },
];



/* ── Payment method icons ── */
const EWalletIcon = () => (
  <img
    src={ewalletLogo}
    alt="E-Wallet"
    className="w-5 h-5 object-contain shrink-0"
  />
);

const BankIcon = () => (
  <img
    src={bank}
    alt="Bank Transfer"
    className="w-5 h-5 object-contain shrink-0 brightness-0 invert opacity-90 dark:invert-0"
  />
);

export default function Donation() {
  const { user } = useAuth();
  const [donationAmount, setDonationAmount] = useState('');
  const [donationCategory, setDonationCategory] = useState('');
  const [donationCommunity, setDonationCommunity] = useState(user?.branch || '');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [subMethod, setSubMethod] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [isRecurring] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [stats, setStats] = useState({ totalDonated: 0, thisYearTotal: 0, totalCount: 0 });
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [historyPage] = useState(1);
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [recentDonations, setRecentDonations] = useState([]);
  const [approvalMethod, setApprovalMethod] = useState('gateway');
  const [proofFile, setProofFile] = useState(null);
  const [proofBase64, setProofBase64] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [touched, setTouched] = useState({});

  const handleBlur = (field) => setTouched(prev => ({ ...prev, [field]: true }));

  /* ── History Modal States ── */
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [modalPage, setModalPage] = useState(1);
  const [modalCategory, setModalCategory] = useState('');
  const [modalPaymentMethod, setModalPaymentMethod] = useState('');
  const [modalHistory, setModalHistory] = useState([]);
  const [modalTotalPages, setModalTotalPages] = useState(1);
  const [modalLoading, setModalLoading] = useState(false);
  const MODAL_LIMIT = 5;
  const HISTORY_PER_PAGE = 5;

  const token = localStorage.getItem('token');
  const fetcherSingle = (url, headers = {}) => fetch(url, headers).then(res => res.ok ? res.json() : { success: false });

  const { data: historyData, mutate: mutateHistory } = useSWR(
    token ? `${API}/api/donations/my-donations?page=${historyPage}&limit=${HISTORY_PER_PAGE}` : null,
    url => fetcherSingle(url, { headers: { Authorization: `Bearer ${token}` } }),
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const { data: settingsData } = useSWR(
    `${API}/api/settings/public`,
    url => fetcherSingle(url),
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const mutate = () => mutateHistory();

  useEffect(() => {
    if (!historyData) return;
    if (historyData.success) {
      setStats(historyData.stats || { totalDonated: 0, thisYearTotal: 0, totalCount: 0 });
      setRecentDonations(historyData.donations || []);
    }
    setLoading(false);
  }, [historyData]);

  useEffect(() => {
    if (!settingsData) return;
    if (settingsData.success) {
      setApprovalMethod(settingsData.paymentApprovalMethod || 'gateway');
    }
  }, [settingsData]);

  const modalUrl = isHistoryModalOpen 
    ? `${API}/api/donations/my-donations?page=${modalPage}&limit=${MODAL_LIMIT}${modalCategory ? `&category=${modalCategory}` : ''}${modalPaymentMethod ? `&paymentMethod=${modalPaymentMethod}` : ''}`
    : null;

  const modalFetcher = url => fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json());

  const { data: modalData, isValidating: isModalValidating } = useSWR(modalUrl, modalFetcher, { revalidateOnFocus: false });

  useEffect(() => {
    if (!modalData) return;
    setModalLoading(isModalValidating && !modalData);
    if (modalData && modalData.success) {
      setModalHistory(modalData.donations || []);
      setModalTotalPages(modalData.totalPages || 1);
    }
    if (modalData) setModalLoading(false);
  }, [modalData, isModalValidating]);

  useEffect(() => {
    if (user?.branch && !donationCommunity) {
      setDonationCommunity(user.branch);
    }
  }, [user, donationCommunity]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type || !file.type.startsWith('image/')) {
        setFormError('Only image files (PNG, JPG, JPEG, WEBP) are allowed as proof of payment.');
        setProofFile(null);
        setProofBase64('');
        e.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFormError('File size exceeds the 5MB limit. Please upload a smaller image.');
        setProofFile(null);
        setProofBase64('');
        e.target.value = '';
        return;
      }
      setFormError('');
      setProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // const historyTotalPages = Math.max(1, Math.ceil(totalCount / HISTORY_PER_PAGE));
  // const paginatedHistory = donationHistory;
  const handleDonate = async () => {
    setFormError('');
    const num = Number(String(donationAmount).replace(/,/g, ''));
    if (!num || num <= 0) { setFormError('Please enter a valid donation amount.'); return; }
    if (!donationCategory) { setFormError('Please select a donation category.'); return; }
    if (!donationCommunity) { setFormError('Please select a community/branch.'); return; }
    if (!paymentMethod) { setFormError('Please select a payment method.'); return; }
    
    if (approvalMethod === 'manual') {
      if (!proofBase64) { setFormError('Please upload your proof of payment.'); return; }
      if (!subMethod) { setFormError(`Please select a ${paymentMethod} option.`); return; }
      if (!accountName.trim()) { setFormError('Please enter the account name.'); return; }
      if (accountNumber.trim().length !== 11) { setFormError('Sender Account Number must be exactly 11 digits.'); return; }
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/donations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: num, category: donationCategory, community: donationCommunity, paymentMethod, subMethod, accountName, accountNumber, isRecurring, proofOfPayment: proofBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to record donation');
      
      setIsConfirmModalOpen(false);
      if (approvalMethod === 'manual') {
        setSuccessData({ amount: num, category: donationCategory });
        setDonationAmount('');
        setDonationCategory('');
        setDonationCommunity('');
        setPaymentMethod('');
        setSubMethod('');
        setAccountName('');
        setAccountNumber('');
        setProofFile(null);
        setProofBase64('');
        setTouched({});
        mutate(); // Refresh the data via SWR
        setSubmitting(false);
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setFormError('Failed to generate payment link.');
        setSubmitting(false);
      }
    } catch (err) {
      setFormError(err.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    } 
  };

  const handleOpenHistory = () => {
    setModalPage(1);
    setModalCategory('');
    setModalPaymentMethod('');
    setIsHistoryModalOpen(true);
  };

  const handleOpenReceipt = (donation) => {
    setSelectedDonation(donation);
    setIsReceiptModalOpen(true);
  };

  const currentNum = Number(String(donationAmount).replace(/,/g, ''));
  
  /* ── Derived Live Validation Errors ── */
  const amountError = touched.amount
    ? !donationAmount || currentNum <= 0
      ? 'Please enter a valid donation amount.'
      : currentNum > 500000
      ? 'Maximum donation limit per transaction is ₱500,000.'
      : ''
    : '';

  const categoryError = touched.category && !donationCategory ? 'Please select a donation category.' : '';
  const communityError = touched.community && !donationCommunity ? 'Please select a community.' : '';
  const subMethodError = touched.subMethod && approvalMethod === 'manual' && paymentMethod && !subMethod ? `Please select a ${paymentMethod} option.` : '';
  
  const accountNameError = touched.accountName && approvalMethod === 'manual' && paymentMethod
    ? !accountName.trim()
      ? 'Sender account name is required.'
      : accountName.trim().length < 2
      ? 'Account name must be at least 2 characters.'
      : ''
    : '';

  const accountNumberError = touched.accountNumber && approvalMethod === 'manual' && paymentMethod
    ? !accountNumber
      ? 'Sender account number is required.'
      : !accountNumber.startsWith('09')
      ? 'Account number must start with 09 (e.g. 09123456789).'
      : accountNumber.length !== 11
      ? `Account number must be exactly 11 digits (${accountNumber.length}/11).`
      : ''
    : '';

  const isAccountNumValid = accountNumber.trim().length === 11 && accountNumber.startsWith('09');

  const isFormComplete = 
    currentNum > 0 &&
    currentNum <= 500000 &&
    donationCategory !== '' &&
    donationCommunity !== '' &&
    paymentMethod !== '' &&
    (approvalMethod !== 'manual' || (
      proofBase64 !== '' &&
      subMethod !== '' &&
      accountName.trim().length >= 2 &&
      isAccountNumValid
    ));

  return (
    <>
      <div className="space-y-4 w-full pb-8 font-inter">

        {loading ? (
          <div className="space-y-4 w-full pb-8 animate-pulse font-inter">
            {/* Page Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-white/10">
              <div className="space-y-2">
                <div className="h-3 w-36 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
                <div className="h-7 w-40 bg-slate-200 dark:bg-slate-700/80 rounded-lg" />
                <div className="h-3.5 w-64 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
              </div>
              <div className="h-10 w-36 bg-slate-200 dark:bg-slate-700/80 rounded-xl shrink-0" />
            </div>

            {/* 3 Stat Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/80 rounded" />
                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700/80 shrink-0" />
                  </div>
                  <div className="h-7 w-28 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
                  <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700/80 rounded" />
                </div>
              ))}
            </div>

            {/* Main Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-1">
              {/* Form Skeleton */}
              <div className="lg:col-span-7 p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm space-y-5">
                <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700/80 rounded pb-3 border-b border-slate-100 dark:border-white/5" />
                <div className="space-y-4">
                  <div className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                  <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                  <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                  <div className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                  <div className="h-11 bg-slate-200 dark:bg-slate-700/80 rounded-xl" />
                </div>
              </div>

              {/* Categories Skeleton */}
              <div className="lg:col-span-5 p-5 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm space-y-4">
                <div className="h-4 w-44 bg-slate-200 dark:bg-slate-700/80 rounded pb-3 border-b border-slate-100 dark:border-white/5" />
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <div key={j} className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-white/10">
              <div>
                <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-inter mb-0.5">Community Giving &amp; Impact</p>
                <h1 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 dark:text-white font-dm leading-none tracking-tight">Donations</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-inter mt-1">Support church ministries, causes &amp; track your contributions</p>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button 
                  className="h-10 px-4 rounded-xl bg-white dark:bg-[#1E2130] border border-slate-200/90 dark:border-white/10 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 text-xs font-bold font-inter flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  onClick={handleOpenHistory}
                >
                  <Receipt size={16} className="text-blue-600 dark:text-blue-400" />
                  <span>Donation History</span>
                </button>
              </div>
            </div>

            {/* Stats Grid matching Loans & Savings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total Donated */}
              <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col gap-1 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-inter">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Total Donated</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100/60 dark:border-blue-900/30 shrink-0 group-hover:scale-105 transition-transform">
                    <Banknote size={16} />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-none">
                  {fmt(stats.totalDonated)}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-inter mt-0.5">
                  Lifetime contributions
                </p>
              </div>

              {/* This Year */}
              <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col gap-1 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-inter">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">This Year</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100/60 dark:border-emerald-900/30 shrink-0 group-hover:scale-105 transition-transform">
                    <CalendarDays size={16} />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-none">
                  {fmt(stats.thisYearTotal)}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-inter mt-0.5">
                  Current year total
                </p>
              </div>

              {/* Total Contributions */}
              <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-none flex flex-col gap-1 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-inter">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-inter">Total Contributions</span>
                  <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100/60 dark:border-rose-900/30 shrink-0 group-hover:scale-105 transition-transform">
                    <Heart size={16} />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold font-dm text-slate-900 dark:text-white tracking-tight leading-none">
                  {stats.totalCount}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-inter mt-0.5">
                  {stats.totalCount > 0 ? `${stats.totalCount} donation record(s)` : 'No donations recorded'}
                </p>
              </div>
            </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-1">

          {/* Left: Make a Donation Card */}
          <div className="lg:col-span-7 p-5 sm:p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-md shadow-slate-200/50 dark:shadow-none font-inter space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Make a Donation</h2>
            </div>
            <div className="space-y-5 text-left">

              {/* Amount */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Donation Amount <span className="text-red-500">*</span></label>
                  {touched.amount && !amountError && currentNum > 0 && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={13} /> Valid amount
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">₱</span>
                  <input
                    type="text"
                    className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-base font-bold text-slate-900 dark:text-white outline-none transition-all placeholder-slate-400 font-dm ${
                      amountError 
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' 
                        : touched.amount && currentNum > 0 
                        ? 'border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20' 
                        : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                    }`}
                    placeholder="Enter amount"
                    value={donationAmount}
                    onBlur={() => handleBlur('amount')}
                    onChange={(e) => {
                      let raw = e.target.value.replace(/\D/g, '');
                      if (raw) {
                        let val = parseInt(raw, 10);
                        if (val > 500000) val = 500000;
                        setDonationAmount(val.toLocaleString('en-US'));
                      } else {
                        setDonationAmount('');
                      }
                      setFormError('');
                      setTouched(prev => ({ ...prev, amount: true }));
                    }}
                    disabled={submitting}
                  />
                </div>
                {amountError && (
                  <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 mt-1">
                    <AlertCircle size={13} /> {amountError}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUICK_AMOUNTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-inter transition-all cursor-pointer border-none ${
                        Number(String(donationAmount).replace(/,/g, '')) === q
                          ? 'bg-[#1E3A8A] text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                      onClick={() => { 
                        setDonationAmount(q.toLocaleString('en-US')); 
                        setFormError(''); 
                        setTouched(prev => ({ ...prev, amount: true }));
                      }}
                      disabled={submitting}
                    >
                      ₱{q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Donation Category <span className="text-red-500">*</span></label>
                  {touched.category && donationCategory && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={13} /> Selected
                    </span>
                  )}
                </div>
                <div className="relative">
                  <select
                    className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-xs text-slate-900 dark:text-white outline-none appearance-none pr-10 ${
                      categoryError 
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' 
                        : touched.category && donationCategory 
                        ? 'border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20' 
                        : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                    }`}
                    value={donationCategory}
                    onBlur={() => handleBlur('category')}
                    onChange={(e) => { 
                      setDonationCategory(e.target.value); 
                      setFormError(''); 
                      setTouched(prev => ({ ...prev, category: true }));
                    }}
                    disabled={submitting}
                  >
                    <option value="" disabled>Select a category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
                {categoryError && (
                  <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 mt-1">
                    <AlertCircle size={13} /> {categoryError}
                  </p>
                )}
              </div>

              {/* Community */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Community <span className="text-red-500">*</span></label>
                  {touched.community && donationCommunity && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={13} /> Selected
                    </span>
                  )}
                </div>
                <div className="relative">
                  <select
                    className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-xs text-slate-900 dark:text-white outline-none appearance-none pr-10 ${
                      communityError 
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' 
                        : touched.community && donationCommunity 
                        ? 'border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20' 
                        : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                    }`}
                    value={donationCommunity}
                    onBlur={() => handleBlur('community')}
                    onChange={(e) => { 
                      setDonationCommunity(e.target.value); 
                      setFormError(''); 
                      setTouched(prev => ({ ...prev, community: true }));
                    }}
                    disabled={submitting}
                  >
                    <option value="" disabled>Select a community</option>
                    {REGION_ORDER.map(regionKey => {
                      const regionBranches = branchData.filter(b => b.region === regionKey);
                      if (regionBranches.length === 0) return null;
                      
                      const provinces = [...new Set(regionBranches.map(b => b.province))];
                      
                      return provinces.map(province => {
                        const provinceBranches = regionBranches.filter(b => b.province === province);
                        return (
                          <optgroup key={`${regionKey}-${province}`} label={`${regionKey === 'NCR' ? 'NCR' : regionKey + ' – ' + province}`}>
                            {provinceBranches.map(b => (
                              <option key={b.name} value={b.name}>{b.name}</option>
                            ))}
                          </optgroup>
                        );
                      });
                    })}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
                {communityError && (
                  <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 mt-1">
                    <AlertCircle size={13} /> {communityError}
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'E-Wallet' 
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                    onClick={() => setPaymentMethod(paymentMethod === 'E-Wallet' ? '' : 'E-Wallet')}
                    disabled={submitting}
                  >
                    <EWalletIcon />
                    <span>E-Wallet</span>
                  </button>
                  <button
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'Bank' 
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                    onClick={() => setPaymentMethod(paymentMethod === 'Bank' ? '' : 'Bank')}
                    disabled={submitting}
                  >
                    <BankIcon />
                    <span>Bank Transfer</span>
                  </button>
                </div>
                {paymentMethod && (
                  <div className="pt-2 space-y-3">
                    {approvalMethod === 'manual' ? (
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/10 rounded-xl space-y-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Please transfer your donation to our <strong className="font-bold text-slate-900 dark:text-white">{paymentMethod}</strong> account and upload the receipt below.
                        </p>

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{paymentMethod} Option <span className="text-red-500">*</span></label>
                            {paymentMethod === 'E-Wallet' ? (
                              <select 
                                className={`w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs text-slate-900 dark:text-white outline-none transition-all ${
                                  subMethodError ? 'border-red-500' : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                                }`} 
                                value={subMethod} 
                                onBlur={() => handleBlur('subMethod')}
                                onChange={(e) => {
                                  setSubMethod(e.target.value);
                                  setTouched(prev => ({ ...prev, subMethod: true }));
                                }}
                              >
                                <option value="">Select E-Wallet</option>
                                <option value="GCash">GCash</option>
                                <option value="Maya">Maya</option>
                              </select>
                            ) : (
                              <select 
                                className={`w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs text-slate-900 dark:text-white outline-none transition-all ${
                                  subMethodError ? 'border-red-500' : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                                }`} 
                                value={subMethod} 
                                onBlur={() => handleBlur('subMethod')}
                                onChange={(e) => {
                                  setSubMethod(e.target.value);
                                  setTouched(prev => ({ ...prev, subMethod: true }));
                                }}
                              >
                                <option value="">Select Bank</option>
                                <optgroup label="Card Payments">
                                  <option value="Master Card">Master Card</option>
                                  <option value="Visa">Visa</option>
                                </optgroup>
                                <optgroup label="Online Bank">
                                  <option value="BPI">BPI</option>
                                  <option value="BDO">BDO</option>
                                  <option value="PNB">PNB</option>
                                  <option value="Metrobank">Metrobank</option>
                                  <option value="Unionbank">Unionbank</option>
                                  <option value="Instapay">Instapay</option>
                                  <option value="RCBC">RCBC</option>
                                </optgroup>
                              </select>
                            )}
                            {subMethodError && (
                              <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 mt-0.5">
                                <AlertCircle size={12} /> {subMethodError}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Sender Account Name <span className="text-red-500">*</span></label>
                              {touched.accountName && accountName.trim().length >= 2 && !accountNameError && (
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 size={12} /> Valid
                                </span>
                              )}
                            </div>
                            <input 
                              type="text" 
                              className={`w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs text-slate-900 dark:text-white outline-none transition-all ${
                                accountNameError 
                                  ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' 
                                  : touched.accountName && accountName.trim().length >= 2
                                  ? 'border-emerald-500/80' 
                                  : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                              }`} 
                              placeholder="Juan Dela Cruz"
                              value={accountName}
                              onBlur={() => handleBlur('accountName')}
                              onChange={(e) => {
                                setAccountName(e.target.value);
                                setTouched(prev => ({ ...prev, accountName: true }));
                              }}
                            />
                            {accountNameError && (
                              <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 mt-0.5">
                                <AlertCircle size={12} /> {accountNameError}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Sender Account Number <span className="text-red-500">*</span></label>
                              <span className={`text-[11px] font-bold flex items-center gap-1 ${
                                isAccountNumValid 
                                  ? 'text-emerald-600 dark:text-emerald-400' 
                                  : accountNumberError
                                  ? 'text-red-500'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}>
                                {isAccountNumValid && <CheckCircle2 size={12} />}
                                {accountNumber.length}/11 digits
                              </span>
                            </div>
                            <input 
                              type="text" 
                              className={`w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs text-slate-900 dark:text-white outline-none transition-all ${
                                accountNumberError 
                                  ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' 
                                  : isAccountNumValid 
                                  ? 'border-emerald-500/80' 
                                  : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                              }`} 
                              placeholder="09123456789"
                              maxLength={11}
                              value={accountNumber}
                              onBlur={() => handleBlur('accountNumber')}
                              onChange={(e) => {
                                setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 11));
                                setTouched(prev => ({ ...prev, accountNumber: true }));
                              }}
                            />
                            {accountNumberError && (
                              <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 mt-0.5">
                                <AlertCircle size={12} /> {accountNumberError}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {proofFile && proofBase64 ? (
                          <div className="relative p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-xl flex flex-col gap-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 truncate pr-2">
                                <FileCheck2 size={16} className="text-emerald-500 shrink-0" />
                                <span className="truncate">{proofFile.name}</span>
                                {proofFile.size && (
                                  <span className="text-[10px] font-normal text-slate-400 shrink-0">
                                    ({(proofFile.size / 1024 / 1024).toFixed(2)} MB)
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setProofFile(null);
                                  setProofBase64('');
                                }}
                                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center shrink-0"
                                title="Remove file"
                              >
                                <X size={16} />
                              </button>
                            </div>

                            {/* Image Preview Container */}
                            <div 
                              className="relative w-full max-h-52 overflow-hidden rounded-lg border border-slate-200/80 dark:border-white/10 bg-slate-100 dark:bg-black/30 flex items-center justify-center p-2 cursor-pointer group transition-all"
                              onClick={() => setPreviewImage({ src: proofBase64, name: proofFile.name })}
                              title="Click to expand image"
                            >
                              <img
                                src={proofBase64}
                                alt="Proof of Payment Preview"
                                className="max-h-48 max-w-full object-contain rounded-md shadow-xs group-hover:scale-[1.02] transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[2px] rounded-lg">
                                <ZoomIn size={18} /> Click to enlarge
                              </div>
                            </div>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-xl bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all text-center">
                            <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleFileChange} className="hidden" />
                            <div className="flex flex-col items-center gap-1">
                              <UploadCloud className="text-slate-400" size={28} />
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300"><span className="text-blue-600 dark:text-blue-400 hover:underline">Click to upload image</span> or drag and drop</p>
                              <p className="text-[11px] text-slate-400 m-0">PNG, JPG, JPEG, WEBP up to 5MB</p>
                            </div>
                          </label>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                        You will be securely redirected to PayMongo to complete your {paymentMethod} transaction.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {formError && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{formError}</p>}

              <button 
                className="w-full h-11 bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white font-bold font-inter rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs cursor-pointer border-none disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]" 
                onClick={() => {
                  setTouched({
                    amount: true,
                    category: true,
                    community: true,
                    paymentMethod: true,
                    subMethod: true,
                    accountName: true,
                    accountNumber: true
                  });
                  if (isFormComplete) {
                    setIsConfirmModalOpen(true);
                  }
                }} 
                disabled={submitting || !isFormComplete}
              >
                <Heart size={16} />
                <span>Donate Now</span>
              </button>
            </div>
          </div>

          {/* Right Column Container */}
          <div className="lg:col-span-5 space-y-4">
            {/* Where your giving goes Card */}
            <div className="p-5 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-md shadow-slate-200/50 dark:shadow-none space-y-4 font-inter">
              <div className="pb-3 border-b border-slate-100 dark:border-white/10">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Where Your Giving Goes</h2>
              </div>
              <div className="space-y-2.5">
                {CATEGORIES.map((cat) => (
                  <div key={cat.name} className="p-3 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5 rounded-xl flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-all">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      {cat.icon}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{cat.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{cat.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    )}
  </div>


      {/* ── Donation History Modal ── */}
      <DonationHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        modalCategory={modalCategory}
        setModalCategory={setModalCategory}
        modalPaymentMethod={modalPaymentMethod}
        setModalPaymentMethod={setModalPaymentMethod}
        setModalPage={setModalPage}
        modalLoading={modalLoading}
        modalHistory={modalHistory}
        handleOpenReceipt={handleOpenReceipt}
        modalTotalPages={modalTotalPages}
        modalPage={modalPage}
      />

      {/* ── Receipt Modal ── */}
      <DonationReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        selectedDonation={selectedDonation}
        user={user}
        onPreviewImage={(img) => setPreviewImage(img)}
      />

      {/* ── Image Lightbox Modal ── */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-4xl w-full bg-white dark:bg-[#1E2130] rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3 overflow-hidden border border-slate-200 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2 min-w-0 pr-4">
                <FileCheck2 size={18} className="text-emerald-500 shrink-0" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate font-inter">
                  {previewImage.name || 'Receipt Image Preview'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-100 dark:bg-black/40 rounded-xl p-3 border border-slate-200/60 dark:border-white/5">
              <img
                src={previewImage.src}
                alt={previewImage.name || 'Receipt'}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Donation Success Modal ── */}
      {successData && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" 
          onClick={() => setSuccessData(null)}
        >
          <div 
            className="relative max-w-md w-full bg-white dark:bg-[#1E2130] rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center gap-4 border border-slate-200 dark:border-white/10 font-inter animate-in zoom-in-95 duration-200" 
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSuccessData(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
            >
              <X size={18} />
            </button>

            {/* Icon Header */}
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs shrink-0">
              <CheckCircle2 size={36} />
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-inter tracking-tight">
                Donation Submitted!
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Your contribution has been received and is currently pending manual administrator approval.
              </p>
            </div>

            {/* Highlight Box */}
            <div className="p-4 w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 rounded-xl space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Amount Contributed</span>
              <h3 className="text-3xl font-extrabold text-[#1E3A8A] dark:text-blue-400 font-dm">
                {fmt(successData.amount)}
              </h3>
              <div className="pt-1 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-lg shadow-2xs">
                  <Heart size={14} className="fill-blue-600 dark:fill-blue-400 text-blue-600 dark:text-blue-400" />
                  <span>{successData.category}</span>
                </span>
              </div>
            </div>

            {/* Pending Status Highlight Badge */}
            <div className="w-full p-3 bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Current Status</span>
              </div>
              <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 text-[11px] font-extrabold rounded-lg border border-amber-300/70 dark:border-amber-700/50 flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                <span>Pending Approval</span>
              </span>
            </div>

            {/* Information Callout */}
            <div className="p-3 w-full bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30 rounded-xl text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5 text-left">
              <ShieldCheck size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed m-0">
                Our administrators will review your uploaded proof of payment. Thank you for your generous support!
              </p>
            </div>

            {/* Action Button */}
            <button 
              className="w-full py-3 bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2 active:scale-[0.99] mt-1" 
              onClick={() => setSuccessData(null)}
            >
              <span>Done</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Confirmation & Info Review Modal ── */}
      {isConfirmModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => !submitting && setIsConfirmModalOpen(false)}
        >
          <div 
            className="relative max-w-lg w-full bg-white dark:bg-[#1E2130] rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 overflow-hidden border border-slate-200 dark:border-white/10 font-inter"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-inter">Confirm Donation Details</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Please review your contribution info before proceeding</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={submitting}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Summary Box */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {/* Amount Highlight */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50/60 dark:from-blue-950/40 dark:to-slate-800/80 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Contribution</span>
                  <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 font-dm">
                    ₱{currentNum.toLocaleString('en-US')}
                  </div>
                </div>
                <span className="px-3 py-1 bg-[#1E3A8A] text-white text-xs font-bold rounded-lg shadow-xs">
                  {donationCategory}
                </span>
              </div>

              {/* Info Rows */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-white/5 rounded-xl space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/50 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Community / Branch</span>
                  <span className="font-bold text-slate-900 dark:text-white">{donationCommunity}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-200/50 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Payment Channel</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {paymentMethod} {subMethod ? `(${subMethod})` : ''}
                  </span>
                </div>

                {approvalMethod === 'manual' && (
                  <>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Sender Account Name</span>
                      <span className="font-bold text-slate-900 dark:text-white">{accountName}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Sender Account Number</span>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">{accountNumber}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Proof of Payment Thumbnail preview if manual */}
              {approvalMethod === 'manual' && proofBase64 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-white/5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Attached Proof of Payment</span>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <FileCheck2 size={13} /> Attached
                    </span>
                  </div>
                  <div 
                    className="relative w-full max-h-36 overflow-hidden rounded-lg border border-slate-200/80 dark:border-white/10 bg-slate-100 dark:bg-black/30 flex items-center justify-center p-2 cursor-pointer group"
                    onClick={() => setPreviewImage({ src: proofBase64, name: proofFile?.name || 'Receipt' })}
                  >
                    <img src={proofBase64} alt="Receipt" className="max-h-32 object-contain rounded-md" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 backdrop-blur-[1px] rounded-lg">
                      <ZoomIn size={16} /> Enlarge
                    </div>
                  </div>
                </div>
              )}

              {formError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="pt-2 flex items-center gap-3 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={submitting}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer border-none flex items-center justify-center gap-1.5"
              >
                <Edit3 size={14} /> Edit Details
              </button>
              <button
                type="button"
                onClick={handleDonate}
                disabled={submitting}
                className="flex-1 py-2.5 px-4 bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Heart size={14} />
                    <span>Confirm & Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DonationHistoryModal({
  isOpen,
  onClose,
  modalCategory,
  setModalCategory,
  modalPaymentMethod,
  setModalPaymentMethod,
  setModalPage,
  modalLoading,
  modalHistory,
  handleOpenReceipt,
  modalTotalPages,
  modalPage
}) {
  const { modalStyle, touchHandlers } = useSwipeToClose(onClose);
  if (!isOpen) return null;

  return (
    <div className="dim-overlay" onClick={onClose}>
      <div className="dim-modal sm:max-w-xl p-5 sm:p-6 font-inter" style={modalStyle} {...touchHandlers} onClick={e => e.stopPropagation()}>
        <DragHandle />
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
          <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Donation History</h2>
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer border-none bg-transparent" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3 border-b border-slate-100 dark:border-white/10">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Category</label>
            <div className="relative flex items-center">
              <select
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none appearance-none pr-8 cursor-pointer"
                value={modalCategory}
                onChange={(e) => {
                  setModalCategory(e.target.value);
                  setModalPage(1);
                }}
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Payment Method</label>
            <div className="relative flex items-center">
              <select
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none appearance-none pr-8 cursor-pointer"
                value={modalPaymentMethod}
                onChange={(e) => {
                  setModalPaymentMethod(e.target.value);
                  setModalPage(1);
                }}
              >
                <option value="">All Methods</option>
                <option value="E-Wallet">E-Wallet</option>
                <option value="Bank">Bank Transfer</option>
              </select>
              <ChevronDown className="absolute right-2.5 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="py-3 space-y-2">
          {modalLoading ? (
            <p className="text-center text-xs text-slate-400 py-6">Loading history...</p>
          ) : modalHistory.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">No donations found for this filter.</p>
          ) : (
            <div className="space-y-2">
              {modalHistory.map((d) => (
                <div
                  key={d._id || d.donationId}
                  className="flex items-center justify-between p-3 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl border border-slate-200/60 dark:border-white/5 cursor-pointer transition-all"
                  onClick={() => handleOpenReceipt(d)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                      <Receipt size={16} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">{d.category}</h3>
                      <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{d.donationId} · {fmtDate(d.createdAt || d.date)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-extrabold font-dm text-slate-900 dark:text-white">{fmt(d.amount)}</p>
                    <span className={`inline-block px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-full mt-0.5 ${
                      d.status === 'confirmed' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/30' : d.status === 'rejected' ? 'text-red-600 bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900/30' : 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900/30'
                    }`}>
                      {d.status === 'confirmed' ? 'Successful' : d.status === 'rejected' ? 'Failed' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {modalTotalPages > 1 && (
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-white/10 text-xs">
            <button
              className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors text-xs font-bold cursor-pointer border-none"
              onClick={() => setModalPage(p => Math.max(1, p - 1))}
              disabled={modalPage === 1 || modalLoading}
            >‹ Prev</button>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Page {modalPage} of {modalTotalPages}</span>
            <button
              className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors text-xs font-bold cursor-pointer border-none"
              onClick={() => setModalPage(p => Math.min(modalTotalPages, p + 1))}
              disabled={modalPage === modalTotalPages || modalLoading}
            >Next ›</button>
          </div>
        )}
      </div>
    </div>
  );
}

function DonationReceiptModal({ isOpen, onClose, selectedDonation, user, onPreviewImage }) {
  const { modalStyle, touchHandlers } = useSwipeToClose(onClose);
  if (!isOpen || !selectedDonation) return null;

  const proofImg = selectedDonation.proofOfPayment || selectedDonation.proofUrl || selectedDonation.receiptUrl;
  const refNum = selectedDonation.referenceNumber || selectedDonation.donationId || `DON-${selectedDonation._id?.slice(-8) || '0000'}`;

  return (
    <div className="dim-overlay" onClick={onClose}>
      <div 
        className="dim-modal sm:max-w-md p-0 overflow-hidden font-inter bg-white dark:bg-[#1E2130] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[85vh] w-full" 
        style={modalStyle} 
        {...touchHandlers} 
        onClick={e => e.stopPropagation()}
      >
        <DragHandle />
        
        {/* Header */}
        <div className="bg-[#1E3A8A] dark:bg-gradient-to-r dark:from-[#1E3A8A] dark:to-slate-900 p-5 text-white relative shrink-0">
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors border-none bg-transparent cursor-pointer"
            onClick={onClose}
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
              <Receipt size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">Official Donation Receipt</h2>
              <p className="text-[11px] text-blue-200">IsangDiwa Faith Community Record</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Amount Card */}
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 rounded-xl space-y-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Contribution</span>
            <h1 className="text-3xl font-extrabold text-[#1E3A8A] dark:text-blue-400 font-dm">{fmt(selectedDonation.amount)}</h1>
            <div className="pt-1 flex items-center justify-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full ${
                selectedDonation.status === 'confirmed' || selectedDonation.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' 
                  : selectedDonation.status === 'rejected' || selectedDonation.status === 'failed'
                  ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400' 
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
              }`}>
                {selectedDonation.status === 'confirmed' || selectedDonation.status === 'completed' 
                  ? 'Successful' 
                  : selectedDonation.status === 'rejected' || selectedDonation.status === 'failed'
                  ? 'Failed' 
                  : 'Pending Verification'}
              </span>
            </div>
          </div>

          {/* Reference Number Banner */}
          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Reference No.</span>
            <span className="font-mono font-bold text-[#1E3A8A] dark:text-blue-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-900/50">
              {refNum}
            </span>
          </div>

          {/* Details Table */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Donor Name</span>
              <span className="text-slate-900 dark:text-white font-bold">{user?.fullName || selectedDonation.donorName || 'Valued Donor'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Fund Category</span>
              <span className="text-slate-900 dark:text-white font-bold">{selectedDonation.category}</span>
            </div>
            {selectedDonation.community && (
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Community / Branch</span>
                <span className="text-slate-900 dark:text-white font-bold">{selectedDonation.community}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Payment Method</span>
              <span className="text-slate-900 dark:text-white font-bold">
                {selectedDonation.method || selectedDonation.paymentMethod}
                {selectedDonation.subMethod ? ` (${selectedDonation.subMethod})` : ''}
              </span>
            </div>
            {selectedDonation.accountName && (
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Sender Name</span>
                <span className="text-slate-900 dark:text-white font-bold">{selectedDonation.accountName}</span>
              </div>
            )}
            {selectedDonation.accountNumber && (
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Sender Account No.</span>
                <span className="text-slate-900 dark:text-white font-bold font-mono">{selectedDonation.accountNumber}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Date & Time</span>
              <span className="text-slate-900 dark:text-white font-bold">{fmtDate(selectedDonation.createdAt || selectedDonation.date)}</span>
            </div>
          </div>

          {/* Uploaded Receipt Image Attachment */}
          {proofImg && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Proof of Payment</span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <FileCheck2 size={13} /> Uploaded
                </span>
              </div>
              <div 
                className="relative w-full max-h-40 overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-100 dark:bg-black/40 flex items-center justify-center p-2 cursor-pointer group transition-all"
                onClick={() => onPreviewImage && onPreviewImage({ src: proofImg, name: `Proof-${refNum}` })}
                title="Click to view full image"
              >
                <img
                  src={proofImg}
                  alt="Proof of Payment"
                  className="max-h-36 max-w-full object-contain rounded-lg shadow-xs group-hover:scale-[1.02] transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[1px] rounded-xl">
                  <ZoomIn size={16} /> Click to enlarge
                </div>
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5 rounded-xl text-center">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Thank you for your contribution to IsangDiwa. This serves as an official proof of transaction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}