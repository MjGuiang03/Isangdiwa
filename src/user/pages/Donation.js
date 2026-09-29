import { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { 
  Banknote, CalendarDays, ChevronDown, Heart, Receipt, X, UploadCloud, 
  FileCheck2, ZoomIn, AlertCircle, CheckCircle2, ShieldCheck, Edit3, Clock, 
  Loader2, Copy, Check, Wallet, Landmark, Sparkles, RefreshCw, 
  Info, AlertTriangle 
} from 'lucide-react';
import useSwipeToClose, { DragHandle } from '../hooks/useSwipeToClose';

import { branchData, REGION_ORDER } from '../components/branchData';
import gcashQr from '../../assets/gcash_qr_only.jpg';
import puacLogo from '../../assets/optimized/puaclogo.webp';
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

const formatPhoneForInput = (raw) => {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length === 12) {
    return '0' + digits.slice(2);
  }
  if (digits.startsWith('09') && digits.length === 11) {
    return digits;
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return '0' + digits;
  }
  return digits.slice(0, 11);
};

const formatBankAccountNumber = (val) => {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '').slice(0, 20);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
};

const INVALID_SENDER_KEYWORDS = [
  'account', 'easy account', 'savings', 'current', 'checking', 'payroll',
  'wallet', 'gcash', 'maya', 'paymaya', 'bank', 'pesonet', 'instapay',
  'debit', 'credit', 'card', 'transfer', 'fund', 'funds', 'balance', 'source',
  'deposit', 'express', 'online', 'unibank', 'universal', 'bdo', 'bpi',
  'unionbank', 'metrobank', 'landbank', 'rcbc', 'security bank', 'pnb',
  'chinabank', 'load', 'cash-in', 'cash in', 'cash out', 'payment', 'receipt',
  'ref', 'reference', 'transaction', 'customer', 'merchant', 'from', 'to',
  'puac', 'pacific union', 'faithly', 'church'
];

const isValidPersonName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 70) return false;
  
  // A person name must NOT contain any digits (e.g. "EASY ACCOUNT 2")
  if (/\d/.test(trimmed)) return false;

  // Check against blacklisted banking keywords
  const lower = trimmed.toLowerCase();
  for (const kw of INVALID_SENDER_KEYWORDS) {
    const regex = new RegExp(`(^|\\b)${kw}(\\b|$)`, 'i');
    if (regex.test(lower)) return false;
  }

  // Must only contain letters (including accented/ñ), spaces, dots, hyphens, and apostrophes
  if (!/^[a-zA-ZñÑ\s.,'-]+$/.test(trimmed)) return false;

  // Must contain at least one letter
  if (!/[a-zA-ZñÑ]/.test(trimmed)) return false;

  return true;
};

const normalizeSubMethod = (extracted) => {
  if (!extracted) return '';
  const clean = String(extracted).trim().toLowerCase();

  // Digital Banks
  if (clean.includes('gotyme')) return 'GoTyme Bank';
  if (clean.includes('seabank')) return 'SeaBank';
  if (clean.includes('tonik')) return 'Tonik Bank';
  if (clean.includes('cimb')) return 'CIMB Bank';
  if (clean.includes('uno') && (clean.includes('digital') || clean.includes('bank'))) return 'UNO Digital Bank';
  if (clean.includes('uniondigital')) return 'UnionDigital Bank';
  if (clean === 'maya bank' || clean.includes('maya bank')) return 'Maya Bank';

  // Traditional Banks
  if (clean === 'bdo' || clean.includes('bdo') || clean.includes('banco de oro')) return 'BDO';
  if (clean === 'bpi' || clean.includes('bank of the philippine islands')) return 'BPI';
  if (clean.includes('metrobank')) return 'Metrobank';
  if (clean.includes('unionbank') || clean.includes('union bank')) return 'Unionbank';
  if (clean.includes('landbank') || clean.includes('land bank')) return 'Landbank';
  if (clean.includes('security bank')) return 'Security Bank';
  if (clean.includes('rcbc')) return 'RCBC';
  if (clean.includes('pnb') || clean.includes('philippine national bank')) return 'PNB';
  if (clean.includes('china bank') || clean.includes('chinabank')) return 'China Bank';
  if (clean.includes('eastwest') || clean.includes('east west')) return 'EastWest Bank';

  // E-Wallets
  if (clean.includes('gcash')) return 'GCash';
  if (clean === 'maya' || clean.includes('paymaya')) return 'Maya';
  if (clean.includes('grab')) return 'GrabPay';
  if (clean.includes('shopee')) return 'ShopeePay';
  if (clean.includes('coins')) return 'Coins.ph';

  // Transfer Networks & Cards
  if (clean.includes('instapay')) return 'Instapay';
  if (clean.includes('pesonet')) return 'PESONet';
  if (clean.includes('mastercard') || clean.includes('master card')) return 'Master Card';
  if (clean.includes('visa')) return 'Visa';

  return 'Others';
};

const QUICK_AMOUNTS = [25, 50, 100, 250];

const CATEGORIES = [
  { name: 'General Fund', description: 'Church operations and ministry', icon: <img src={iconGeneral} alt="General Fund" className="user-3d-cat-icon" /> },
  { name: 'Children\'s Department', description: "Children's programs and activities", icon: <img src={iconChildren} alt="Children's Department" className="user-3d-cat-icon" /> },
  { name: 'Men\'s Department', description: 'Men\'s programs and activities', icon: <img src={iconBuilding} alt="Men's Department" className="user-3d-cat-icon" /> },
  { name: 'Women\'s Department', description: 'Women\'s programs and activities', icon: <img src={iconGeneral} alt="Women's Department" className="user-3d-cat-icon" /> },
  { name: 'Youth Department', description: 'Youth programs and events', icon: <img src={iconYouth} alt="Youth Department" className="user-3d-cat-icon" /> },
  { name: 'Mission Fund', description: 'Missionary work and outreach programs', icon: <img src={iconMission} alt="Mission Fund" className="user-3d-cat-icon" /> },
];

const fetcherSingle = (url) => {
    const token = localStorage.getItem('token');
    if (!token) return Promise.resolve(null);
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => {
        if (res.status === 401) { window.location.href = '/'; return null; }
        return res.json();
    }).catch(() => null);
};

