import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from '../../context/AuthContext';
// import Sidebar from '../components/Sidebar'; // Moved to UserLayout

import API from '../../utils/api';
import { Banknote, CheckCircle, Printer, Settings, X, UploadCloud, FileCheck2 } from 'lucide-react';


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

const STATUS_CLASS = {
    active: 'ld-badge--active',
    pending: 'ld-badge--pending',
    approved: 'ld-badge--approved',
    completed: 'ld-badge--completed',
    rejected: 'ld-badge--rejected',
};

const STATUS_TEXT = {
    pending:    'Pending review',
    approved:   'Approved',
    active:     'Active',
    completed:  'Completed',
    rejected:   'Rejected',
    overdue:    'Overdue',
    awaiting_member_approval: 'Review requested',
};

/* ── Back arrow ── */
const BackIcon = () => (
    <X size={14} />
);

/* ── Close icon ── */
const CloseIcon = () => (
    <X size={12} />
);

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
            icon: (
                <Settings size={20} color="#3b6d11" />
            ),
            iconBg: 'ld-method-icon--cash',
            instructions: [
                `Visit the office or authorized cashier during business hours.`,
                `Present your Loan ID: ${loan?.loanId} to the cashier.`,
                `Pay the exact amount of ${fmt(loan?.upcomingPaymentAmount || loan?.monthlyPayment)} and keep your receipt.`,
            ],
        },
        {
            id: 'bank',
            name: 'Bank transfer',
            desc: 'Transfer via online banking or over-the-counter',
            icon: (
                <Banknote size={20} color="#185fa5" />
            ),
            iconBg: 'ld-method-icon--bank',
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
            desc: 'Send via E-Wallet wallet instantly',
            icon: (
                <CheckCircle size={20} color="#6d28d9" />
            ),
            iconBg: 'ld-method-icon--gcash',
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
        <div className="ld-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="ld-modal ld-modal--pay">
                {/* Header */}
                <div className="ld-modal-header">
                    <div>
                        <div className="ld-modal-title">Pay now</div>
                        <div className="ld-modal-sub">{loan?.loanId} · Payment due {fmtDate(loan?.nextPaymentDate)}</div>
                    </div>
                    <button className="ld-modal-close" onClick={onClose}><CloseIcon /></button>
                </div>

                {submitted ? (
                    <div className="ld-pay-success">
                        <div className="ld-pay-success-icon">
                            <CheckCircle size={28} color="#22c55e" />
                        </div>
                        <div className="ld-pay-success-title">Payment submitted!</div>
                        <div className="ld-pay-success-sub">Your payment is being processed. You'll be notified once confirmed.</div>
                    </div>
                ) : (
                    <div className="ld-modal-body">
                        {/* Payment Type Selector */}
                        <div className="ld-pay-section-label">Select payment type</div>
                        <div className="ld-method-list">
                            {PAYMENT_TYPES.map((pt) => (
                                <div
                                    key={pt.id}
                                    className={`ld-method-card ${paymentType === pt.id ? 'ld-method-card--selected' : ''}`}
                                    onClick={() => { setPaymentType(pt.id); setCustomAmount(''); setSelectedMonths(0); setError(''); }}
                                >
                                    <div className="ld-method-info">
                                        <div className="ld-method-name">{pt.name}</div>
                                        <div className="ld-method-desc">{pt.desc}</div>
                                    </div>
                                    <div className={`ld-radio ${paymentType === pt.id ? 'ld-radio--selected' : ''}`} />
                                </div>
                            ))}
                        </div>

                        {/* Custom Amount Input (Advance) */}
                        {paymentType === 'advance' && (
                            <div style={{ marginTop: '16px' }}>
                                {/* Month Selector Dropdown */}
                                <div className="ld-pay-section-label" style={{ marginBottom: '8px' }}>How many months do you want to pay?</div>
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
                                    style={{ width: '100%', padding: '12px 14px', fontSize: '15px', fontWeight: 600, fontFamily: 'Inter, sans-serif', border: '1.5px solid #D1D5DB', borderRadius: '10px', outline: 'none', color: '#111827', background: '#fff', boxSizing: 'border-box', cursor: 'pointer', appearance: 'auto' }}
                                >
                                    <option value={0}>— Select months or enter custom amount —</option>
                                    {Array.from({ length: remainingMonths }, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>
                                            {m} month{m > 1 ? 's' : ''} — {fmt(Math.min(monthlyAmt * m, remaining))}
                                        </option>
                                    ))}
                                </select>

                                {/* Or enter custom amount */}
                                <div className="ld-pay-section-label" style={{ marginBottom: '8px', marginTop: '14px' }}>Or enter a custom amount (min ₱500)</div>
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
                                    style={{ width: '100%', padding: '12px 14px', fontSize: '16px', fontWeight: 700, fontFamily: 'Inter, sans-serif', border: `1.5px solid ${computedAmount > 0 && computedAmount < 500 ? '#EF4444' : '#D1D5DB'}`, borderRadius: '10px', outline: 'none', color: '#111827', boxSizing: 'border-box', transition: 'border-color 0.2s ease' }}
                                />
                                {computedAmount > 0 && computedAmount < 500 && (
                                    <div style={{ marginTop: '8px', fontSize: '13px', color: '#EF4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        ⚠ Minimum payment is ₱500. Please enter a higher amount.
                                    </div>
                                )}
                                {computedAmount >= 500 && (
                                    <div style={{ marginTop: '8px', fontSize: '13px', color: '#1E3A8A', fontWeight: 600 }}>
                                        {monthsCovered > 0 ? (
                                            <>
                                                This covers {monthsCovered} month{monthsCovered > 1 ? 's' : ''} ({fmt(monthlyAmt)} × {monthsCovered} = {fmt(monthlyAmt * monthsCovered)})
                                                {computedAmount > monthlyAmt * monthsCovered && (
                                                    <span style={{ color: '#6B7280', fontWeight: 400 }}> + {fmt(computedAmount - monthlyAmt * monthsCovered)} partial</span>
                                                )}
                                            </>
                                        ) : (
                                            <span style={{ color: '#16A34A' }}>You will pay: {fmt(computedAmount)}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Amount Summary */}
                        <div className="ld-pay-amount-box" style={{ marginTop: '16px' }}>
                            <div>
                                <div className="ld-pay-amount-label">
                                    {paymentType === 'regular' ? 'Amount due' : paymentType === 'full' ? 'Full payoff amount' : 'Payment amount'}
                                </div>
                                <div className="ld-pay-amount-value">
                                    {fmt(computedAmount)}
                                    {loan?.isLate && paymentType === 'regular' && <span style={{ fontSize: '12px', color: '#DC2626', background: '#FEE2E2', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', fontWeight: 600, verticalAlign: 'middle' }}>Late 3% Penalty</span>}
                                </div>
                                <div className="ld-pay-amount-sub">
                                    {paymentType === 'regular' && `Due ${fmtDate(loan?.nextPaymentDate)}`}
                                    {paymentType === 'advance' && monthsCovered > 0 && `Covers ${monthsCovered} month${monthsCovered > 1 ? 's' : ''} ahead`}
                                    {paymentType === 'advance' && monthsCovered === 0 && computedAmount > 0 && `Custom payment · Remaining balance: ${fmt(remaining)}`}
                                    {paymentType === 'full' && `Settles entire loan (${remainingMonths} months remaining)`}
                                </div>
                            </div>
                            {paymentType === 'full' && (
                                <div className="ld-badge ld-badge--approved" style={{ alignSelf: 'flex-start' }}>Full Payoff</div>
                            )}
                            {paymentType === 'regular' && loan?.nextPaymentDate && (
                                <div className="ld-badge ld-badge--pending" style={{ alignSelf: 'flex-start' }}>Due soon</div>
                            )}
                        </div>

                        {/* Method label */}
                        <div className="ld-pay-section-label">Select payment method</div>

                        {/* Methods */}
                        <div className="ld-method-list">
                            {METHODS.map((m) => (
                                <div
                                    key={m.id}
                                    className={`ld-method-card ${method === m.id ? 'ld-method-card--selected' : ''}`}
                                    onClick={() => { setMethod(m.id); setError(''); }}
                                >
                                    <div className={`ld-method-icon ${m.iconBg}`}>{m.icon}</div>
                                    <div className="ld-method-info">
                                        <div className="ld-method-name">{m.name}</div>
                                        <div className="ld-method-desc">{m.desc}</div>
                                    </div>
                                    <div className={`ld-radio ${method === m.id ? 'ld-radio--selected' : ''}`} />
                                </div>
                            ))}
                        </div>

                        {/* Instructions */}
                        <div className="ld-pay-instructions">
                            <div className="ld-pay-instructions-title">How to pay via {selected?.name}</div>
                            {selected?.instructions.map((step, i) => (
                                <div key={i} className="ld-pay-step">
                                    <div className="ld-pay-step-num">{i + 1}</div>
                                    <div className="ld-pay-step-text">{step}</div>
                                </div>
                            ))}

                            {/* Standout Account Details */}
                            {selected?.id === 'bank' && approvalMethod === 'manual' && (
                                <div style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '12px', padding: '20px', marginTop: '20px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: '#0369A1', marginBottom: '12px', letterSpacing: '0.5px' }}>Bank Transfer Details</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>BDO Unibank</div>
                                    <div style={{ fontSize: '15px', color: '#334155', marginTop: '6px' }}>Account Name: <strong>Philippine United Apostolic Church</strong></div>
                                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#1D4ED8', marginTop: '8px', letterSpacing: '1px' }}>0012 3456 7890</div>
                                </div>
                            )}

                            {selected?.id === 'e-wallet' && approvalMethod === 'manual' && (
                                <div style={{ backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '12px', padding: '20px', marginTop: '20px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: '#6D28D9', marginBottom: '12px', letterSpacing: '0.5px' }}>Send GCash To</div>
                                        <div style={{ fontSize: '15px', color: '#334155' }}>Name: <strong>IsangDiwa Church</strong></div>
                                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#4C1D95', marginTop: '8px', letterSpacing: '1px' }}>0912 345 6789</div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: '#6D28D9', marginBottom: '12px', letterSpacing: '0.5px' }}>Send Maya To</div>
                                        <div style={{ fontSize: '15px', color: '#334155' }}>Name: <strong>IsangDiwa Church</strong></div>
                                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#4C1D95', marginTop: '8px', letterSpacing: '1px' }}>0998 765 4321</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Manual Approval Info Fields */}
                        {selected?.needsReceipt && (
                            <div className="user-donation-manual-info-grid" style={{ marginTop: '16px', marginBottom: '16px' }}>
                                <div className="user-donation-input-group">
                                    <label className="user-donation-form-label">{method === 'e-wallet' ? 'E-Wallet' : 'Bank'} Option</label>
                                    {method === 'e-wallet' ? (
                                        <select className="user-donation-select" value={subMethod} onChange={(e) => setSubMethod(e.target.value)}>
                                            <option value="">Select E-Wallet</option>
                                            <option value="GCash">GCash</option>
                                            <option value="Maya">Maya</option>
                                        </select>
                                    ) : (
                                        <select className="user-donation-select" value={subMethod} onChange={(e) => setSubMethod(e.target.value)}>
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
                                <div className="user-donation-input-group">
                                    <label className="user-donation-form-label">Sender Account Name</label>
                                    <input 
                                        type="text" 
                                        className="user-donation-input" 
                                        placeholder="Juan Dela Cruz"
                                        value={accountName}
                                        onChange={(e) => setAccountName(e.target.value)}
                                    />
                                </div>
                                <div className="user-donation-input-group">
                                    <label className="user-donation-form-label">Sender Account Number</label>
                                    <input 
                                        type="text" 
                                        className="user-donation-input" 
                                        placeholder="09123456789"
                                        maxLength={11}
                                        value={accountNumber}
                                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Receipt upload (bank / e-wallet) */}
                        {selected?.needsReceipt && (
                            <div className="ld-pay-upload">
                                <div className="ld-pay-section-label" style={{ marginBottom: '8px' }}>Upload proof of payment</div>
                                <label className="user-file-upload-zone" style={{ margin: 0 }}>
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="user-file-upload-input"
                                        onChange={(e) => { setReceipt(e.target.files[0]); setError(''); }}
                                    />
                                    <div className="user-file-upload-content">
                                        <UploadCloud className="user-file-upload-icon" size={28} />
                                        <p className="user-file-upload-text"><span>Click to upload</span> or drag and drop</p>
                                        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>PNG, JPG, PDF up to 5MB</p>
                                    </div>
                                </label>
                                {receipt && (
                                    <div className="user-file-attached">
                                        <FileCheck2 size={16} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {receipt.name}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Error */}
                        {error && <div className="ld-pay-error">{error}</div>}
                    </div>
                )}

                {/* Footer */}
                {!submitted && (
                    <div className="ld-modal-footer">
                        <button className="ld-footer-btn-cancel" onClick={onClose}>Cancel</button>
                        <button 
                            className="ld-footer-btn-confirm" 
                            onClick={handleConfirm} 
                            disabled={uploading}
                            style={!isFormComplete && !uploading ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
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
        <div className="ld-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="ld-modal ld-modal--schedule">
                {/* Header */}
                <div className="ld-modal-header">
                    <div>
                        <div className="ld-modal-title">Payment schedule — {loan?.loanId}</div>
                        <div className="ld-modal-sub">{loan?.termMonths} monthly payments · {loan?.purpose} · {(loan?.interestRate < 1 ? loan?.interestRate * 100 : loan?.interestRate) || 0}% per month</div>
                    </div>
                    <button className="ld-modal-close" onClick={onClose}><CloseIcon /></button>
                </div>

                {/* Summary strip */}
                <div className="ld-sched-summary">
                    <div className="ld-sched-summary-cell">
                        <label>Total principal</label>
                        <div className="ld-sched-summary-val">{fmt(loan?.amount)}</div>
                    </div>
                    <div className="ld-sched-summary-cell">
                        <label>Total interest</label>
                        <div className="ld-sched-summary-val">{fmt(totalInterest)}</div>
                    </div>
                    <div className="ld-sched-summary-cell">
                        <label>Total repayment</label>
                        <div className="ld-sched-summary-val">{fmt(totalRepayment)}</div>
                    </div>
                </div>

                {/* Table */}
                <div className="ld-sched-table-wrap">
                    <div className="ld-sched-table-head">
                        <span>#</span>
                        <span style={{ textAlign: 'left' }}>Due date</span>
                        <span>Principal</span>
                        <span>Interest</span>
                        <span>Payment</span>
                        <span>Status</span>
                    </div>

                    {schedule.map((row, i) => {
                        const isPaid = row.status === 'paid';
                        const isDue = !isPaid && row.isNext;
                        const isMissed = row.status === 'missed';
                        return (
                            <div key={i} className={`ld-sched-row ${isDue ? 'ld-sched-row--due' : ''} ${isPaid ? 'ld-sched-row--paid' : ''}`}>
                                <div className={`ld-sched-num ${isDue ? 'ld-sched-num--due' : ''} ${isPaid ? 'ld-sched-num--paid' : ''}`}>
                                    {isPaid ? '✓' : i + 1}
                                </div>
                                <span style={{ textAlign: 'left', fontSize: '12px' }}>{fmtDate(row.dueDate)}</span>
                                <span className="ld-sched-cell">{fmt(row.principal)}</span>
                                <span className="ld-sched-cell">{fmt(row.interest)}</span>
                                <span className={`ld-sched-cell ld-sched-cell--bold ${isDue ? 'ld-sched-cell--warn' : ''} ${isPaid ? 'ld-sched-cell--paid' : ''}`}>
                                    {fmt(row.payment)}
                                </span>
                                <span style={{ textAlign: 'right' }}>
                                    {isPaid && <span className="ld-sched-badge ld-sched-badge--paid">Paid</span>}
                                    {isDue && <span className="ld-sched-badge ld-sched-badge--due">Due soon</span>}
                                    {isMissed && <span className="ld-sched-badge ld-sched-badge--missed">Missed</span>}
                                    {!isPaid && !isDue && !isMissed && <span className="ld-sched-badge ld-sched-badge--upcoming">Upcoming</span>}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="ld-modal-footer">
                    <button className="ld-footer-btn-cancel" onClick={onClose}>Close</button>
                    {loan?.status === 'active' && (
                        <button className="ld-footer-btn-confirm" onClick={() => { onClose(); onPayNow(); }}>
                            Pay now
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
        
        // Handle unauthorized
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

    /* ── Skeleton ── */
    if (loading) return (
        <div className="ld-loading-wrap">
            <div className="ld-back-btn" style={{ marginBottom: '20px', opacity: 0.4 }}>
                <BackIcon /> Back to My Loans
            </div>
            <div className="ld-skeleton" style={{ height: '32px', width: '240px', marginBottom: '20px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
                {[1, 2, 3, 4].map(i => <div key={i} className="ld-skeleton" style={{ height: '72px', borderRadius: '12px' }} />)}
            </div>
            <div className="ld-skeleton" style={{ height: '120px', borderRadius: '14px', marginBottom: '16px' }} />
            <div className="ld-skeleton" style={{ height: '200px', borderRadius: '14px' }} />
        </div>
    );

    return (
        <div className="ld-page-wrapper">

            {/* ── Back ── */}
            <button className="ld-back-btn" onClick={() => navigate('/loans')}>
                <BackIcon /> Back to My Loans
            </button>

            {/* ── Error ── */}
            {error && (
                <div className="user-loans-error-banner">
                    <span>⚠ {error}</span>
                    <button onClick={() => mutate()} className="user-loans-retry-btn">Retry</button>
                </div>
            )}

            {loan && (
                <>
                    {/* ── Header ── */}
                    <div className="ld-page-header">
                        <div>
                            <div className="ld-page-title-row">
                                <h1 className="ld-page-title">{loan.loanId}</h1>
                                <span className={`ld-badge ${STATUS_CLASS[loan.status] || ''}`}>
                                    {STATUS_TEXT[loan.status] || loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                                </span>
                            </div>
                            <p className="ld-page-subtitle">{loan.purpose} loan · Applied {fmtDate(loan.appliedDate)}</p>
                        </div>
                        {loan.status === 'active' && (
                            <button className="ld-pay-now-header-btn" onClick={() => setShowPayNow(true)}>
                                Pay now
                            </button>
                        )}
                    </div>

                    {/* ── Stats ── */}
                    <div className="ld-stats">
                        <div className="ld-stat-card">
                            <label className="ld-stat-label">Original amount</label>
                            <div className="ld-stat-value">{fmt(loan.amount)}</div>
                            <div className="ld-stat-sub">
                                {(loan.status === 'active' || loan.status === 'completed') ? 'Disbursed in full' : 'Not yet disbursed'}
                            </div>
                        </div>
                        <div className="ld-stat-card">
                            <label className="ld-stat-label">Remaining balance</label>
                            <div className="ld-stat-value">
                                {(loan.status === 'pending' || loan.status === 'approved') ? fmt(0) : fmt(loan.remainingBalance)}
                            </div>
                            <div className="ld-stat-sub">
                                {loan.status === 'pending' || loan.status === 'approved' 
                                    ? 'Awaiting disbursement'
                                    : loan.remainingBalance > 0
                                        ? `${Math.round((loan.remainingBalance / loan.amount) * 100)}% outstanding`
                                        : 'Fully paid'}
                            </div>
                        </div>
                        <div className="ld-stat-card">
                            <label className="ld-stat-label">Monthly payment</label>
                            <div className="ld-stat-value">
                                {fmt(loan?.upcomingPaymentAmount || loan?.monthlyPayment)}
                                {loan?.isLate && <span style={{ fontSize: '11px', color: '#DC2626', background: '#FEE2E2', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', verticalAlign: 'middle' }}>Late Penalty</span>}
                            </div>
                            <div className="ld-stat-sub">Over {loan.termMonths} months</div>
                        </div>
                        <div className={`ld-stat-card ${loan.nextPaymentDate && new Date(loan.nextPaymentDate) < new Date() ? 'ld-stat-card--warn' : ''}`}>
                            <label className="ld-stat-label">Next due date</label>
                            <div className="ld-stat-value">
                                {loan.nextPaymentDate
                                    ? new Date(loan.nextPaymentDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                                    : (loan.status === 'pending' || loan.status === 'approved') ? 'Pending disbursement' : '—'}
                            </div>
                            <div className="ld-stat-sub">
                                {loan.nextPaymentDate ? `${fmt(Math.min(loan.upcomingPaymentAmount || loan.monthlyPayment, loan.remainingBalance || Infinity))} due` : (loan.status === 'pending' || loan.status === 'approved') ? 'Starts after disbursement' : 'No upcoming payment'}
                            </div>
                        </div>
                    </div>

                    {/* ── Progress ── */}
                    <div className="ld-section">
                        <div className="ld-section-head">
                            <div className="ld-section-title">Repayment progress</div>
                        </div>
                        <div className="ld-progress-body">
                            <div className="ld-progress-label">
                                <span>{paidCount} of {totalMonths} payments made</span>
                                <span>{fmt(paidAmount)} paid · {(loan.status === 'pending' || loan.status === 'approved') ? fmt(0) : fmt(loan.remainingBalance)} remaining</span>
                            </div>
                            <div className="ld-progress-bar">
                                <div className="ld-progress-fill" style={{ width: `${progressPct}%` }} />
                            </div>
                            <div className="ld-progress-sub">Loan matures {fmtDate(schedule.length > 0 ? schedule[schedule.length - 1].dueDate : null)}</div>
                        </div>
                    </div>

                    {/* ── Loan details ── */}
                    <div className="ld-section">
                        <div className="ld-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="ld-section-title">Loan details</div>
                            <button className="ld-view-link" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#1E3A8A', fontWeight: 600, fontSize: '12px' }}>
                                <Printer size={14} /> Export to PDF
                            </button>
                        </div>
                        <div className="ld-details-grid">
                            <div className="ld-detail-col">
                                <div className="ld-detail-row">
                                    <span className="ld-detail-label">Loan ID</span>
                                    <span className="ld-detail-val">{loan.loanId}</span>
                                </div>
                                <div className="ld-detail-row">
                                    <span className="ld-detail-label">Loan type</span>
                                    <span className="ld-detail-val">{loan.purpose}</span>
                                </div>
                                <div className="ld-detail-row">
                                    <span className="ld-detail-label">Loan term</span>
                                    <span className="ld-detail-val">{loan.termMonths} months</span>
                                </div>
                                <div className="ld-detail-row">
                                    <span className="ld-detail-label">Interest rate</span>
                                    <span className="ld-detail-val">{(loan.interestRate < 1 ? loan.interestRate * 100 : loan.interestRate) || 0}% per month</span>
                                </div>
                            </div>
                            <div className="ld-detail-col ld-detail-col--right">
                                <div className="ld-detail-row">
                                    <span className="ld-detail-label">Applied date</span>
                                    <span className="ld-detail-val">{fmtDate(loan.appliedDate)}</span>
                                </div>
                                <div className="ld-detail-row">
                                    <span className="ld-detail-label">Disbursement date</span>
                                    <span className="ld-detail-val">{fmtDate(loan.disbursementDate)}</span>
                                </div>
                                <div className="ld-detail-row">
                                    <span className="ld-detail-label">Maturity date</span>
                                    <span className="ld-detail-val">{fmtDate(schedule.length > 0 ? schedule[schedule.length - 1].dueDate : null)}</span>
                                </div>
                                <div className="ld-detail-row">
                                    <span className="ld-detail-label">Payment frequency</span>
                                    <span className="ld-detail-val">Monthly</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Upcoming payments + Payment History (side by side) ── */}
                    <div className={schedule.filter(r => r.status !== 'paid').length > 0 && paymentHistory.length > 0 ? 'ld-two-col-grid' : 'ld-one-col-grid'}>
                        {/* Upcoming payments */}
                        {schedule.filter(r => r.status !== 'paid').length > 0 && (
                            <div className="ld-section" style={{ margin: 0 }}>
                                <div className="ld-section-head">
                                    <div className="ld-section-title">Upcoming payments</div>
                                    <button className="ld-view-link" onClick={() => setShowSchedule(true)}>
                                        View full schedule
                                    </button>
                                </div>
                                <div className="ld-preview-list">
                                    {schedule.filter(r => r.status !== 'paid').slice(0, 3).map((row, i) => {
                                        const isNext = row.isNext;
                                        const absIdx = schedule.indexOf(row);
                                        return (
                                            <div key={i} className="ld-preview-row">
                                                <div className={`ld-sched-num ${isNext ? 'ld-sched-num--due' : ''}`}>
                                                    {absIdx + 1}
                                                </div>
                                                <div className="ld-preview-info">
                                                    <div className="ld-preview-date">{fmtDate(row.dueDate)}</div>
                                                    <div className="ld-preview-breakdown">
                                                        Principal {fmt(row.principal)} · Interest {fmt(row.interest)}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div className={`ld-preview-amount ${isNext ? 'ld-preview-amount--warn' : ''}`}>
                                                        {fmt(row.payment)}
                                                        {row.isLate && <div style={{ fontSize: '10px', color: '#DC2626', background: '#FEE2E2', padding: '1px 4px', borderRadius: '4px', marginTop: '2px', display: 'inline-block', marginLeft: '6px' }}>3% Penalty</div>}
                                                    </div>
                                                    <div className={`ld-preview-status ${isNext ? 'ld-preview-status--due' : 'ld-preview-status--upcoming'}`}>
                                                        {isNext ? 'Due soon' : 'Upcoming'}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Payment History */}
                        {paymentHistory.length > 0 && (
                            <div className="ld-section" style={{ margin: 0 }}>
                                <div className="ld-section-head">
                                    <div className="ld-section-title">Payment history</div>
                                </div>
                                <div className="ld-preview-list">
                                    {paymentHistory.slice(0, 4).map((p, i) => (
                                        <div key={i} className="ld-preview-row" onClick={() => setHistoryDetail(p)} style={{ cursor: 'pointer' }}>
                                            <div className="ld-sched-num ld-sched-num--paid">✓</div>
                                            <div className="ld-preview-info">
                                                <div className="ld-preview-date">{fmtDate(p.confirmedAt || p.submittedAt)}</div>
                                                <div className="ld-preview-breakdown" style={{ textTransform: 'capitalize' }}>
                                                    Month #{p.monthNumber} · {p.paymentMethod}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div className="ld-preview-amount" style={{ color: '#16A34A' }}>{fmt(p.amount)}</div>
                                                <div className="ld-preview-status" style={{ color: '#16A34A', fontSize: '11px' }}>Confirmed</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Print View (Hidden on screen, visible on print) ── */}
                    <div className="ld-print-view">
                        <div className="ld-print-header">
                            <h2>Loan Statement — {loan.loanId}</h2>
                            <p>{loan.purpose} · Applied {fmtDate(loan.appliedDate)}</p>
                        </div>
                        
                        <div className="ld-print-stats">
                            <div className="ld-print-stat-item">
                                <label>Original amount</label>
                                <div>{fmt(loan.amount)}</div>
                            </div>
                            <div className="ld-print-stat-item">
                                <label>Remaining balance</label>
                                <div>{fmt(loan.remainingBalance)}</div>
                            </div>
                            <div className="ld-print-stat-item">
                                <label>Monthly payment</label>
                                <div>{fmt(loan?.upcomingPaymentAmount || loan?.monthlyPayment)}</div>
                            </div>
                            <div className="ld-print-stat-item">
                                <label>Next due date</label>
                                <div>{fmtDate(loan.nextPaymentDate)}</div>
                            </div>
                        </div>

                        <div className="ld-print-schedule">
                            <h3>Payment Schedule</h3>
                            <div className="ld-sched-table-wrap">
                                <div className="ld-sched-table-head">
                                    <span>#</span>
                                    <span style={{ textAlign: 'left' }}>Due date</span>
                                    <span>Principal</span>
                                    <span>Interest</span>
                                    <span>Payment</span>
                                    <span style={{ textAlign: 'right' }}>Status</span>
                                </div>
                                {schedule.map((row, i) => {
                                    const isPaid = row.status === 'paid';
                                    return (
                                        <div key={i} className="ld-sched-row">
                                            <div className="ld-sched-num">
                                                {isPaid ? '✓' : i + 1}
                                            </div>
                                            <span style={{ textAlign: 'left', fontSize: '12px' }}>{fmtDate(row.dueDate)}</span>
                                            <span className="ld-sched-cell">{fmt(row.principal)}</span>
                                            <span className="ld-sched-cell">{fmt(row.interest)}</span>
                                            <span className="ld-sched-cell">{fmt(row.payment)}</span>
                                            <span style={{ textAlign: 'right', fontWeight: 600, fontSize: '11px', color: isPaid ? '#16A34A' : '#6B7280' }}>
                                                {isPaid ? 'Paid' : 'Upcoming'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                </>
            )}

            {/* ── Modals ── */}
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
                <div className="ld-overlay" onClick={() => setHistoryDetail(null)}>
                    <div className="ld-modal ld-modal--pay" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
                        <div className="ld-modal-header">
                            <div>
                                <div className="ld-modal-title">Payment Receipt</div>
                                <div className="ld-modal-sub">Month #{historyDetail.monthNumber} — {historyDetail.loanId}</div>
                            </div>
                            <button className="ld-modal-close" onClick={() => setHistoryDetail(null)}><CloseIcon /></button>
                        </div>
                        <div className="ld-modal-body">
                            <div className="ld-pay-amount-box">
                                <div>
                                    <div className="ld-pay-amount-label">Amount Paid</div>
                                    <div className="ld-pay-amount-value" style={{ color: '#16A34A' }}>{fmt(historyDetail.amount)}</div>
                                </div>
                                <span style={{ background: '#DCFCE7', color: '#166534', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', fontFamily: 'Inter' }}>Confirmed</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <div className="ld-pay-section-label" style={{ marginBottom: '2px' }}>Payment For</div>
                                    <div style={{ fontFamily: 'Inter', fontSize: '14px', fontWeight: 600, color: '#111827' }}>Loan Repayment — {loan.purpose}</div>
                                </div>
                                <div><div className="ld-pay-section-label" style={{ marginBottom: '2px' }}>Method</div><div style={{ fontFamily: 'Inter', fontSize: '14px', fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>{historyDetail.paymentMethod}</div></div>
                                <div><div className="ld-pay-section-label" style={{ marginBottom: '2px' }}>Submitted</div><div style={{ fontFamily: 'Inter', fontSize: '13px', color: '#374151' }}>{fmtDate(historyDetail.submittedAt)}</div></div>
                                <div><div className="ld-pay-section-label" style={{ marginBottom: '2px' }}>Confirmed</div><div style={{ fontFamily: 'Inter', fontSize: '13px', color: '#374151' }}>{fmtDate(historyDetail.confirmedAt)}</div></div>
                                <div>
                                    <div className="ld-pay-section-label" style={{ marginBottom: '2px' }}>Month #</div>
                                    <div style={{ fontFamily: 'Inter', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                                        {historyDetail.monthNumber}
                                        {schedule && schedule[historyDetail.monthNumber - 1]?.dueDate && (
                                            <span style={{ fontWeight: 400, color: '#6B7280', marginLeft: '4px' }}>
                                                ({new Date(schedule[historyDetail.monthNumber - 1].dueDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <div className="ld-pay-section-label" style={{ marginBottom: '2px' }}>Reference No.</div>
                                    <div style={{ fontFamily: 'Inter', fontSize: '14px', fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                                        {historyDetail.referenceNumber || 'N/A'}
                                    </div>
                                </div>
                            </div>
                            {historyDetail.proofData && (
                                <div style={{ marginTop: '16px' }}>
                                    <div className="ld-pay-section-label" style={{ marginBottom: '8px' }}>Proof of Payment</div>
                                    <img
                                        src={historyDetail.proofData}
                                        alt="Payment proof"
                                        onClick={() => window.open(historyDetail.proofData, '_blank')}
                                        style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #E5E7EB', cursor: 'pointer' }}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="ld-modal-footer">
                            <button className="ld-footer-btn-confirm" onClick={() => setHistoryDetail(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
