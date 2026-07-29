import { Banknote, X, User, FileText, CheckCircle2 } from 'lucide-react';

export default function SecApprovedLoanDetailsModal({ loan, onClose, onProcess }) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[600px] max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-navy/10 dark:bg-blue-500/10 flex items-center justify-center">
                            <FileText size={18} className="text-navy dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="font-inter font-bold text-[16px] text-slate-900 dark:text-white m-0 leading-tight">Approved Loan Details</h2>
                            <p className="font-inter text-[12px] text-slate-500 dark:text-slate-400 m-0">Loan ID: {loan.id}</p>
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
                        <div className="flex items-center gap-2 mb-3">
                            <User size={14} className="text-slate-400" />
                            <h3 className="font-inter font-semibold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-widest m-0">Officer Information</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3.5 flex flex-col gap-0.5">
                                <p className="font-inter text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Full Name</p>
                                <p className="font-inter text-[14px] font-medium text-slate-900 dark:text-white m-0">{loan.member}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3.5 flex flex-col gap-0.5">
                                <p className="font-inter text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Email</p>
                                <p className="font-inter text-[13px] font-medium text-slate-900 dark:text-white m-0 break-all">{loan.email}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3.5 flex flex-col gap-0.5">
                                <p className="font-inter text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Church ID</p>
                                <p className="font-inter text-[14px] font-medium text-slate-900 dark:text-white m-0">{loan.churchId}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3.5 flex flex-col gap-0.5">
                                <p className="font-inter text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Church Position</p>
                                <p className="font-inter text-[14px] font-medium text-slate-900 dark:text-white m-0">{loan.position}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3.5 flex flex-col gap-0.5">
                                <p className="font-inter text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Disbursement Method</p>
                                <p className="font-inter text-[14px] font-medium text-slate-900 dark:text-white m-0 capitalize">{loan.disbursementMethod || 'N/A'}</p>
                            </div>
                            {loan.disbursementAccount && (
                                <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3.5 flex flex-col gap-0.5">
                                    <p className="font-inter text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Account Details</p>
                                    <p className="font-inter text-[13px] font-medium text-slate-900 dark:text-white m-0">{loan.disbursementAccount}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-dashed border-slate-200 dark:border-white/5" />

                    {/* Section 2: Loan Request Details */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Banknote size={14} className="text-slate-400" />
                            <h3 className="font-inter font-semibold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-widest m-0">Loan Request Details</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-navy/5 dark:bg-blue-500/10 border border-navy/10 dark:border-blue-500/20 rounded-xl p-3.5 flex flex-col gap-0.5 col-span-2">
                                <p className="font-inter text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Loan Amount</p>
                                <p className="font-inter text-[22px] font-bold text-navy dark:text-blue-400 m-0">₱{(loan.amount || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3.5 flex flex-col gap-0.5">
                                <p className="font-inter text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Loan Type / Purpose</p>
                                <p className="font-inter text-[14px] font-medium text-slate-900 dark:text-white m-0">{loan.purpose}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3.5 flex flex-col gap-0.5">
                                <p className="font-inter text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Approved Date</p>
                                <p className="font-inter text-[14px] font-medium text-slate-900 dark:text-white m-0">{loan.approvedDate}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3.5 flex flex-col gap-0.5">
                                <p className="font-inter text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Status</p>
                                <span className="inline-flex items-center gap-1.5 mt-0.5 w-fit px-2.5 py-1 rounded-md font-inter font-semibold text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                    Awaiting Processing
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-dashed border-slate-200 dark:border-white/5" />

                    {/* Section 3: Member Stats */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 size={14} className="text-slate-400" />
                            <h3 className="font-inter font-semibold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-widest m-0">Member Standing</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl p-3.5 flex flex-col gap-0.5">
                                <p className="font-inter text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider m-0">Church Status</p>
                                <p className="font-inter text-[14px] font-bold text-emerald-700 dark:text-emerald-300 m-0">Active</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3.5 flex flex-col gap-0.5">
                                <p className="font-inter text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Loan History</p>
                                <p className="font-inter text-[20px] font-bold text-slate-900 dark:text-white m-0">{loan.loanHistory}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3.5 flex flex-col gap-0.5">
                                <p className="font-inter text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Total Donations</p>
                                <p className="font-inter text-[14px] font-bold text-slate-900 dark:text-white m-0">₱{(loan.totalDonations || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-white/5 shrink-0">
                    <button
                        onClick={onClose}
                        className="h-9 px-4 bg-white dark:bg-transparent border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg font-inter text-[13px] font-semibold cursor-pointer transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={onProcess}
                        className="h-9 px-5 bg-navy hover:bg-blue-800 dark:bg-[#0D1F45] dark:hover:bg-blue-900 text-white border-none rounded-lg font-inter text-[13px] font-semibold cursor-pointer transition-colors flex items-center gap-2"
                    >
                        <Banknote size={15} />
                        Process Payment
                    </button>
                </div>
            </div>
        </div>
    );
}
