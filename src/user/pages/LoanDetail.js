import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from '../../context/AuthContext';

import API from '../../utils/api';
import { 
  ArrowLeft, 
  Banknote, 
  CheckCircle, 
  Printer, 
  Settings, 
  X, 
  UploadCloud, 
  FileCheck2,
  CreditCard,
  AlertCircle
} from 'lucide-react';

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const fmt = (n) =>
  n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₱0.00';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const STATUS_BADGE = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800/40',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800/40',
  completed: 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800/40',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800/40',
  overdue: 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800/40',
  awaiting_member_approval: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40',
};

const STATUS_TEXT = {
  pending: 'Pending Review',
  approved: 'Approved',
  active: 'Active',
  completed: 'Completed',
  rejected: 'Rejected',
  overdue: 'Overdue',
  awaiting_member_approval: 'Review Requested',
};

/* ════════════════════════════════════════════════════════════
   PAY NOW MODAL
   ════════════════════════════════════════════════════════════ */
const PAYMENT_TYPES = [
  { id: 'regular', name: 'Regular Payment', desc: 'Pay the current monthly installment' },
  { id: 'advance', name: 'Custom Payment', desc: 'Enter any amount — months covered are computed automatically' },
  { id: 'full', name: 'Full Payment', desc: 'Settle the entire remaining balance at once' },
];

