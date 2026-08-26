import { Download, X, Receipt, CheckCircle } from 'lucide-react';

const fmt = (n) =>
  n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0 })}` : '₱0';

export default function SecLoanReceiptModal({ loan, onClose }) {
  if (!loan) return null;

  const now = new Date();
  const dateStr = loan.disbursementDate
    ? new Date(loan.disbursementDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

  const refNum = loan.referenceNumber || `REF${Math.random().toString(36).toUpperCase().substring(2, 12)}`;

  const methodLabel =
    loan.paymentMethod === 'e-wallet' ? 'E-Wallet'
    : loan.paymentMethod === 'bank' ? 'Bank Transfer'
    : 'Cash';

  const rows = [
    { label: 'Recipient',        value: loan.member || loan.memberName },
    { label: 'Loan ID',          value: loan.id || loan.loanId },
    { label: 'Payment Method',   value: methodLabel },
    { label: 'Date & Time',      value: `${dateStr} • ${timeStr}` },
    { label: 'E-Wallet Number',  value: loan.gcashNumber || 'N/A', hide: loan.paymentMethod === 'cash' },
  ].filter(r => !r.hide);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[380px] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient Header */}
        <div className="relative bg-gradient-to-br from-navy to-blue-700 dark:from-[#0D1F45] dark:to-blue-900 px-5 py-4 flex flex-col items-center text-center gap-1">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 border-none text-white/70 hover:text-white cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center mb-0.5">
            <Receipt size={20} className="text-white" />
          </div>
          <h2 className="font-inter font-bold text-[15px] text-white m-0">Disbursement Receipt</h2>
          <p className="font-inter text-[11px] text-white/60 m-0">IsangDiwa Official Transaction</p>
        </div>

        {/* Amount Hero */}
        <div className="flex flex-col items-center py-4 px-5 border-b border-slate-100 dark:border-white/5 gap-1">
          <p className="font-inter text-[10px] font-semibold text-slate-400 uppercase tracking-widest m-0">Amount Disbursed</p>
          <h1 className="font-inter text-[28px] font-bold text-slate-900 dark:text-white m-0 tracking-tight">{fmt(loan.amount)}</h1>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-inter text-[11px] font-semibold">
            <CheckCircle size={12} />
            Completed
          </span>
        </div>

        {/* Transaction Details */}
        <div className="px-5 py-3 flex flex-col">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-white/5 last:border-0">
              <span className="font-inter text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
              <span className="font-inter text-[12px] font-semibold text-slate-900 dark:text-white text-right max-w-[65%] truncate">{value}</span>
            </div>
          ))}

          {/* Reference number highlighted */}
          <div className="mt-2 bg-navy/5 dark:bg-blue-500/10 border border-navy/10 dark:border-blue-500/20 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="font-inter text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reference No.</span>
            <span className="font-inter text-[12px] font-bold text-navy dark:text-blue-400 tracking-wide">{refNum}</span>
          </div>
        </div>

        {/* Footer note */}
        <div className="px-5 pb-1">
          <p className="font-inter text-[10px] text-slate-400 dark:text-slate-500 text-center leading-normal m-0">
            The loan disbursement has been processed successfully. Funds will be credited shortly.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-100 dark:border-white/5">
          <button
            onClick={onClose}
            className="flex-1 h-8.5 bg-white dark:bg-transparent border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg font-inter text-[12px] font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
          <button
            className="flex-1 h-8.5 bg-navy hover:bg-blue-800 dark:bg-[#0D1F45] dark:hover:bg-blue-900 text-white border-none rounded-lg font-inter text-[12px] font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
          >
            <Download size={13} />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
