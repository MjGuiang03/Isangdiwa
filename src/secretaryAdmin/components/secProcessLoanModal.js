import { useState } from 'react';
import useSWR from 'swr';
import API from '../../utils/api';
import { Banknote, Check, Smartphone, Building2, X, AlertTriangle } from 'lucide-react';

const fetcherPublic = (url) => fetch(url).then(res => res.json());

export default function SecProcessLoanModal({ loan, onClose, onProcess }) {
    const [paymentMethod, setPaymentMethod] = useState(loan.disbursementMethod || 'e-wallet');
    const [reason, setReason] = useState('');
    const [processing, setProcessing] = useState(false);

    const { data: publicSettings } = useSWR(`${API}/api/settings/public`, fetcherPublic, { revalidateOnFocus: false });
    const isManualApproval = publicSettings?.paymentApprovalMethod === 'manual';

    const handleProcess = async () => {
        if (paymentMethod !== (loan.disbursementMethod || 'cash') && !reason.trim()) {
            alert('Please provide a reason for changing the payment method.');
            return;
        }
        setProcessing(true);
        try {
            await onProcess(paymentMethod, reason);
        } catch {
            alert('Failed to process disbursement.');
        } finally {
            setProcessing(false);
        }
    };

    const isDigital = paymentMethod === 'e-wallet' || paymentMethod === 'bank';
    const isOverride = paymentMethod !== (loan.disbursementMethod || 'cash');

    const methodOptions = [
        { key: 'cash',     label: 'Cash',          icon: <Banknote size={20} /> },
        { key: 'e-wallet', label: 'E-Wallet',       icon: <Smartphone size={20} /> },
        { key: 'bank',     label: 'Bank Transfer',  icon: <Building2 size={20} /> },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[520px] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-navy/10 dark:bg-blue-500/10 flex items-center justify-center">
                            <Banknote size={18} className="text-navy dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="font-inter font-bold text-[16px] text-slate-900 dark:text-white m-0 leading-tight">Process Loan Disbursement</h2>
                            <p >Loan ID: <span className="font-inter text-[12px] text-slate-500 dark:text-slate-400 m-0 font-semibold text-navy dark:text-blue-400">{loan.id}</span></p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border-none text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto max-h-[calc(90vh-130px)]">
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
                        <label className="font-inter text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Select Payment Method</label>
                        <div className="grid grid-cols-3 gap-2">
                            {methodOptions.map(({ key, label, icon }) => (
                                <button
                                    key={key}
                                    onClick={() => setPaymentMethod(key)}
                                    className={`flex flex-col items-center gap-2 py-3 px-2 rounded-xl border-2 font-inter text-[12px] font-semibold cursor-pointer transition-all ${
                                        paymentMethod === key
                                            ? 'border-navy bg-navy/5 text-navy dark:border-blue-400 dark:bg-blue-400/10 dark:text-blue-400'
                                            : 'border-slate-200 dark:border-white/10 bg-white dark:bg-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'
                                    }`}
                                >
                                    {icon}
                                    <span>{label}</span>
                                    {paymentMethod === key && <Check size={14} className="text-navy dark:text-blue-400" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Override reason */}
                    {isOverride && (
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-4 flex flex-col gap-2">
                            <label className="font-inter text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                                Reason for overriding user preference <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                placeholder="State why the preferred method cannot be used..."
                                className="w-full resize-none rounded-lg border border-red-200 dark:border-red-900/30 bg-white dark:bg-[#1E2130] px-3 py-2.5 font-inter text-[13px] text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-red-400 transition-colors"
                                rows={3}
                            />
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
                        onClick={onClose}
                        className="h-9 px-4 bg-white dark:bg-transparent border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg font-inter text-[13px] font-semibold cursor-pointer transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleProcess}
                        disabled={processing}
                        className="h-9 px-5 bg-navy hover:bg-blue-800 dark:bg-[#0D1F45] dark:hover:bg-blue-900 text-white border-none rounded-lg font-inter text-[13px] font-semibold cursor-pointer transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
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
