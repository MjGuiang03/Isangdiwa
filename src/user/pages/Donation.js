import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from '../../context/AuthContext';
import { Banknote, CalendarDays, ChevronDown, Download, Heart, Receipt, Share2, X, UploadCloud, FileCheck2 } from 'lucide-react';
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
  const [successData, setSuccessData] = useState(null);

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
  const isFormComplete = 
    currentNum > 0 &&
    donationCategory !== '' &&
    donationCommunity !== '' &&
    paymentMethod !== '' &&
    (approvalMethod !== 'manual' || (
      proofBase64 !== '' &&
      subMethod !== '' &&
      accountName.trim() !== '' &&
      accountNumber.trim().length === 11
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Donation Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">₱</span>
                  <input
                    type="text"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 rounded-xl text-base font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder-slate-400 font-dm"
                    placeholder="Enter amount"
                    value={donationAmount}
                    onChange={(e) => {
                      let raw = e.target.value.replace(/[^0-9.]/g, '');
                      let val = parseFloat(raw) || 0;
                      if (val > 500000) raw = '500000';
                      
                      const parts = raw.split('.');
                      if (parts[0]) {
                        parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
                      }
                      setDonationAmount(parts.join('.'));
                      setFormError('');
                    }}
                    disabled={submitting}
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUICK_AMOUNTS.map((q) => (
                    <button
                      key={q}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-inter transition-all cursor-pointer border-none ${
                        Number(String(donationAmount).replace(/,/g, '')) === q
                          ? 'bg-[#1E3A8A] text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                      onClick={() => { setDonationAmount(q.toLocaleString('en-US')); setFormError(''); }}
                      disabled={submitting}
                    >
                      ₱{q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Donation Category</label>
                <div className="relative">
                  <select
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 appearance-none pr-10"
                    value={donationCategory}
                    onChange={(e) => { setDonationCategory(e.target.value); setFormError(''); }}
                    disabled={submitting}
                  >
                    <option value="" disabled>Select a category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>

              {/* Community */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Community <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 appearance-none pr-10"
                    value={donationCommunity}
                    onChange={(e) => { setDonationCommunity(e.target.value); setFormError(''); }}
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
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{paymentMethod} Option</label>
                            {paymentMethod === 'E-Wallet' ? (
                              <select className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none" value={subMethod} onChange={(e) => setSubMethod(e.target.value)}>
                                <option value="">Select E-Wallet</option>
                                <option value="GCash">GCash</option>
                                <option value="Maya">Maya</option>
                              </select>
                            ) : (
                              <select className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none" value={subMethod} onChange={(e) => setSubMethod(e.target.value)}>
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
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Sender Account Name <span className="text-red-500">*</span></label>
                            <input 
                              type="text" 
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none" 
                              placeholder="Juan Dela Cruz"
                              value={accountName}
                              onChange={(e) => setAccountName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Sender Account Number <span className="text-red-500">*</span></label>
                            <input 
                              type="text" 
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none" 
                              placeholder="09123456789"
                              maxLength={11}
                              value={accountNumber}
                              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            />
                          </div>
                        </div>
                        
                        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-xl bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all text-center">
                          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                          <div className="flex flex-col items-center gap-1">
                            <UploadCloud className="text-slate-400" size={28} />
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300"><span className="text-blue-600 dark:text-blue-400 hover:underline">Click to upload</span> or drag and drop</p>
                            <p className="text-[11px] text-slate-400 m-0">PNG, JPG, JPEG up to 5MB</p>
                          </div>
                        </label>

                        {proofFile && (
                          <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <FileCheck2 size={16} />
                            <span className="truncate">
                              {proofFile.name}
                            </span>
                          </div>
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
                onClick={handleDonate} 
                disabled={submitting || !isFormComplete}
              >
                {submitting ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
                  <>
                    <Heart size={16} />
                    <span>Donate Now</span>
                  </>
                )}
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
      />

      {/* ── Donation Success Modal ── */}
      {successData && (
        <div className="user-donation-success-overlay" onClick={() => setSuccessData(null)}>
          <div className="user-donation-success-modal" onClick={e => e.stopPropagation()}>
            <div className="user-donation-success-icon-wrap">
              <FileCheck2 size={48} color="#10B981" />
            </div>
            <h2 className="user-donation-success-title">Donation Submitted!</h2>
            <p className="user-donation-success-subtitle">Your payment is pending manual approval.</p>
            
            <div className="user-donation-success-details">
              <p className="user-donation-success-detail-label">Amount Contributed</p>
              <h3 className="user-donation-success-amount">{fmt(successData.amount)}</h3>
              <div className="user-donation-success-category">
                <Heart size={16} color="#2563eb" fill="#2563eb" />
                <span>{successData.category}</span>
              </div>
            </div>

            <p className="user-donation-success-note">
              Our administrators will review your uploaded proof of payment. Thank you for your generous support!
            </p>

            <button className="user-donation-success-close" onClick={() => setSuccessData(null)}>
              Done
            </button>
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

function DonationReceiptModal({ isOpen, onClose, selectedDonation, user }) {
  const { modalStyle, touchHandlers } = useSwipeToClose(onClose);
  if (!isOpen || !selectedDonation) return null;

  return (
    <div className="dim-overlay" onClick={onClose}>
      <div className="dim-modal sm:max-w-md p-0 overflow-hidden font-inter" style={modalStyle} {...touchHandlers} onClick={e => e.stopPropagation()}>
        <DragHandle />
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center relative">
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-full transition-colors"
            onClick={onClose}
          >
            <X size={20} />
          </button>
          <Receipt className="w-10 h-10 mx-auto mb-2 text-white/90" />
          <h2 className="text-xl font-bold">Donation Receipt</h2>
          <p className="text-xs text-white/80">IsangDiwa Official Record</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center pb-4 border-b border-slate-100 dark:border-white/5">
            <p className="text-xs text-slate-400">Amount Contributed</p>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{fmt(selectedDonation.amount)}</h1>
            <div className={`inline-block px-3 py-1 text-xs font-bold rounded-full mt-2 ${selectedDonation.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : selectedDonation.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'}`}>
              {selectedDonation.status === 'confirmed' ? 'Successful' : selectedDonation.status === 'rejected' ? 'Failed' : 'Incomplete'}
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-400 font-medium">Donor Name</span>
              <span className="text-slate-900 dark:text-white font-bold">{user?.fullName || 'Valued Member'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-400 font-medium">Fund Category</span>
              <span className="text-slate-900 dark:text-white font-bold">{selectedDonation.category}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-400 font-medium">Transaction ID</span>
              <span className="text-slate-900 dark:text-white font-bold">{selectedDonation.donationId}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-400 font-medium">Date & Time</span>
              <span className="text-slate-900 dark:text-white font-bold">{fmtDate(selectedDonation.createdAt || selectedDonation.date)}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-400 font-medium">Payment Method</span>
              <span className="text-slate-900 dark:text-white font-bold">{selectedDonation.method || selectedDonation.paymentMethod}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 font-medium">Reference No.</span>
              <span className="text-slate-900 dark:text-white font-bold">{selectedDonation.referenceNumber || selectedDonation.donationId}</span>
            </div>
          </div>

          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl text-center">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Thank you for your generous support of God's work. Your contribution makes a difference in our community.</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-xs">
              <Share2 size={16} />
              <span>Share</span>
            </button>
            <button className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs">
              <Download size={16} />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}