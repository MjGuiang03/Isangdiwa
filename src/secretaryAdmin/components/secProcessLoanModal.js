import { useState } from 'react';
import useSWR from 'swr';
import API from '../../utils/api';
import { Banknote, Check, Smartphone, Building2, X, AlertTriangle, CheckCircle2, Receipt } from 'lucide-react';

const fetcherPublic = (url) => fetch(url).then(res => res.json());

const PREDEFINED_REASONS = [
    'Member requested in-person cash payout',
    'Account details invalid or unverified',
    'E-Wallet / Bank service temporarily unavailable',
    'Member requested change of payment channel',
    'Office policy requirement',
    'Other (specify below)'
];

export default function SecProcessLoanModal({ loan, onClose, onProcess, onShowReceipt }) {
    const [paymentMethod, setPaymentMethod] = useState(loan.disbursementMethod || 'e-wallet');
    const [selectedReasonOption, setSelectedReasonOption] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successData, setSuccessData] = useState(null);

    const { data: publicSettings } = useSWR(`${API}/api/settings/public`, fetcherPublic, { revalidateOnFocus: false });
    const isManualApproval = publicSettings?.paymentApprovalMethod === 'manual';

    const isDigital = paymentMethod === 'e-wallet' || paymentMethod === 'bank';
    const isOverride = paymentMethod !== (loan.disbursementMethod || 'cash');

    const handleProcess = async () => {
        setErrorMsg('');
        const finalReason = selectedReasonOption === 'Other (specify below)' 
            ? customReason.trim() 
            : selectedReasonOption;

        if (isOverride && !finalReason) {
            setErrorMsg('Please select or specify a reason for changing the payment method.');
            return;
        }
        setProcessing(true);
        try {
            const result = await onProcess(paymentMethod, finalReason);
            if (result && result.success) {
                setSuccessData({
                    referenceNumber: result.referenceNumber,
                    method: paymentMethod,
                    amount: loan.amount,
                    member: loan.member
                });
            }
        } catch (err) {
            setErrorMsg(err.message || 'Failed to process disbursement. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const methodOptions = [
        { key: 'cash',     label: 'Cash',          icon: <Banknote size={20} /> },
        { key: 'e-wallet', label: 'E-Wallet',       icon: <Smartphone size={20} /> },
        { key: 'bank',     label: 'Bank Transfer',  icon: <Building2 size={20} /> },
    ];

    if (successData) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={onClose}>
                <div
                    className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[440px] flex flex-col items-center shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden text-center p-6 animate-in zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Success Icon */}
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 border border-emerald-200/60 dark:border-emerald-500/20 shadow-sm">
                        <CheckCircle2 size={36} strokeWidth={2.5} />
                    </div>

                    <h2 className="font-inter font-bold text-[20px] text-slate-900 dark:text-white m-0 leading-tight">
                        Disbursement Successful!
                    </h2>
                    <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1.5 mb-5 max-w-[340px] leading-relaxed">
                        The loan disbursement of <strong className="text-slate-800 dark:text-white">₱{loan.amount.toLocaleString()}</strong> for <strong className="text-slate-800 dark:text-white">{loan.member}</strong> has been successfully processed.
                    </p>

                    {/* Transaction Details Box */}
                    <div className="w-full bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-white/5 flex flex-col gap-2.5 mb-6 text-left">
                        <div className="flex items-center justify-between text-[12.5px]">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Loan ID</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-white">{loan.id}</span>
                        </div>
                        <div className="flex items-center justify-between text-[12.5px]">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Payment Method</span>
                            <span className="font-semibold text-slate-800 dark:text-white capitalize">
                                {paymentMethod === 'e-wallet' ? 'E-Wallet' : paymentMethod === 'bank' ? 'Bank Transfer' : 'Cash'}
                            </span>
                        </div>
                        {successData.referenceNumber && (
                            <div className="flex items-center justify-between text-[12.5px] pt-2 border-t border-slate-200/60 dark:border-white/5">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Reference No.</span>
                                <span className="font-mono font-bold text-navy dark:text-blue-400">{successData.referenceNumber}</span>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 w-full">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-10 bg-white dark:bg-transparent border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-inter text-[13px] font-semibold cursor-pointer transition-colors"
                        >
                            Done
                        </button>
                        {onShowReceipt && (
                            <button
                                type="button"
                                onClick={onShowReceipt}
                                className="flex-1 h-10 bg-navy hover:bg-blue-800 dark:bg-[#0D1F45] dark:hover:bg-blue-900 text-white border-none rounded-xl font-inter text-[13px] font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Receipt size={15} />
                                View Receipt
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[520px] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-navy/10 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Banknote size={20} className="text-navy dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="font-inter font-bold text-[16px] text-slate-900 dark:text-white m-0 leading-tight">Process Loan Disbursement</h2>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="font-inter text-[12px] font-medium text-slate-500 dark:text-slate-400">Loan ID:</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-blue-500/10 text-navy dark:text-blue-400 font-mono text-[11.5px] font-bold border border-slate-200/80 dark:border-blue-500/20">
                                    {loan.id}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border-none text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto max-h-[calc(90vh-130px)]">
                    {/* Error Alert Banner inside modal */}
                    {errorMsg && (
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 font-inter text-[12.5px] animate-in fade-in slide-in-from-top-1 duration-200">
                            <AlertTriangle size={16} className="shrink-0 text-red-500" />
                            <span className="flex-1 font-medium">{errorMsg}</span>
                            <button 
                                type="button" 
                                onClick={() => setErrorMsg('')} 
                                className="text-red-400 hover:text-red-600 dark:hover:text-red-200 bg-transparent border-none cursor-pointer p-0.5"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {/* Info Single Container */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-white/5 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col gap-0.5">
                                <p className="font-inter text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Member</p>
                                <p className="font-inter text-[13px] font-semibold text-slate-900 dark:text-white m-0 truncate">{loan.member}</p>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <p className="font-inter text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Amount</p>
                                <p className="font-inter text-[15px] font-bold text-navy dark:text-blue-400 m-0">₱{loan.amount.toLocaleString()}</p>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <p className="font-inter text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">User Preference</p>
                                <p className="font-inter text-[13px] font-semibold text-blue-600 dark:text-blue-400 m-0 capitalize">{loan.disbursementMethod || 'N/A'}</p>
                            </div>
                        </div>

                        {loan.disbursementAccount && (
                            <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center gap-2">
                                <span className="font-inter text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Account Details:</span>
                                <span className="font-inter text-[12.5px] font-semibold text-slate-800 dark:text-white">{loan.disbursementAccount}</span>
                            </div>
                        )}
                    </div>

                    {/* Payment Method Selection */}
                    <div>
                        <label className="font-inter text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2.5 block">Select Payment Method</label>
                        <div className="grid grid-cols-3 gap-3">
                            {methodOptions.map(({ key, label, icon }) => {
                                const isSelected = paymentMethod === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                            setPaymentMethod(key);
                                            setErrorMsg('');
                                        }}
                                        className={`relative flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all duration-200 cursor-pointer select-none text-center ${
                                            isSelected
                                                ? 'border-navy bg-navy/[0.04] dark:border-blue-400 dark:bg-blue-500/10 text-navy dark:text-blue-400 shadow-sm translate-y-[-1px]'
                                                : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50/80 dark:hover:bg-slate-800/70'
                                        }`}
                                    >
                                        {isSelected && (
                                            <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-navy dark:bg-blue-400 text-white dark:text-slate-950 flex items-center justify-center shadow-xs">
                                                <Check size={10} strokeWidth={3} />
                                            </div>
                                        )}
                                        
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-all ${
                                            isSelected 
                                                ? 'bg-navy text-white dark:bg-blue-400 dark:text-slate-950 shadow-xs' 
                                                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400'
                                        }`}>
                                            {icon}
                                        </div>
                                        
                                        <span className={`font-inter text-[12.5px] font-semibold leading-tight ${
                                            isSelected ? 'text-navy dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
                                        }`}>
                                            {label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Override reason dropdown */}
                    {isOverride && (
                        <div className="bg-red-50/60 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-4 flex flex-col gap-2.5">
                            <label className="font-inter text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                                Reason for overriding user preference <span className="text-red-500">*</span>
                            </label>
                            
                            <select
                                value={selectedReasonOption}
                                onChange={e => {
                                    setSelectedReasonOption(e.target.value);
                                    if (errorMsg) setErrorMsg('');
                                }}
                                className="w-full rounded-lg border border-red-200 dark:border-red-900/30 bg-white dark:bg-[#1E2130] px-3 py-2 font-inter text-[13px] text-slate-800 dark:text-white outline-none focus:border-red-400 transition-colors cursor-pointer"
                            >
                                <option value="" disabled>-- Select a reason --</option>
                                {PREDEFINED_REASONS.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>

                            {selectedReasonOption === 'Other (specify below)' && (
                                <textarea
                                    value={customReason}
                                    onChange={e => {
                                        setCustomReason(e.target.value);
                                        if (errorMsg) setErrorMsg('');
                                    }}
                                    placeholder="State specific reason for overriding preference..."
                                    className="w-full resize-none rounded-lg border border-red-200 dark:border-red-900/30 bg-white dark:bg-[#1E2130] px-3 py-2 font-inter text-[13px] text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-red-400 transition-colors"
                                    rows={2}
                                />
                            )}
                        </div>
                    )}

                    {/* Notice */}
                    <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${
                        isDigital
                            ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30 text-amber-700 dark:text-amber-400'
                    }`}>
                        {isDigital
                            ? <Smartphone size={16} className="shrink-0 mt-0.5" />
                            : <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        }
                        <p className="font-inter text-[12px] m-0 leading-relaxed">
                            {isDigital ? (
                                isManualApproval ? (
                                    <>The amount of <strong>₱{loan.amount.toLocaleString()}</strong> will be transferred directly to <strong>{loan.disbursementAccount || "the member's account"}</strong> (Manual Approval Mode).</>
                                ) : (
                                    <>The amount of <strong>₱{loan.amount.toLocaleString()}</strong> will be processed via <strong>Payment Gateway</strong> to <strong>{loan.disbursementAccount || "the member's account"}</strong>.</>
                                )
                            ) : (
                                <>Cash disbursement of <strong>₱{loan.amount.toLocaleString()}</strong> — the member must pick up at the office.</>
                            )}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-white/5 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 px-4 bg-white dark:bg-transparent border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg font-inter text-[13px] font-semibold cursor-pointer transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleProcess}
                        disabled={processing}
                        className="h-9 px-5 bg-navy hover:bg-blue-800 dark:bg-[#0D1F45] dark:hover:bg-blue-900 text-white border-none rounded-lg font-inter text-[13px] font-semibold cursor-pointer transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
                    >
                        <Check size={15} />
                        {processing 
                            ? 'Processing…' 
                            : isDigital 
                                ? (isManualApproval ? 'Confirm Direct Transfer' : 'Process via Payment Gateway') 
                                : 'Confirm Cash Disbursement'}
                    </button>
                </div>
            </div>
        </div>
    );
}