export default function Donation() {
  const { user, profile } = useAuth();
  const currentUser = profile || user;

  const defaultName = useMemo(() => {
    return currentUser?.fullName || currentUser?.full_name || currentUser?.name || '';
  }, [currentUser]);

  const defaultPhone = useMemo(() => {
    const raw = currentUser?.phone || currentUser?.phoneNumber || currentUser?.contact || '';
    return formatPhoneForInput(raw);
  }, [currentUser]);

  const [donationAmount, setDonationAmount] = useState('');
  const [donationCategory, setDonationCategory] = useState('');
  const [donationCommunity, setDonationCommunity] = useState(currentUser?.branch || '');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [subMethod, setSubMethod] = useState('');
  const [customSubMethod, setCustomSubMethod] = useState('');
  const [isAnotherAccount, setIsAnotherAccount] = useState(false);
  const [customAccountName, setCustomAccountName] = useState('');
  const [customAccountNumber, setCustomAccountNumber] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [isRecurring] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  // eslint-disable-next-line no-unused-vars
  const [historyPage] = useState(1);
  const [selectedDonation, setSelectedDonation] = useState(null);

  const handleSelectPaymentMethod = (method) => {
    if (paymentMethod === method) {
      setPaymentMethod('');
      setSubMethod('');
      setCustomSubMethod('');
      return;
    }
    setPaymentMethod(method);
    setCustomSubMethod('');
    setTouched(prev => ({ ...prev, paymentMethod: true }));

    if (method === 'E-Wallet') {
      if (!subMethod || subMethod === 'Bank') setSubMethod('GCash');
    } else if (method === 'Bank') {
      setSubMethod('');
    }
  };
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [approvalMethod, setApprovalMethod] = useState('gateway');
  const [proofFile, setProofFile] = useState(null);
  const [proofBase64, setProofBase64] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [touched, setTouched] = useState({});
  const [receiptValidating, setReceiptValidating] = useState(false);
  const [receiptValid, setReceiptValid] = useState(null); // null = not checked, true = valid, false = invalid
  const [receiptReason, setReceiptReason] = useState('');
  const [acknowledgePublicly, setAcknowledgePublicly] = useState(false);
  const [copiedField, setCopiedField] = useState('');

  /* ── Redesign: Church Payment Tab & AI Auto-fill States ── */
  const [churchTab, setChurchTab] = useState('gcash'); // 'gcash' | 'bank'
  const [extractedData, setExtractedData] = useState(null);
  const [autoFilledFields, setAutoFilledFields] = useState([]);
  const [isDuplicateReceipt, setIsDuplicateReceipt] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleCopy = (text, field) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    }
  };

  const handleBlur = (field) => setTouched(prev => ({ ...prev, [field]: true }));

  /* ── History Modal States ── */
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [modalPage, setModalPage] = useState(1);
  const [modalCategory, setModalCategory] = useState('');
  const [modalPaymentMethod, setModalPaymentMethod] = useState('');
  const MODAL_LIMIT = 5;
  const HISTORY_PER_PAGE = 5;

  const token = localStorage.getItem('token');

  const { data: historyData, mutate: mutateHistory, isValidating: isHistoryValidating } = useSWR(
    token ? `${API}/api/donations/my-donations?page=${historyPage}&limit=${HISTORY_PER_PAGE}` : null,
    fetcherSingle,
    { revalidateOnFocus: false, dedupingInterval: 30000, keepPreviousData: true }
  );

  const { data: settingsData } = useSWR(
    `${API}/api/settings/public`,
    fetcherSingle,
    { revalidateOnFocus: false, dedupingInterval: 30000, keepPreviousData: true }
  );

  const stats = useMemo(() => historyData?.success ? (historyData.stats || { totalDonated: 0, thisYearTotal: 0, totalCount: 0 }) : { totalDonated: 0, thisYearTotal: 0, totalCount: 0 }, [historyData]);
  const loading = !historyData && isHistoryValidating;

  useEffect(() => {
    if (!settingsData) return;
    if (settingsData.success) {
      setApprovalMethod(settingsData.paymentApprovalMethod || 'gateway');
    }
  }, [settingsData]);

  const modalUrl = isHistoryModalOpen 
    ? `${API}/api/donations/my-donations?page=${modalPage}&limit=${MODAL_LIMIT}${modalCategory ? `&category=${modalCategory}` : ''}${modalPaymentMethod ? `&paymentMethod=${modalPaymentMethod}` : ''}`
    : null;

  const { data: modalData, isValidating: isModalValidating } = useSWR(modalUrl, fetcherSingle, { revalidateOnFocus: false, dedupingInterval: 30000, keepPreviousData: true });

  const modalHistory = useMemo(() => modalData?.success ? (modalData.donations || []) : [], [modalData]);
  const modalTotalPages = useMemo(() => modalData?.success ? (modalData.totalPages || 1) : 1, [modalData]);
  const modalLoading = !modalData && isModalValidating;

  useEffect(() => {
    if (currentUser?.branch && !donationCommunity) {
      setDonationCommunity(currentUser.branch);
    }
  }, [currentUser, donationCommunity]);

  const processReceiptFile = (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      setFormError('Only image files (PNG, JPG, JPEG, WEBP) are allowed as proof of payment.');
      setProofFile(null);
      setProofBase64('');
      setReceiptValid(null);
      setReceiptReason('');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('File size exceeds the 5MB limit. Please upload a smaller image.');
      setProofFile(null);
      setProofBase64('');
      setReceiptValid(null);
      setReceiptReason('');
      return;
    }

    setFormError('');
    setProofFile(file);
    setReceiptValid(null);
    setReceiptReason('');
    setIsDuplicateReceipt(false);
    setDuplicateInfo(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Result = reader.result;
      setProofBase64(base64Result);

      // AI Receipt Validation & Data Extraction
      setReceiptValidating(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API}/api/donations/validate-receipt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ image: base64Result }),
        });
        const data = await res.json();

        if (data.success && data.isReceipt) {
          setReceiptValid(true);
          setReceiptReason(data.fallback ? data.reason : '');

          if (data.isDuplicate) {
            setIsDuplicateReceipt(true);
            setDuplicateInfo(data.duplicateInfo);
          } else {
            setIsDuplicateReceipt(false);
            setDuplicateInfo(null);
          }

          if (data.extracted) {
            setExtractedData(data.extracted);
            const newAutoFilled = [];

            // Auto-fill Amount
            if (data.extracted.amount && Number(data.extracted.amount) > 0) {
              setDonationAmount(Number(data.extracted.amount).toLocaleString('en-US'));
              newAutoFilled.push('amount');
            }

            // Auto-fill Reference Number
            if (data.extracted.referenceNumber) {
              setReferenceNumber(data.extracted.referenceNumber);
              newAutoFilled.push('referenceNumber');
            }

            // Auto-fill Payment Method & Sub-method
            const rawSubMethod = data.extracted?.subMethod ? String(data.extracted.subMethod).trim() : '';
            const normalizedSub = normalizeSubMethod(rawSubMethod);

            const isEWalletMethod = ['GCash', 'Maya', 'GrabPay', 'ShopeePay', 'Coins.ph'].includes(normalizedSub);
            const detectedMethod = data.extracted?.paymentMethod || (isEWalletMethod ? 'E-Wallet' : 'Bank');

            setPaymentMethod(detectedMethod);
            newAutoFilled.push('paymentMethod');

            if (rawSubMethod) {
              if (normalizedSub === 'Others') {
                setSubMethod('Others');
                setCustomSubMethod(rawSubMethod);
              } else {
                setSubMethod(normalizedSub);
                setCustomSubMethod('');
              }
              newAutoFilled.push('subMethod');
            }

            // Auto-fill Sender Account Name & Account Option
            const rawSenderName = data.extracted?.senderName ? String(data.extracted.senderName).trim() : '';
            const isSenderNameValid = isValidPersonName(rawSenderName);

            if (isSenderNameValid) {
              // Valid human person name extracted — choose Another Account and pre-fill so user can review or modify
              setIsAnotherAccount(true);
              setCustomAccountName(rawSenderName);
              newAutoFilled.push('accountName');
            } else {
              // AI could not analyze sender name accurately (e.g. bank product type, masked, or null)
              // Automatically choose Another Account so user can manually type their info!
              setIsAnotherAccount(true);
              setCustomAccountName('');
            }

            // Auto-fill Sender Account Number if detected
            if (data.extracted?.senderNumber) {
              const rawNum = String(data.extracted.senderNumber).replace(/\D/g, '');

              if (detectedMethod === 'Bank') {
                if (rawNum.length >= 8 && rawNum.length <= 20) {
                  setBankAccountNumber(rawNum);
                  setCustomAccountNumber(rawNum);
                  newAutoFilled.push('accountNumber');
                }
              } else {
                // E-Wallet
                const cleanPhone = formatPhoneForInput(rawNum);
                if (cleanPhone.startsWith('09') && cleanPhone.length === 11) {
                  setCustomAccountNumber(cleanPhone);
                  newAutoFilled.push('accountNumber');
                }
              }
            } else {
              setCustomAccountNumber('');
              setBankAccountNumber('');
            }

            setAutoFilledFields(newAutoFilled);

            // Immediately mark inputs as touched so any fields not filled by the receipt turn red right away!
            setTouched({
              amount: true,
              category: true,
              community: true,
              paymentMethod: true,
              subMethod: true,
              referenceNumber: true,
              customAccountName: true,
              customAccountNumber: true,
              bankAccountNumber: true,
            });

            const missing = [];
            if (!newAutoFilled.includes('amount') && (!data.extracted?.amount || Number(data.extracted.amount) <= 0)) {
              missing.push('Amount');
            }
            if (!donationCategory) missing.push('Donation Category');
            if (!donationCommunity) missing.push('Community');
            if (!newAutoFilled.includes('paymentMethod') && !paymentMethod) missing.push('Payment Method');
            if (!newAutoFilled.includes('subMethod') && !subMethod) missing.push('Payment Option');
            if (!newAutoFilled.includes('referenceNumber') && !referenceNumber) missing.push('Reference Number');
            if (!newAutoFilled.includes('accountName')) {
              missing.push('Sender Account Name');
            }
            if (!newAutoFilled.includes('accountNumber')) {
              missing.push(detectedMethod === 'Bank' ? 'Sender Bank Account Number' : 'Sender Mobile Number');
            }

            if (missing.length > 0) {
              toast.warning(`Receipt scanned. Please complete the highlighted fields: ${missing.join(', ')}`);
            } else {
              toast.success('Details auto-filled from receipt! You can review or edit below.');
            }
          }
        } else if (data.success && !data.isReceipt) {
          setReceiptValid(false);
          setReceiptReason(data.reason || 'This does not appear to be a valid payment receipt.');
          setFormError(data.reason || 'Invalid proof of payment. Please upload a real receipt or transaction screenshot.');
          toast.error(data.reason || 'Invalid receipt. Please upload a real payment receipt or transaction screenshot.');
          // Do not reset proofFile so the image stays visible with the prominent red error state
        } else {
          setReceiptValid(true);
          setReceiptReason('Could not verify. Accepted for manual review.');
        }
      } catch (err) {
        console.error('Receipt validation error:', err);
        setReceiptValid(true);
        setReceiptReason('Could not verify. Accepted for manual review.');
      } finally {
        setReceiptValidating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processReceiptFile(file);
      e.target.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processReceiptFile(file);
    }
  };

  const handleResetAutoFill = () => {
    setProofFile(null);
    setProofBase64('');
    setReceiptValid(null);
    setReceiptReason('');
    setExtractedData(null);
    setAutoFilledFields([]);
    setIsDuplicateReceipt(false);
    setDuplicateInfo(null);
    setReferenceNumber('');
    setIsAnotherAccount(false);
    setCustomAccountName('');
    setCustomSubMethod('');
    toast.info('Receipt removed. You can enter details manually or upload another receipt.');
  };

  const handleDonate = async () => {
    setFormError('');
    const num = Number(String(donationAmount).replace(/,/g, ''));
    if (!num || num <= 0) { setFormError('Please enter a valid donation amount.'); return; }
    if (!donationCategory) { setFormError('Please select a donation category.'); return; }
    if (!donationCommunity) { setFormError('Please select a community/branch.'); return; }
    if (!paymentMethod) { setFormError('Please select a payment method.'); return; }
    
    const resolvedAccountName = isAnotherAccount 
      ? customAccountName 
      : (defaultName || 'Faithly Member');

    const resolvedAccountNumber = isAnotherAccount 
      ? customAccountNumber 
      : (paymentMethod === 'E-Wallet' ? defaultPhone : bankAccountNumber);

    const finalSubMethod = subMethod === 'Others' ? customSubMethod.trim() : subMethod;

    if (approvalMethod === 'manual') {
      if (!proofBase64) { setFormError('Please upload your proof of payment.'); return; }
      if (!finalSubMethod) { 
        setFormError(subMethod === 'Others' ? 'Please specify your bank or payment provider.' : `Please select a ${paymentMethod} option.`); 
        return; 
      }
      if (!resolvedAccountName.trim() || resolvedAccountName.trim().length < 2) { 
        setFormError(paymentMethod === 'Bank' ? 'Please enter the sender bank account name.' : 'Please enter the sender account name.'); 
        return; 
      }
      if (isAnotherAccount && !isValidPersonName(customAccountName)) {
        setFormError('Please enter a valid sender person name (not an account type or number).');
        return;
      }
      if (paymentMethod === 'E-Wallet') {
        if (!resolvedAccountNumber.startsWith('09') || resolvedAccountNumber.trim().length !== 11) {
          setFormError('Sender Mobile Number must be an 11-digit number starting with 09 (e.g. 09123456789).');
          return;
        }
      } else if (paymentMethod === 'Bank') {
        if (resolvedAccountNumber.trim().length < 8 || resolvedAccountNumber.trim().length > 20) {
          setFormError('Sender Bank Account Number must be between 8 and 20 digits.');
          return;
        }
      }
      if (!referenceNumber.trim()) {
        setFormError('Please enter the transaction reference number from your receipt.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/donations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          amount: num, 
          category: donationCategory, 
          community: donationCommunity, 
          paymentMethod, 
          subMethod: finalSubMethod, 
          accountName: resolvedAccountName, 
          accountNumber: resolvedAccountNumber, 
          referenceNumber: referenceNumber || extractedData?.referenceNumber || '',
          isRecurring, 
          proofOfPayment: proofBase64, 
          acknowledged: acknowledgePublicly 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to record donation');
      
      setIsConfirmModalOpen(false);
      if (approvalMethod === 'manual') {
        setSuccessData({ amount: num, category: donationCategory });
        setDonationAmount('');
        setDonationCategory('');
        setDonationCommunity(currentUser?.branch || '');
        setPaymentMethod('');
        setSubMethod('');
        setCustomSubMethod('');
        setIsAnotherAccount(false);
        setCustomAccountName('');
        setCustomAccountNumber('');
        setBankAccountNumber('');
        setProofFile(null);
        setProofBase64('');
        setReceiptValid(null);
        setReceiptReason('');
        setExtractedData(null);
        setAutoFilledFields([]);
        setReferenceNumber('');
        setIsDuplicateReceipt(false);
        setDuplicateInfo(null);
        mutateHistory();
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setFormError(err.message || 'An error occurred while submitting your donation.');
    } finally {
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
  const resolvedSubMethod = subMethod === 'Others' ? customSubMethod.trim() : subMethod;

  const subMethodError = touched.subMethod && approvalMethod === 'manual' && paymentMethod
    ? !subMethod
      ? `Please select a ${paymentMethod} option.`
      : subMethod === 'Others' && touched.customSubMethod && !customSubMethod.trim()
      ? 'Please specify your bank or payment provider.'
      : ''
    : '';
  
  const resolvedAccountName = isAnotherAccount 
    ? customAccountName 
    : (defaultName || 'Faithly Member');

  const resolvedAccountNumber = isAnotherAccount 
    ? customAccountNumber 
    : (paymentMethod === 'E-Wallet' ? defaultPhone : bankAccountNumber);

  const isAccountNameValid = isAnotherAccount
    ? customAccountName.trim().length >= 2 && isValidPersonName(customAccountName)
    : resolvedAccountName.trim().length >= 2;

  const isAccountNumValid = 
    paymentMethod === 'E-Wallet'
      ? resolvedAccountNumber.trim().length === 11 && resolvedAccountNumber.startsWith('09')
      : paymentMethod === 'Bank'
      ? resolvedAccountNumber.trim().length >= 8 && resolvedAccountNumber.trim().length <= 20
      : false;

  const accountNameError = isAnotherAccount && touched.customAccountName && approvalMethod === 'manual' && paymentMethod
    ? !customAccountName.trim()
      ? paymentMethod === 'Bank' ? 'Sender bank account name is required.' : 'Sender account name is required.'
      : customAccountName.trim().length < 2
      ? 'Account name must be at least 2 characters.'
      : !isValidPersonName(customAccountName)
      ? 'Please enter a valid person name (not an account type or number).'
      : ''
    : '';

  const isNumTouched = isAnotherAccount 
    ? touched.customAccountNumber 
    : (paymentMethod === 'Bank' ? touched.bankAccountNumber : false);

  const accountNumberError = isNumTouched && approvalMethod === 'manual' && paymentMethod
    ? !resolvedAccountNumber.trim()
      ? paymentMethod === 'Bank' ? 'Sender bank account number is required.' : 'Sender mobile number is required.'
      : paymentMethod === 'E-Wallet'
        ? !resolvedAccountNumber.startsWith('09')
          ? 'Mobile number must start with 09 (e.g. 09123456789).'
          : resolvedAccountNumber.length !== 11
          ? `Mobile number must be exactly 11 digits (${resolvedAccountNumber.length}/11).`
          : ''
        : paymentMethod === 'Bank'
          ? resolvedAccountNumber.length < 8
            ? `Bank account number must be at least 8 digits (${resolvedAccountNumber.length} entered).`
            : resolvedAccountNumber.length > 20
            ? 'Bank account number cannot exceed 20 digits.'
            : ''
          : ''
    : '';

  const referenceNumberError = touched.referenceNumber && approvalMethod === 'manual'
    ? !referenceNumber.trim()
      ? 'Transaction reference number is required.'
      : ''
    : '';

  const isFormComplete = 
    currentNum > 0 &&
    currentNum <= 500000 &&
    donationCategory !== '' &&
    donationCommunity !== '' &&
    paymentMethod !== '' &&
    (approvalMethod !== 'manual' || (
      proofBase64 !== '' &&
      receiptValid === true &&
      !receiptValidating &&
      !isDuplicateReceipt &&
      resolvedSubMethod !== '' &&
      referenceNumber.trim() !== '' &&
      isAccountNameValid &&
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

        {/* Two-column grid (50/50 Desktop Split) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-1">

          {/* ══════════════════════════════════════════════════════════════════
              LEFT SIDE: Church Information, Official Channels & Where Giving Goes
             ══════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-6 space-y-6">

            {/* Card 1: Official Church Giving Channels */}
            <div className="p-5 sm:p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-md shadow-slate-200/50 dark:shadow-none font-inter space-y-5">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <img
                    src={puacLogo}
                    alt="PUAC Logo"
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-white/10 shadow-xs shrink-0 bg-white"
                  />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">
                      Church Giving Channels
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Philippine United Apostolic Church (IsangDiwa)
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck size={12} className="text-emerald-600 dark:text-emerald-400" />
                  Official Channel
                </span>
              </div>

              {/* Channel Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setChurchTab('gcash')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold font-inter transition-all flex items-center justify-center gap-2 cursor-pointer border-none ${
                    churchTab === 'gcash'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-transparent'
                  }`}
                >
                  <Wallet size={15} />
                  <span>GCash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChurchTab('bank')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold font-inter transition-all flex items-center justify-center gap-2 cursor-pointer border-none ${
                    churchTab === 'bank'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-transparent'
                  }`}
                >
                  <Landmark size={15} />
                  <span>Bank Transfer</span>
                </button>
              </div>

              {/* Channel Details Content */}
              {churchTab === 'gcash' ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/5">
                    {/* GCash QR Thumbnail */}
                    <div
                      className="relative group cursor-pointer shrink-0 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-xs bg-white p-2 hover:border-blue-500 hover:shadow-md transition-all"
                      onClick={() => setPreviewImage({ src: gcashQr, name: 'IsangDiwa Official GCash QR Code' })}
                      title="Click to enlarge QR Code"
                    >
                      <img src={gcashQr} alt="IsangDiwa GCash QR" className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-lg" />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold rounded-lg backdrop-blur-[1px]">
                        <ZoomIn size={18} className="mb-1" />
                        <span>Click to Enlarge</span>
                      </div>
                    </div>

                    {/* GCash Details */}
                    <div className="flex-1 w-full space-y-2 text-xs font-inter">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 dark:border-white/5">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Account Name:</span>
                        <span className="font-bold text-slate-900 dark:text-white">IsangDiwa Church</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">GCash Number:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-slate-900 dark:text-white text-xs sm:text-sm">0912 345 6789</span>
                          <button
                            type="button"
                            onClick={() => handleCopy('09123456789', 'gcash')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 transition-colors cursor-pointer text-xs font-semibold"
                          >
                            {copiedField === 'gcash' ? (
                              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold"><Check size={12} /> Copied</span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px]"><Copy size={12} /> Copy</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Bank Transfer Details */
                <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/5 space-y-2.5 text-xs font-inter">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 dark:border-white/5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Bank Name:</span>
                    <span className="font-bold text-slate-900 dark:text-white">BDO Unibank</span>
                  </div>
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 dark:border-white/5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Account Name:</span>
                    <span className="font-bold text-slate-900 dark:text-white text-right">Philippine United Apostolic Church</span>
                  </div>
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 dark:border-white/5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Account Number:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono text-slate-900 dark:text-white text-xs sm:text-sm">0012 3456 7890</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('001234567890', 'bank')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 transition-colors cursor-pointer text-xs font-semibold"
                      >
                        {copiedField === 'bank' ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold"><Check size={12} /> Copied</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px]"><Copy size={12} /> Copy</span>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-0.5 m-0">
                    Accepts InstaPay and PESONet transfers from all Philippine banks (BDO, BPI, Metrobank, Unionbank, etc.).
                  </p>
                </div>
              )}

              {/* 3 Simple Steps Guide Banner */}
              <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 rounded-xl space-y-2">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Info size={14} className="text-blue-600 dark:text-blue-400" />
                  How to give in 3 simple steps
                </span>
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pl-4 list-decimal">
                  <li>Transfer using the official QR code or account details above.</li>
                  <li>Save or take a screenshot of your transaction receipt.</li>
                  <li>Upload the receipt on the right to auto-fill your donation form.</li>
                </ol>
              </div>
            </div>

            {/* Card 2: Where Your Giving Goes */}
            <div className="p-5 sm:p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-md shadow-slate-200/50 dark:shadow-none space-y-4 font-inter">
              <div className="pb-3 border-b border-slate-100 dark:border-white/10">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">
                  Where Your Giving Goes
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Every contribution directly empowers church missions and ministries
                </p>
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

          {/* ══════════════════════════════════════════════════════════════════
              RIGHT SIDE: Make a Donation Form (Upload Receipt First + Manual Inputs)
             ══════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-6 space-y-5">
            <div className="p-5 sm:p-6 bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-md shadow-slate-200/50 dark:shadow-none font-inter space-y-5">
              
              {/* Form Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-inter">
                    Make a Donation
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Upload receipt first to auto-fill or enter details manually
                  </p>
                </div>
                {proofFile && (
                  <button
                    type="button"
                    onClick={handleResetAutoFill}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors cursor-pointer bg-transparent border-none"
                    title="Reset receipt and auto-filled values"
                  >
                    <RefreshCw size={12} />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  1. UPLOAD RECEIPT (At the Very Top)
                 ───────────────────────────────────────────────────────────── */}
              {approvalMethod === 'manual' && (
                <div className="space-y-2 pb-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Upload Proof of Payment <span className="text-red-500">*</span>
                    </label>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/50">
                      <Sparkles size={11} className="text-blue-600 dark:text-blue-400" />
                      AI Auto-Fill
                    </span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {/* Persistent Invalid Receipt Banner (never disappears when invalid receipt is uploaded) */}
                  {!proofFile && receiptValid === false && !receiptValidating && (
                    <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 flex items-start gap-2.5 mb-2.5">
                      <AlertCircle size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="text-xs font-bold text-red-800 dark:text-red-300">
                          Invalid Proof of Payment
                        </p>
                        <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed">
                          {receiptReason || 'The uploaded file was not recognized as a valid payment receipt. Please upload a clear photo or transaction screenshot.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {!proofFile ? (
                    /* Interactive Drag & Drop Box */
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 text-center select-none group ${
                        isDragging
                          ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 ring-4 ring-blue-500/20 scale-[1.01]'
                          : receiptValid === false
                          ? 'border-red-400 bg-red-50/30 dark:bg-red-950/20 hover:border-red-500'
                          : 'border-slate-300 dark:border-white/15 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 hover:border-blue-400 dark:hover:border-blue-500/60'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2.5 group-hover:scale-110 transition-all shadow-xs ${
                        receiptValid === false
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                          : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white'
                      }`}>
                        <UploadCloud size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span className="text-blue-600 dark:text-blue-400 underline underline-offset-2">Upload your receipt</span> or drag & drop here
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                        Instant auto-fill for Amount, Method, and Reference Number
                      </p>
                      <span className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        Supports PNG, JPG, JPEG, WEBP (up to 5MB)
                      </span>
                    </div>
                  ) : (
                    /* Uploaded Receipt Preview & Status Card */
                    <div className={`p-3.5 rounded-2xl border transition-all ${
                      receiptValidating
                        ? 'border-blue-400/80 bg-blue-50/30 dark:bg-blue-950/20'
                        : isDuplicateReceipt
                        ? 'border-amber-400/80 bg-amber-50/30 dark:bg-amber-950/20'
                        : receiptValid === true
                        ? 'border-emerald-400/80 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : receiptValid === false
                        ? 'border-red-500 bg-red-50/25 dark:bg-red-950/25'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}>
                      {/* Top info row */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/60 dark:border-white/5">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <FileCheck2 size={16} className={receiptValid === false ? 'text-red-500 shrink-0' : 'text-emerald-500 shrink-0'} />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {proofFile.name}
                          </span>
                          {proofFile.size && (
                            <span className="text-[10px] font-normal text-slate-400 shrink-0">
                              ({(proofFile.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer border-none bg-transparent font-medium"
                            disabled={receiptValidating}
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={handleResetAutoFill}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border-none bg-transparent"
                            title="Remove receipt"
                            disabled={receiptValidating}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Image Preview & Laser Scan Overlay */}
                      <div
                        className="relative w-full max-h-48 overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-900/5 dark:bg-black/40 flex items-center justify-center p-2 cursor-pointer group"
                        onClick={() => !receiptValidating && setPreviewImage({ src: proofBase64, name: proofFile.name })}
                      >
                        <img
                          src={proofBase64}
                          alt="Receipt preview"
                          className={`max-h-44 max-w-full object-contain rounded-lg transition-all ${
                            receiptValidating ? 'opacity-40 blur-[1px]' : 'group-hover:scale-[1.02]'
                          }`}
                        />

                        {/* Scanning Overlay */}
                        {receiptValidating && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/50 backdrop-blur-[2px] rounded-xl z-10">
                            <Loader2 size={32} className="text-white animate-spin" />
                            <p className="text-xs font-bold text-white tracking-wide">
                              Scanning receipt with AI...
                            </p>
                            <p className="text-[11px] text-blue-200">
                              Auto-populating donation details below
                            </p>
                          </div>
                        )}

                        {!receiptValidating && (
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[1px] rounded-xl">
                            <ZoomIn size={16} /> Click to enlarge
                          </div>
                        )}
                      </div>

                      {/* Duplicate Alert Banner */}
                      {isDuplicateReceipt && !receiptValidating && (
                        <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                          <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                            <AlertTriangle size={15} className="shrink-0" />
                            <span>Duplicate Receipt Warning</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            This reference number was already recorded in our system {duplicateInfo?.date ? `on ${duplicateInfo.date}` : ''} {duplicateInfo?.amount ? `for ₱${Number(duplicateInfo.amount).toLocaleString()}` : ''}. Please check if you have already submitted this donation.
                          </p>
                        </div>
                      )}

                      {/* Valid Verified Auto-fill Banner */}
                      {receiptValid === true && !receiptValidating && !isDuplicateReceipt && (
                        <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2">
                          <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                              Receipt Verified & Details Populated
                            </p>
                            <p className="text-[10.5px] text-emerald-700/80 dark:text-emerald-400/80 leading-tight">
                              Detected inputs have been auto-filled below. Please complete any highlighted fields.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Missing Fields Action Banner */}
                      {receiptValid === true && !receiptValidating && (
                        (() => {
                          const missing = [];
                          if (!donationAmount || Number(String(donationAmount).replace(/,/g, '')) <= 0) missing.push('Donation Amount');
                          if (!donationCategory) missing.push('Donation Category');
                          if (!donationCommunity) missing.push('Community');
                          if (!paymentMethod) missing.push('Payment Method');
                          if (paymentMethod && !subMethod) missing.push(`${paymentMethod} Option`);
                          if (!referenceNumber.trim()) missing.push('Reference Number');

                          if (missing.length === 0) return null;

                          return (
                            <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                                <AlertTriangle size={15} className="shrink-0" />
                                <span>Manual Input Required for Highlighted Fields</span>
                              </div>
                              <p className="text-[11px] leading-relaxed">
                                The receipt did not specify: <strong className="font-semibold text-amber-950 dark:text-amber-100">{missing.join(', ')}</strong>. These inputs are highlighted in red below for you to complete.
                              </p>
                            </div>
                          );
                        })()
                      )}

                      {/* Invalid Receipt Banner */}
                      {receiptValid === false && !receiptValidating && (
                        <div className="mt-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 flex items-start gap-2.5">
                          <AlertCircle size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <p className="text-xs font-bold text-red-800 dark:text-red-300">
                              Invalid Proof of Payment
                            </p>
                            <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed">
                              {receiptReason || 'The uploaded image could not be verified as a valid payment receipt. Please upload a clear photo or transaction screenshot.'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  2. MANUAL INPUT FIELDS (Underneath Upload, 100% Editable)
                 ───────────────────────────────────────────────────────────── */}
              <div className="space-y-4 pt-1">
                
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Donation Details
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    All fields remain editable
                  </span>
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Donation Amount <span className="text-red-500">*</span>
                      </label>
                      {autoFilledFields.includes('amount') ? (
                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-blue-200/80 dark:border-blue-900/50">
                          <Sparkles size={10} /> Auto-filled
                        </span>
                      ) : touched.amount && (!donationAmount || currentNum <= 0) ? (
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-red-200 dark:border-red-900/50">
                          <AlertCircle size={10} /> Needs manual input
                        </span>
                      ) : null}
                    </div>
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
                    <div className="flex items-center gap-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Donation Category <span className="text-red-500">*</span>
                      </label>
                      {touched.category && !donationCategory && (
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-red-200 dark:border-red-900/50">
                          <AlertCircle size={10} /> Needs manual selection
                        </span>
                      )}
                    </div>
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
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500/20 ring-1 ring-red-500/30' 
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
                    <div className="flex items-center gap-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Community <span className="text-red-500">*</span>
                      </label>
                      {touched.community && !donationCommunity && (
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-red-200 dark:border-red-900/50">
                          <AlertCircle size={10} /> Needs selection
                        </span>
                      )}
                    </div>
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
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500/20 ring-1 ring-red-500/30' 
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Payment Method <span className="text-red-500">*</span>
                      </label>
                      {autoFilledFields.includes('paymentMethod') ? (
                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-blue-200/80 dark:border-blue-900/50">
                          <Sparkles size={10} /> Auto-filled
                        </span>
                      ) : touched.paymentMethod && !paymentMethod ? (
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-red-200 dark:border-red-900/50">
                          <AlertCircle size={10} /> Needs selection
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className={`grid grid-cols-2 gap-3 p-1 rounded-2xl ${
                    touched.paymentMethod && !paymentMethod ? 'border border-red-500 bg-red-50/20 dark:bg-red-950/20 p-1.5' : ''
                  }`}>
                    <button
                      type="button"
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                        paymentMethod === 'E-Wallet' 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20 font-bold' 
                          : 'bg-blue-50/70 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60 hover:bg-blue-100/80'
                      }`}
                      onClick={() => handleSelectPaymentMethod('E-Wallet')}
                      disabled={submitting}
                    >
                      <Wallet size={18} className="shrink-0" />
                      <span>E-Wallet</span>
                    </button>
                    <button
                      type="button"
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                        paymentMethod === 'Bank' 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20 font-bold' 
                          : 'bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60 hover:bg-indigo-100/80'
                      }`}
                      onClick={() => handleSelectPaymentMethod('Bank')}
                      disabled={submitting}
                    >
                      <Landmark size={18} className="shrink-0" />
                      <span>Bank Transfer</span>
                    </button>
                  </div>

                  {/* SubMethod Selector (GCash/Maya or Specific Bank) */}
                  {paymentMethod && approvalMethod === 'manual' && (
                    <div className="pt-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {paymentMethod} Option <span className="text-red-500">*</span>
                          </label>
                          {autoFilledFields.includes('subMethod') ? (
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-blue-200/80 dark:border-blue-900/50">
                              <Sparkles size={10} /> Auto-filled
                            </span>
                          ) : touched.subMethod && !subMethod ? (
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-red-200 dark:border-red-900/50">
                              <AlertCircle size={10} /> Needs selection
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {paymentMethod === 'E-Wallet' ? (
                        <select 
                          className={`w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs text-slate-900 dark:text-white outline-none transition-all ${
                            subMethodError ? 'border-red-500 focus:ring-2 focus:ring-red-500/20 ring-1 ring-red-500/30' : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                          }`} 
                          value={subMethod} 
                          onBlur={() => handleBlur('subMethod')}
                          onChange={(e) => {
                            setSubMethod(e.target.value);
                            if (e.target.value !== 'Others') setCustomSubMethod('');
                            setTouched(prev => ({ ...prev, subMethod: true, customSubMethod: e.target.value === 'Others' }));
                          }}
                        >
                          <option value="">Select E-Wallet</option>
                          <option value="GCash">GCash</option>
                          <option value="Maya">Maya</option>
                          <option value="GrabPay">GrabPay</option>
                          <option value="ShopeePay">ShopeePay</option>
                          <option value="Coins.ph">Coins.ph</option>
                          <option value="Others">Others (Please specify)</option>
                        </select>
                      ) : (
                        <select 
                          className={`w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs text-slate-900 dark:text-white outline-none transition-all ${
                            subMethodError ? 'border-red-500 focus:ring-2 focus:ring-red-500/20 ring-1 ring-red-500/30' : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                          }`} 
                          value={subMethod} 
                          onBlur={() => handleBlur('subMethod')}
                          onChange={(e) => {
                            setSubMethod(e.target.value);
                            if (e.target.value !== 'Others') setCustomSubMethod('');
                            setTouched(prev => ({ ...prev, subMethod: true, customSubMethod: e.target.value === 'Others' }));
                          }}
                        >
                          <option value="">Select Bank / Digital Bank</option>
                          <optgroup label="Digital Banks (Philippines)">
                            <option value="Maya Bank">Maya Bank</option>
                            <option value="GoTyme Bank">GoTyme Bank</option>
                            <option value="SeaBank">SeaBank</option>
                            <option value="Tonik Bank">Tonik Bank</option>
                            <option value="CIMB Bank">CIMB Bank</option>
                            <option value="UNO Digital Bank">UNO Digital Bank</option>
                            <option value="UnionDigital Bank">UnionDigital Bank</option>
                          </optgroup>
                          <optgroup label="Traditional Banks">
                            <option value="BPI">BPI (Bank of the Philippine Islands)</option>
                            <option value="BDO">BDO Unibank</option>
                            <option value="Metrobank">Metrobank</option>
                            <option value="Unionbank">UnionBank</option>
                            <option value="Landbank">Landbank</option>
                            <option value="Security Bank">Security Bank</option>
                            <option value="RCBC">RCBC</option>
                            <option value="PNB">PNB (Philippine National Bank)</option>
                            <option value="China Bank">China Bank</option>
                            <option value="EastWest Bank">EastWest Bank</option>
                          </optgroup>
                          <optgroup label="Transfer Networks & Cards">
                            <option value="Instapay">InstaPay</option>
                            <option value="PESONet">PESONet</option>
                            <option value="Master Card">Master Card</option>
                            <option value="Visa">Visa</option>
                          </optgroup>
                          <optgroup label="Other Banks">
                            <option value="Others">Others (Please specify)</option>
                          </optgroup>
                        </select>
                      )}

                      {/* Manual input when "Others" is selected */}
                      {subMethod === 'Others' && (
                        <div className="pt-1.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              Specify {paymentMethod === 'Bank' ? 'Bank / Provider' : 'E-Wallet'} Name <span className="text-red-500">*</span>
                            </label>
                            {touched.customSubMethod && customSubMethod.trim() && (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 size={11} /> Specified
                              </span>
                            )}
                          </div>
                          <input 
                            type="text"
                            className={`w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs text-slate-900 dark:text-white outline-none transition-all ${
                              touched.customSubMethod && !customSubMethod.trim()
                                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20 ring-1 ring-red-500/30'
                                : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                            }`}
                            placeholder={paymentMethod === 'Bank' ? 'Type your bank name (e.g. Komo, DiskarTech, OwnBank, Netbank)' : 'Type your e-wallet name (e.g. PalawanPay, Bayad)'}
                            value={customSubMethod}
                            onBlur={() => handleBlur('customSubMethod')}
                            onChange={(e) => {
                              setCustomSubMethod(e.target.value);
                              setTouched(prev => ({ ...prev, customSubMethod: true }));
                            }}
                          />
                          {touched.customSubMethod && !customSubMethod.trim() && (
                            <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 mt-0.5">
                              <AlertCircle size={12} /> Please specify your {paymentMethod === 'Bank' ? 'bank' : 'e-wallet'} name.
                            </p>
                          )}
                        </div>
                      )}

                      {subMethodError && subMethod !== 'Others' && (
                        <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 mt-0.5">
                          <AlertCircle size={12} /> {subMethodError}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Reference Number / Transaction ID */}
                {approvalMethod === 'manual' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Reference Number / Transaction ID <span className="text-red-500">*</span>
                        </label>
                        {autoFilledFields.includes('referenceNumber') ? (
                          <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-blue-200/80 dark:border-blue-900/50">
                            <Sparkles size={10} /> Auto-filled
                          </span>
                        ) : touched.referenceNumber && !referenceNumber.trim() ? (
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-red-200 dark:border-red-900/50">
                            <AlertCircle size={10} /> Needs manual input
                          </span>
                        ) : null}
                      </div>
                      {referenceNumber && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          {referenceNumber.length} chars
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-xs font-mono text-slate-900 dark:text-white outline-none transition-all placeholder-slate-400 ${
                        referenceNumberError
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500/20 ring-1 ring-red-500/30'
                          : autoFilledFields.includes('referenceNumber')
                          ? 'border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20'
                          : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                      }`}
                      placeholder="e.g. 10023456789 or TXN-987654"
                      value={referenceNumber}
                      onBlur={() => handleBlur('referenceNumber')}
                      onChange={(e) => {
                        setReferenceNumber(e.target.value);
                        setTouched(prev => ({ ...prev, referenceNumber: true }));
                      }}
                      disabled={submitting}
                    />
                    {referenceNumberError && (
                      <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 mt-1">
                        <AlertCircle size={13} /> {referenceNumberError}
                      </p>
                    )}
                    <p className="text-[10.5px] text-slate-400 dark:text-slate-500">
                      Transaction reference number from your receipt for verification.
                    </p>
                  </div>
                )}

                {/* Sender Information */}
                {approvalMethod === 'manual' && paymentMethod && (
                  <div className="space-y-3 pt-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Sender Information <span className="text-red-500">*</span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Option 1: Selected User (My Profile Account) */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsAnotherAccount(false);
                          setTouched(prev => ({ ...prev, customAccountName: false, customAccountNumber: false }));
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          !isAnotherAccount
                            ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20 shadow-xs'
                            : 'bg-white dark:bg-slate-800/60 border-slate-200/80 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          !isAnotherAccount ? 'border-blue-600 bg-blue-600' : 'border-slate-300 dark:border-slate-600'
                        }`}>
                          {!isAnotherAccount && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {defaultName || 'My Profile Account'}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
                              You
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                            {paymentMethod === 'E-Wallet' 
                              ? (defaultPhone || 'Registered Mobile') 
                              : 'Account Holder'}
                          </p>
                        </div>
                      </button>

                      {/* Option 2: Another Account */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsAnotherAccount(true);
                          setTouched(prev => ({ ...prev, customAccountName: true, customAccountNumber: true }));
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          isAnotherAccount
                            ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20 shadow-xs'
                            : 'bg-white dark:bg-slate-800/60 border-slate-200/80 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isAnotherAccount ? 'border-blue-600 bg-blue-600' : 'border-slate-300 dark:border-slate-600'
                        }`}>
                          {isAnotherAccount && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Another account?
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            Donate using someone else's account
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Case 1: My Profile Account */}
                    {!isAnotherAccount ? (
                      paymentMethod === 'E-Wallet' ? (
                        <div className="p-3.5 bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/10 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-white/5">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Sender Name:</span>
                            <span className="font-bold text-slate-900 dark:text-white">{defaultName || 'Faithly Member'}</span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-white/5">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Sender Mobile:</span>
                            <span className="font-bold font-mono text-slate-900 dark:text-white">{defaultPhone || '09XXXXXXXXX'}</span>
                          </div>
                          <div className="pt-1 flex items-center justify-between text-[11px]">
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 size={13} /> Auto-filled from your profile
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsAnotherAccount(true)}
                              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer bg-transparent border-none"
                            >
                              Use another account?
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="p-3 bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/10 rounded-xl flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Account Holder:</span>
                            <span className="font-bold text-slate-900 dark:text-white">{defaultName || 'Faithly Member'} (You)</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Your Bank Account Number <span className="text-red-500">*</span>
                              </label>
                              <span className={`text-[11px] font-bold flex items-center gap-1 ${
                                isAccountNumValid 
                                  ? 'text-emerald-600 dark:text-emerald-400' 
                                  : accountNumberError
                                  ? 'text-red-500'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}>
                                {isAccountNumValid && <CheckCircle2 size={12} />}
                                {bankAccountNumber.length} digits {isAccountNumValid ? '' : '(8–20 digits)'}
                              </span>
                            </div>
                            <input 
                              type="text" 
                              inputMode="numeric"
                              className={`w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs font-mono text-slate-900 dark:text-white outline-none transition-all ${
                                accountNumberError 
                                  ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' 
                                  : isAccountNumValid 
                                  ? 'border-emerald-500/80' 
                                  : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                              }`} 
                              placeholder="0012 3456 7890 (8–20 digits)"
                              maxLength={24}
                              value={formatBankAccountNumber(bankAccountNumber)}
                              onBlur={() => handleBlur('bankAccountNumber')}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, '').slice(0, 20);
                                setBankAccountNumber(raw);
                                setTouched(prev => ({ ...prev, bankAccountNumber: true }));
                              }}
                            />
                            {accountNumberError && (
                              <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 mt-0.5">
                                <AlertCircle size={12} /> {accountNumberError}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    ) : (
                      /* Case 2: Another Account */
                      <div className="space-y-3 p-3.5 bg-blue-50/30 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 rounded-xl">
                        <div className="flex items-center justify-between pb-1.5 border-b border-blue-100 dark:border-blue-900/40">
                          <span className="text-xs font-bold text-blue-950 dark:text-blue-300">
                            Enter Details of Another Account
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsAnotherAccount(false)}
                            className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer bg-transparent border-none"
                          >
                            Back to my account
                          </button>
                        </div>

                        {/* Sender Account Name */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {paymentMethod === 'Bank' ? 'Sender Bank Account Name' : 'Sender Account Name'} <span className="text-red-500">*</span>
                            </label>
                            {touched.customAccountName && customAccountName.trim().length >= 2 && !accountNameError && (
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
                                : touched.customAccountName && customAccountName.trim().length >= 2
                                ? 'border-emerald-500/80' 
                                : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                            }`} 
                            placeholder="Enter account holder name (e.g. Maria Santos)"
                            value={customAccountName}
                            onBlur={() => handleBlur('customAccountName')}
                            onChange={(e) => {
                              setCustomAccountName(e.target.value);
                              setTouched(prev => ({ ...prev, customAccountName: true }));
                            }}
                          />
                          {accountNameError && (
                            <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 mt-0.5">
                              <AlertCircle size={12} /> {accountNameError}
                            </p>
                          )}
                        </div>

                        {/* Sender Account Number */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {paymentMethod === 'Bank' ? 'Sender Bank Account Number' : 'Sender Mobile / E-Wallet Number'} <span className="text-red-500">*</span>
                            </label>
                            <span className={`text-[11px] font-bold flex items-center gap-1 ${
                              isAccountNumValid 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : accountNumberError
                                ? 'text-red-500'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              {isAccountNumValid && <CheckCircle2 size={12} />}
                              {paymentMethod === 'Bank'
                                ? `${customAccountNumber.length} digits ${isAccountNumValid ? '' : '(8–20 digits)'}`
                                : `${customAccountNumber.length}/11 digits`
                              }
                            </span>
                          </div>
                          <input 
                            type={paymentMethod === 'Bank' ? 'text' : 'tel'}
                            inputMode="numeric"
                            className={`w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs font-mono text-slate-900 dark:text-white outline-none transition-all ${
                              accountNumberError 
                                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' 
                                : isAccountNumValid 
                                ? 'border-emerald-500/80' 
                                : 'border-slate-200/80 dark:border-white/10 focus:ring-2 focus:ring-blue-600'
                            }`} 
                            placeholder={
                              paymentMethod === 'Bank' 
                                ? '0012 3456 7890 (8–20 digits)' 
                                : '09123456789'
                            }
                            maxLength={paymentMethod === 'Bank' ? 24 : 11}
                            value={paymentMethod === 'Bank' ? formatBankAccountNumber(customAccountNumber) : customAccountNumber}
                            onBlur={() => handleBlur('customAccountNumber')}
                            onChange={(e) => {
                              if (paymentMethod === 'Bank') {
                                const raw = e.target.value.replace(/\D/g, '').slice(0, 20);
                                setCustomAccountNumber(raw);
                              } else {
                                setCustomAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 11));
                              }
                              setTouched(prev => ({ ...prev, customAccountNumber: true }));
                            }}
                          />
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {paymentMethod === 'Bank' 
                              ? 'Enter 8 to 20 digits.' 
                              : 'Enter 11-digit mobile number starting with 09.'}
                          </p>
                          {accountNumberError && (
                            <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 mt-0.5">
                              <AlertCircle size={12} /> {accountNumberError}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Gateway notice if approvalMethod !== 'manual' */}
                {approvalMethod !== 'manual' && paymentMethod && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                    You will be securely redirected to PayMongo to complete your {paymentMethod} transaction.
                  </p>
                )}

                {formError && (
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{formError}</span>
                  </p>
                )}

                {/* Public Acknowledgement Checkbox */}
                <label className="flex items-start gap-3 p-3.5 rounded-xl cursor-pointer group hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                  <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      className="appearance-none w-4 h-4 border-2 border-slate-300 dark:border-white/20 rounded bg-white dark:bg-[#1E2130] checked:bg-blue-600 checked:border-blue-600 dark:checked:bg-blue-500 dark:checked:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                      checked={acknowledgePublicly}
                      onChange={(e) => setAcknowledgePublicly(e.target.checked)}
                      disabled={submitting}
                    />
                    <svg className={`absolute w-3 h-3 text-white pointer-events-none transition-opacity ${acknowledgePublicly ? 'opacity-100' : 'opacity-0'}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5L5 9L9.5 3.5" /></svg>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors leading-tight">
                      Acknowledge my donation publicly
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                      Your name and donation will be visible to all community members.
                    </span>
                  </div>
                </label>

                {/* Submit / Donate Now Button */}
                <button 
                  className="w-full h-11 bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white font-bold font-inter rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs cursor-pointer border-none disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]" 
                  onClick={() => {
                    setTouched({
                      amount: true,
                      category: true,
                      community: true,
                      paymentMethod: true,
                      subMethod: true,
                      customAccountName: true,
                      customAccountNumber: true,
                      bankAccountNumber: true,
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
                    {paymentMethod} {resolvedSubMethod ? `(${resolvedSubMethod})` : ''}
                  </span>
                </div>

                {approvalMethod === 'manual' && (
                  <>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        {paymentMethod === 'Bank' ? 'Sender Bank Account Name' : 'Sender Account Name'}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {resolvedAccountName}
                        {!isAnotherAccount && (
                          <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                            You
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        {paymentMethod === 'Bank' ? 'Sender Bank Account Number' : 'Sender Mobile / Account Number'}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        {paymentMethod === 'Bank' ? formatBankAccountNumber(resolvedAccountNumber) : resolvedAccountNumber}
                      </span>
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
  modalPage,
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
                  className="p-3 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl border border-slate-200/60 dark:border-white/5 cursor-pointer transition-all"
                  onClick={() => handleOpenReceipt(d)}
                >
                  <div className="flex items-center justify-between">
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
                <span className="text-slate-900 dark:text-white font-bold font-mono">
                  {(selectedDonation.method === 'Bank' || selectedDonation.paymentMethod === 'Bank') 
                    ? formatBankAccountNumber(selectedDonation.accountNumber) 
                    : selectedDonation.accountNumber}
                </span>
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