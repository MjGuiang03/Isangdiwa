import { Banknote, X, User, FileText, CheckCircle2 } from 'lucide-react';

export default function SecApprovedLoanDetailsModal({ loan, onClose, onProcess }) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[600px] max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200 font-inter"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-navy/10 dark:bg-blue-500/10 flex items-center justify-center">
                            <FileText size={20} className="text-navy dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-[16px] text-slate-900 dark:text-white m-0 leading-tight">Approved Loan Details</h2>
                            <p className="text-[12px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">Loan ID: {loan.id}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border-none text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-5">
                    {/* Section 1: Officer Information */}
                    <div>
                        <div className="flex items-center gap-2 mb-2.5">
                            <User size={14} className="text-slate-400" />
                            <h3 className="font-semibold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-widest m-0">Officer Information</h3>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-white/5">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Full Name</p>
                                    <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white m-0">{loan.member}</p>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Email</p>
                                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white m-0 break-all">{loan.email}</p>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Church ID</p>
                                    <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white m-0">{loan.churchId}</p>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Church Position</p>
                                    <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white m-0">{loan.position}</p>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Disbursement Method</p>
                                    <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white m-0 capitalize">{loan.disbursementMethod || 'N/A'}</p>
                                </div>
                                {loan.disbursementAccount && (
                                    <div className="flex flex-col gap-0.5">
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Account Details</p>
                                        <p className="text-[13px] font-semibold text-slate-900 dark:text-white m-0">{loan.disbursementAccount}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Loan Request Details */}
                    <div>
                        <div className="flex items-center gap-2 mb-2.5">
                            <Banknote size={14} className="text-slate-400" />
                            <h3 className="font-semibold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-widest m-0">Loan Request Details</h3>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-white/5 space-y-3.5">
                            <div className="p-3.5 bg-navy/5 dark:bg-blue-500/10 border border-navy/10 dark:border-blue-500/20 rounded-lg flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Loan Amount</p>
                                    <p className="text-[20px] font-bold text-navy dark:text-blue-400 m-0">₱{(loan.amount || 0).toLocaleString()}</p>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                    Awaiting Processing
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Loan Type / Purpose</p>
                                    <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white m-0">{loan.purpose}</p>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Approved Date</p>
                                    <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white m-0">{loan.approvedDate}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Member Standing */}
                    <div>
                        <div className="flex items-center gap-2 mb-2.5">
                            <CheckCircle2 size={14} className="text-slate-400" />
                            <h3 className="font-semibold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-widest m-0">Member Standing</h3>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-white/5">
                            <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Church Status</p>
                                    <p className="text-[13.5px] font-bold text-emerald-600 dark:text-emerald-400 m-0">Active</p>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Loan History</p>
                                    <p className="text-[13.5px] font-bold text-slate-900 dark:text-white m-0">{loan.loanHistory}</p>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider m-0">Total Donations</p>
                                    <p className="text-[13.5px] font-bold text-slate-900 dark:text-white m-0">₱{(loan.totalDonations || 0).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-white/5 shrink-0 bg-slate-50/50 dark:bg-black/20">
                    <button
                        onClick={onClose}
                        className="h-9 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={onProcess}
                        className="h-9 px-5 bg-navy hover:bg-blue-800 dark:bg-[#0D1F45] dark:hover:bg-blue-900 text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Banknote size={15} />
                        Process Payment
                    </button>
                </div>
            </div>
        </div>
    );
}