function PayNowModal({ loan, onClose, onSuccess }) {
  const [method, setMethod] = useState('cash');
  const [subMethod, setSubMethod] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [approvalMethod, setApprovalMethod] = useState('gateway');
  const [paymentType, setPaymentType] = useState('regular');
  const [customAmount, setCustomAmount] = useState('');
  const [selectedMonths, setSelectedMonths] = useState(0);

  const monthlyAmt = loan?.upcomingPaymentAmount || loan?.monthlyPayment || 0;
  const remaining = loan?.remainingBalance || 0;
  const remainingMonths = (loan?.termMonths || 0) - (loan?.paidMonths || 0);

  const computedAmount = (() => {
    if (paymentType === 'regular') return Math.min(monthlyAmt, remaining);
    if (paymentType === 'full') return remaining;
    if (paymentType === 'advance') {
      const val = Number(String(customAmount).replace(/,/g, '')) || 0;
      return Math.min(val, remaining);
    }
    return monthlyAmt;
  })();

  const monthsCovered = (() => {
    if (paymentType === 'regular') return 1;
    if (paymentType === 'full') return remainingMonths;
    if (paymentType === 'advance') {
      if (monthlyAmt <= 0) return 0;
      return Math.min(Math.floor(computedAmount / monthlyAmt), remainingMonths);
    }
    return 0;
  })();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API}/api/settings/public`);
        const data = await res.json();
        if (res.ok && data.success) {
          setApprovalMethod(data.paymentApprovalMethod || 'gateway');
        }
      } catch { /* silent */ }
    };
    fetchSettings();
  }, []);

  const METHODS = [
    {
      id: 'cash',
      name: 'Cash',
      desc: 'Pay in person at the office or cashier',
      icon: <Settings size={18} className="text-emerald-600 dark:text-emerald-400" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/80',
      instructions: [
        `Visit the office or authorized cashier during business hours.`,
        `Present your Loan ID: ${loan?.loanId} to the cashier.`,
        `Pay the exact amount of ${fmt(loan?.upcomingPaymentAmount || loan?.monthlyPayment)} and keep your receipt.`,
      ],
    },
    {
      id: 'bank',
      name: 'Bank Transfer',
      desc: 'Transfer via online banking or over-the-counter',
      icon: <Banknote size={18} className="text-blue-600 dark:text-blue-400" />,
      iconBg: 'bg-blue-100 dark:bg-blue-950/80',
      instructions: approvalMethod === 'manual'
        ? [`Please transfer to our Bank account and upload your receipt below.`]
        : [
            `You will be redirected to PayMongo to securely complete your bank transfer.`,
            `Please complete the payment on the next page.`
          ],
      needsReceipt: approvalMethod === 'manual',
    },
    {
      id: 'e-wallet',
      name: 'E-Wallet',
      desc: 'Send via GCash / Maya instantly',
      icon: <CheckCircle size={18} className="text-purple-600 dark:text-purple-400" />,
      iconBg: 'bg-purple-100 dark:bg-purple-950/80',
      instructions: approvalMethod === 'manual'
        ? [`Please transfer to our E-Wallet account and upload your receipt below.`]
        : [
            `You will be redirected to PayMongo to securely complete your E-Wallet payment.`,
            `Please complete the payment on the next page.`
          ],
      needsReceipt: approvalMethod === 'manual',
    },
  ];

  const selected = METHODS.find(m => m.id === method);

  const isFormComplete = (() => {
    if (computedAmount <= 0) return false;
    if (paymentType === 'advance' && computedAmount < 500) return false;
    if (selected?.needsReceipt) {
      if (!subMethod) return false;
      if (!accountName.trim()) return false;
      if (accountNumber.trim().length !== 11) return false;
      if (!receipt) return false;
    }
    return true;
  })();

  const handleConfirm = async () => {
    if (paymentType === 'advance' && computedAmount < 500) return setError('Minimum advance payment is ₱500.');
    if (computedAmount <= 0) return setError('Payment amount must be greater than zero.');
    if (selected?.needsReceipt) {
      if (!subMethod) return setError(`Please select a ${method === 'e-wallet' ? 'E-Wallet' : 'Bank'} option.`);
      if (!accountName.trim()) return setError('Please provide your Account Name.');
      if (accountNumber.trim().length !== 11) return setError('Sender Account Number must be exactly 11 digits.');
      if (!receipt) return setError('Please upload your proof of payment before confirming.');
    }
    setError('');
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const proofData = receipt ? await fileToBase64(receipt) : null;

      const res = await fetch(`${API}/api/loans/${loan.loanId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          paymentMethod: method,
          paymentType,
          amount: computedAmount,
          monthsCovered,
          subMethod: selected?.needsReceipt ? subMethod : undefined,
          accountName: selected?.needsReceipt ? accountName : undefined,
          accountNumber: selected?.needsReceipt ? accountNumber : undefined,
          proofData,
          proofFileName: receipt?.name || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (approvalMethod === 'manual') {
          setSubmitted(true);
          setTimeout(() => { onSuccess?.(); onClose(); }, 2000);
        } else if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          setSubmitted(true);
          setTimeout(() => { onSuccess?.(); onClose(); }, 2000);
        }
      } else {
        setError(data.message || 'Payment submission failed. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100010] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 max-h-[90vh] overflow-y-auto text-left font-inter animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Pay Now</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{loan?.loanId} · Payment due {fmtDate(loan?.nextPaymentDate)}</p>
          </div>
          <button className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          <div className="py-10 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <CheckCircle size={36} />
            </div>
            <h4 className="text-xl font-black text-slate-900 dark:text-white">Payment Submitted!</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">Your payment is being processed. You'll be notified once confirmed.</p>
          </div>
        ) : (
          <div className="py-4 space-y-5">
            {/* Payment Type Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">Select Payment Type</label>
              <div className="space-y-2">
                {PAYMENT_TYPES.map((pt) => (
                  <div
                    key={pt.id}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${paymentType === pt.id ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500/60 ring-2 ring-emerald-500/20' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-white/10 hover:border-slate-300'}`}
                    onClick={() => { setPaymentType(pt.id); setCustomAmount(''); setSelectedMonths(0); setError(''); }}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{pt.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{pt.desc}</div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${paymentType === pt.id ? 'border-emerald-600 bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                      {paymentType === pt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Amount Input (Advance) */}
            {paymentType === 'advance' && (
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">How many months do you want to pay?</label>
                <select
                  value={selectedMonths}
                  onChange={(e) => {
                    const m = Number(e.target.value);
                    setSelectedMonths(m);
                    if (m > 0) {
                      const amt = Math.min(monthlyAmt * m, remaining);
                      setCustomAmount(Math.round(amt).toLocaleString('en-PH'));
                    } else {
                      setCustomAmount('');
                    }
                    setError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={0}>— Select months or enter custom amount —</option>
                  {Array.from({ length: remainingMonths }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>
                      {m} month{m > 1 ? 's' : ''} — {fmt(Math.min(monthlyAmt * m, remaining))}
                    </option>
                  ))}
                </select>

                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block pt-1">Or enter a custom amount (min ₱500)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 5,000"
                  value={customAmount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    if (raw === '') { setCustomAmount(''); setSelectedMonths(0); setError(''); return; }
                    let num = parseInt(raw, 10);
                    if (num > remaining) num = remaining;
                    setCustomAmount(num.toLocaleString('en-PH'));
                    setSelectedMonths(0);
                    if (num > 0 && num < 500) setError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {computedAmount > 0 && computedAmount < 500 && (
                  <p className="text-xs text-rose-500 font-bold flex items-center gap-1">
                    <AlertCircle size={13} /> Minimum payment is ₱500.
                  </p>
                )}
              </div>
            )}

            {/* Amount Summary Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-md">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100 block">
                  {paymentType === 'regular' ? 'Amount Due' : paymentType === 'full' ? 'Full Payoff Amount' : 'Payment Amount'}
                </span>
                <span className="text-2xl font-black block mt-0.5">{fmt(computedAmount)}</span>
                <span className="text-[11px] text-emerald-100 block mt-0.5">
                  {paymentType === 'regular' && `Due ${fmtDate(loan?.nextPaymentDate)}`}
                  {paymentType === 'advance' && monthsCovered > 0 && `Covers ${monthsCovered} month${monthsCovered > 1 ? 's' : ''} ahead`}
                  {paymentType === 'full' && `Settles entire loan balance`}
                </span>
              </div>
              {paymentType === 'full' && (
                <span className="px-3 py-1 rounded-full bg-white/20 text-white text-[11px] font-extrabold backdrop-blur-sm">
                  Full Payoff
                </span>
              )}
            </div>

            {/* Method Label */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">Select Payment Method</label>
              <div className="space-y-2">
                {METHODS.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${method === m.id ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500/60 ring-2 ring-emerald-500/20' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-white/10 hover:border-slate-300'}`}
                    onClick={() => { setMethod(m.id); setError(''); }}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${m.iconBg}`}>
                      {m.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{m.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{m.desc}</div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${method === m.id ? 'border-emerald-600 bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                      {method === m.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 space-y-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">How to pay via {selected?.name}</span>
              {selected?.instructions.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                  <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </div>
              ))}

              {selected?.id === 'bank' && approvalMethod === 'manual' && (
                <div className="mt-3 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50">
                  <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 block tracking-wider">Bank Details</span>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white mt-1">BDO Unibank</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Account Name: <strong>Philippine United Apostolic Church</strong></p>
                  <p className="text-sm font-black text-blue-600 dark:text-blue-400 mt-1 tracking-wider">0012 3456 7890</p>
                </div>
              )}

              {selected?.id === 'e-wallet' && approvalMethod === 'manual' && (
                <div className="mt-3 p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 space-y-2">
                  <div>
                    <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 block tracking-wider">GCash Details</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Name: <strong>IsangDiwa Church</strong></p>
                    <p className="text-sm font-black text-purple-600 dark:text-purple-400 tracking-wider">0912 345 6789</p>
                  </div>
                  <div className="pt-2 border-t border-purple-200/60 dark:border-purple-800/40">
                    <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 block tracking-wider">Maya Details</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Name: <strong>IsangDiwa Church</strong></p>
                    <p className="text-sm font-black text-purple-600 dark:text-purple-400 tracking-wider">0998 765 4321</p>
                  </div>
                </div>
              )}
            </div>

            {/* Manual Approval Info Fields */}
            {selected?.needsReceipt && (
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{method === 'e-wallet' ? 'E-Wallet' : 'Bank'} Option</label>
                  {method === 'e-wallet' ? (
                    <select className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold" value={subMethod} onChange={(e) => setSubMethod(e.target.value)}>
                      <option value="">Select E-Wallet</option>
                      <option value="GCash">GCash</option>
                      <option value="Maya">Maya</option>
                    </select>
                  ) : (
                    <select className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold" value={subMethod} onChange={(e) => setSubMethod(e.target.value)}>
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

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Sender Account Name</label>
                  <input 
                    type="text" 
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold" 
                    placeholder="Juan Dela Cruz"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Sender Account Number (11 digits)</label>
                  <input 
                    type="text" 
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold" 
                    placeholder="09123456789"
                    maxLength={11}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  />
                </div>
              </div>
            )}

            {/* Receipt Upload */}
            {selected?.needsReceipt && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Upload Proof of Payment</label>
                <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50 dark:bg-slate-800/40 transition-colors">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => { setReceipt(e.target.files[0]); setError(''); }}
                  />
                  <UploadCloud className="text-slate-400 mb-1" size={24} />
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold"><span className="text-emerald-600 dark:text-emerald-400">Click to upload</span> receipt image</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, PDF up to 5MB</p>
                </label>
                {receipt && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/50">
                    <FileCheck2 size={16} />
                    <span className="truncate">{receipt.name}</span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!submitted && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
            <button className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" onClick={onClose}>
              Cancel
            </button>
            <button 
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              onClick={handleConfirm} 
              disabled={uploading || (!isFormComplete && !uploading)}
            >
              {uploading ? <span className="btn-spinner" /> : (method === 'cash' || approvalMethod === 'manual' ? 'Submit Payment' : 'Proceed to PayMongo')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SCHEDULE MODAL
   ════════════════════════════════════════════════════════════ */
function ScheduleModal({ loan, schedule, onClose, onPayNow }) {
  const totalInterest = schedule.reduce((s, r) => s + (r.interest || 0), 0);
  const totalRepayment = schedule.reduce((s, r) => s + (r.payment || 0), 0);

  return (
    <div className="fixed inset-0 z-[100010] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 max-h-[90vh] overflow-y-auto text-left font-inter animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Payment Schedule</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{loan?.loanId} · {loan?.termMonths} monthly payments · {(loan?.interestRate < 1 ? loan?.interestRate * 100 : loan?.interestRate) || 0}% / mo</p>
          </div>
          <button className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-3 gap-3 my-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/10">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Principal</span>
            <span className="text-sm font-black text-slate-900 dark:text-white block mt-0.5">{fmt(loan?.amount)}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Interest</span>
            <span className="text-sm font-black text-slate-900 dark:text-white block mt-0.5">{fmt(totalInterest)}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Repayment</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">{fmt(totalRepayment)}</span>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3.5">#</th>
                <th className="py-3 px-3.5">Due Date</th>
                <th className="py-3 px-3.5">Principal</th>
                <th className="py-3 px-3.5">Interest</th>
                <th className="py-3 px-3.5">Payment</th>
                <th className="py-3 px-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium text-slate-800 dark:text-slate-200">
              {schedule.map((row, i) => {
                const isPaid = row.status === 'paid';
                const isDue = !isPaid && row.isNext;
                const isMissed = row.status === 'missed';

                return (
                  <tr key={i} className={isDue ? 'bg-amber-50/60 dark:bg-amber-950/20' : isPaid ? 'bg-slate-50/40 dark:bg-slate-900/40 opacity-75' : ''}>
                    <td className="py-3 px-3.5 font-bold">
                      {isPaid ? <span className="text-emerald-600 dark:text-emerald-400">✓</span> : i + 1}
                    </td>
                    <td className="py-3 px-3.5">{fmtDate(row.dueDate)}</td>
                    <td className="py-3 px-3.5">{fmt(row.principal)}</td>
                    <td className="py-3 px-3.5">{fmt(row.interest)}</td>
                    <td className={`py-3 px-3.5 font-bold ${isDue ? 'text-amber-600 dark:text-amber-400' : isPaid ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                      {fmt(row.payment)}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      {isPaid && <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold text-[10px]">Paid</span>}
                      {isDue && <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-extrabold text-[10px]">Due Soon</span>}
                      {isMissed && <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-extrabold text-[10px]">Missed</span>}
                      {!isPaid && !isDue && !isMissed && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-extrabold text-[10px]">Upcoming</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-white/10">
          <button className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" onClick={onClose}>
            Close
          </button>
          {loan?.status === 'active' && (
            <button className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer" onClick={() => { onClose(); onPayNow(); }}>
              Pay Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   LOAN DETAIL PAGE
   ════════════════════════════════════════════════════════════ */
export default function LoanDetail() {
  const { loanId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  useAuth();

  const [loan, setLoan] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [showPayNow, setShowPayNow] = useState(false);
  const [historyDetail, setHistoryDetail] = useState(null);

  /* Auto-open modals via query param */
  useEffect(() => {
    if (searchParams.get('tab') === 'schedule') setShowSchedule(true);
    if (searchParams.get('pay') === 'true') setShowPayNow(true);
  }, [searchParams]);

  const token = localStorage.getItem('token');
  const encodedId = loanId ? encodeURIComponent(loanId) : null;
  const urls = useMemo(() => {
    if (!token || !encodedId) return null;
    return [
      `${API}/api/loans/${encodedId}`,
      `${API}/api/loans/${encodedId}/schedule`,
      `${API}/api/loans/${encodedId}/payment-history`
    ];
  }, [token, encodedId]);

  const fetcher = async (urlsToFetch) => {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const responses = await Promise.all(urlsToFetch.map(url => fetch(url, { headers })));
    
    if (responses[0].status === 401) {
      localStorage.removeItem('token');
      navigate('/');
      return null;
    }
    
    return Promise.all(responses.map(res => res.ok ? res.json() : { success: false }));
  };

  const { data, isValidating, mutate } = useSWR(urls, fetcher, { revalidateOnFocus: false, revalidateIfStale: true });

  useEffect(() => {
    if (!data) return;
    setLoading(isValidating && !data);
    const [loanData, schedData, histData] = data;

    if (loanData && loanData.success) {
      setLoan(loanData.loan);
      setSchedule(schedData?.schedule || []);
      setPaymentHistory(histData?.payments || []);
      setError('');
    } else {
      setError(loanData?.message || 'Failed to load loan details.');
    }
    if (data) setLoading(false);
  }, [data, isValidating]);

  /* Derived */
  const paidCount = schedule.filter(r => r.status === 'paid').length;
  const totalMonths = loan?.termMonths || 0;
  const progressPct = totalMonths > 0 ? Math.max(2, Math.round((paidCount / totalMonths) * 100)) : 2;
  const paidAmount = schedule.filter(r => r.status === 'paid').reduce((s, r) => s + (r.payment || 0), 0);

  /* Skeleton Loader */
  if (loading) return (
    <div className="space-y-4 w-full pb-8 animate-pulse font-inter">
      <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-white/10">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700/80 rounded-lg" />
          <div className="h-3.5 w-64 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
        </div>
        <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700/80 rounded-xl shrink-0" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-xs flex flex-col gap-2.5">
            <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/80 rounded" />
            <div className="h-7 w-28 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
            <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700/80 rounded" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 w-full pb-10 font-inter text-slate-900 dark:text-white">

      {/* Back Button */}
      <button 
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        onClick={() => navigate('/loans')}
      >
        <ArrowLeft size={16} /> Back to My Loans
      </button>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center justify-between">
          <span>⚠ {error}</span>
          <button onClick={() => mutate()} className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors">Retry</button>
        </div>
      )}

      {loan && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{loan.loanId}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-2xs ${STATUS_BADGE[loan.status] || ''}`}>
                  {STATUS_TEXT[loan.status] || loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">{loan.purpose} Loan · Applied {fmtDate(loan.appliedDate)}</p>
            </div>
            {loan.status === 'active' && (
              <button 
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer shrink-0"
                onClick={() => setShowPayNow(true)}
              >
                <CreditCard size={15} />
                Pay Now
              </button>
            )}
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Original Amount</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{fmt(loan.amount)}</div>
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 block">
                {(loan.status === 'active' || loan.status === 'completed') ? 'Disbursed in full' : 'Not yet disbursed'}
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Remaining Balance</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {(loan.status === 'pending' || loan.status === 'approved') ? fmt(0) : fmt(loan.remainingBalance)}
              </div>
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 block">
                {loan.status === 'pending' || loan.status === 'approved' 
                  ? 'Awaiting disbursement'
                  : loan.remainingBalance > 0
                    ? `${Math.round((loan.remainingBalance / loan.amount) * 100)}% outstanding`
                    : 'Fully paid'}
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Monthly Payment</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                {fmt(loan?.upcomingPaymentAmount || loan?.monthlyPayment)}
                {loan?.isLate && <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded">Penalty</span>}
              </div>
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 block">Over {loan.termMonths} months</span>
            </div>

            <div className={`p-5 rounded-2xl bg-white dark:bg-[#1E2130] border shadow-xs ${loan.nextPaymentDate && new Date(loan.nextPaymentDate) < new Date() ? 'border-rose-300 dark:border-rose-800/50 bg-rose-50/20' : 'border-slate-200/80 dark:border-white/10'}`}>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Next Due Date</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {loan.nextPaymentDate
                  ? new Date(loan.nextPaymentDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                  : (loan.status === 'pending' || loan.status === 'approved') ? 'Pending disbursement' : '—'}
              </div>
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 block">
                {loan.nextPaymentDate ? `${fmt(Math.min(loan.upcomingPaymentAmount || loan.monthlyPayment, loan.remainingBalance || Infinity))} due` : (loan.status === 'pending' || loan.status === 'approved') ? 'Starts after disbursement' : 'No upcoming payment'}
              </span>
            </div>
          </div>

          {/* Repayment Progress */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-900 dark:text-white">Repayment Progress</span>
              <span className="text-slate-500 dark:text-slate-400">{paidCount} of {totalMonths} payments made ({fmt(paidAmount)} paid)</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Loan matures {fmtDate(schedule.length > 0 ? schedule[schedule.length - 1].dueDate : null)}</p>
          </div>

          {/* Loan Details Grid */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Loan Specifications</h3>
              <button 
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 cursor-pointer"
                onClick={() => window.print()}
              >
                <Printer size={14} /> Export to PDF
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Loan ID</span>
                <span className="font-bold text-slate-900 dark:text-white">{loan.loanId}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Applied Date</span>
                <span className="font-bold text-slate-900 dark:text-white">{fmtDate(loan.appliedDate)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Loan Type</span>
                <span className="font-bold text-slate-900 dark:text-white">{loan.purpose}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Disbursement Date</span>
                <span className="font-bold text-slate-900 dark:text-white">{fmtDate(loan.disbursementDate)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Loan Term</span>
                <span className="font-bold text-slate-900 dark:text-white">{loan.termMonths} months</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Maturity Date</span>
                <span className="font-bold text-slate-900 dark:text-white">{fmtDate(schedule.length > 0 ? schedule[schedule.length - 1].dueDate : null)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Interest Rate</span>
                <span className="font-bold text-slate-900 dark:text-white">{(loan.interestRate < 1 ? loan.interestRate * 100 : loan.interestRate) || 0}% per month</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Payment Frequency</span>
                <span className="font-bold text-slate-900 dark:text-white">Monthly</span>
              </div>
            </div>
          </div>

          {/* Upcoming Payments + History Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Payments */}
            {schedule.filter(r => r.status !== 'paid').length > 0 && (
              <div className="p-5 rounded-2xl bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Upcoming Payments</h3>
                  <button className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer" onClick={() => setShowSchedule(true)}>
                    View Full Schedule
                  </button>
                </div>
                <div className="space-y-2.5">
                  {schedule.filter(r => r.status !== 'paid').slice(0, 3).map((row, i) => {
                    const isNext = row.isNext;
                    const absIdx = schedule.indexOf(row);
                    return (
                      <div key={i} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${isNext ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                            {absIdx + 1}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">{fmtDate(row.dueDate)}</span>
                            <span className="text-[11px] text-slate-400 font-medium">Principal {fmt(row.principal)} · Interest {fmt(row.interest)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-black block ${isNext ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{fmt(row.payment)}</span>
                          <span className={`text-[10px] font-bold ${isNext ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{isNext ? 'Due Soon' : 'Upcoming'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment History */}
            {paymentHistory.length > 0 && (
              <div className="p-5 rounded-2xl bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Payment History</h3>
                </div>
                <div className="space-y-2.5">
                  {paymentHistory.slice(0, 4).map((p, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors" onClick={() => setHistoryDetail(p)}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">✓</div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">{fmtDate(p.confirmedAt || p.submittedAt)}</span>
                          <span className="text-[11px] text-slate-400 font-medium capitalize">Month #{p.monthNumber} · {p.paymentMethod}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block">{fmt(p.amount)}</span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Confirmed</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </>
      )}

      {/* Modals */}
      {showSchedule && (
        <ScheduleModal
          loan={loan}
          schedule={schedule}
          onClose={() => setShowSchedule(false)}
          onPayNow={() => setShowPayNow(true)}
        />
      )}

      {showPayNow && (
        <PayNowModal
          loan={loan}
          onClose={() => setShowPayNow(false)}
          onSuccess={() => mutate()}
        />
      )}

      {/* Payment History Detail Modal */}
      {historyDetail && (
        <div className="fixed inset-0 z-[100010] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setHistoryDetail(null)}>
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 text-left font-inter animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Payment Receipt</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Month #{historyDetail.monthNumber} — {historyDetail.loanId}</p>
              </div>
              <button className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center cursor-pointer" onClick={() => setHistoryDetail(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">Amount Paid</span>
                  <span className="text-xl font-black text-emerald-700 dark:text-emerald-300 block mt-0.5">{fmt(historyDetail.amount)}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-200/60 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px] font-black">Confirmed</span>
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-2">
                <div className="col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Payment For</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block mt-0.5">Loan Repayment — {loan?.purpose}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Method</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white capitalize block mt-0.5">{historyDetail.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Confirmed</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300 block mt-0.5">{fmtDate(historyDetail.confirmedAt)}</span>
                </div>
              </div>

              {historyDetail.proofData && (
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Proof of Payment</span>
                  <img
                    src={historyDetail.proofData}
                    alt="Payment proof"
                    onClick={() => window.open(historyDetail.proofData, '_blank')}
                    className="w-full max-h-48 object-contain rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer bg-black/5"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex justify-end">
              <button className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => setHistoryDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
