import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import API from '../../utils/api';
import { CheckCircle, X, ArrowDownRight, ArrowUpLeft, Repeat, History, CreditCard, Smartphone, Building2, Info, UploadCloud, FileCheck2, PiggyBank, ZoomIn } from 'lucide-react';
import useSwipeToClose, { DragHandle } from '../hooks/useSwipeToClose';

const fmt = (n) =>
    n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '₱0.00';



const GOAL_NAME_OPTIONS = [
    { value: 'Vacation Fund', label: '  Vacation Fund' },
    { value: 'Emergency Fund', label: '  Emergency Fund' },
    { value: 'House / Down Payment', label: '  House / Down Payment' },
    { value: 'Car Purchase', label: '  Car Purchase' },
    { value: 'Education Fund', label: '  Education Fund' },
    { value: 'Retirement', label: '  Retirement' },
    { value: 'Gadget / Tech', label: '  Gadget / Tech' },
    { value: 'Wedding Fund', label: '  Wedding Fund' },
    { value: 'others', label: '  Others (Specify)' },
];

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

const CloseIcon = () => (
    <X size={16} />
);

/* ─────────────────────────────────────────────────────────────
   1.  DEPOSIT MODAL  (full — opened from top "+ Deposit" btn)
───────────────────────────────────────────────────────────── */
function DepositModal({ goals, onClose }) {
    const { modalStyle, touchHandlers } = useSwipeToClose(onClose);
    const [selectedGoal, setSelectedGoal] = useState(goals[0]?._id || '');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('E-Wallet');
    const [subMethod, setSubMethod] = useState('');
    const [accountName, setAccountName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [proofFile, setProofFile] = useState(null);
    const [proofBase64, setProofBase64] = useState('');
    const [previewImage, setPreviewImage] = useState(null);
    const [approvalMethod, setApprovalMethod] = useState('gateway');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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

    const goal = goals.find(g => g._id === selectedGoal);
    const numAmt = parseFloat(amount.replace(/,/g, '')) || 0;
    const newSaved = (goal?.savedAmount || 0) + numAmt;
    const newPct = goal?.targetAmount > 0
        ? Math.min(100, Math.round((newSaved / goal.targetAmount) * 100))
        : 0;

    const handleQuick = (val) => {
        const maxAllowed = goal?.targetAmount > 0 ? goal.targetAmount - (goal.savedAmount || 0) : Infinity;
        const toAdd = Math.min(val, maxAllowed);
        setAmount(toAdd.toLocaleString('en-US'));
    };

    const handleSubmit = async () => {
        if (!numAmt || numAmt <= 0) { setError('Please enter a valid amount.'); return; }
        if (!selectedGoal) { setError('Please select a goal.'); return; }
        if (!paymentMethod) { setError('Please select a payment method.'); return; }
        
        if (approvalMethod === 'manual') {
            if (!proofBase64) { setError('Please upload your proof of payment.'); return; }
            if (paymentMethod !== 'Cash') {
                if (!subMethod) { setError(`Please select a ${paymentMethod} option.`); return; }
                if (!accountName.trim()) { setError('Please enter the account name.'); return; }
                if (accountNumber.trim().length !== 11) { setError('Sender Account Number must be exactly 11 digits.'); return; }
            }
        }
        
        setError('');
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/api/savings/deposit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ goalId: selectedGoal, amount: numAmt, note, paymentMethod, subMethod, accountName, accountNumber, proofOfPayment: proofBase64 }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Deposit failed.');
            
            if (approvalMethod === 'manual') {
                alert('Deposit submitted! Your payment is pending manual approval.');
                onClose();
            } else if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                onClose();
            }
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const isFormComplete = 
        numAmt > 0 &&
        selectedGoal !== '' &&
        paymentMethod !== '' &&
        (approvalMethod !== 'manual' || (
            proofBase64 !== '' &&
            (paymentMethod === 'Cash' || (
                subMethod !== '' &&
                accountName.trim() !== '' &&
                accountNumber.trim().length === 11
            ))
        ));

    return (
        <div className="svm-overlay" onClick={onClose}>
            <div className="svm-modal" style={modalStyle} {...touchHandlers} onClick={e => e.stopPropagation()}>
                <DragHandle />
                <div className="svm-modal-head">
                    <div>
                        <div className="svm-modal-title">Deposit to savings</div>
                        <div className="svm-modal-sub">Choose a goal and enter the amount you'd like to add.</div>
                    </div>
                    <button className="svm-close-btn" onClick={onClose}><CloseIcon /></button>
                </div>

                <div className="svm-modal-body">
                    {error && <div className="svm-error">{error}</div>}

                    <div className="svm-field">
                        <label className="svm-label">Goal</label>
                        <select
                            className="svm-select"
                            value={selectedGoal}
                            onChange={e => setSelectedGoal(e.target.value)}
                        >
                            {goals.map(g => (
                                <option key={g._id} value={g._id}>
                                    {g.name} — {fmt(g.savedAmount)} saved
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="svm-field">
                        <label className="svm-label">Amount</label>
                        <div className="svm-amount-wrap">
                            <span className="svm-peso">₱</span>
                            <input
                                className="svm-input svm-input--amount"
                                type="text"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => {
                                    let raw = e.target.value.replace(/[^0-9.]/g, '');
                                    let val = parseFloat(raw) || 0;
                                    const maxAllowed = goal?.targetAmount > 0 ? goal.targetAmount - (goal.savedAmount || 0) : Infinity;
                                    if (val > maxAllowed) {
                                        raw = String(maxAllowed);
                                    }
                                    const parts = raw.split('.');
                                    if (parts[0]) {
                                        parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
                                    }
                                    setAmount(parts.join('.'));
                                }}
                            />
                        </div>
                        <div className="svm-quick-pills">
                            {QUICK_AMOUNTS.map(v => (
                                <button key={v} className="svm-quick-pill" onClick={() => handleQuick(v)}>
                                    ₱{v.toLocaleString()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="svm-field">
                        <label className="svm-label">Payment Method</label>
                        <div className="svm-payment-options">
                            {[
                                { id: 'E-Wallet', label: 'E-Wallet' },
                                { id: 'Bank', label: 'Bank Transfer' },
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    className={`svm-payment-btn ${paymentMethod === opt.id ? 'active' : ''}`}
                                    onClick={() => { setPaymentMethod(opt.id); setSubMethod(''); }}
                                >
                                    <div className={`svm-radio ${paymentMethod === opt.id ? 'active' : ''}`} />
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <div className="svm-info-text" style={{ marginTop: '8px' }}>
                            {approvalMethod === 'manual' ? (
                                <div style={{ marginTop: '16px' }}>
                                    <p style={{ marginBottom: '8px' }}>Please transfer your deposit to our <strong>{paymentMethod}</strong> account and upload the receipt below.</p>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                      <div className="svm-field">
                                        <label className="svm-label">{paymentMethod} Option</label>
                                        {paymentMethod === 'E-Wallet' ? (
                                          <select className="svm-select" value={subMethod} onChange={(e) => setSubMethod(e.target.value)}>
                                            <option value="" disabled>Select E-Wallet…</option>
                                            <option value="GCash">GCash</option>
                                            <option value="Maya">Maya</option>
                                          </select>
                                        ) : (
                                          <select className="svm-select" value={subMethod} onChange={(e) => setSubMethod(e.target.value)}>
                                            <option value="" disabled>Select Bank…</option>
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
                                      <div className="svm-field">
                                        <label className="svm-label">Sender Account Name</label>
                                        <input 
                                          type="text" 
                                          className="svm-input" 
                                          placeholder="e.g. Juan Dela Cruz"
                                          value={accountName}
                                          onChange={(e) => setAccountName(e.target.value)}
                                        />
                                      </div>
                                      <div className="svm-field">
                                        <label className="svm-label">Sender Account Number</label>
                                        <input 
                                          type="text" 
                                          className="svm-input" 
                                          placeholder="e.g. 09123456789"
                                          maxLength={11}
                                          value={accountNumber}
                                          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                        />
                                      </div>
                                    </div>

                                    {proofFile && proofBase64 ? (
                                      <div className="mt-4 relative p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-xl flex flex-col gap-2.5">
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
                                            className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center shrink-0"
                                            title="Remove file"
                                          >
                                            <X size={16} />
                                          </button>
                                        </div>

                                        <div 
                                          className="relative w-full max-h-48 overflow-hidden rounded-lg border border-slate-200/80 dark:border-white/10 bg-slate-100 dark:bg-black/30 flex items-center justify-center p-2 cursor-pointer group transition-all"
                                          onClick={() => setPreviewImage({ src: proofBase64, name: proofFile.name })}
                                          title="Click to expand image"
                                        >
                                          <img
                                            src={proofBase64}
                                            alt="Proof of Payment Preview"
                                            className="max-h-44 max-w-full object-contain rounded-md shadow-xs group-hover:scale-[1.02] transition-transform duration-200"
                                          />
                                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[2px] rounded-lg">
                                            <ZoomIn size={18} /> Click to enlarge
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <label className="mt-4 flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer transition-all text-center">
                                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                        <div className="flex flex-col items-center gap-1">
                                          <UploadCloud className="text-slate-400 dark:text-slate-300" size={28} />
                                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300"><span className="text-blue-600 dark:text-blue-400 hover:underline">Click to upload</span> or drag and drop</p>
                                          <p className="text-[11px] text-slate-400 m-0">PNG, JPG, JPEG up to 5MB</p>
                                        </div>
                                      </label>
                                    )}
                                </div>
                            ) : (
                                "You will be redirected to PayMongo to securely complete your payment. No manual proof upload is required!"
                            )}
                        </div>
                    </div>

                    <div className="svm-field">
                        <label className="svm-label">
                            Note <span className="svm-label-opt">(optional)</span>
                        </label>
                        <input
                            className="svm-input"
                            type="text"
                            placeholder="e.g. March savings"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    </div>

                    {goal && numAmt > 0 && (
                        <div className="svm-progress-hint">
                            <div style={{ flex: 1 }}>
                                <div className="svm-progress-hint-text">
                                    After this deposit, <strong>{goal.name}</strong> will be at
                                </div>
                                <div className="svm-progress-bar-wrap">
                                    <div
                                        className="svm-progress-bar-fill"
                                        style={{ width: `${newPct}%` }}
                                    />
                                </div>
                            </div>
                            <div className="svm-progress-pct">{newPct}%</div>
                        </div>
                    )}
                </div>

                <div className="svm-modal-footer">
                    <button className="svm-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
                    <button className="svm-btn-submit" onClick={handleSubmit} disabled={loading} style={{ opacity: (!isFormComplete || loading) ? 0.6 : 1, cursor: (!isFormComplete || loading) ? 'not-allowed' : 'pointer' }}>
                        {loading ? <span className="btn-spinner" /> : 'Confirm deposit'}
                    </button>
                </div>

                {previewImage && (
                    <div 
                        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setPreviewImage(null)}
                    >
                        <div 
                            className="relative max-w-3xl w-full bg-white dark:bg-[#1E2130] rounded-2xl p-4 shadow-2xl flex flex-col gap-3 overflow-hidden border border-slate-200 dark:border-white/10"
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
                                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-100 dark:bg-black/40 rounded-xl p-3 border border-slate-200/60 dark:border-white/5">
                                <img
                                    src={previewImage.src}
                                    alt={previewImage.name || 'Receipt'}
                                    className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-md"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   2.  NEW GOAL MODAL
───────────────────────────────────────────────────────────── */
function NewGoalModal({ onClose }) {
    const { modalStyle, touchHandlers } = useSwipeToClose(onClose);
    const [nameOption, setNameOption] = useState('');
    const [customName, setCustomName] = useState('');
    const [targetAmount, setTarget] = useState('');
    const [color] = useState('blue');
    const [iconType, setIcon] = useState('default');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isOthers = nameOption === 'others';
    const resolvedName = isOthers ? customName.trim() : nameOption;



    const handleNameChange = (val) => {
        setNameOption(val);
        setCustomName('');
        
        // Auto-match icon
        const mapping = {
            'Vacation Fund': 'star',
            'Emergency Fund': 'emergency',
            'House / Down Payment': 'house',
            'Car Purchase': 'car',
            'Education Fund': 'bag'
        };
        setIcon(mapping[val] || 'default');
    };

    const handleSubmit = async () => {
        if (!resolvedName) { setError('Goal name is required.'); return; }
        if (!targetAmount || parseFloat(targetAmount.replace(/,/g, '')) <= 0) { setError('Enter a valid target amount.'); return; }
        setError('');
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/api/savings/goals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    name: resolvedName,
                    targetAmount: parseFloat(targetAmount.replace(/,/g, '')),
                    color,
                    iconType,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Could not create goal.');
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const isFormComplete = 
        resolvedName !== '' &&
        targetAmount !== '' && parseFloat(targetAmount.replace(/,/g, '')) > 0;

    return (
        <div className="svm-overlay" onClick={onClose}>
            <div className="svm-modal" style={modalStyle} {...touchHandlers} onClick={e => e.stopPropagation()}>
                <DragHandle />
                <div className="svm-modal-head">
                    <div>
                        <div className="svm-modal-title">Create a savings goal</div>
                        <div className="svm-modal-sub">Set a target and track your progress</div>
                    </div>
                    <button className="svm-close-btn" onClick={onClose}><CloseIcon /></button>
                </div>

                <div className="svm-modal-body">
                    {error && <div className="svm-error">{error}</div>}

                    {/* GOAL NAME — dropdown + optional manual input */}
                    <div className="svm-field">
                        <label className="svm-label">Goal name</label>
                        <select
                            className="svm-select"
                            value={nameOption}
                            onChange={e => handleNameChange(e.target.value)}
                        >
                            <option value="" disabled>Select a goal…</option>
                            {GOAL_NAME_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        {isOthers && (
                            <input
                                className="svm-input svm-input--others"
                                type="text"
                                placeholder="e.g. Dream Concert Fund"
                                value={customName}
                                onChange={e => setCustomName(e.target.value)}
                                autoFocus
                            />
                        )}
                    </div>

                    <div className="svm-field">
                        <label className="svm-label">Target amount</label>
                        <div className="svm-amount-wrap">
                            <span className="svm-peso">₱</span>
                            <input
                                className="svm-input svm-input--amount"
                                type="text"
                                placeholder="0.00"
                                value={targetAmount}
                                onChange={e => {
                                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                                    const parts = raw.split('.');
                                    if (parts[0]) {
                                        parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
                                    }
                                    setTarget(parts.join('.'));
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="svm-modal-footer">
                    <button className="svm-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
                    <button className="svm-btn-submit" onClick={handleSubmit} disabled={loading} style={{ opacity: (!isFormComplete || loading) ? 0.6 : 1, cursor: (!isFormComplete || loading) ? 'not-allowed' : 'pointer' }}>
                        {loading ? <span className="btn-spinner" /> : 'Create goal'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   3.  QUICK DEPOSIT MODAL  (opened from + icon on goal row)
───────────────────────────────────────────────────────────── */
function QuickDepositModal({ goal, goals, onClose }) {
    const { modalStyle, touchHandlers } = useSwipeToClose(onClose);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('E-Wallet');
    const [subMethod, setSubMethod] = useState('');
    const [accountName, setAccountName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [proofFile, setProofFile] = useState(null);
    const [proofBase64, setProofBase64] = useState('');
    const [previewImage, setPreviewImage] = useState(null);
    const [approvalMethod, setApprovalMethod] = useState('gateway');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

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

    const numAmt = parseFloat(amount.replace(/,/g, '')) || 0;
    const newSaved = (goal?.savedAmount || 0) + numAmt;
    const newPct = goal?.targetAmount > 0
        ? Math.min(100, Math.round((newSaved / goal.targetAmount) * 100))
        : 0;

    const handleSubmit = async () => {
        if (!numAmt || numAmt <= 0) { setError('Enter a valid amount.'); return; }
        if (!paymentMethod) { setError('Please select a payment method.'); return; }
        if (approvalMethod === 'manual') {
            if (!proofBase64) { setError('Please upload your proof of payment.'); return; }
            if (!subMethod) { setError(`Please select a ${paymentMethod} option.`); return; }
            if (!accountName.trim()) { setError('Please enter the account name.'); return; }
            if (accountNumber.trim().length !== 11) { setError('Sender Account Number must be exactly 11 digits.'); return; }
        }
        setError('');
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/api/savings/deposit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ goalId: goal._id, amount: numAmt, note, paymentMethod, subMethod, accountName, accountNumber, proofOfPayment: proofBase64 }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Deposit failed.');
            
            if (approvalMethod === 'manual') {
                setSuccess(true);
                setTimeout(onClose, 1200);
            } else if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                setSuccess(true);
                setTimeout(onClose, 1200);
            }
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const isFormComplete = 
        numAmt > 0 &&
        paymentMethod !== '' && paymentMethod !== 'cash' &&
        (approvalMethod !== 'manual' || (
            proofBase64 !== '' &&
            subMethod !== '' &&
            accountName.trim() !== '' &&
            accountNumber.trim().length === 11
        ));

    return (
        <div className="svm-overlay" onClick={onClose}>
            <div className="svm-modal svm-modal--sm" style={modalStyle} {...touchHandlers} onClick={e => e.stopPropagation()}>
                <DragHandle />
                <div className="svm-modal-head">
                    <div>
                        <div className="svm-modal-title">Quick deposit</div>
                        <div className="svm-modal-sub">Add funds to your goal instantly</div>
                        <div className="svm-modal-goal-tag">{goal?.name}</div>
                    </div>
                    <button className="svm-close-btn" onClick={onClose}><CloseIcon /></button>
                </div>

                <div className="svm-modal-body">
                    {error && <div className="svm-error">{error}</div>}

                    {success ? (
                        <div className="svm-success">
                            <CheckCircle size={20} color="#fff" />
                            ₱{numAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })} submitted for admin confirmation!
                        </div>
                    ) : (
                        <>
                            <div className="svm-field">
                                <label className="svm-label">Amount</label>
                                <div className="svm-amount-wrap">
                                    <span className="svm-peso">₱</span>
                                    <input
                                        className="svm-input svm-input--amount"
                                        type="text"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={e => {
                                            let raw = e.target.value.replace(/[^0-9.]/g, '');
                                            let val = parseFloat(raw) || 0;
                                            const maxAllowed = goal?.targetAmount > 0 ? goal.targetAmount - (goal.savedAmount || 0) : Infinity;
                                            if (val > maxAllowed) {
                                                raw = String(maxAllowed);
                                            }
                                            const parts = raw.split('.');
                                            if (parts[0]) {
                                                parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
                                            }
                                            setAmount(parts.join('.'));
                                        }}
                                        autoFocus
                                    />
                                </div>
                                <div className="svm-quick-pills">
                                    {QUICK_AMOUNTS.map(v => (
                                        <button key={v} className="svm-quick-pill" onClick={() => {
                                            const maxAllowed = goal?.targetAmount > 0 ? goal.targetAmount - (goal.savedAmount || 0) : Infinity;
                                            const toAdd = Math.min(v, maxAllowed);
                                            setAmount(toAdd.toLocaleString('en-US'));
                                        }}>
                                            ₱{v.toLocaleString()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {goal && numAmt > 0 && (
                                <div className="svm-progress-hint">
                                    <div style={{ flex: 1 }}>
                                        <div className="svm-progress-hint-text">This deposit will bring your {goal.name} Fund to</div>
                                        <div className="svm-progress-bar-wrap">
                                            <div className="svm-progress-bar-fill" style={{ width: `${newPct}%` }} />
                                        </div>
                                    </div>
                                    <div className="svm-progress-pct">{newPct}%</div>
                                </div>
                            )}

                            <div className="svm-field">
                                <label className="svm-label">Payment Method</label>
                                <div className="svm-payment-options">
                                    {[
                                        { id: 'E-Wallet', label: 'E-Wallet' },
                                        { id: 'Bank', label: 'Bank' },
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            className={`svm-payment-btn ${paymentMethod === opt.id ? 'active' : ''}`}
                                            onClick={() => { setPaymentMethod(opt.id); setSubMethod(''); }}
                                            style={{ padding: '8px', fontSize: '11px' }}
                                        >
                                            <div className={`svm-radio ${paymentMethod === opt.id ? 'active' : ''}`} style={{ width: '12px', height: '12px' }} />
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="svm-info-text" style={{ marginTop: '8px', fontSize: '11px', color: '#6B7280' }}>
                                    {approvalMethod === 'manual' ? (
                                        <div style={{ marginTop: '12px' }}>
                                            <p style={{ marginBottom: '8px' }}>Please transfer to our <strong>{paymentMethod}</strong> account and upload receipt.</p>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                              <div className="svm-field">
                                                <label className="svm-label">{paymentMethod} Option</label>
                                                {paymentMethod === 'E-Wallet' ? (
                                                  <select className="svm-select" value={subMethod} onChange={(e) => setSubMethod(e.target.value)}>
                                                    <option value="" disabled>Select E-Wallet…</option>
                                                    <option value="GCash">GCash</option>
                                                    <option value="Maya">Maya</option>
                                                  </select>
                                                ) : (
                                                  <select className="svm-select" value={subMethod} onChange={(e) => setSubMethod(e.target.value)}>
                                                    <option value="" disabled>Select Bank…</option>
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
                                              <div className="svm-field">
                                                <label className="svm-label">Sender Account Name</label>
                                                <input 
                                                  type="text" 
                                                  className="svm-input" 
                                                  placeholder="e.g. Juan Dela Cruz"
                                                  value={accountName}
                                                  onChange={(e) => setAccountName(e.target.value)}
                                                />
                                              </div>
                                              <div className="svm-field">
                                                <label className="svm-label">Sender Account Number</label>
                                                <input 
                                                  type="text" 
                                                  className="svm-input" 
                                                  placeholder="e.g. 09123456789"
                                                  maxLength={11}
                                                  value={accountNumber}
                                                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                                />
                                              </div>
                                            </div>

                                            {proofFile && proofBase64 ? (
                                              <div className="mt-4 relative p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-xl flex flex-col gap-2">
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 truncate pr-2">
                                                    <FileCheck2 size={14} className="text-emerald-500 shrink-0" />
                                                    <span className="truncate">{proofFile.name}</span>
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setProofFile(null);
                                                      setProofBase64('');
                                                    }}
                                                    className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center shrink-0"
                                                    title="Remove file"
                                                  >
                                                    <X size={14} />
                                                  </button>
                                                </div>

                                                <div 
                                                  className="relative w-full max-h-40 overflow-hidden rounded-lg border border-slate-200/80 dark:border-white/10 bg-slate-100 dark:bg-black/30 flex items-center justify-center p-2 cursor-pointer group transition-all"
                                                  onClick={() => setPreviewImage({ src: proofBase64, name: proofFile.name })}
                                                  title="Click to expand image"
                                                >
                                                  <img
                                                    src={proofBase64}
                                                    alt="Proof of Payment Preview"
                                                    className="max-h-36 max-w-full object-contain rounded-md shadow-xs group-hover:scale-[1.02] transition-transform duration-200"
                                                  />
                                                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[2px] rounded-lg">
                                                    <ZoomIn size={16} /> Click to enlarge
                                                  </div>
                                                </div>
                                              </div>
                                            ) : (
                                              <label className="mt-4 p-3 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer transition-all text-center">
                                                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                                <div className="flex flex-col items-center gap-1">
                                                  <UploadCloud className="text-slate-400 dark:text-slate-300" size={24} />
                                                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300"><span className="text-blue-600 dark:text-blue-400 hover:underline">Upload Receipt</span></p>
                                                </div>
                                              </label>
                                            )}
                                        </div>
                                    ) : (
                                        "You will be securely redirected to PayMongo."
                                    )}
                                </div>
                            </div>

                            <div className="svm-field">
                                <label className="svm-label">Note <span className="svm-label-opt">(optional)</span></label>
                                <input
                                    className="svm-input"
                                    type="text"
                                    placeholder="e.g. bonus pay"
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                </div>

                {!success && (
                    <div className="svm-modal-footer">
                        <button className="svm-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
                        <button className="svm-btn-submit" onClick={handleSubmit} disabled={loading} style={{ opacity: (!isFormComplete || loading) ? 0.6 : 1, cursor: (!isFormComplete || loading) ? 'not-allowed' : 'pointer' }}>
                            {loading ? <span className="btn-spinner" /> : `Deposit ${numAmt > 0 ? fmt(numAmt) : ''}`}
                        </button>
                    </div>
                )}

                {previewImage && (
                    <div 
                        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setPreviewImage(null)}
                    >
                        <div 
                            className="relative max-w-3xl w-full bg-white dark:bg-[#1E2130] rounded-2xl p-4 shadow-2xl flex flex-col gap-3 overflow-hidden border border-slate-200 dark:border-white/10"
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
                                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-100 dark:bg-black/40 rounded-xl p-3 border border-slate-200/60 dark:border-white/5">
                                <img
                                    src={previewImage.src}
                                    alt={previewImage.name || 'Receipt'}
                                    className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-md"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   4.  EDIT GOAL MODAL
───────────────────────────────────────────────────────────── */
function EditGoalModal({ goal, onClose }) {
    const { modalStyle, touchHandlers } = useSwipeToClose(onClose);
    // Detect if the existing name matches a preset or is custom
    const matchedPreset = GOAL_NAME_OPTIONS.find(
        o => o.value !== 'others' && o.value === goal?.name
    );
    const [nameOption, setNameOption] = useState(matchedPreset ? goal.name : 'others');
    const [customName, setCustomName] = useState(!matchedPreset ? (goal?.name || '') : '');
    const [target, setTarget] = useState(String(goal?.targetAmount || ''));
    const [monthly, setMonthly] = useState(String(goal?.monthlyContribution || ''));
    const [startDate, setStartDate] = useState(goal?.startDate ? goal.startDate.slice(0, 10) : new Date().toISOString().split('T')[0]);
    const [targetDate, setDate] = useState(goal?.targetDate ? goal.targetDate.slice(0, 10) : '');
    const [dateError, setDateError] = useState('');
    const [color] = useState(goal?.color || 'blue');
    const [iconType, setIcon] = useState(goal?.iconType || 'default');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);

    const isOthers = nameOption === 'others';
    const resolvedName = isOthers ? customName.trim() : nameOption;


    const handleDates = (start, end) => {
        if (start && end) {
            const s = new Date(start);
            const e = new Date(end);
            const minTarget = new Date(s);
            // Must be at least 1 month forward
            minTarget.setMonth(s.getMonth() + 1);
            if (e < minTarget) {
                setDateError('Target date must be at least 1 month from start date.');
            } else {
                setDateError('');
            }
        } else {
            setDateError('');
        }
    };

    const handleNameChange = (val) => {
        setNameOption(val);
        setCustomName('');
        
        // Auto-match icon
        const mapping = {
            'Vacation Fund': 'star',
            'Emergency Fund': 'emergency',
            'House / Down Payment': 'house',
            'Car Purchase': 'car',
            'Education Fund': 'bag'
        };
        setIcon(mapping[val] || 'default');
    };

    const handleSave = async () => {
        if (!resolvedName) { setError('Goal name is required.'); return; }
        if (dateError) { setError(dateError); return; }
        setError('');
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/api/savings/goals/${goal._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    name: resolvedName,
                    targetAmount: parseFloat(target) || goal.targetAmount,
                    startDate: startDate || undefined,
                    targetDate: targetDate || undefined,
                    monthlyContribution: parseFloat(monthly) || 0,
                    color,
                    iconType,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Could not update goal.');
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/api/savings/goals/${goal._id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Could not delete goal.');
            onClose();
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="svm-overlay" onClick={onClose}>
            <div className="svm-modal" style={modalStyle} {...touchHandlers} onClick={e => e.stopPropagation()}>
                <DragHandle />
                <div className="svm-modal-head">
                    <div>
                        <div className="svm-modal-title">Edit goal</div>
                        <div className="svm-modal-sub">Update your savings goal details</div>
                    </div>
                    <button className="svm-close-btn" onClick={onClose}><CloseIcon /></button>
                </div>

                <div className="svm-modal-body">
                    {error && <div className="svm-error">{error}</div>}

                    {/* GOAL NAME — dropdown + optional manual input */}
                    <div className="svm-field">
                        <label className="svm-label">Goal name</label>
                        <select
                            className="svm-select"
                            value={nameOption}
                            onChange={e => handleNameChange(e.target.value)}
                        >
                            <option value="" disabled>Select a goal…</option>
                            {GOAL_NAME_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        {isOthers && (
                            <input
                                className="svm-input svm-input--others"
                                type="text"
                                placeholder="e.g. Dream Concert Fund"
                                value={customName}
                                onChange={e => setCustomName(e.target.value)}
                            />
                        )}
                    </div>

                    <div className="svm-field">
                        <label className="svm-label">Target amount</label>
                        <div className="svm-amount-wrap">
                            <span className="svm-peso">₱</span>
                            <input
                                className="svm-input svm-input--amount"
                                type="text"
                                value={target}
                                onChange={e => setTarget(e.target.value.replace(/[^0-9.]/g, ''))}
                            />
                        </div>
                    </div>

                    {/* START DATE + TARGET DATE side by side */}
                    <div className="svm-field-row">
                        <div className="svm-field">
                            <label className="svm-label">Start date</label>
                            <input
                                className="svm-input"
                                type="date"
                                value={startDate}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={e => { setStartDate(e.target.value); handleDates(e.target.value, targetDate); }}
                            />
                        </div>
                        <div className="svm-field">
                            <label className="svm-label">Target date <span className="svm-label-opt">(optional)</span></label>
                            <input
                                className={`svm-input${dateError ? ' svm-input--error' : ''}`}
                                type="date"
                                value={targetDate}
                                min={(() => {
                                    if (!startDate) return new Date().toISOString().split('T')[0];
                                    const d = new Date(startDate);
                                    d.setMonth(d.getMonth() + 1);
                                    return d.toISOString().split('T')[0];
                                })()}
                                onChange={e => { setDate(e.target.value); handleDates(startDate, e.target.value); }}
                            />
                        </div>
                    </div>
                    {dateError && <div className="svm-date-error">{dateError}</div>}
                    <div className="svm-helper-text">When to begin saving</div>

                    <div className="svm-field">
                        <label className="svm-label">Monthly contribution <span className="svm-label-opt">(optional)</span></label>
                        <div className="svm-amount-wrap">
                            <span className="svm-peso">₱</span>
                            <input
                                className="svm-input svm-input--amount"
                                type="text"
                                value={monthly}
                                onChange={e => setMonthly(e.target.value.replace(/[^0-9.]/g, ''))}
                            />
                        </div>
                    </div>

                    {/* Delete zone */}
                    <div className="svm-delete-zone">
                        {!confirmDelete ? (
                            <button className="svm-delete-link" onClick={() => setConfirmDelete(true)}>
                                Delete this goal
                            </button>
                        ) : (
                            <div className="svm-delete-confirm">
                                <span>Are you sure? This cannot be undone.</span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="svm-btn-cancel svm-btn-cancel--sm" onClick={() => setConfirmDelete(false)}>
                                        No, keep it
                                    </button>
                                    <button className="svm-btn-danger" onClick={handleDelete} disabled={loading}>
                                        {loading ? <span className="btn-spinner" /> : 'Yes, delete'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="svm-modal-footer">
                    <button className="svm-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
                    <button className="svm-btn-submit" onClick={handleSave} disabled={loading}>
                        {loading ? <span className="btn-spinner" /> : 'Save changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   5.  TRANSFER MODAL  (move funds between goals)
───────────────────────────────────────────────────────────── */
function TransferModal({ goal, goals, onClose }) {
    const { modalStyle, touchHandlers } = useSwipeToClose(onClose);
    const [fromGoalId, setFromGoalId] = useState(goal?._id || '');
    const [toGoalId, setToGoalId] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const fromGoal = goals.find(g => g._id === fromGoalId);
    const available = fromGoal?.savedAmount || 0;
    const numAmt = parseFloat(amount.replace(/,/g, '')) || 0;
    const quickAmounts = [100, 500, 1000, 2000].filter(v => v <= available);

    const handleSubmit = async () => {
        if (!fromGoalId) { setError('Select a source goal.'); return; }
        if (!toGoalId) { setError('Select a destination goal.'); return; }
        if (fromGoalId === toGoalId) { setError('Source and destination must be different.'); return; }
        if (!numAmt || numAmt <= 0) { setError('Enter a valid amount.'); return; }
        if (numAmt > available) { setError('Amount exceeds available balance.'); return; }
        setError('');
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/api/savings/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ fromGoalId, toGoalId, amount: numAmt, note }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Transfer failed.');
            setSuccess(true);
            setTimeout(onClose, 1500);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="svm-overlay" onClick={onClose}>
            <div className="svm-modal" style={modalStyle} {...touchHandlers} onClick={e => e.stopPropagation()}>
                <DragHandle />
                <div className="svm-modal-head">
                    <div>
                        <div className="svm-modal-title">Transfer funds</div>
                        <div className="svm-modal-sub">Move savings between your goals</div>
                    </div>
                    <button className="svm-close-btn" onClick={onClose}><CloseIcon /></button>
                </div>

                <div className="svm-modal-body">
                    {error && <div className="svm-error">{error}</div>}

                    {success ? (
                        <div className="svm-success">
                            <CheckCircle size={20} color="#fff" />
                            ₱{numAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })} transferred!
                        </div>
                    ) : (
                        <>
                            <div className="svm-field">
                                <label className="svm-label">From goal</label>
                                <select
                                    className="svm-select"
                                    value={fromGoalId}
                                    onChange={e => { setFromGoalId(e.target.value); setAmount(''); }}
                                >
                                    <option value="" disabled>Select source…</option>
                                    {goals.filter(g => (g.savedAmount || 0) > 0).map(g => (
                                        <option key={g._id} value={g._id}>
                                            {g.name} — {fmt(g.savedAmount)} available
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="svm-field">
                                <label className="svm-label">To goal</label>
                                <select
                                    className="svm-select"
                                    value={toGoalId}
                                    onChange={e => setToGoalId(e.target.value)}
                                >
                                    <option value="" disabled>Select destination…</option>
                                    {goals.filter(g => g._id !== fromGoalId).map(g => (
                                        <option key={g._id} value={g._id}>
                                            {g.name} — {fmt(g.savedAmount)} saved
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="svm-field">
                                <label className="svm-label">Amount</label>
                                <div className="svm-amount-wrap">
                                    <span className="svm-peso">₱</span>
                                    <input
                                        className="svm-input svm-input--amount"
                                        type="text"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={e => {
                                            let raw = e.target.value.replace(/[^0-9.]/g, '');
                                            let val = parseFloat(raw) || 0;
                                            if (val > available) raw = String(available);
                                            const parts = raw.split('.');
                                            if (parts[0]) {
                                                parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
                                            }
                                            setAmount(parts.join('.'));
                                        }}
                                    />
                                </div>
                                {available > 0 && (
                                    <div className="svm-helper-text">
                                        Available: {fmt(available)}
                                    </div>
                                )}
                                {quickAmounts.length > 0 && (
                                    <div className="svm-quick-pills">
                                        {quickAmounts.map(v => (
                                            <button key={v} className="svm-quick-pill" onClick={() => setAmount(String(v))}>
                                                ₱{v.toLocaleString()}
                                            </button>
                                        ))}
                                        <button className="svm-quick-pill" onClick={() => setAmount(String(available))}>
                                            All
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="svm-field">
                                <label className="svm-label">
                                    Note <span className="svm-label-opt">(optional)</span>
                                </label>
                                <input
                                    className="svm-input"
                                    type="text"
                                    placeholder="e.g. Re-allocating funds"
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                </div>

                {!success && (
                    <div className="svm-modal-footer">
                        <button className="svm-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
                        <button className="svm-btn-submit" onClick={handleSubmit} disabled={loading || !numAmt}>
                            {loading ? <span className="btn-spinner" /> : `Transfer ${numAmt > 0 ? fmt(numAmt) : ''}`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   3.5 GOAL INFO MODAL (Read-only + history)
───────────────────────────────────────────────────────────── */
function GoalInfoModal({ goal, onClose, onEdit, onTransfer, onQuickDeposit }) {
    const { modalStyle, touchHandlers } = useSwipeToClose(onClose);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!goal) return;
        const fetchHistory = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API}/api/savings/transactions?goalId=${goal._id}&limit=50`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    setTransactions(data.transactions || []);
                }
            } catch (err) {
                console.error('Failed to fetch goal history:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [goal._id, goal]);

    const fmtDateShort = (d) => {
        if (!d) return '';
        const date = new Date(d);
        return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (!goal) return null;

    return (
        <div className="svm-overlay" onClick={onClose}>
            <div className="svm-modal" style={modalStyle} {...touchHandlers} onClick={e => e.stopPropagation()}>
                <DragHandle />
                <div className="svm-modal-head">
                    <div className="svm-modal-title-row">
                        <div className="svm-modal-title">{goal.name}</div>
                        <div className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-200 dark:border-blue-800/50">
                            Goal Details & History
                        </div>
                    </div>
                    <button className="svm-close-btn" onClick={onClose}><CloseIcon /></button>
                </div>

                <div className="svm-modal-body space-y-4">
                    {/* Goal Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 font-inter">
                        <div className="flex flex-col">
                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Current Balance</span>
                            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-dm">{fmt(goal.savedAmount)}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Target Amount</span>
                            <span className="text-base font-bold text-slate-900 dark:text-white font-dm">{fmt(goal.targetAmount)}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Monthly Goal</span>
                            <span className="text-base font-bold text-slate-900 dark:text-white font-dm">{goal.monthlyContribution > 0 ? fmt(goal.monthlyContribution) : '—'}</span>
                        </div>
                    </div>

                    {/* Transaction History Section */}
                    <div className="space-y-2 font-inter">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            <History size={14} className="text-blue-500" />
                            <span>Transaction History</span>
                        </div>

                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {loading ? (
                                <div className="py-8 text-center text-xs text-slate-400 font-medium">Loading history...</div>
                            ) : transactions.length === 0 ? (
                                <div className="py-8 text-center text-xs text-slate-400 font-medium bg-slate-50/50 dark:bg-white/5 rounded-xl border border-dashed border-slate-200 dark:border-white/10">No transactions yet for this goal.</div>
                            ) : (
                                transactions.map(txn => {
                                    const isPos = txn.type === 'deposit';
                                    const isNeg = txn.type === 'withdrawal';
                                    const isTransfer = txn.source === 'Transfer';
                                    
                                    let Icon = ArrowDownRight;
                                    let txLabel = 'Deposit';
                                    
                                    if (isNeg) { 
                                        Icon = ArrowUpLeft; 
                                        txLabel = 'Withdrawal'; 
                                    }
                                    if (isTransfer) { 
                                        Icon = Repeat; 
                                        txLabel = 'Transfer'; 
                                    }

                                    return (
                                        <div key={txn._id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 hover:border-blue-500/40 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                    isPos ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : isNeg ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                                                }`}>
                                                    <Icon size={15} />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                                                        {txLabel}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 dark:text-slate-500">{fmtDateShort(txn.date)}</div>
                                                </div>
                                            </div>
                                            <div className={`text-xs font-bold font-dm ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                                {isPos ? '+' : '-'}{fmt(txn.amount)}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                <div className="svm-modal-footer">
                    <button className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer" onClick={onClose}>
                        Close
                    </button>
                    <button className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer" onClick={() => onQuickDeposit(goal)}>
                        + Deposit
                    </button>
                    <button className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer" onClick={() => onTransfer(goal)}>
                        Transfer
                    </button>
                    <button className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer" onClick={() => onEdit(goal)}>
                        Edit
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   6.  TRANSACTION INFO MODAL (Specific details)
 ───────────────────────────────────────────────────────────── */
function TransactionInfoModal({ transaction, onClose }) {
    const { modalStyle, touchHandlers } = useSwipeToClose(onClose);
    const [fullImage, setFullImage] = useState(false);


    if (!transaction) return null;

    const isIn = transaction.type === 'deposit';
    const isOut = transaction.type === 'withdrawal';
    const isTransfer = transaction.source === 'Transfer';
    const isGcash = transaction.paymentMethod === 'e-wallet';
    const isBank = transaction.paymentMethod === 'bank';

    let Icon = ArrowDownRight;
    let statusText = transaction.status === 'confirmed' ? 'Successful' : transaction.status === 'rejected' ? 'Failed' : 'Pending';

    if (isOut) { Icon = ArrowUpLeft; }
    if (isTransfer) { Icon = Repeat; }

    return (
        <div className="svm-overlay" onClick={onClose}>
            <div className="svm-modal svm-modal--sm" style={modalStyle} {...touchHandlers} onClick={e => e.stopPropagation()}>
                <DragHandle />
                {/* Header */}
                <div className="svm-modal-head">
                    <div>
                        <div className="svm-modal-title">Transaction Receipt</div>
                        <div className="svm-modal-sub">Activity reference details</div>
                    </div>
                    <button className="svm-close-btn" onClick={onClose}><CloseIcon /></button>
                </div>

                <div className="svm-modal-body space-y-4 font-inter">
                    {/* Amount & Status Banner */}
                    <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 text-center space-y-2">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs ${
                            isIn ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600' : isOut ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-600'
                        }`}>
                            <Icon size={24} />
                        </div>
                        <div>
                            <div className={`text-2xl font-extrabold font-dm ${isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                {isIn ? '+' : '-'}{fmt(transaction.amount)}
                            </div>
                            <span className={`inline-block mt-1.5 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                                transaction.status === 'confirmed' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            }`}>
                                {statusText}
                            </span>
                        </div>
                    </div>

                    {/* Receipt Details Grid */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 dark:text-slate-500 font-medium">Date & Time</span>
                            <span className="text-slate-900 dark:text-white font-semibold">
                                {new Date(transaction.date).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-200/70 dark:border-white/5">
                            <span className="text-slate-400 dark:text-slate-500 font-medium">Type</span>
                            <span className="text-slate-900 dark:text-white font-semibold capitalize">
                                {transaction.type} {isTransfer ? '(Transfer)' : ''}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-200/70 dark:border-white/5">
                            <span className="text-slate-400 dark:text-slate-500 font-medium">Allocated Goal</span>
                            <span className="text-slate-900 dark:text-white font-semibold">
                                {transaction.goalName || 'General Savings'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-200/70 dark:border-white/5">
                            <span className="text-slate-400 dark:text-slate-500 font-medium">Description</span>
                            <span className="text-slate-900 dark:text-white font-semibold">
                                {transaction.description || (isIn ? 'Deposit' : 'Withdrawal')}
                            </span>
                        </div>
                    </div>

                    {/* Payment Info Card */}
                    {(transaction.paymentMethod && transaction.paymentMethod !== 'cash') && (
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 space-y-3">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Payment Method</span>
                                <span className="text-slate-900 dark:text-white font-semibold flex items-center gap-1.5 capitalize">
                                    {isGcash ? <Smartphone size={14} className="text-blue-500" /> : isBank ? <Building2 size={14} className="text-emerald-500" /> : <CreditCard size={14} className="text-purple-500" />} 
                                    {transaction.paymentMethod}
                                </span>
                            </div>

                            {transaction.referenceNumber && (
                                <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-200/70 dark:border-white/5">
                                    <span className="text-slate-400 dark:text-slate-500 font-medium">Reference No.</span>
                                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/40">
                                        {transaction.referenceNumber}
                                    </span>
                                </div>
                            )}

                            {transaction.proofOfPayment && (
                                <div className="pt-2.5 border-t border-slate-200/70 dark:border-white/5 space-y-1.5">
                                    <span className="text-slate-400 dark:text-slate-500 font-medium text-xs block">Proof of Payment</span>
                                    <div 
                                        onClick={() => setFullImage(true)}
                                        className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 group cursor-pointer h-28 bg-slate-100 dark:bg-black/20 flex items-center justify-center"
                                    >
                                        <img src={transaction.proofOfPayment} alt="Receipt" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                                            <Info size={14} /> Tap to expand
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="svm-modal-footer">
                    <button className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer" onClick={onClose}>
                        Done
                    </button>
                </div>
            </div>

            {/* Internal Image Preview Overlay */}
            {fullImage && (
                <div className="svm-full-img-overlay" onClick={() => setFullImage(false)}>
                    <div className="svm-full-img-container" onClick={e => e.stopPropagation()}>
                        <button className="svm-full-img-close" onClick={() => setFullImage(false)}>
                            <X size={20} />
                        </button>
                        <img src={transaction.proofOfPayment} alt="Full Proof" className="svm-full-img" />
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   8.  WITHDRAW MODAL
───────────────────────────────────────────────────────────── */
function WithdrawModal({ goals, onClose, onOpenDeposit }) {
    const { modalStyle, touchHandlers } = useSwipeToClose(onClose);
    const { profile } = useAuth();
    const activeGoals = goals.filter(g => (g.savedAmount || 0) > 0);
    const [selectedGoal, setSelectedGoal] = useState(activeGoals[0]?._id || '');
    const [amount, setAmount] = useState('');
    const [reasonOption, setReasonOption] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [sendMethod, setSendMethod] = useState('e-wallet');
    const [accountNumber, setAccountNumber] = useState(profile?.phone || '');
    const [accountName, setAccountName] = useState(profile?.fullName || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const goal = activeGoals.find(g => g._id === selectedGoal);
    const balance = goal?.savedAmount || 0;
    const numAmt = parseFloat(amount.replace(/,/g, '')) || 0;
    const remaining = balance - numAmt;
    const remainingPct = goal?.targetAmount > 0
        ? Math.max(0, Math.round((remaining / goal.targetAmount) * 100))
        : 0;
    const isOtherReason = reasonOption === 'Others';
    const finalReason = isOtherReason ? customReason : reasonOption;

    const handleSubmit = async () => {
        if (!selectedGoal) { setError('Select a goal to withdraw from.'); return; }
        if (!numAmt || numAmt <= 0) { setError('Enter a valid withdrawal amount.'); return; }
        if (numAmt > balance) { setError(`Insufficient balance. Available: ${fmt(balance)}`); return; }
        if (!finalReason.trim()) { setError('Please provide a reason for withdrawal.'); return; }
        if (!accountNumber.trim()) { setError('Please provide your account number.'); return; }
        if (!accountName.trim()) { setError('Please provide the account holder name.'); return; }
        setError('');
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/api/savings/withdraw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ 
                    goalId: selectedGoal, 
                    amount: numAmt, 
                    reason: finalReason,
                    sendMethod,
                    accountNumber: accountNumber.trim(),
                    accountName: accountName.trim()
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Withdrawal failed.');
            setSuccess(true);
            setTimeout(onClose, 1500);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (activeGoals.length === 0) {
        return (
            <div className="svm-overlay" onClick={onClose}>
                <div className="svm-modal svm-modal--sm" style={modalStyle} {...touchHandlers} onClick={e => e.stopPropagation()}>
                    <DragHandle />
                    <div className="svm-modal-head">
                        <div>
                            <div className="svm-modal-title">Withdraw Savings</div>
                            <div className="svm-modal-sub">No funds available to withdraw</div>
                        </div>
                        <button className="svm-close-btn" onClick={onClose}><CloseIcon /></button>
                    </div>

                    <div className="svm-modal-body text-center py-6 px-4 font-inter">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-900/30 mx-auto mb-3 shadow-xs">
                            <PiggyBank size={28} />
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-dm mb-1.5">
                            No Savings Available Yet
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-inter leading-relaxed max-w-xs mx-auto">
                            You don't have active savings funds to withdraw yet. Start by making a deposit or creating a new goal.
                        </p>
                    </div>

                    {onOpenDeposit ? (
                        <div className="svm-modal-footer">
                            <button 
                                className="w-full h-10 px-4 rounded-xl bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white text-xs font-bold font-inter transition-all border-none cursor-pointer shadow-md active:scale-95" 
                                onClick={() => { onClose(); onOpenDeposit(); }}
                            >
                                + Deposit Now
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className="svm-overlay" onClick={onClose}>
            <div className="svm-modal" style={modalStyle} {...touchHandlers} onClick={e => e.stopPropagation()}>
                <DragHandle />
                <div className="svm-modal-head">
                    <div>
                        <div className="svm-modal-title">Withdraw savings</div>
                        <div className="svm-modal-sub">Request a withdrawal from your savings goal.</div>
                    </div>
                    <button className="svm-close-btn" onClick={onClose}><CloseIcon /></button>
                </div>

                <div className="svm-modal-body">
                    {error && <div className="svm-error">{error}</div>}

                    {success ? (
                        <div className="svm-success">
                            <CheckCircle size={20} color="#fff" />
                            Withdrawal of {fmt(numAmt)} — Successful!
                        </div>
                    ) : (
                        <>
                            <div className="svm-field">
                                <label className="svm-label">Withdraw from</label>
                                <select
                                    className="svm-select"
                                    value={selectedGoal}
                                    onChange={e => setSelectedGoal(e.target.value)}
                                >
                                    {activeGoals.map(g => (
                                        <option key={g._id} value={g._id}>
                                            {g.name} — {fmt(g.savedAmount)} available
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {goal && (
                                <div className="svm-withdraw-balance-card">
                                    <div className="svm-withdraw-balance-row">
                                        <span className="svm-withdraw-balance-label">Available balance</span>
                                        <span className="svm-withdraw-balance-value text-emerald-600 dark:text-emerald-400">{fmt(balance)}</span>
                                    </div>
                                    {goal.targetAmount > 0 && (
                                        <div className="svm-withdraw-balance-row">
                                            <span className="svm-withdraw-balance-label">Goal target</span>
                                            <span className="svm-withdraw-balance-value text-slate-500 dark:text-slate-400 font-semibold">{fmt(goal.targetAmount)}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="svm-field">
                                <label className="svm-label">Amount to withdraw</label>
                                <div className="svm-amount-wrap">
                                    <span className="svm-peso">₱</span>
                                    <input
                                        className="svm-input svm-input--amount"
                                        type="text"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                                        autoFocus
                                    />
                                </div>
                                <div className="svm-quick-pills">
                                    {[500, 1000, 2000].filter(v => v <= balance).map(v => (
                                        <button key={v} className="svm-quick-pill" onClick={() => setAmount(String(v))}>
                                            ₱{v.toLocaleString()}
                                        </button>
                                    ))}
                                    <button className="svm-quick-pill svm-quick-pill--all" onClick={() => setAmount(String(balance))}>
                                        Withdraw all
                                    </button>
                                </div>
                            </div>

                            {goal && numAmt > 0 && numAmt <= balance && (
                                <div className="svm-progress-hint svm-progress-hint--withdraw">
                                    <div style={{ flex: 1 }}>
                                        <div className="svm-progress-hint-text">
                                            After withdrawal, <strong>{goal.name}</strong> will have {fmt(remaining)} remaining
                                        </div>
                                        <div className="svm-progress-bar-wrap">
                                            <div
                                                className="svm-progress-bar-fill svm-progress-bar-fill--withdraw"
                                                style={{ width: `${remainingPct}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="svm-progress-pct">{remainingPct}%</div>
                                </div>
                            )}

                            {numAmt > balance && (
                                <div className="svm-withdraw-warning">
                                    ⚠️ Amount exceeds available balance of {fmt(balance)}
                                </div>
                            )}

                            <div className="svm-field">
                                <label className="svm-label">Send to</label>
                                <div className="svm-payment-options">
                                    {[
                                        { id: 'e-wallet', label: 'E-Wallet' },
                                        { id: 'bank', label: 'Bank Transfer' },
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            className={`svm-payment-btn ${sendMethod === opt.id ? 'active' : ''}`}
                                            onClick={() => setSendMethod(opt.id)}
                                        >
                                            <div className={`svm-radio ${sendMethod === opt.id ? 'active' : ''}`} />
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="svm-field">
                                <label className="svm-label">{sendMethod === 'e-wallet' ? 'E-Wallet Number' : 'Bank Account Number'}</label>
                                <input
                                    className="svm-input"
                                    type="text"
                                    placeholder={sendMethod === 'e-wallet' ? '09XX XXX XXXX' : 'Account number'}
                                    value={accountNumber}
                                    onChange={e => setAccountNumber(e.target.value)}
                                />
                            </div>

                            <div className="svm-field">
                                <label className="svm-label">Account Holder Name</label>
                                <input
                                    className="svm-input"
                                    type="text"
                                    placeholder="Full name as registered"
                                    value={accountName}
                                    onChange={e => setAccountName(e.target.value)}
                                />
                            </div>

                            <div className="svm-field">
                                <label className="svm-label">Reason for withdrawal</label>
                                <select
                                    className="svm-select"
                                    value={reasonOption}
                                    onChange={e => {
                                        setReasonOption(e.target.value);
                                        if (e.target.value !== 'Others') setCustomReason('');
                                    }}
                                >
                                    <option value="" disabled>Select a reason...</option>
                                    <option value="Emergency">Emergency</option>
                                    <option value="Medical Expenses">Medical Expenses</option>
                                    <option value="Tuition / Education">Tuition / Education</option>
                                    <option value="Home Repair">Home Repair</option>
                                    <option value="Personal Use">Personal Use</option>
                                    <option value="Others">Others (Please specify)</option>
                                </select>

                                {reasonOption === 'Others' && (
                                    <input
                                        className="svm-input"
                                        style={{ marginTop: '8px' }}
                                        type="text"
                                        placeholder="Please specify your reason..."
                                        value={customReason}
                                        onChange={e => setCustomReason(e.target.value)}
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>

                {!success && (
                    <div className="svm-modal-footer">
                        <button className="svm-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
                        <button
                            className="svm-btn-submit svm-btn-submit--withdraw"
                            onClick={handleSubmit}
                            disabled={loading || !numAmt || numAmt > balance}
                        >
                            {loading ? <span className="btn-spinner" /> : `Request withdrawal`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}



/* ─────────────────────────────────────────────────────────────
   ROOT EXPORT  — renders whichever modal is active
───────────────────────────────────────────────────────────── */
export default function SavingsModals({ modal, modalData, goals: propGoals, onClose, onEdit, onTransfer, onQuickDeposit, onOpenDeposit }) {
    const [allGoals, setAllGoals] = useState(propGoals || []);
    const [loadingGoals, setLoadingGoals] = useState(false);

    /* lock body scroll when a modal is open */
    useEffect(() => {
        if (modal) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [modal]);

    // Fetch all goals to bypass pagination limits when a modal opens
    useEffect(() => {
        if (modal && (modal === 'deposit' || modal === 'withdraw' || modal === 'transfer' || modal === 'quickDeposit')) {
            const fetchAllGoals = async () => {
                setLoadingGoals(true);
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`${API}/api/savings/goals?all=true`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.success) {
                        setAllGoals(data.goals);
                    }
                } catch (err) {
                    console.error('Failed to fetch all goals for modal', err);
                } finally {
                    setLoadingGoals(false);
                }
            };
            fetchAllGoals();
        } else {
            setAllGoals(propGoals || []);
        }
    }, [modal, propGoals]);

    if (!modal) return null;

    if (modal === 'deposit')
        return loadingGoals ? null : <DepositModal goals={allGoals} onClose={onClose} />;

    if (modal === 'newGoal')
        return <NewGoalModal onClose={onClose} />;

    if (modal === 'quickDeposit')
        return loadingGoals ? null : <QuickDepositModal goal={modalData} goals={allGoals} onClose={onClose} />;

    if (modal === 'editGoal')
        return <EditGoalModal goal={modalData} onClose={onClose} />;

    if (modal === 'goalInfo')
        return <GoalInfoModal goal={modalData} onClose={onClose} onEdit={onEdit} onTransfer={onTransfer} onQuickDeposit={onQuickDeposit} />;

    if (modal === 'transfer')
        return loadingGoals ? null : <TransferModal goal={modalData} goals={allGoals} onClose={onClose} />;

    if (modal === 'withdraw')
        return loadingGoals ? null : <WithdrawModal goals={allGoals} onClose={onClose} onOpenDeposit={onOpenDeposit} />;

    if (modal === 'transactionInfo')
        return <TransactionInfoModal transaction={modalData} onClose={onClose} />;

    return null;
}
