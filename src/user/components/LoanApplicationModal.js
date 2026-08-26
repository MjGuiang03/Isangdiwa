import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

import API from '../../utils/api';
import { Banknote, CheckCircle, X, Pencil, Camera, RotateCcw, AlertTriangle, Upload, Trash2, ChevronDown, Check, ShieldCheck, Send, Wallet, Clock } from 'lucide-react';

/* ── Loan-type config ── */
const LOAN_TYPES = [
  {
    key: 'personal',
    name: 'Personal Loan',
    multiplier: 2,
    minTerm: 3,
    maxTerm: 12,
    rate: 0.02,
    rateLabel: '2% / mo',
    color: 'blue',
    desc: 'For everyday needs, big purchases, or personal goals.',
    icon: (
      <Wallet size={20} />
    ),
  },
  {
    key: 'emergency',
    name: 'Emergency Loan',
    multiplier: 1.5,
    minTerm: 1,
    maxTerm: 6,
    rate: 0.015,
    rateLabel: '1.5% / mo',
    color: 'amber',
    desc: 'Fast-tracked for urgent and unexpected situations.',
    icon: (
      <AlertTriangle size={20} />
    ),
  },
  {
    key: 'short-term',
    name: 'Short-Term Loan',
    multiplier: 1,
    minTerm: 1,
    maxTerm: 3,
    rate: 0.01,
    rateLabel: '1% / mo',
    color: 'teal',
    desc: 'Quick, low-interest loan for short bridge financing.',
    icon: (
      <Clock size={20} />
    ),
  },
];

const PHILIPPINE_BANKS = [
  'BDO Unibank (BDO)',
  'Bank of the Philippine Islands (BPI)',
  'Metropolitan Bank & Trust Company (Metrobank)',
  'Land Bank of the Philippines (Landbank)',
  'Union Bank of the Philippines (UnionBank)',
  'Rizal Commercial Banking Corporation (RCBC)',
  'Security Bank Corporation',
  'Philippine National Bank (PNB)',
  'China Banking Corporation (China Bank)',
  'Development Bank of the Philippines (DBP)',
  'EastWest Banking Corporation',
  'GoTyme Bank',
  'Maya Bank',
  'SeaBank Philippines',
  'CIMB Bank Philippines',
  'Philippine Savings Bank (PSBank)',
  'Asia United Bank (AUB)',
  'Robinsons Bank',
  'Other Bank'
];

const fmt = (n) =>
  n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '₱0.00';

const CheckIcon = () => (
  <CheckCircle size={15} color="#16a34a" />
);

const XIcon = () => (
  <X size={15} color="#dc2626" />
);

