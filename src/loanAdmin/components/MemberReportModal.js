import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X, Download, Loader2, FileText } from 'lucide-react';
import API from '../../utils/api';

/* ── Formatting helpers ── */
const peso = (n) =>
    `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '—');

const fmtMethod = (method, sub) => {
    if (!method) return 'Cash';
    const m = String(method).toLowerCase();
    if (m === 'gcash') return 'GCash';
    if (m === 'paymaya' || m === 'maya') return 'Maya';
    if (m === 'bank_transfer' || m === 'bank') return sub ? `Bank (${sub})` : 'Bank Transfer';
    return sub ? `${cap(method)} (${sub})` : cap(method);
};

const STATUS_COLORS = {
    paid: '#059669', confirmed: '#059669', approved: '#059669', completed: '#2563EB', active: '#059669',
    pending: '#D97706', next: '#2563EB', upcoming: '#64748B',
    overdue: '#DC2626', rejected: '#DC2626', cancelled: '#D97706',
};
const statusColor = (s) => STATUS_COLORS[String(s || '').toLowerCase()] || '#64748B';

/* ── Inline styles (kept inline so the PDF renders identically regardless of theme) ── */
const S = {
    sheet: { width: '190mm', background: '#ffffff', color: '#0F172A', fontFamily: 'Inter, Arial, sans-serif', fontSize: '11px', lineHeight: 1.45, padding: '8mm 8mm 6mm', boxSizing: 'border-box' },
    h2: { fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1E3A8A', margin: '18px 0 8px', paddingBottom: '4px', borderBottom: '1.5px solid #E2E8F0' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' },
    th: { textAlign: 'left', padding: '6px 8px', background: '#F1F5F9', color: '#475569', fontWeight: 700, fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0' },
    td: { padding: '6px 8px', borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' },
    label: { fontSize: '9px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 },
    value: { fontSize: '12px', fontWeight: 700, color: '#0F172A', margin: '2px 0 0' },
    empty: { padding: '10px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic', fontSize: '10.5px' },
};

const Badge = ({ status }) => (
    <span style={{ color: statusColor(status), fontWeight: 700, fontSize: '10px' }}>{cap(status)}</span>
);

export default function MemberReportModal({ email, onClose }) {
    const token = localStorage.getItem('adminToken');
    const reportRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);
    const [payments, setPayments] = useState([]);

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const headers = { Authorization: `Bearer ${token}` };
                const [profileRes, payRes] = await Promise.all([
                    fetch(`${API}/api/admin/loan-users/${encodeURIComponent(email)}/profile`, { headers }),
                    fetch(`${API}/api/admin/loan-payments?email=${encodeURIComponent(email)}&limit=200`, { headers }),
                ]);
                const profile = await profileRes.json();
                const pay = await payRes.json().catch(() => null);
                if (!alive) return;
                if (!profileRes.ok || profile?.success === false) throw new Error(profile?.message || 'Failed to load member data');
                setData(profile?.data || profile);
                setPayments(pay?.payments || profile?.recentLoanPayments || []);
            } catch (err) {
                if (alive) setError(err.message || 'Failed to load member data');
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [email, token]);

    // Close on Escape
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !exporting) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, exporting]);

    const user = data?.user || {};
    const goals = data?.savings?.goals || [];
    const activeLoans = data?.loans?.active || [];
    const historyLoans = data?.loans?.history || [];
    const allLoans = [...activeLoans, ...historyLoans];
    const savingsTx = data?.recentSavingsTransactions || [];

    const confirmedPayments = payments.filter(p => ['confirmed', 'approved', 'paid'].includes(String(p.status || '').toLowerCase()));
    const totalPaid = confirmedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const totalBorrowed = allLoans
        .filter(l => !['rejected', 'cancelled', 'pending'].includes(String(l.status || '').toLowerCase()))
        .reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const outstanding = activeLoans.reduce((s, l) => s + (Number(l.remainingBalance) || 0), 0);
    const hasOverdue = activeLoans.some(l => l.isLate || (l.schedule || []).some(s => s.status === 'overdue'));

    const generatedAt = new Date();
    const safeName = (user.fullName || email || 'Member').replace(/[^a-z0-9]+/gi, '_');

    const handleExport = async () => {
        if (!reportRef.current) return;
        setExporting(true);
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            const worker = html2pdf().set({
                margin: [8, 8, 14, 8],
                filename: `Member_Report_${safeName}_${generatedAt.toISOString().slice(0, 10)}_UNOFFICIAL.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, scrollY: 0, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.avoid-break'] },
            }).from(reportRef.current).toPdf();

            // Stamp every page with an "UNOFFICIAL" watermark + disclaimer footer
            await worker.get('pdf').then((pdf) => {
                const total = pdf.internal.getNumberOfPages();
                const pageW = pdf.internal.pageSize.getWidth();
                const pageH = pdf.internal.pageSize.getHeight();
                for (let i = 1; i <= total; i++) {
                    pdf.setPage(i);

                    // Diagonal watermark
                    pdf.saveGraphicsState();
                    if (pdf.GState) pdf.setGState(new pdf.GState({ opacity: 0.1 }));
                    pdf.setFont('helvetica', 'bold');
                    pdf.setTextColor(220, 38, 38);
                    pdf.setFontSize(64);
                    pdf.text('UNOFFICIAL', pageW / 2, pageH / 2 - 6, { align: 'center', angle: 35 });
                    pdf.setFontSize(26);
                    pdf.text('FOR REFERENCE ONLY', pageW / 2 + 8, pageH / 2 + 14, { align: 'center', angle: 35 });
                    pdf.restoreGraphicsState();

                    // Footer disclaimer + page number
                    pdf.setDrawColor(226, 232, 240);
                    pdf.line(8, pageH - 10, pageW - 8, pageH - 10);
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(7.5);
                    pdf.setTextColor(185, 28, 28);
                    pdf.text('UNOFFICIAL DOCUMENT', 8, pageH - 6);
                    const labelW = pdf.getTextWidth('UNOFFICIAL DOCUMENT');
                    pdf.setFont('helvetica', 'normal');
                    pdf.setTextColor(100, 116, 139);
                    pdf.text(' - For member viewing only. Not valid for any official, legal, or financial transaction.', 8 + labelW, pageH - 6);
                    pdf.text(`Page ${i} of ${total}`, pageW - 8, pageH - 6, { align: 'right' });
                }
            });
            await worker.save();
            toast.success('Member report exported');
        } catch (err) {
            console.error('Member report PDF export error:', err);
            toast.error('Failed to export PDF');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6" onClick={() => !exporting && onClose()}>
            <div className="bg-white dark:bg-[#1E2130] w-full max-w-4xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-white/10 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white font-inter m-0 truncate flex items-center gap-2">
                                Member Report
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">UNOFFICIAL</span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-inter m-0 truncate">{user.fullName || email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleExport}
                            disabled={loading || !!error || exporting}
                            className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white text-xs font-semibold font-inter border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            {exporting ? 'Exporting…' : 'Export PDF'}
                        </button>
                        <button onClick={onClose} disabled={exporting} className="w-9 h-9 flex items-center justify-center rounded-lg bg-transparent border-none text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body / Preview */}
                <div className="flex-1 overflow-auto bg-slate-100 dark:bg-[#161922] p-4 sm:p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <Loader2 size={26} className="animate-spin text-blue-500" />
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-inter m-0">Generating report…</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-2">
                            <p className="text-sm font-semibold text-rose-600 font-inter m-0">{error}</p>
                            <button onClick={onClose} className="text-xs text-blue-600 bg-transparent border-none cursor-pointer hover:underline">Close</button>
                        </div>
                    ) : (
                        <div className="mx-auto shadow-lg relative" style={{ width: '190mm', maxWidth: '100%' }}>
                            {/* Preview-only watermark (the PDF gets its own per-page watermark on export) */}
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
                                        "<svg xmlns='http://www.w3.org/2000/svg' width='420' height='300'><text x='50%' y='50%' fill='rgba(220,38,38,0.09)' font-family='Arial' font-weight='700' font-size='44' text-anchor='middle' transform='rotate(-35 210 150)'>UNOFFICIAL</text></svg>"
                                    )}")`,
                                    backgroundRepeat: 'repeat',
                                }}
                            />
                            <div ref={reportRef} style={S.sheet}>
                                {/* Letterhead */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #1E3A8A', paddingBottom: '10px' }}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1E3A8A' }}>IsangDiwa Portal</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748B' }}>Loan &amp; Savings Management</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Member Financial Report</p>
                                        <p style={{ margin: '3px 0 0' }}>
                                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', border: '1.5px solid #DC2626', color: '#DC2626', fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.08em' }}>
                                                UNOFFICIAL COPY
                                            </span>
                                        </p>
                                        <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#64748B' }}>Generated {generatedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    </div>
                                </div>

                                {/* Unofficial disclaimer banner */}
                                <div className="avoid-break" style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '6px', background: '#FEF2F2', border: '1px solid #FECACA', borderLeft: '4px solid #DC2626' }}>
                                    <p style={{ margin: 0, fontSize: '10.5px', fontWeight: 800, color: '#B91C1C', letterSpacing: '0.04em' }}>
                                        UNOFFICIAL DOCUMENT — FOR MEMBER VIEWING ONLY
                                    </p>
                                    <p style={{ margin: '2px 0 0', fontSize: '9.5px', color: '#7F1D1D', lineHeight: 1.4 }}>
                                        This report is provided solely so the member can review their own savings and loan records.
                                        It is <strong>not</strong> an official statement of account, certificate, or clearance and
                                        may not be used for any legal, banking, employment, or other official purpose.
                                        For official documents, please request a certified copy from the church office.
                                    </p>
                                </div>

                                {/* Member Information */}
                                <h2 style={S.h2}>Member Information</h2>
                                <table style={S.table}>
                                    <tbody>
                                        <tr>
                                            <td style={{ ...S.td, width: '22%', color: '#64748B' }}>Full Name</td>
                                            <td style={{ ...S.td, fontWeight: 700 }}>{user.fullName || '—'}</td>
                                            <td style={{ ...S.td, width: '18%', color: '#64748B' }}>Member ID</td>
                                            <td style={{ ...S.td, fontWeight: 600 }}>{user.memberId || '—'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ ...S.td, color: '#64748B' }}>Email</td>
                                            <td style={S.td}>{user.email || email}</td>
                                            <td style={{ ...S.td, color: '#64748B' }}>Phone</td>
                                            <td style={S.td}>{user.phone || user.phoneNumber || '—'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ ...S.td, color: '#64748B' }}>Branch</td>
                                            <td style={S.td}>{user.branch || '—'}</td>
                                            <td style={{ ...S.td, color: '#64748B' }}>Standing</td>
                                            <td style={{ ...S.td, fontWeight: 700, color: hasOverdue ? '#DC2626' : allLoans.length ? '#059669' : '#64748B' }}>
                                                {hasOverdue ? 'Delinquent' : allLoans.length ? 'Good Standing' : 'No Loans'}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Summary */}
                                <h2 style={S.h2}>Financial Summary</h2>
                                <div className="avoid-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                    {[
                                        { l: 'Total Savings', v: peso(data?.savings?.totalBalance), c: '#7C3AED' },
                                        { l: 'Total Borrowed', v: peso(totalBorrowed), c: '#0F172A' },
                                        { l: 'Total Repaid', v: peso(totalPaid), c: '#059669' },
                                        { l: 'Outstanding Balance', v: peso(outstanding), c: outstanding > 0 ? '#DC2626' : '#0F172A' },
                                    ].map(card => (
                                        <div key={card.l} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', background: '#F8FAFC' }}>
                                            <p style={S.label}>{card.l}</p>
                                            <p style={{ ...S.value, color: card.c }}>{card.v}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Active Loans */}
                                <h2 style={S.h2}>Active Loan{activeLoans.length === 1 ? '' : 's'} ({activeLoans.length})</h2>
                                {activeLoans.length === 0 ? (
                                    <div style={S.empty}>No active loans.</div>
                                ) : activeLoans.map((loan, idx) => {
                                    const schedule = loan.schedule || [];
                                    return (
                                        <div key={loan._id || idx} style={{ marginBottom: '12px' }}>
                                            <table className="avoid-break" style={{ ...S.table, marginBottom: '6px' }}>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ ...S.td, color: '#64748B', width: '18%' }}>Loan ID</td>
                                                        <td style={{ ...S.td, fontWeight: 700 }}>{loan.loanId || '—'}</td>
                                                        <td style={{ ...S.td, color: '#64748B', width: '18%' }}>Type</td>
                                                        <td style={S.td}>{loan.loanType || 'Personal'} Loan</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ ...S.td, color: '#64748B' }}>Principal</td>
                                                        <td style={{ ...S.td, fontWeight: 600 }}>{peso(loan.amount)}</td>
                                                        <td style={{ ...S.td, color: '#64748B' }}>Monthly Due</td>
                                                        <td style={{ ...S.td, fontWeight: 600 }}>{peso(loan.monthlyPayment)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ ...S.td, color: '#64748B' }}>Remaining</td>
                                                        <td style={{ ...S.td, fontWeight: 700, color: '#DC2626' }}>{peso(loan.remainingBalance)}</td>
                                                        <td style={{ ...S.td, color: '#64748B' }}>Progress</td>
                                                        <td style={S.td}>{loan.paidMonths || 0} of {loan.termMonths || loan.term || schedule.length} months paid</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ ...S.td, color: '#64748B' }}>Disbursed</td>
                                                        <td style={S.td}>{fmtDate(loan.disbursementDate || loan.approvedDate)}</td>
                                                        <td style={{ ...S.td, color: '#64748B' }}>Next Due</td>
                                                        <td style={S.td}>{fmtDate(loan.nextPaymentDate || loan.nextDueDate)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            {schedule.length > 0 && (
                                                <table style={S.table}>
                                                    <thead>
                                                        <tr>
                                                            <th style={S.th}>#</th>
                                                            <th style={S.th}>Due Date</th>
                                                            <th style={{ ...S.th, textAlign: 'right' }}>Amount</th>
                                                            <th style={{ ...S.th, textAlign: 'right' }}>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {schedule.map(s => (
                                                            <tr key={s.monthNumber}>
                                                                <td style={S.td}>{s.monthNumber}</td>
                                                                <td style={S.td}>{fmtDate(s.dueDate)}</td>
                                                                <td style={{ ...S.td, textAlign: 'right' }}>{peso(s.payment)}</td>
                                                                <td style={{ ...S.td, textAlign: 'right' }}><Badge status={s.status} /></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Loan History */}
                                <h2 style={S.h2}>Loan History ({historyLoans.length})</h2>
                                {historyLoans.length === 0 ? (
                                    <div style={S.empty}>No past loan records.</div>
                                ) : (
                                    <table style={S.table}>
                                        <thead>
                                            <tr>
                                                <th style={S.th}>Loan ID</th>
                                                <th style={S.th}>Type</th>
                                                <th style={{ ...S.th, textAlign: 'right' }}>Amount</th>
                                                <th style={S.th}>Term</th>
                                                <th style={S.th}>Applied</th>
                                                <th style={{ ...S.th, textAlign: 'right' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyLoans.map((l, i) => (
                                                <tr key={l._id || i}>
                                                    <td style={{ ...S.td, fontWeight: 600 }}>{l.loanId || '—'}</td>
                                                    <td style={S.td}>{l.loanType || 'Personal'}</td>
                                                    <td style={{ ...S.td, textAlign: 'right' }}>{peso(l.amount)}</td>
                                                    <td style={S.td}>{l.term || l.termMonths ? `${l.term || l.termMonths} mo` : '—'}</td>
                                                    <td style={S.td}>{fmtDate(l.appliedDate)}</td>
                                                    <td style={{ ...S.td, textAlign: 'right' }}><Badge status={l.status} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}

                                {/* Loan Payments */}
                                <h2 style={S.h2}>Loan Payment Records ({payments.length})</h2>
                                {payments.length === 0 ? (
                                    <div style={S.empty}>No loan payments recorded.</div>
                                ) : (
                                    <table style={S.table}>
                                        <thead>
                                            <tr>
                                                <th style={S.th}>Date</th>
                                                <th style={S.th}>Loan ID</th>
                                                <th style={S.th}>Method</th>
                                                <th style={S.th}>Reference</th>
                                                <th style={{ ...S.th, textAlign: 'right' }}>Amount</th>
                                                <th style={{ ...S.th, textAlign: 'right' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {payments.map((p, i) => (
                                                <tr key={p._id || i}>
                                                    <td style={S.td}>{fmtDate(p.submittedAt || p.confirmedAt || p.paymentDate || p.createdAt)}</td>
                                                    <td style={S.td}>{p.loanId || '—'}{p.monthNumber ? ` (M${p.monthNumber})` : ''}</td>
                                                    <td style={S.td}>{fmtMethod(p.paymentMethod, p.subMethod)}</td>
                                                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '9.5px' }}>{p.referenceNumber || '—'}</td>
                                                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{peso(p.amount)}</td>
                                                    <td style={{ ...S.td, textAlign: 'right' }}><Badge status={p.status} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}

                                {/* Savings Goals */}
                                <h2 style={S.h2}>Savings Goals ({goals.length})</h2>
                                {goals.length === 0 ? (
                                    <div style={S.empty}>No savings goals.</div>
                                ) : (
                                    <table style={S.table}>
                                        <thead>
                                            <tr>
                                                <th style={S.th}>Goal</th>
                                                <th style={{ ...S.th, textAlign: 'right' }}>Saved</th>
                                                <th style={{ ...S.th, textAlign: 'right' }}>Target</th>
                                                <th style={{ ...S.th, textAlign: 'right' }}>Progress</th>
                                                <th style={{ ...S.th, textAlign: 'right' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {goals.map((g, i) => {
                                                const pct = g.targetAmount > 0 ? Math.min(100, Math.round(((g.savedAmount || 0) / g.targetAmount) * 100)) : 0;
                                                return (
                                                    <tr key={g._id || i}>
                                                        <td style={{ ...S.td, fontWeight: 600 }}>{g.goalName || 'Savings Goal'}</td>
                                                        <td style={{ ...S.td, textAlign: 'right' }}>{peso(g.savedAmount)}</td>
                                                        <td style={{ ...S.td, textAlign: 'right' }}>{peso(g.targetAmount)}</td>
                                                        <td style={{ ...S.td, textAlign: 'right' }}>{pct}%</td>
                                                        <td style={{ ...S.td, textAlign: 'right' }}><Badge status={g.status || 'active'} /></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}

                                {/* Savings Transactions */}
                                {savingsTx.length > 0 && (
                                    <>
                                        <h2 style={S.h2}>Recent Savings Transactions</h2>
                                        <table style={S.table}>
                                            <thead>
                                                <tr>
                                                    <th style={S.th}>Date</th>
                                                    <th style={S.th}>Type</th>
                                                    <th style={S.th}>Goal</th>
                                                    <th style={{ ...S.th, textAlign: 'right' }}>Amount</th>
                                                    <th style={{ ...S.th, textAlign: 'right' }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {savingsTx.map((t, i) => (
                                                    <tr key={t._id || i}>
                                                        <td style={S.td}>{fmtDate(t.date)}</td>
                                                        <td style={S.td}>{cap(t.type)}</td>
                                                        <td style={S.td}>{t.goalName || '—'}</td>
                                                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{peso(t.amount)}</td>
                                                        <td style={{ ...S.td, textAlign: 'right' }}><Badge status={t.status || 'confirmed'} /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </>
                                )}

                                {/* Footer */}
                                <div className="avoid-break" style={{ marginTop: '28px', paddingTop: '10px', borderTop: '1px dashed #CBD5E1', textAlign: 'center' }}>
                                    <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#B91C1C', letterSpacing: '0.06em' }}>
                                        *** UNOFFICIAL DOCUMENT — NOT VALID WITHOUT OFFICIAL SEAL AND SIGNATURE ***
                                    </p>
                                    <p style={{ margin: '3px 0 0', fontSize: '9px', color: '#94A3B8' }}>
                                        System-generated by IsangDiwa Portal for member reference only. Figures are based on records at the time of generation and may change.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