export default function LoanApplicationModal({
  isOpen,
  onClose,
  onSuccess,
  totalSavings = 0,
  existingLoanBalance = 0,
  hasOverdueLoans = false,
}) {
  const [loanType, setLoanType] = useState('');
  const [amount, setAmount] = useState('');
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const carouselRef = useRef(null);

  const handleCarouselScroll = useCallback((e) => {
    const container = e.target;
    if (!container) return;
    const scrollLeft = container.scrollLeft;
    const itemWidth = container.clientWidth * 0.75;
    const newIndex = Math.min(
      LOAN_TYPES.length - 1,
      Math.max(0, Math.round(scrollLeft / (itemWidth || 1)))
    );
    setActiveCardIndex(newIndex);
  }, []);
  const [termMonths, setTermMonths] = useState('');
  const [selfieImage, setSelfieImage] = useState(null);   // base64 data URL
  const [idImage, setIdImage] = useState(null);             // base64 data URL
  const [disbursementMethod, setDisbursementMethod] = useState('');
  const [disbursementAccount, setDisbursementAccount] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [selectedAccountIdx, setSelectedAccountIdx] = useState(-1);
  const [editingAccountIdx, setEditingAccountIdx] = useState(null);

  const [coeData, setCoeData] = useState(null);
  const [coeFileName, setCoeFileName] = useState('');
  const [itrData, setItrData] = useState(null);
  const [itrFileName, setItrFileName] = useState('');
  const [payslipData, setPayslipData] = useState(null);
  const [payslipFileName, setPayslipFileName] = useState('');
  const [hasActiveLoan, setHasActiveLoan] = useState(null);
  const [activeLoanScreenshotData, setActiveLoanScreenshotData] = useState(null);
  const [activeLoanScreenshotFileName, setActiveLoanScreenshotFileName] = useState('');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: '',
    title: '',
    message: '',
    actionText: '',
    actionVariant: 'primary'
  });

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [showFinalSubmitConfirm, setShowFinalSubmitConfirm] = useState(false);

  const handleFileUpload = (e, setFileData, setFileName) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setFileData(ev.target.result);
    reader.readAsDataURL(file);
  };

  const [newEwalletProvider, setNewEwalletProvider] = useState('');
  const [newEwalletAccountName, setNewEwalletAccountName] = useState('');
  const [newEwalletNumber, setNewEwalletNumber] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [isCustomBank, setIsCustomBank] = useState(false);
  const [newBankAccountName, setNewBankAccountName] = useState('');
  const [newBankAccountNumber, setNewBankAccountNumber] = useState('');
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const bankDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target)) {
        setIsBankDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── Camera state ── */
  const [cameraOpen, setCameraOpen] = useState(false);       // is camera modal visible
  const [cameraTarget, setCameraTarget] = useState(null);    // 'selfie' | 'id'
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraHint, setCameraHint] = useState('');
  const [idChecking, setIdChecking] = useState(false);       // currently verifying frame
  const [idDetectionMsg, setIdDetectionMsg] = useState('');  // detection message
  const [capturedIdPreview, setCapturedIdPreview] = useState(null); // preview of captured ID photo
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const hintTimerRef = useRef(null);

  /* ── derived ── */
  const selectedType = LOAN_TYPES.find((t) => t.key === loanType) || null;

  const maxLoanable = selectedType
    ? Math.max(0, totalSavings * selectedType.multiplier - existingLoanBalance)
    : 0;

  const termOptions = selectedType
    ? Array.from(
      { length: selectedType.maxTerm - selectedType.minTerm + 1 },
      (_, i) => selectedType.minTerm + i,
    )
    : [];

  /* ── calculation breakdown ── */
  const calc = useMemo(() => {
    const principal = Number(amount.replace(/,/g, '')) || 0;
    const months = Number(termMonths) || 0;
    if (!selectedType || principal <= 0 || months <= 0) return null;
    const totalInterest = principal * selectedType.rate * months;
    const totalRepayment = principal + totalInterest;
    const monthly = totalRepayment / months;
    return { principal, totalInterest, totalRepayment, monthly, rate: selectedType.rate, months };
  }, [amount, termMonths, selectedType]);

  /* ── fetch saved accounts ── */
  useEffect(() => {
    if (!isOpen) return;
    const fetchAccounts = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API}/api/saved-accounts`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) setSavedAccounts(data.accounts || []);
      } catch { /* silent */ }
    };
    fetchAccounts();
  }, [isOpen]);

  const filteredAccounts = useMemo(() => {
    return savedAccounts
      .filter(a => a.method === disbursementMethod)
      .map(a => {
        let label = a.label || '';
        if (a.method === 'e-wallet') {
          if (!label.startsWith('GCash') && !label.startsWith('Maya')) {
            label = `GCash - ${label}`;
          }
        } else if (a.method === 'bank') {
          if (!label.includes(' - ')) {
            label = `Bank - ${label}`;
          }
        }
        return { ...a, displayLabel: label };
      });
  }, [savedAccounts, disbursementMethod]);

  const parseAccountBadge = (acc) => {
    const full = acc.displayLabel || acc.label || '';
    const parts = full.split(' - ');
    if (parts.length >= 2) {
      const provider = parts[0];
      const details = parts.slice(1).join(' - ');
      let badgeColor = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40';
      if (provider.toLowerCase().includes('gcash')) {
        badgeColor = 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40';
      } else if (provider.toLowerCase().includes('maya')) {
        badgeColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40';
      }
      return { provider, details, badgeColor };
    }
    return { 
      provider: acc.method === 'e-wallet' ? 'E-Wallet' : 'Bank', 
      details: full, 
      badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700' 
    };
  };

  const handleDeleteAccount = async (acc) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/saved-accounts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ method: acc.method, accountNumber: acc.accountNumber }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Saved account removed');
        setSavedAccounts(prev => prev.filter(a => !(a.method === acc.method && a.accountNumber === acc.accountNumber)));
        if (disbursementAccount === acc.label) {
          setSelectedAccountIdx(-1);
          setDisbursementAccount('');
        }
      } else {
        toast.error(data.message || 'Failed to delete account');
      }
    } catch {
      toast.error('Network error. Failed to delete account.');
    }
  };

  /* ── Camera helpers ── */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setCameraHint('');
    setIdChecking(false);
    setIdDetectionMsg('');
    if (hintTimerRef.current) clearInterval(hintTimerRef.current);
  }, []);

  const openCamera = useCallback(async (target) => {
    setCameraTarget(target);
    setCameraOpen(true);
    setCameraError(null);
    setCameraReady(false);
    setCameraHint('');
    setIdChecking(false);
    setIdDetectionMsg('');
    setCapturedIdPreview(null);

    try {
      const facingMode = target === 'selfie' ? 'user' : 'environment';
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      // Wait for DOM to mount the video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => {
            setCameraReady(true);
          });
        }
      }, 100);

      // Rotate validation hints
      const hints = target === 'selfie'
        ? [
            'Hold your ID beside your face',
            'Make sure your face is fully visible',
            'Include today\'s date (handwritten on paper)',
            'Move closer to the camera',
            'Ensure good lighting on your face',
          ]
        : [
            'Place your ID flat on a surface',
            'Make sure all text is readable',
            'Avoid glare and shadows',
            'Move closer if text is too small',
            'Ensure good lighting',
          ];
      let hintIdx = 0;
      setCameraHint(hints[0]);
      hintTimerRef.current = setInterval(() => {
        hintIdx = (hintIdx + 1) % hints.length;
        setCameraHint(hints[hintIdx]);
      }, 4000);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Unable to access camera. Please allow camera permissions and try again.');
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    // Mirror for selfie (front camera)
    if (cameraTarget === 'selfie') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    if (cameraTarget === 'selfie') {
      setSelfieImage(dataUrl);
      stopCamera();
      setCameraOpen(false);
      toast.success('Selfie captured!');
      return;
    }

    // ── Target: ID ──
    // Capture photo first, then verify with AI ONCE
    setCapturedIdPreview(dataUrl);
    setIdChecking(true);
    setIdDetectionMsg('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/loans/verify-id-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageData: dataUrl }),
      });
      const data = await res.json();

      if (data.rateLimited) {
        setIdDetectionMsg('API busy — please wait a moment and try again.');
        return;
      }

      if (data.detected && (data.confidence === 'high' || data.confidence === 'medium')) {
        setIdImage(dataUrl);
        stopCamera();
        setCameraOpen(false);
        setCapturedIdPreview(null);
        toast.success('✓ Government ID verified & captured successfully!');
      } else {
        setIdDetectionMsg(data.reason || 'No valid Government ID detected in photo. Please ensure all text and details are clear.');
      }
    } catch (err) {
      console.error('ID verification error:', err);
      setIdDetectionMsg('Verification system unavailable — please try again.');
    } finally {
      setIdChecking(false);
    }
  }, [cameraTarget, stopCamera]);

  const closeCamera = useCallback(() => {
    stopCamera();
    setCameraOpen(false);
  }, [stopCamera]);

  const requestClose = useCallback(() => {
    if (loanType || amount || selfieImage || idImage || coeData || itrData || payslipData) {
      setConfirmModal({
        isOpen: true,
        type: 'close_modal',
        title: 'Discard Application?',
        message: 'Are you sure you want to exit? Any progress and uploaded documents will be lost.',
        actionText: 'Discard & Exit',
        actionVariant: 'danger'
      });
    } else {
      onClose();
    }
  }, [loanType, amount, selfieImage, idImage, coeData, itrData, payslipData, onClose]);

  // Cleanup camera on modal close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCameraOpen(false);
    }
  }, [isOpen, stopCamera]);

  if (!isOpen) return null;

  /* ── eligibility ── */
  const savingsOk = totalSavings >= 1000;
  const noOverdue = !hasOverdueLoans;
  const amountOk = calc ? calc.principal >= 1000 && calc.principal <= maxLoanable : true;
  const allEligible = savingsOk && noOverdue && (calc ? amountOk : true);

  /* ── submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedType) { toast.error('Please select a loan type.'); return; }
    if (!amount || Number(amount.replace(/,/g, '')) <= 0) { toast.error('Please enter a loan amount.'); return; }
    if (!termMonths) { toast.error('Please select a repayment term.'); return; }
    if (!calc) { toast.error('Please fill in amount and term.'); return; }
    if (calc.principal < 1000) { toast.error('Minimum loan amount is ₱1,000.'); return; }
    if (calc.principal > maxLoanable) { toast.error(`Amount exceeds your max loanable of ${fmt(maxLoanable)}.`); return; }
    if (!savingsOk) { toast.error('You need at least ₱1,000 in savings.'); return; }
    if (hasOverdueLoans) { toast.error('You have overdue loans. Please settle them first.'); return; }
    if (!selfieImage) { toast.error('Please capture a selfie with ID & date.'); return; }
    if (!idImage) { toast.error('Please capture a photo of your government ID.'); return; }
    if (!coeData) { toast.error('Please upload your Certificate of Employment (COE).'); return; }
    if (!itrData) { toast.error('Please upload your Income Tax Return (ITR).'); return; }
    if (!payslipData) { toast.error('Please upload your Payslip.'); return; }
    if (hasActiveLoan === null) { toast.error('Please specify if you have an active loan with another entity.'); return; }
    if (hasActiveLoan === true && !activeLoanScreenshotData) { toast.error('Please upload a screenshot of your active loan.'); return; }
    if (!disbursementMethod) { toast.error('Please select a disbursement method.'); return; }

    let finalDisbursementAccount = disbursementAccount;
    if (selectedAccountIdx === -1 && (disbursementMethod === 'e-wallet' || disbursementMethod === 'bank')) {
      if (disbursementMethod === 'e-wallet') {
        if (!newEwalletProvider) { toast.error('Please select an E-Wallet provider (GCash or Maya).'); return; }
        if (!newEwalletAccountName || newEwalletAccountName.trim().length < 2) { toast.error('Please enter a valid E-Wallet account name (min 2 characters).'); return; }
        
        if (newEwalletProvider === 'GCash') {
          if (!newEwalletNumber.startsWith('09')) { toast.error('GCash account number must start with 09 (e.g. 09123456789).'); return; }
          if (newEwalletNumber.length !== 11) { toast.error('GCash account number must be exactly 11 digits.'); return; }
        } else if (newEwalletProvider === 'Maya') {
          const isValidMobile = newEwalletNumber.length === 11 && newEwalletNumber.startsWith('09');
          const isValidAccount = newEwalletNumber.length >= 12 && newEwalletNumber.length <= 16;
          if (!isValidMobile && !isValidAccount) {
            if (newEwalletNumber.length === 11 && !newEwalletNumber.startsWith('09')) {
              toast.error('11-digit Maya mobile number must start with 09.');
            } else {
              toast.error('Maya account number must be 11 digits starting with 09 or 12-16 digits.');
            }
            return;
          }
        }
        finalDisbursementAccount = `${newEwalletProvider} - ${newEwalletAccountName.trim()} - ${newEwalletNumber}`;
      } else if (disbursementMethod === 'bank') {
        if (!newBankName || newBankName.trim().length === 0) { toast.error('Please select or specify a bank name.'); return; }
        if (!newBankAccountName || newBankAccountName.trim().length < 2) { toast.error('Please enter a valid bank account name (min 2 characters).'); return; }
        const bankNumDigits = newBankAccountNumber.replace(/\D/g, '');
        if (bankNumDigits.length < 10 || bankNumDigits.length > 16) {
          toast.error('Bank account number must be between 10 and 16 digits.');
          return;
        }
        finalDisbursementAccount = `${newBankName} - ${newBankAccountName.trim()} - ${newBankAccountNumber.trim()}`;
      }
    } else {
      if ((disbursementMethod === 'e-wallet' || disbursementMethod === 'bank') && !finalDisbursementAccount) {
        toast.error(`Please select or provide your ${disbursementMethod === 'e-wallet' ? 'E-Wallet details' : 'bank account details'}.`);
        return;
      }
    }
    if (!agreedToTerms) { toast.error('You must accept the Loan Terms and Conditions to continue.'); return; }

    // Save summary data for review modal
    setReviewData({
      loanTypeObj: selectedType,
      amount: calc.principal,
      termMonths: calc.months,
      monthlyPayment: calc.monthly,
      totalInterest: calc.totalInterest,
      totalRepayment: calc.totalRepayment,
      disbursementMethod,
      disbursementAccount: finalDisbursementAccount,
      selfieImage,
      idImage,
      coeFileName,
      itrFileName,
      payslipFileName,
      hasActiveLoan,
      activeLoanScreenshotFileName,
      payload: {
        amount: calc.principal,
        loanType: selectedType.key,
        purpose: selectedType.name,
        termMonths: calc.months,
        interestRate: selectedType.rate,
        totalInterest: calc.totalInterest,
        totalRepayment: calc.totalRepayment,
        monthlyPayment: calc.monthly,
        disbursementMethod,
        disbursementAccount: finalDisbursementAccount,
        selfieFileName: 'camera-selfie.jpg',
        idFileName: 'camera-id.jpg',
        selfieData: selfieImage,
        idData: idImage,
        coeData,
        coeFileName,
        itrData,
        itrFileName,
        payslipData,
        payslipFileName,
        hasActiveLoan,
        activeLoanScreenshotData: hasActiveLoan ? activeLoanScreenshotData : null,
        activeLoanScreenshotFileName: hasActiveLoan ? activeLoanScreenshotFileName : null
      }
    });

    setShowReviewModal(true);
  };

  /* ── execute final submission ── */
  const executeFinalSubmission = async () => {
    if (!reviewData || !reviewData.payload) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const res = await fetch(`${API}/api/loans/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reviewData.payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit application');

      toast.success('Loan application submitted successfully!');

      if ((disbursementMethod === 'e-wallet' || disbursementMethod === 'bank') && reviewData.disbursementAccount) {
        try {
          await fetch(`${API}/api/saved-accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              method: disbursementMethod,
              accountNumber: reviewData.disbursementAccount,
              accountName: '',
              label: reviewData.disbursementAccount,
            }),
          });
        } catch { /* silent */ }
      }

      setLoanType('');
      setAmount('');
      setTermMonths('');
      setSelfieImage(null);
      setIdImage(null);
      setShowReviewModal(false);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden sm:overflow-y-auto transition-all duration-300" onClick={requestClose}>
      <div className="relative w-full max-w-none sm:max-w-3xl bg-white dark:bg-[#1E2130] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border-t sm:border border-slate-200 dark:border-white/10 my-0 sm:my-auto text-left font-inter h-auto max-h-[92dvh] sm:max-h-[90vh] flex flex-col mobile-slide-up-modal" onClick={(e) => e.stopPropagation()}>

        {/* Simple Clean Header */}
        <div className="p-5 sm:p-6 bg-white dark:bg-[#1E2130] flex items-center justify-between border-b border-slate-200 dark:border-white/10 shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-dm text-slate-900 dark:text-white">Apply for Loan</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Calculate repayments, upload identity documents, and submit your application.</p>
          </div>
          <button 
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer shrink-0" 
            onClick={(e) => { e.stopPropagation(); requestClose(); }} 
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1" onSubmit={handleSubmit}>
          {/* Focus trap */}
          <input type="text" hidden className="hidden" aria-hidden="true" readOnly />

          {/* ── Savings Context Card ── */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-slate-700 dark:text-slate-200 font-bold text-xs block">Your Total Savings</span>
                <span className={`text-lg font-extrabold ${totalSavings < 1000 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                  {fmt(totalSavings)}
                </span>
              </div>
            </div>

            {existingLoanBalance > 0 && (
              <div className="text-right">
                <span className="text-slate-700 dark:text-slate-200 font-bold text-xs block">Existing Loan Balance</span>
                <span className="text-base font-bold text-red-600 dark:text-red-400">
                  −{fmt(existingLoanBalance)}
                </span>
              </div>
            )}
          </div>

          {/* ── STEP 1: Loan Type & Terms ── */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/10 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#1E3A8A] text-white font-bold text-xs flex items-center justify-center shrink-0">1</div>
                <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Loan Details &amp; Amount</h3>
              </div>
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">Step 1 of 4</span>
            </div>

            {/* ── Loan Type selector ── */}
            <div className="user-loan-application-form-group">
              <label className="user-loan-application-label text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 block mb-3">Select Loan Type</label>
              <div
                ref={carouselRef}
                onScroll={handleCarouselScroll}
                className="flex sm:grid sm:grid-cols-3 gap-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-2 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
              >
                {LOAN_TYPES.map((lt, idx) => {
                  const isSelected = loanType === lt.key;
                  const ltMax = Math.max(0, totalSavings * lt.multiplier - existingLoanBalance);
                  
                  /* accent colors per card type */
                  const cardTheme = {
                    personal: {
                      bg: 'bg-gradient-to-br from-[#0D1F45] via-[#1A3268] to-[#2B4EAF]',
                      accent: 'text-blue-300',
                      iconBg: 'bg-blue-400/20',
                      iconColor: 'text-blue-300',
                      checkBg: 'bg-blue-500',
                      ringActive: 'ring-blue-400 ring-2 shadow-lg shadow-blue-500/30',
                    },
                    emergency: {
                      bg: 'bg-gradient-to-br from-[#1C1024] via-[#3B1A4A] to-[#6B2FA0]',
                      accent: 'text-purple-300',
                      iconBg: 'bg-purple-400/20',
                      iconColor: 'text-purple-300',
                      checkBg: 'bg-purple-500',
                      ringActive: 'ring-purple-400 ring-2 shadow-lg shadow-purple-500/30',
                    },
                    'short-term': {
                      bg: 'bg-gradient-to-br from-[#0B1F1A] via-[#133D32] to-[#1B6B54]',
                      accent: 'text-emerald-300',
                      iconBg: 'bg-emerald-400/20',
                      iconColor: 'text-emerald-300',
                      checkBg: 'bg-emerald-500',
                      ringActive: 'ring-emerald-400 ring-2 shadow-lg shadow-emerald-500/30',
                    },
                  }[lt.key];

                  return (
                    <div
                      key={lt.key}
                      className={`relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 ${cardTheme.bg} ${isSelected ? `${cardTheme.ringActive} sm:-translate-y-3 sm:scale-[1.02]` : 'ring-1 ring-white/10 shadow-md sm:hover:-translate-y-0.5 sm:hover:shadow-xl'} w-[75vw] max-w-[260px] sm:w-auto shrink-0 sm:shrink snap-center p-5 sm:p-4`}
                      onClick={() => {
                        setLoanType(lt.key);
                        setActiveCardIndex(idx);
                        setTermMonths('');
                        setAmount(ltMax > 0 ? Number(ltMax).toLocaleString('en-US') : '');
                      }}
                    >
                      {/* Subtle card pattern overlay */}
                      <div className="absolute inset-0 opacity-[0.04]" style={{
                        backgroundImage: `radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`,
                        backgroundSize: '60px 60px'
                      }} />

                      <div className="relative z-10 flex flex-col gap-4 sm:gap-3">
                        {/* Row 1: Icon + Checkmark */}
                        <div className="flex items-center justify-between">
                          <div className={`w-9 h-9 rounded-xl ${cardTheme.iconBg} ${cardTheme.iconColor} flex items-center justify-center`}>
                            {lt.icon}
                          </div>
                          {isSelected && (
                            <div className={`w-6 h-6 rounded-full ${cardTheme.checkBg} flex items-center justify-center shadow-md`}>
                              <Check size={14} className="text-white" strokeWidth={3} />
                            </div>
                          )}
                        </div>

                        {/* Row 2: Name + Description */}
                        <div>
                          <p className="text-base font-bold text-white tracking-tight leading-tight" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
                            {lt.name}
                          </p>
                          <p className="text-[11px] text-white/50 mt-0.5 leading-snug">
                            {lt.desc}
                          </p>
                        </div>

                        {/* Row 3: Multiplier */}
                        <p className={`text-[11px] font-semibold ${cardTheme.accent}`}>
                          {lt.multiplier}x savings multiplier
                        </p>

                        {/* Row 4: Rate + Term side by side */}
                        <div className="flex items-end gap-6">
                          <div>
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-white/40">Rate</span>
                            <span className="text-xs font-semibold text-white/90">{lt.rateLabel}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-white/40">Term</span>
                            <span className="text-xs font-semibold text-white/90">{lt.minTerm}-{lt.maxTerm} mo</span>
                          </div>
                        </div>

                        {/* Row 5: Max Limit */}
                        <div>
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-white/40">Max Limit</span>
                          <span className={`text-base font-extrabold ${cardTheme.accent}`} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            {fmt(ltMax)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile swipe indicator dots */}
              <div className="flex sm:hidden items-center justify-center gap-1.5 mt-2">
                {LOAN_TYPES.map((lt, idx) => (
                  <button
                    key={lt.key}
                    type="button"
                    onClick={() => {
                      if (carouselRef.current) {
                        const itemWidth = carouselRef.current.clientWidth * 0.75;
                        carouselRef.current.scrollTo({ left: idx * itemWidth, behavior: 'smooth' });
                      }
                      setActiveCardIndex(idx);
                    }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${activeCardIndex === idx ? 'w-5 bg-blue-600 dark:bg-blue-400' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

            </div>

            {/* ── Amount + Term row ── */}
            {selectedType && (
              <div className="user-loan-application-row">
                <div className="user-loan-application-group-half">
                  <div className="ula-label-row">
                    <label className="user-loan-application-label">Loan Amount (₱)</label>
                    <span className="ula-max-pill">Max: {fmt(maxLoanable)}</span>
                  </div>
                  <div className="user-loan-application-input-wrapper ula-filled-input">
                    <span className="user-loan-application-input-icon">₱</span>
                    <input
                      type="text"
                      className="user-loan-application-input"
                      style={{ paddingLeft: '40px' }}
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = raw.split('.');
                        if (parts[0]) {
                            parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
                        }
                        setAmount(parts.join('.'));
                      }}
                      required
                    />
                  </div>
                  {amount && Number(amount.replace(/,/g, '')) > maxLoanable && (
                    <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40">
                      <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 font-inter">Exceeds your max loanable amount</span>
                    </div>
                  )}
                  {amount && Number(amount.replace(/,/g, '')) > 0 && Number(amount.replace(/,/g, '')) < 1000 && (
                    <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40">
                      <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 font-inter">Minimum loan is ₱1,000</span>
                    </div>
                  )}
                </div>

                <div className="user-loan-application-group-half">
                  <div className="ula-label-row">
                    <label className="user-loan-application-label">Repayment Term</label>
                  </div>
                  <div className="user-loan-application-input-wrapper ula-filled-input">
                    <Banknote className="user-loan-application-input-icon-svg" size={20} color="#99A1AF" />
                    <select
                      className="user-loan-application-select"
                      style={{ paddingLeft: '40px' }}
                      value={termMonths}
                      onChange={(e) => setTermMonths(e.target.value)}
                      required
                    >
                      <option value="">Select term</option>
                      {termOptions.map((m) => (
                        <option key={m} value={m}>
                          {m} month{m > 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── Live calculation breakdown ── */}
            {calc && (
              <div className="ula-calc-card">
                <div className="ula-calc-header">
                  <Banknote size={16} />
                  Loan Calculation Breakdown
                </div>
                <div className="ula-calc-rows">
                  <div className="ula-calc-row">
                    <span>Principal amount</span>
                    <span>{fmt(calc.principal)}</span>
                  </div>
                  <div className="ula-calc-row">
                    <span>Interest rate</span>
                    <span>{calc.rate * 100}% per month</span>
                  </div>
                  <div className="ula-calc-row">
                    <span>Term</span>
                    <span>{calc.months} month{calc.months > 1 ? 's' : ''}</span>
                  </div>
                  <div className="ula-calc-row">
                    <span>Total interest <span className="ula-calc-formula"></span></span>
                    <span>{fmt(calc.totalInterest)}</span>
                  </div>
                  <div className="ula-calc-divider" />
                  <div className="ula-calc-row ula-calc-row--bold">
                    <span>Total repayment</span>
                    <span>{fmt(calc.totalRepayment)}</span>
                  </div>
                  <div className="ula-calc-row ula-calc-row--bold ula-calc-row--primary">
                    <span>Monthly payment</span>
                    <span>{fmt(calc.monthly)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Eligibility checklist ── */}
            {selectedType && (
              <div className="ula-eligibility">
                <div className="ula-eligibility-title">Eligibility Check</div>
                <div className="ula-eligibility-list">
                  <div className="ula-eligibility-item">
                    {savingsOk ? <CheckIcon /> : <XIcon />}
                    <span>Minimum savings of ₱1,000</span>
                  </div>
                  <div className="ula-eligibility-item">
                    {noOverdue ? <CheckIcon /> : <XIcon />}
                    <span>No overdue or unpaid loans</span>
                  </div>
                  {calc && (
                    <div className="ula-eligibility-item">
                      {amountOk ? <CheckIcon /> : <XIcon />}
                      <span>Amount within computed limit ({fmt(maxLoanable)})</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── STEP 2: Verification & Required Documents ── */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/10 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#1E3A8A] text-white font-bold text-xs flex items-center justify-center shrink-0">2</div>
                <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Verification &amp; Documents</h3>
              </div>
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">Step 2 of 4</span>
            </div>

            {/* ── Group A: Live Camera Verification ── */}
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 font-inter flex items-center gap-1.5">
                  <Camera size={14} className="text-blue-600 dark:text-blue-400" /> Live Camera Verification
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Must capture live photo using device camera for identity verification.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Selfie Card */}
                <div className={`p-3.5 rounded-xl border transition-all ${selfieImage ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/50' : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-white/10 hover:border-blue-500/50'} shadow-sm flex flex-col justify-between gap-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Selfie with ID &amp; Date <span className="text-rose-500">*</span></span>
                    {selfieImage ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle size={10} /> Captured
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-medium">Required</span>
                    )}
                  </div>

                  {selfieImage ? (
                    <div className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-white/10">
                      <img src={selfieImage} alt="Selfie preview" className="w-full h-24 object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                        <button
                          type="button"
                          className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 transition-all shadow-md active:scale-95 cursor-pointer"
                          onClick={() => setConfirmModal({
                            isOpen: true,
                            type: 'retake_selfie',
                            title: 'Retake Selfie Photo?',
                            message: 'Your current selfie photo will be replaced when you take a new photo.',
                            actionText: 'Retake Photo',
                            actionVariant: 'primary'
                          })}
                        >
                          <RotateCcw size={12} /> Retake
                        </button>
                        <button
                          type="button"
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 transition-all shadow-md active:scale-95 cursor-pointer"
                          onClick={() => setConfirmModal({
                            isOpen: true,
                            type: 'remove_selfie',
                            title: 'Remove Selfie Photo?',
                            message: 'Are you sure you want to remove your captured selfie photo?',
                            actionText: 'Remove Photo',
                            actionVariant: 'danger'
                          })}
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-full py-2.5 px-3 rounded-lg border border-dashed border-blue-300 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                      onClick={() => openCamera('selfie')}
                    >
                      <Camera size={16} /> Take Live Selfie
                    </button>
                  )}
                </div>

                {/* ID Card */}
                <div className={`p-3.5 rounded-xl border transition-all ${idImage ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/50' : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-white/10 hover:border-blue-500/50'} shadow-sm flex flex-col justify-between gap-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Valid Government ID <span className="text-rose-500">*</span></span>
                    {idImage ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle size={10} /> Captured
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-medium">Required</span>
                    )}
                  </div>

                  {idImage ? (
                    <div className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-white/10">
                      <img src={idImage} alt="ID preview" className="w-full h-24 object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                        <button
                          type="button"
                          className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 transition-all shadow-md active:scale-95 cursor-pointer"
                          onClick={() => setConfirmModal({
                            isOpen: true,
                            type: 'retake_id',
                            title: 'Retake ID Photo?',
                            message: 'Your current ID photo will be replaced when you take a new photo.',
                            actionText: 'Retake Photo',
                            actionVariant: 'primary'
                          })}
                        >
                          <RotateCcw size={12} /> Retake
                        </button>
                        <button
                          type="button"
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 transition-all shadow-md active:scale-95 cursor-pointer"
                          onClick={() => setConfirmModal({
                            isOpen: true,
                            type: 'remove_id',
                            title: 'Remove ID Photo?',
                            message: 'Are you sure you want to remove your captured ID photo?',
                            actionText: 'Remove Photo',
                            actionVariant: 'danger'
                          })}
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-full py-2.5 px-3 rounded-lg border border-dashed border-blue-300 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                      onClick={() => openCamera('id')}
                    >
                      <Camera size={16} /> Take Photo of ID
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Group B: Required Proof Documents ── */}
            <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-white/5">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 font-inter flex items-center gap-1.5">
                  <Upload size={14} className="text-blue-600 dark:text-blue-400" /> Required Proof Documents
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Accepted formats: JPG, PNG, or PDF file.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* COE Upload */}
                <div className={`p-3 rounded-xl border transition-all ${coeFileName ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-500/40' : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-white/10'} shadow-sm flex flex-col justify-between gap-2`}>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">COE <span className="text-rose-500">*</span></span>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, setCoeData, setCoeFileName)} className="hidden" />
                    <div className="py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 text-center transition-colors">
                      {coeFileName ? (
                        <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                          <CheckCircle size={12} className="shrink-0" />
                          <span className="truncate">{coeFileName}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                          <Upload size={13} className="text-blue-600" /> Choose File
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* ITR Upload */}
                <div className={`p-3 rounded-xl border transition-all ${itrFileName ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-500/40' : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-white/10'} shadow-sm flex flex-col justify-between gap-2`}>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">ITR <span className="text-rose-500">*</span></span>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, setItrData, setItrFileName)} className="hidden" />
                    <div className="py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 text-center transition-colors">
                      {itrFileName ? (
                        <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                          <CheckCircle size={12} className="shrink-0" />
                          <span className="truncate">{itrFileName}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                          <Upload size={13} className="text-blue-600" /> Choose File
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* Payslip Upload */}
                <div className={`p-3 rounded-xl border transition-all ${payslipFileName ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-500/40' : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-white/10'} shadow-sm flex flex-col justify-between gap-2`}>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Latest Payslip <span className="text-rose-500">*</span></span>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, setPayslipData, setPayslipFileName)} className="hidden" />
                    <div className="py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 text-center transition-colors">
                      {payslipFileName ? (
                        <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                          <CheckCircle size={12} className="shrink-0" />
                          <span className="truncate">{payslipFileName}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                          <Upload size={13} className="text-blue-600" /> Choose File
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* ── Active Loan Question ── */}
            <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Do you have an active loan with another financial entity? <span className="text-rose-500">*</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 ${hasActiveLoan === true ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'}`}
                  onClick={() => setHasActiveLoan(true)}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center`}>
                    {hasActiveLoan === true && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  Yes, I do
                </button>

                <button
                  type="button"
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 ${hasActiveLoan === false ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'}`}
                  onClick={() => { setHasActiveLoan(false); setActiveLoanScreenshotData(null); setActiveLoanScreenshotFileName(''); }}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center`}>
                    {hasActiveLoan === false && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  No, I don't
                </button>
              </div>

              {hasActiveLoan && (
                <div className="mt-3 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300">Upload Screenshot of Active Loan <span className="text-rose-500">*</span></span>
                  <label className="block cursor-pointer">
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, setActiveLoanScreenshotData, setActiveLoanScreenshotFileName)} className="hidden" />
                    <div className="py-2.5 px-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-center transition-colors">
                      {activeLoanScreenshotFileName ? (
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle size={14} /> {activeLoanScreenshotFileName}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 font-semibold">
                          <Upload size={14} /> Select Screenshot (Image/PDF)
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* ── STEP 3: Disbursement Method ── */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/10 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#1E3A8A] text-white font-bold text-xs flex items-center justify-center shrink-0">3</div>
                <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Disbursement Method</h3>
              </div>
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">Step 3 of 4</span>
            </div>

            {/* ── Disbursement Method ── */}
            <div className="ula-disbursement-section">
              <p className="ula-disbursement-desc">How would you like to receive your loan once approved?</p>
              <div className="ula-disbursement-options mt-2">
                {[
                  { id: 'cash', label: 'Cash (Pick up at office)' },
                  { id: 'e-wallet', label: 'E-Wallet' },
                  { id: 'bank', label: 'Bank Transfer' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`ula-disbursement-btn ${disbursementMethod === opt.id ? 'ula-disbursement-btn--active' : ''}`}
                    onClick={() => { setDisbursementMethod(opt.id); setSelectedAccountIdx(-1); setDisbursementAccount(''); }}
                  >
                    <div className={`ula-disbursement-radio ${disbursementMethod === opt.id ? 'active' : ''}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
              
              {(disbursementMethod === 'e-wallet' || disbursementMethod === 'bank') && (
                <div className="ula-disbursement-account">
                  {filteredAccounts.length > 0 && (
                    <>
                      <label className="user-loan-application-label">Select a saved account</label>
                      <div className="ula-saved-accounts">
                        {filteredAccounts.map((acc, idx) => {
                          const badgeInfo = parseAccountBadge(acc);
                          const fullAccountText = acc.displayLabel || acc.label;

                          return (
                            <div key={idx} className={`ula-saved-account-btn ${selectedAccountIdx === idx ? 'ula-saved-account-btn--active' : ''}`}>
                              {editingAccountIdx === idx ? (
                                <div className="flex items-center gap-2.5 w-full min-w-0">
                                  <div className={`ula-disbursement-radio ${selectedAccountIdx === idx ? 'active' : ''}`} />
                                  <input
                                    type="text"
                                    className="ula-saved-account-edit-input"
                                    value={disbursementAccount}
                                    onChange={(e) => setDisbursementAccount(e.target.value)}
                                    onBlur={() => setEditingAccountIdx(null)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') setEditingAccountIdx(null); }}
                                    autoFocus
                                  />
                                </div>
                              ) : (
                                <>
                                  <div
                                    className="ula-saved-account-select-area flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                                    onClick={() => {
                                      setSelectedAccountIdx(idx);
                                      setDisbursementAccount(fullAccountText);
                                      setEditingAccountIdx(null);
                                    }}
                                  >
                                    <div className={`ula-disbursement-radio ${selectedAccountIdx === idx ? 'active' : ''}`} />
                                    <div className="ula-saved-account-info min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 shadow-2xs ${badgeInfo.badgeColor}`}>
                                          {badgeInfo.provider}
                                        </span>
                                        <span className="ula-saved-account-label font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                                          {badgeInfo.details}
                                        </span>
                                      </div>
                                      <span className="ula-saved-account-source text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block font-medium">
                                        {acc.source}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      className="ula-saved-account-edit-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAccountIdx(idx);
                                        setDisbursementAccount(fullAccountText);
                                        setEditingAccountIdx(idx);
                                      }}
                                      title="Edit account info"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className="ula-saved-account-edit-btn text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmModal({
                                          isOpen: true,
                                          type: 'delete_account',
                                          title: 'Delete Saved Account?',
                                          message: `Are you sure you want to remove "${fullAccountText}" from your saved accounts?`,
                                          actionText: 'Delete Account',
                                          actionVariant: 'danger',
                                          accountToDelete: acc
                                        });
                                      }}
                                      title="Delete account"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          className={`ula-saved-account-btn !justify-start ${selectedAccountIdx === -1 ? 'ula-saved-account-btn--active' : ''}`}
                          onClick={() => { setSelectedAccountIdx(-1); setDisbursementAccount(''); setEditingAccountIdx(null); }}
                        >
                          <div className={`ula-disbursement-radio ${selectedAccountIdx === -1 ? 'active' : ''}`} />
                          <span className="ula-saved-account-label">Enter new account</span>
                        </button>
                      </div>
                    </>
                  )}
                  {(filteredAccounts.length === 0 || selectedAccountIdx === -1) && (
                    <div style={{ marginTop: filteredAccounts.length > 0 ? '12px' : 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {disbursementMethod === 'e-wallet' ? (
                        <>
                          <div>
                            <label className="user-loan-application-label">E-Wallet Provider</label>
                            <div className="grid grid-cols-2 gap-3 mt-1.5 mb-2">
                              <label className={`ula-saved-account-btn cursor-pointer ${newEwalletProvider === 'GCash' ? 'ula-saved-account-btn--active' : ''}`}>
                                <input type="radio" name="ewalletProvider" value="GCash" checked={newEwalletProvider === 'GCash'} onChange={(e) => setNewEwalletProvider(e.target.value)} className="hidden" />
                                <div className="flex items-center gap-2">
                                  <div className={`ula-disbursement-radio ${newEwalletProvider === 'GCash' ? 'active' : ''}`} />
                                  <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-inter">GCash</span>
                                </div>
                              </label>
                              <label className={`ula-saved-account-btn cursor-pointer ${newEwalletProvider === 'Maya' ? 'ula-saved-account-btn--active' : ''}`}>
                                <input type="radio" name="ewalletProvider" value="Maya" checked={newEwalletProvider === 'Maya'} onChange={(e) => setNewEwalletProvider(e.target.value)} className="hidden" />
                                <div className="flex items-center gap-2">
                                  <div className={`ula-disbursement-radio ${newEwalletProvider === 'Maya' ? 'active' : ''}`} />
                                  <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-inter">Maya</span>
                                </div>
                              </label>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="user-loan-application-label">Account Name</label>
                              {newEwalletAccountName.length > 0 && (
                                <span className={`text-[11px] font-bold ${newEwalletAccountName.trim().length >= 2 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                  {newEwalletAccountName.trim().length >= 2 ? '✓ Valid Name' : 'Min 2 characters'}
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              className={`user-loan-application-input ${
                                newEwalletAccountName.length > 0
                                  ? (newEwalletAccountName.trim().length >= 2 ? '!border-emerald-500/60 focus:!ring-emerald-500/30' : '!border-rose-500/60 focus:!ring-rose-500/30')
                                  : ''
                              }`}
                              style={{ paddingLeft: '16px' }}
                              placeholder="e.g. Juan Dela Cruz"
                              value={newEwalletAccountName}
                              onChange={(e) => setNewEwalletAccountName(e.target.value)}
                              maxLength={50}
                              required
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="user-loan-application-label">Account Number</label>
                              {newEwalletNumber.length > 0 && (
                                <span className={`text-[11px] font-bold ${
                                  newEwalletProvider === 'GCash'
                                    ? (newEwalletNumber.startsWith('09') && newEwalletNumber.length === 11 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')
                                    : (
                                      (newEwalletNumber.length === 11 && newEwalletNumber.startsWith('09')) || (newEwalletNumber.length >= 12 && newEwalletNumber.length <= 16)
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-500'
                                    )
                                }`}>
                                  {newEwalletProvider === 'GCash'
                                    ? (!newEwalletNumber.startsWith('09')
                                        ? 'Must start with 09'
                                        : newEwalletNumber.length !== 11
                                        ? `${newEwalletNumber.length}/11 digits`
                                        : '✓ Valid GCash Number')
                                    : (newEwalletNumber.length === 11 && !newEwalletNumber.startsWith('09')
                                        ? '11-digit mobile must start with 09'
                                        : newEwalletNumber.length < 11
                                        ? `${newEwalletNumber.length}/11 digits`
                                        : (newEwalletNumber.length >= 12 && newEwalletNumber.length <= 16)
                                        ? '✓ Valid Maya Account'
                                        : newEwalletNumber.length === 11 && newEwalletNumber.startsWith('09')
                                        ? '✓ Valid Maya Number'
                                        : 'Max 16 digits')}
                                </span>
                              )}
                            </div>
                            <input 
                              type="text" 
                              className={`user-loan-application-input ${
                                newEwalletNumber.length > 0 ? (
                                  (newEwalletProvider === 'GCash' && newEwalletNumber.startsWith('09') && newEwalletNumber.length === 11) ||
                                  (newEwalletProvider === 'Maya' && ((newEwalletNumber.length === 11 && newEwalletNumber.startsWith('09')) || (newEwalletNumber.length >= 12 && newEwalletNumber.length <= 16)))
                                    ? '!border-emerald-500/60 focus:!ring-emerald-500/30'
                                    : '!border-rose-500/60 focus:!ring-rose-500/30'
                                ) : ''
                              }`}
                              style={{ paddingLeft: '16px' }} 
                              placeholder={newEwalletProvider === 'GCash' ? 'e.g. 09123456789 (11 digits)' : 'e.g. 09123456789 or Account No.'} 
                              value={newEwalletNumber} 
                              onChange={(e) => setNewEwalletNumber(e.target.value.replace(/[^0-9]/g, ''))} 
                              maxLength={newEwalletProvider === 'GCash' ? 11 : 16}
                              required 
                            />
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {newEwalletProvider === 'GCash'
                                ? 'GCash numbers must be exactly 11 digits starting with 09 (e.g. 09123456789).'
                                : 'Maya accounts must be an 11-digit mobile number starting with 09 or a 12–16 digit account number.'}
                            </p>
                          </div>
                        </>
                      ) : disbursementMethod === 'bank' ? (
                        <>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="user-loan-application-label">Bank Name</label>
                              {newBankName.length > 0 && (
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  ✓ {isCustomBank ? 'Custom Bank' : 'Selected'}
                                </span>
                              )}
                            </div>
                            <div className="relative" ref={bankDropdownRef}>
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  className={`user-loan-application-input !pr-10 ${
                                    newBankName.length > 0 ? '!border-emerald-500/60 focus:!ring-emerald-500/30' : ''
                                  }`}
                                  style={{ paddingLeft: '16px' }}
                                  placeholder="Type or select a Bank (e.g. BDO, BPI, Metrobank)"
                                  value={newBankName}
                                  onFocus={() => setIsBankDropdownOpen(true)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNewBankName(val);
                                    setIsBankDropdownOpen(true);
                                    const exactMatch = PHILIPPINE_BANKS.find(b => b.toLowerCase() === val.toLowerCase());
                                    setIsCustomBank(!exactMatch);
                                  }}
                                  required
                                />
                                <button
                                  type="button"
                                  className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                                  onClick={() => setIsBankDropdownOpen(prev => !prev)}
                                >
                                  <ChevronDown size={16} className={`transition-transform ${isBankDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
                                </button>
                              </div>

                              {isBankDropdownOpen && (
                                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar">
                                  {PHILIPPINE_BANKS
                                    .filter((b) => b !== 'Other Bank' && (!newBankName || b.toLowerCase().includes(newBankName.toLowerCase())))
                                    .map((b) => {
                                      const isSelected = newBankName === b;
                                      return (
                                        <button
                                          key={b}
                                          type="button"
                                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-between ${
                                            isSelected
                                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold'
                                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                                          }`}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            setNewBankName(b);
                                            setIsCustomBank(false);
                                            setIsBankDropdownOpen(false);
                                          }}
                                        >
                                          <span>{b}</span>
                                          {isSelected && <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />}
                                        </button>
                                      );
                                    })}

                                  {PHILIPPINE_BANKS.filter((b) => b !== 'Other Bank' && (!newBankName || b.toLowerCase().includes(newBankName.toLowerCase()))).length === 0 && (
                                    <div className="p-3 text-center text-xs text-slate-400">
                                      <p>No matching preset bank.</p>
                                      <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-1">
                                        "{newBankName}" will be saved as a Custom Bank
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="user-loan-application-label">Account Name</label>
                              {newBankAccountName.length > 0 && (
                                <span className={`text-[11px] font-bold ${newBankAccountName.trim().length >= 2 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                  {newBankAccountName.trim().length >= 2 ? '✓ Valid Name' : 'Min 2 characters'}
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              className={`user-loan-application-input ${
                                newBankAccountName.length > 0
                                  ? (newBankAccountName.trim().length >= 2 ? '!border-emerald-500/60 focus:!ring-emerald-500/30' : '!border-rose-500/60 focus:!ring-rose-500/30')
                                  : ''
                              }`}
                              style={{ paddingLeft: '16px' }}
                              placeholder="e.g. Juan Dela Cruz"
                              value={newBankAccountName}
                              onChange={(e) => setNewBankAccountName(e.target.value)}
                              maxLength={50}
                              required
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="user-loan-application-label">Account Number</label>
                              {newBankAccountNumber.length > 0 && (
                                <span className={`text-[11px] font-bold ${
                                  newBankAccountNumber.replace(/\D/g, '').length >= 10 && newBankAccountNumber.replace(/\D/g, '').length <= 16
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-500'
                                }`}>
                                  {newBankAccountNumber.replace(/\D/g, '').length < 10
                                    ? `${newBankAccountNumber.replace(/\D/g, '').length}/10-16 digits`
                                    : newBankAccountNumber.replace(/\D/g, '').length <= 16
                                    ? '✓ Valid Bank Account'
                                    : 'Max 16 digits'}
                                </span>
                              )}
                            </div>
                            <input 
                              type="text" 
                              className={`user-loan-application-input ${
                                newBankAccountNumber.length > 0 ? (
                                  newBankAccountNumber.replace(/\D/g, '').length >= 10 && newBankAccountNumber.replace(/\D/g, '').length <= 16
                                    ? '!border-emerald-500/60 focus:!ring-emerald-500/30'
                                    : '!border-rose-500/60 focus:!ring-rose-500/30'
                                ) : ''
                              }`}
                              style={{ paddingLeft: '16px' }} 
                              placeholder="e.g. 1234 5678 90 (10-16 digits)" 
                              value={newBankAccountNumber} 
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, '');
                                setNewBankAccountNumber(raw.replace(/(.{4})/g, '$1 ').trim());
                              }} 
                              maxLength={20} 
                              required 
                            />
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              Bank account numbers must contain 10 to 16 digits.
                            </p>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── STEP 4: Terms & Conditions Agreement ── */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/10 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#1E3A8A] text-white font-bold text-xs flex items-center justify-center shrink-0">4</div>
                <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">Terms &amp; Conditions</h3>
              </div>
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">Step 4 of 4</span>
            </div>

            <div className="ula-terms-section">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 font-inter">IsangDiwa — Loan Terms &amp; Conditions</h4>
              <div className="ula-terms-box max-h-60 overflow-y-auto pr-1 space-y-3">
                <div className="ula-terms-group">
                  <strong>1. Eligibility Requirements</strong>
                  <ul>
                    <li>Active officer in good standing with minimum ₱1,000 confirmed savings.</li>
                    <li>Borrowing limit depends directly on accumulated total savings.</li>
                  </ul>
                </div>

                <div className="ula-terms-group">
                  <strong>2. Application &amp; Approval Process</strong>
                  <ul>
                    <li>All applications are evaluated by loan staff.</li>
                    <li>Approval notice will be sent via notifications.</li>
                  </ul>
                </div>

                <div className="ula-terms-group">
                  <strong>3. Maximum Loan Limits</strong>
                  <ul>
                    <li>Personal Loan: up to 2× of total active savings.</li>
                    <li>Emergency Loan: up to 1.5× of total active savings.</li>
                    <li>Short-Term Loan: up to 1× of total active savings.</li>
                  </ul>
                </div>

                <div className="ula-terms-group">
                  <strong>4. Interest Rates</strong>
                  <ul>
                    <li>Emergency Loan: 1.5% monthly interest rate.</li>
                    <li>Personal Loan: 2.0% monthly interest rate.</li>
                    <li>Short-Term Loan: 1.0% monthly interest rate.</li>
                  </ul>
                </div>

                <div className="ula-terms-group">
                  <strong>5. Document Requirements</strong>
                  <ul>
                    <li>Live selfie holding valid government ID with current date label.</li>
                    <li>Uploaded COE, ITR, or payslip supporting income verification.</li>
                  </ul>
                </div>

                <div className="ula-terms-group">
                  <strong>6. Identity Verification</strong>
                  <ul>
                    <li>Documents undergo automated AI scanning and validation checks.</li>
                    <li>Unclear or fake document captures will result in instant rejection.</li>
                  </ul>
                </div>

                <div className="ula-terms-group">
                  <strong>7. Purpose of Loan</strong>
                  <ul>
                    <li>Loan funds must be utilized strictly for the stated purpose.</li>
                    <li>Misrepresentation of purpose may disqualify future borrowings.</li>
                  </ul>
                </div>

                <div className="ula-terms-group">
                  <strong>8. Existing Loan Disclosure</strong>
                  <ul>
                    <li>Full disclosure of external active loans is mandatory.</li>
                    <li>Additional proof of ongoing balance may be requested.</li>
                  </ul>
                </div>

                <div className="ula-terms-group">
                  <strong>9. Disbursement Options</strong>
                  <ul>
                    <li>Cash pickup at office or direct transfer via GCash / Bank.</li>
                    <li>Account details must match member name on record.</li>
                  </ul>
                </div>

                <div className="ula-terms-group">
                  <strong>10. Repayment Terms</strong>
                  <ul>
                    <li>Payments are monthly based on the selected term.</li>
                    <li>Due dates are fixed upon approval.</li>
                    <li>Accepted payment methods: Cash, Bank Transfer, GCash.</li>
                  </ul>
                </div>

                <div className="ula-terms-group">
                  <strong>11. Early Payment Policy</strong>
                  <ul>
                    <li>Members may repay early at any time.</li>
                    <li>Interest is charged only up to the payment date.</li>
                    <li>No penalties for early settlement.</li>
                  </ul>
                </div>

                <div className="ula-terms-group">
                  <strong>12. Late Payment and Penalties</strong>
                  <ul>
                    <li>Late payments may incur an ongoing penalty fee.</li>
                    <li>Accounts past due beyond 60 days will be escalated.</li>
                    <li>Reach out to administration to apply for an extension.</li>
                  </ul>
                </div>
              </div>
              
              <label className="ula-terms-checkbox mt-3">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
                <span>I have read and agree to the IsangDiwa Loan Terms &amp; Conditions above.</span>
              </label>
            </div>
          </div>

          {/* Note */}
          <div className="user-loan-application-note-box">
            <p className="user-loan-application-note-text">
              <strong>Note:</strong> Your application will be reviewed within 2–3 business days. A late payment penalty of 3% per month applies after a 3-day grace period.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
            <button 
              type="button" 
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all cursor-pointer" 
              onClick={requestClose} 
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              disabled={loading || !allEligible || !calc || !selfieImage || !idImage || !disbursementMethod || !agreedToTerms}
            >
              {loading ? <span className="btn-spinner" /> : 'Submit Application'}
            </button>
          </div>

        </form>

      </div>

      {/* ── Camera Capture Modal ── */}
      {cameraOpen && (
        <div className="ula-camera-overlay" onClick={closeCamera}>
          <div className="ula-camera-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ula-camera-header">
              <h3 className="ula-camera-title">
                {cameraTarget === 'selfie' ? 'Capture Selfie with ID & Date' : 'Capture Government ID'}
              </h3>
              <button type="button" className="ula-camera-close" onClick={closeCamera}>
                <X size={20} />
              </button>
            </div>

            <div className="ula-camera-body">
              {cameraError ? (
                <div className="ula-camera-error">
                  <AlertTriangle size={32} color="#dc2626" />
                  <p>{cameraError}</p>
                  <button type="button" className="ula-retake-btn" onClick={() => openCamera(cameraTarget)}>
                    <RotateCcw size={14} /> Try Again
                  </button>
                </div>
              ) : (
                <>
                  <div className={`ula-camera-video-container ${cameraTarget === 'selfie' ? 'ula-camera-mirror' : ''}`}>
                    {capturedIdPreview ? (
                      <img src={capturedIdPreview} alt="Captured ID Preview" className="w-full h-full object-cover" />
                    ) : (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="ula-camera-video"
                      />
                    )}
                    {!cameraReady && !capturedIdPreview && (
                      <div className="ula-camera-loading">
                        <span className="btn-spinner text-blue-500" style={{ width: 28, height: 28 }} />
                        <p className="text-xs font-bold font-inter tracking-wide text-slate-200">Starting camera...</p>
                      </div>
                    )}
                    {idChecking && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2.5 text-white p-4 text-center">
                        <span className="btn-spinner text-blue-500" style={{ width: 28, height: 28 }} />
                        <p className="text-xs font-bold font-inter tracking-wide">Verifying ID with AI...</p>
                        <p className="text-[11px] text-slate-300">Checking document readability &amp; validity</p>
                      </div>
                    )}
                    {/* Guide overlay */}
                    {cameraReady && !capturedIdPreview && cameraTarget === 'selfie' && (
                      <div className="ula-camera-guide-selfie">
                        <div className="ula-camera-face-outline" />
                      </div>
                    )}
                    {cameraReady && !capturedIdPreview && cameraTarget === 'id' && (
                      <div className="ula-camera-guide-id">
                        <div className="ula-camera-id-outline" />
                      </div>
                    )}
                  </div>

                  {/* ID Detection Error Message */}
                  {idDetectionMsg && (
                    <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle size={16} className="shrink-0 text-rose-400" />
                      <span>{idDetectionMsg}</span>
                    </div>
                  )}

                  {/* Hint bar */}
                  {cameraReady && !capturedIdPreview && cameraHint && !idDetectionMsg && (
                    <div className="ula-camera-hint">
                      <AlertTriangle size={14} />
                      <span>{cameraHint}</span>
                    </div>
                  )}

                  {/* Instructions */}
                  {!capturedIdPreview && (
                    <div className="ula-camera-instructions">
                      {cameraTarget === 'selfie' ? (
                        <ul>
                          <li>Hold your government ID beside your face</li>
                          <li>Your face must be clearly visible and close to the camera</li>
                          <li>Include today's date (handwritten on paper)</li>
                        </ul>
                      ) : (
                        <ul>
                          <li>Capture a clear photo of the front of your valid government ID</li>
                          <li>All text and photo on the ID must be readable</li>
                          <li>Avoid glare, shadows, and blurriness</li>
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Capture / Action button */}
            {!cameraError && (
              <div className="ula-camera-actions">
                {capturedIdPreview ? (
                  !idChecking && idDetectionMsg && (
                    <button
                      type="button"
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                      onClick={() => {
                        setCapturedIdPreview(null);
                        setIdDetectionMsg('');
                      }}
                    >
                      <RotateCcw size={14} /> Retake Photo
                    </button>
                  )
                ) : (
                  <>
                    <button
                      type="button"
                      className="ula-camera-capture-btn"
                      onClick={capturePhoto}
                      disabled={!cameraReady || idChecking}
                    >
                      <div className="ula-camera-capture-ring">
                        <div className="ula-camera-capture-dot" />
                      </div>
                    </button>
                    <span className="ula-camera-capture-label">Tap to capture</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden canvas for capturing frames */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── Confirmation Modal (Retake / Remove) ── */}
      {confirmModal.isOpen && (
        <div 
          className="fixed inset-0 z-[100005] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        >
          <div 
            className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col gap-4 text-left font-inter"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${confirmModal.actionVariant === 'danger' ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'}`}>
                {confirmModal.actionVariant === 'danger' ? <Trash2 size={22} /> : <RotateCcw size={22} />}
              </div>
              <div className="w-full">
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {confirmModal.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10 w-full">
              <button
                type="button"
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-95 cursor-pointer ${confirmModal.actionVariant === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                onClick={() => {
                  if (confirmModal.type === 'delete_account' && confirmModal.accountToDelete) {
                    handleDeleteAccount(confirmModal.accountToDelete);
                  } else if (confirmModal.type === 'close_modal') {
                    onClose();
                  } else if (confirmModal.type === 'retake_selfie') {
                    openCamera('selfie');
                  } else if (confirmModal.type === 'remove_selfie') {
                    setSelfieImage(null);
                  } else if (confirmModal.type === 'retake_id') {
                    openCamera('id');
                  } else if (confirmModal.type === 'remove_id') {
                    setIdImage(null);
                  }
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
              >
                {confirmModal.actionText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Review & Confirm Modal ── */}
      {showReviewModal && reviewData && (
        <div 
          className="fixed inset-0 z-[100010] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowReviewModal(false)}
        >
          <div 
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] font-inter animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    Review Your Application
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Double-check your inputs before submitting.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => setShowReviewModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              
              {/* Loan Details Breakdown Card */}
              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Loan Summary</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                    {reviewData.loanTypeObj?.name}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Principal Amount</span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white font-dm">{fmt(reviewData.amount)}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Repayment Term</span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white">{reviewData.termMonths} {Number(reviewData.termMonths) === 1 ? 'Month' : 'Months'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Monthly Installment</span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-dm">{fmt(reviewData.monthlyPayment)} / mo</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Total Repayment</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white font-dm">{fmt(reviewData.totalRepayment)}</span>
                  </div>
                </div>
              </div>

              {/* Verification Photos Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 space-y-3">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">Identity Verification</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Selfie with ID</span>
                    {reviewData.selfieImage ? (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 h-24 bg-black">
                        <img src={reviewData.selfieImage} alt="Selfie Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <span className="text-xs text-rose-500">Not provided</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Government ID</span>
                    {reviewData.idImage ? (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 h-24 bg-black">
                        <img src={reviewData.idImage} alt="Government ID Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <span className="text-xs text-rose-500">Not provided</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Uploaded Documents List */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">Attached Documents</span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/10">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Certificate of Employment</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle size={13} /> {reviewData.coeFileName || 'Attached'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/10">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Income Tax Return (ITR)</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle size={13} /> {reviewData.itrFileName || 'Attached'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/10">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Payslip</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle size={13} /> {reviewData.payslipFileName || 'Attached'}
                    </span>
                  </div>
                  {reviewData.hasActiveLoan && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/10">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Active Loan Proof</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle size={13} /> {reviewData.activeLoanScreenshotFileName || 'Attached'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Disbursement Account Details */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">Disbursement Account</span>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/10">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    {reviewData.disbursementMethod === 'cash' ? 'Cash Pickup at Office' : reviewData.disbursementAccount}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                    Method: {reviewData.disbursementMethod}
                  </span>
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3">
              <button
                type="button"
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer"
                onClick={() => setShowReviewModal(false)}
                disabled={loading}
              >
                <Pencil size={14} />
                Edit Details
              </button>

              <button
                type="button"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                onClick={() => setShowFinalSubmitConfirm(true)}
                disabled={loading}
              >
                {loading ? <span className="btn-spinner" /> : (
                  <>
                    <Send size={14} />
                    Confirm & Submit Application
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Final Action Confirmation Dialog ── */}
      {showFinalSubmitConfirm && (
        <div 
          className="fixed inset-0 z-[100020] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowFinalSubmitConfirm(false)}
        >
          <div 
            className="relative w-full max-w-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col gap-4 text-left font-inter animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800/50">
                <ShieldCheck size={22} />
              </div>
              <div className="w-full">
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                  Submit Loan Application?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Are you sure all details are accurate? Once submitted, your application will be forwarded to credit officers for review and processing.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10 w-full">
              <button
                type="button"
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => setShowFinalSubmitConfirm(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                onClick={async () => {
                  setShowFinalSubmitConfirm(false);
                  await executeFinalSubmission();
                }}
                disabled={loading}
              >
                {loading ? <span className="btn-spinner" /> : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}