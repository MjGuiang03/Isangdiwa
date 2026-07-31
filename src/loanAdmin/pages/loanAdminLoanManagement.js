import { useState, useEffect, useMemo, Fragment } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import LoanAdminSidebar from './loanAdminSidebar';
import PageHeader from '../components/PageHeader';
import DSSPanel from '../components/DSSPanel';

import useDebounce from '../../hooks/useDebounce';


import API from '../../utils/api';
import Pagination from '../../components/Pagination';
import { CheckCircle, Circle, Search, X, XCircle, ShieldCheck, AlertTriangle, Loader2, AlertCircle, Edit3, Send } from 'lucide-react'; 
import { performOCRScan } from '../../utils/ocrProcessor';


/* ── Loan-type config (mirrors user-side) ── */
const LOAN_TYPES = [
    { key: 'personal', name: 'Personal Loan', multiplier: 2, minTerm: 3, maxTerm: 12, rate: 0.02, rateLabel: '2% / mo', color: 'blue' },
    { key: 'emergency', name: 'Emergency Loan', multiplier: 1.5, minTerm: 1, maxTerm: 6, rate: 0.015, rateLabel: '1.5% / mo', color: 'amber' },
    { key: 'short-term', name: 'Short-Term Loan', multiplier: 1, minTerm: 1, maxTerm: 3, rate: 0.01, rateLabel: '1% / mo', color: 'teal' },
];

const fmt = (n) =>
    n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₱0.00';

const fmtDate = (d) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
};

/* ── Resolve status helpers ── */
function resolveStatusClass(status) {
    if (!status) return 'pending';
    const s = status.toLowerCase();
    if (s === 'pending') return 'pending';
    if (s === 'awaiting_member_approval') return 'awaiting';
    if (s === 'completed') return 'completed';
    if (s === 'active' || s === 'approved') return 'approved';
    if (s === 'rejected') return 'rejected';
    return 'pending';
}

function resolveStatusLabel(status) {
    if (!status) return 'Pending';
    const s = status.toLowerCase();
    if (s === 'pending') return 'Pending';
    if (s === 'awaiting_member_approval') return 'Awaiting Member';
    if (s === 'completed') return 'Completed';
    if (s === 'active' || s === 'approved') return 'Approved';
    if (s === 'rejected') return 'Rejected';
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function resolveStatusDesc(status) {
    if (!status) return 'Awaiting admin review';
    const s = status.toLowerCase();
    if (s === 'pending') return 'Awaiting admin review';
    if (s === 'awaiting_member_approval') return 'Modified terms sent to member';
    if (s === 'completed') return 'Loan has been fully repaid';
    if (s === 'active' || s === 'approved') return 'Loan has been approved';
    if (s === 'rejected') return 'Loan application rejected';
    return '';
}

const handleDocClick = (dataUrl, setViewingImage) => {
    if (!dataUrl) return;
    if (dataUrl.startsWith('data:application/pdf')) {
        const win = window.open();
        win.document.write(`<iframe src="${dataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    } else {
        setViewingImage(dataUrl);
    }
};

const renderDocPreview = (dataUrl) => {
    if (!dataUrl) return <span style={{ fontSize: '10px' }}>No document</span>;
    if (dataUrl.startsWith('data:application/pdf')) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#1E3A8A' }}>
                <span style={{ fontSize: '24px' }}>📄</span>
                <span style={{ fontSize: '10px', marginTop: '4px', fontWeight: 'bold' }}>PDF Document</span>
            </div>
        );
    }
    return <img src={dataUrl} alt="Document preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />;
};

export default function LoanAdminLoanManagement() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 400);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [interestFilter, setInterestFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [activeView, setActiveView] = useState('all');
    const [actionLoading, setActionLoading] = useState(null);
    const [page, setPage] = useState(1);
    const LIMIT = 10;

    /* ── Completed History expandable row state ── */
    const [expandedLoanId, setExpandedLoanId] = useState(null);
    const [expandedPayments, setExpandedPayments] = useState([]);
    const [expandedLoading, setExpandedLoading] = useState(false);

    /* ── Details modal extra state ── */
    const [memberSavings, setMemberSavings] = useState(0);
    const [approvedAmount, setApprovedAmount] = useState('');
    const [repaymentTerm, setRepaymentTerm] = useState('');
    const [viewingImage, setViewingImage] = useState(null);

    /* ── DSS Analysis state ── */
    const [dssAnalysis, setDssAnalysis] = useState(null);
    const [dssLoading, setDssLoading] = useState(false);

    /* ── OCR State ── */
    const [ocrResults, setOcrResults] = useState(null);
    const [isOcrLoading, setIsOcrLoading] = useState(false);

    const token = localStorage.getItem('adminToken');

    const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => {
        if (res.status === 401 || res.status === 403) { navigate('/'); return { success: false }; }
        return res.json();
    });

    const queryParams = useMemo(() => {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('limit', LIMIT);
        if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
        if (activeView === 'completed') {
            params.set('status', 'completed');
        } else if (statusFilter !== 'all') {
            params.set('status', statusFilter);
        } else {
            params.set('status', 'non_completed');
        }
        return params.toString();
    }, [page, debouncedSearch, statusFilter, activeView]);

    const { data: loansData, isValidating: loadingLoans, mutate: fetchLoans } = useSWR(
        token ? `${API}/api/admin/loans?${queryParams}` : null,
        fetcherSingle,
        { 
            revalidateOnFocus: false, 
            revalidateIfStale: true,
            dedupingInterval: 30000,
            keepPreviousData: true
        }
    );

    const loans = useMemo(() => loansData?.loans || [], [loansData]);
    const totalCount = useMemo(() => loansData?.totalCount || 0, [loansData]);
    const totalPages = useMemo(() => loansData?.totalPages || Math.ceil(totalCount / LIMIT) || 1, [loansData, totalCount]);

    const stats = useMemo(() => ({
        pending: loansData?.stats?.pending || 0,
        approved: loansData?.stats?.approved || 0,
        active: loansData?.stats?.active || 0,
        completed: loansData?.stats?.completed || 0,
        rejected: loansData?.stats?.rejected || 0,
    }), [loansData]);

    const loading = loadingLoans;

    useEffect(() => {
        if (loansData && loansData.success === false && loansData.message) {
            toast.error(loansData.message);
        }
    }, [loansData]);

    const { data: allLoansData } = useSWR(
        token ? `${API}/api/admin/loans?limit=10000` : null,
        fetcherSingle,
        { 
            revalidateOnFocus: false,
            dedupingInterval: 30000,
            keepPreviousData: true
        }
    );

    const allLoansStats = useMemo(() => allLoansData?.loans || [], [allLoansData]);

    const totalInterestFiltered = useMemo(() => {
        return allLoansStats.filter(l => {
            if (l.status === 'rejected' || l.status === 'pending') return false;
            const lType = (l.loanType || '').toLowerCase();
            
            let mult = '2x';
            if (lType.includes('emergency')) mult = '1.5x';
            if (lType.includes('short')) mult = '1x';
            if (l.multiplier) mult = `${l.multiplier}x`;

            if (interestFilter === '2x' && mult !== '2x') return false;
            if (interestFilter === '1.5x' && mult !== '1.5x') return false;
            if (interestFilter === '1x' && mult !== '1x') return false;
            return true;
        }).reduce((sum, l) => {
            const totalRepay = Number(l.totalRepayment || (l.monthlyPayment * (l.termMonths || 12))) || 0;
            const principal = Number(l.amount) || 0;
            const interest = l.totalInterest != null && l.totalInterest > 0 ? Number(l.totalInterest) : (totalRepay - principal);
            return sum + (interest > 0 ? interest : 0);
        }, 0);
    }, [allLoansStats, interestFilter]);

    useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

    /* ── Approve ── */
    const handleApprove = (loan) => {
        setSelectedLoan(loan);
        setShowApproveModal(true);
    };

    const confirmApprove = async () => {
        if (!selectedLoan) return;
        setActionLoading(selectedLoan._id);

        const amtDiff = Number(approvedAmount) !== Number(selectedLoan.amount);
        const termDiff = Number(repaymentTerm) !== Number(selectedLoan.termMonths);
        const termsModified = amtDiff || termDiff;

        try {
            const token = localStorage.getItem('adminToken');

            if (termsModified && !selectedLoan.memberApprovedTerms) {
                const res = await fetch(`${API}/api/admin/loans/${selectedLoan._id}/propose-terms`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        approvedAmount: Number(approvedAmount),
                        repaymentTerm: Number(repaymentTerm),
                        monthlyPayment: calc?.monthly || 0,
                        totalInterest: calc?.totalInterest || 0,
                        totalRepayment: calc?.totalRepayment || 0,
                    }),
                });
                const data = await res.json();
                if (!res.ok) { toast.error(data.message || 'Failed to propose terms'); return; }
                toast.success('Modified terms sent to member for approval');
            } else {
                const res = await fetch(`${API}/api/admin/loans/${selectedLoan._id}/approve`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) { toast.error(data.message || 'Failed to approve'); return; }
                toast.success(`Loan ${selectedLoan.loanId} approved`);
            }

            setShowApproveModal(false);
            setShowDetailsModal(false);
            setSelectedLoan(null);
            fetchLoans();
        } catch {
            toast.error('Network error. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    /* ── Reject ── */
    const handleReject = (loan) => {
        setSelectedLoan(loan);
        setShowRejectModal(true);
    };

    const confirmReject = async () => {
        if (!selectedLoan) return;
        setActionLoading(selectedLoan._id);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`${API}/api/admin/loans/${selectedLoan._id}/reject`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ rejectionReason: rejectReason }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message || 'Failed to reject'); return; }
            toast.success(`Loan ${selectedLoan.loanId} rejected`);
            setShowRejectModal(false);
            setShowDetailsModal(false);
            setSelectedLoan(null);
            setRejectReason('');
            fetchLoans();
        } catch {
            toast.error('Network error. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const fetchDSSAnalysis = async (loanArg, forceRefresh = false) => {
        setDssLoading(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`${API}/api/admin/loans/${loanArg._id}/dss-analysis${forceRefresh ? '?refresh=true' : ''}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) setDssAnalysis(data.analysis);
        } catch (err) {
            console.error('DSS Analysis Error:', err);
        } finally {
            setDssLoading(false);
            if (!forceRefresh) {
                setOcrResults(null); // Reset OCR for new loan
                
                // Automatically trigger OCR scan for pending loans
                if (loanArg.status === 'pending') {
                    handleVerifyDocuments(loanArg);
                }
            }
        }
    };

    /* ── View Details ── */
    const handleViewDetails = async (loan) => {
        // Optimistically open modal with basic data
        setSelectedLoan(loan);
        setApprovedAmount(String(loan.amount || ''));
        setRepaymentTerm(String(loan.termMonths || ''));
        setShowDetailsModal(true);

        let fullLoan = loan;
        try {
            const token = localStorage.getItem('adminToken');
            
            // 1. Fetch full loan details (includes base64 images omitted in list view)
            const detailRes = await fetch(`${API}/api/admin/loans/${loan._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const detailData = await detailRes.json();
            if (detailData.success && detailData.loan) {
                fullLoan = detailData.loan;
                setSelectedLoan(fullLoan);
            }

            // 2. Fetch member savings
            const res = await fetch(`${API}/api/admin/member-savings?email=${encodeURIComponent(loan.email)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) setMemberSavings(data.totalSavings || 0);
        } catch { /* silent */ }

        /* ── Fetch DSS Analysis ── */
        fetchDSSAnalysis(fullLoan);
    };

    /* ── Document Verification (OCR) ── */
    const handleVerifyDocuments = async (loanArg) => {
        const loan = loanArg || selectedLoan;
        if (!loan) return;
        if (!loan.idData && !loan.selfieData) return;

        setIsOcrLoading(true);
        const messages = [];
        let matchFound = false;

        try {
            // Process Government ID primarily for name
            if (loan.idData) {
                const result = await performOCRScan(loan.idData, loan.memberName);
                if (result.isMatch) {
                    matchFound = true;
                    messages.push(`Valid ID: Name match confirmed (${loan.memberName})`);
                } else {
                    messages.push(`Valid ID: Mismatch or low confidence scan. Manual check required.`);
                }
            }

            // Optional: Process Selfie if ID Scan failed to find name
            if (!matchFound && loan.selfieData) {
                const result = await performOCRScan(loan.selfieData, loan.memberName);
                if (result.isMatch) {
                    matchFound = true;
                    messages.push(`Selfie w/ ID: Name match confirmed (${loan.memberName})`);
                }
            }

            setOcrResults({ matchFound, messages });
            if (matchFound) {
                toast.success('Documents verified successfully');
            } else {
                toast.error('Potential document mismatch detected');
            }
        } catch (err) {
            toast.error('Failed to process documents');
        } finally {
            setIsOcrLoading(false);
        }
    };

    /* ── Derived loan-type info ── */
    const selectedType = useMemo(() => {
        return selectedLoan
            ? LOAN_TYPES.find(t => t.key === selectedLoan.loanType) || LOAN_TYPES[0]
            : null;
    }, [selectedLoan]);

    const maxLoanable = useMemo(() => {
        return selectedType ? Math.max(0, memberSavings * selectedType.multiplier) : 0;
    }, [selectedType, memberSavings]);

    /* ── Live calculation ── */
    const calc = useMemo(() => {
        const principal = Number(approvedAmount) || 0;
        const months = Number(repaymentTerm) || 0;
        if (!selectedType || principal <= 0 || months <= 0) return null;
        const totalInterest = principal * selectedType.rate * months;
        const totalRepayment = principal + totalInterest;
        const monthly = totalRepayment / months;
        return { principal, totalInterest, totalRepayment, monthly, months };
    }, [approvedAmount, repaymentTerm, selectedType]);

    /* ── Term options ── */
    const termOptions = useMemo(() => {
        return selectedType
            ? Array.from({ length: selectedType.maxTerm - selectedType.minTerm + 1 }, (_, i) => selectedType.minTerm + i)
            : [];
    }, [selectedType]);

    const filteredLoans = loans;

    const counts = stats;

    /* ── Status class helpers for the details modal ── */
    const detailStatusClass = useMemo(() => {
        return selectedLoan ? resolveStatusClass(selectedLoan.status) : 'pending';
    }, [selectedLoan]);

    const detailStatusLabel = useMemo(() => {
        return selectedLoan ? resolveStatusLabel(selectedLoan.status) : '';
    }, [selectedLoan]);

    const detailStatusDesc = useMemo(() => {
        return selectedLoan ? resolveStatusDesc(selectedLoan.status) : '';
    }, [selectedLoan]);

    /* ── Loan pill color helpers ── */
    const pillClass = useMemo(() => {
        const pillColorKey = selectedType?.color || 'blue';
        const pillColorMap = { blue: '', emergency: 'emergency', teal: 'short-term' };
        return pillColorMap[pillColorKey] || '';
    }, [selectedType]);

    if (!loansData && loadingLoans) {
        return (
            <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
                <LoanAdminSidebar />
                <div className="p-6 pb-16 flex-1 overflow-y-auto w-full animate-pulse flex flex-col gap-6">
                    {/* Header Skeleton */}
                    <div className="flex flex-col gap-2">
                        <div className="h-8 w-56 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
                        <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
                    </div>

                    {/* Stat Cards Skeleton */}
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden mb-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 lg:divide-x divide-slate-200 dark:divide-white/10">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="p-4 min-h-[90px] flex flex-col justify-between">
                                    <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                                    <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700/80 rounded mt-2"></div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Filter toolbar & Table Skeleton */}
                    <div className="w-full bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm p-4 flex flex-col gap-4">
                        <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
            <LoanAdminSidebar />

            <div className="p-6 pb-16 flex-1 overflow-y-auto w-full">
                {/* Header */}
                <PageHeader 
                    title="Loan Management" 
                    subtitle="Review, approve, and manage member loan applications." 
                />

                {/* Status Cards — Unified Metric Bar */}
                <div className="bg-white dark:bg-[#1E2130] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden mb-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-white/10">
                        <div className={`group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer flex flex-col justify-between min-h-[90px] ${statusFilter === 'pending' ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''}`} onClick={() => { setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending'); setActiveView('all'); setPage(1); }}>
                            <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">Pending Review</span>
                            <p className="font-inter font-extrabold text-2xl text-amber-500 dark:text-amber-400 m-0 mt-2">{counts.pending}</p>
                        </div>
                        <div className={`group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer flex flex-col justify-between min-h-[90px] ${statusFilter === 'approved' ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''}`} onClick={() => { setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved'); setActiveView('all'); setPage(1); }}>
                            <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">Approved</span>
                            <p className="font-inter font-extrabold text-2xl text-blue-500 dark:text-blue-400 m-0 mt-2">{counts.approved}</p>
                        </div>
                        <div className={`group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer flex flex-col justify-between min-h-[90px] ${statusFilter === 'active' ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''}`} onClick={() => { setStatusFilter(statusFilter === 'active' ? 'all' : 'active'); setActiveView('all'); setPage(1); }}>
                            <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">On Going</span>
                            <p className="font-inter font-extrabold text-2xl text-emerald-500 dark:text-emerald-400 m-0 mt-2">{counts.active}</p>
                        </div>
                        <div className={`group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer flex flex-col justify-between min-h-[90px] ${statusFilter === 'completed' ? 'bg-purple-500/5 dark:bg-purple-500/10' : ''}`} onClick={() => { setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed'); setActiveView(statusFilter === 'completed' ? 'all' : 'completed'); setPage(1); }}>
                            <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">Completed</span>
                            <p className="font-inter font-extrabold text-2xl text-purple-500 dark:text-purple-400 m-0 mt-2">{counts.completed}</p>
                        </div>
                        <div className={`group relative p-4 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer flex flex-col justify-between min-h-[90px] ${statusFilter === 'rejected' ? 'bg-rose-500/5 dark:bg-rose-500/10' : ''}`} onClick={() => { setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected'); setActiveView('all'); setPage(1); }}>
                            <span className="font-inter font-bold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">Rejected</span>
                            <p className="font-inter font-extrabold text-2xl text-rose-500 dark:text-rose-400 m-0 mt-2">{counts.rejected}</p>
                        </div>
                    </div>
                </div>

                {/* Control Toolbar: Tabs + Search */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 mb-4 pb-3">
                    <div className="flex flex-wrap items-center gap-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <button
                            onClick={() => { setActiveView('all'); setStatusFilter('all'); setPage(1); }}
                            className={`px-3.5 py-2 text-[13px] font-semibold font-inter transition-colors border-b-2 -mb-[13px] whitespace-nowrap ${statusFilter === 'all' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            All Loans
                        </button>
                        <button
                            onClick={() => { setActiveView('all'); setStatusFilter('pending'); setPage(1); }}
                            className={`px-3.5 py-2 text-[13px] font-semibold font-inter transition-colors border-b-2 -mb-[13px] whitespace-nowrap ${statusFilter === 'pending' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            Pending Review
                        </button>
                        <button
                            onClick={() => { setActiveView('all'); setStatusFilter('approved'); setPage(1); }}
                            className={`px-3.5 py-2 text-[13px] font-semibold font-inter transition-colors border-b-2 -mb-[13px] whitespace-nowrap ${statusFilter === 'approved' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            Approved
                        </button>
                        <button
                            onClick={() => { setActiveView('all'); setStatusFilter('active'); setPage(1); }}
                            className={`px-3.5 py-2 text-[13px] font-semibold font-inter transition-colors border-b-2 -mb-[13px] whitespace-nowrap ${statusFilter === 'active' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            On Going
                        </button>
                        <button
                            onClick={() => { setActiveView('completed'); setStatusFilter('completed'); setPage(1); }}
                            className={`px-3.5 py-2 text-[13px] font-semibold font-inter transition-colors border-b-2 -mb-[13px] whitespace-nowrap ${statusFilter === 'completed' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            Completed
                        </button>
                        <button
                            onClick={() => { setActiveView('all'); setStatusFilter('rejected'); setPage(1); }}
                            className={`px-3.5 py-2 text-[13px] font-semibold font-inter transition-colors border-b-2 -mb-[13px] whitespace-nowrap ${statusFilter === 'rejected' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            Rejected
                        </button>
                    </div>

                    <div className="flex items-center gap-3 max-sm:w-full">
                        <div className="relative max-w-[320px] w-full flex items-center">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                            <input
                                type="text"
                                placeholder="Search member or loan ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-9 pl-9 pr-3 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-xs font-inter text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                {activeView === 'all' ? (
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto shadow-sm min-h-[280px] flex flex-col justify-between">
                        <table className="w-full text-left border-collapse min-w-[900px] table-fixed">
                            <thead>
                                <tr>
                                    <th className="w-[15%] bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-2.5 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Loan ID</th>
                                    <th className="w-[28%] bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-2.5 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Member</th>
                                    <th className="w-[15%] bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-2.5 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                                    <th className="w-[15%] bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-2.5 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Purpose</th>
                                    <th className="w-[14%] bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-2.5 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Applied Date</th>
                                    <th className="w-[13%] bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-2.5 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8 text-slate-500 font-inter text-xs">
                                            Loading loans…
                                        </td>
                                    </tr>
                                ) : filteredLoans.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8 text-slate-500 font-inter text-xs">
                                            No loans found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLoans.map(loan => (
                                        <tr key={loan._id} onClick={() => handleViewDetails(loan)} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group h-11">
                                            <td className="px-3.5 py-2 whitespace-nowrap font-inter text-xs font-semibold text-blue-600 dark:text-blue-400">{loan.loanId}</td>
                                            <td className="px-3.5 py-2 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <p className="font-inter text-xs font-semibold text-slate-800 dark:text-white m-0 truncate">{loan.memberName}</p>
                                                    <p className="font-inter text-[10px] text-slate-500 dark:text-slate-400 m-0 truncate">{loan.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-3.5 py-2 whitespace-nowrap font-inter text-xs font-bold text-slate-800 dark:text-white">{fmt(loan.amount)}</td>
                                            <td className="px-3.5 py-2 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300 truncate">{loan.purpose}</td>
                                            <td className="px-3.5 py-2 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">{fmtDate(loan.appliedDate)}</td>
                                            <td className="px-3.5 py-2 whitespace-nowrap">
                                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${ resolveStatusClass(loan.status) === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : resolveStatusClass(loan.status) === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : resolveStatusClass(loan.status) === 'completed' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' : resolveStatusClass(loan.status) === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'}`}>
                                                    {resolveStatusLabel(loan.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto shadow-sm min-h-[280px] flex flex-col justify-between">
                        <table className="w-full text-left border-collapse min-w-[900px] table-fixed">
                            <thead>
                                <tr>
                                    <th className="w-[15%] bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-2.5 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Loan ID</th>
                                    <th className="w-[28%] bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-2.5 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Member</th>
                                    <th className="w-[15%] bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-2.5 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                                    <th className="w-[14%] bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-2.5 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Term</th>
                                    <th className="w-[15%] bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-2.5 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Total Repaid</th>
                                    <th className="w-[13%] bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3.5 py-2.5 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Completed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8 text-slate-500 font-inter text-xs">
                                            Loading…
                                        </td>
                                    </tr>
                                ) : filteredLoans.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8 text-slate-500 font-inter text-xs">
                                            No completed loans found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLoans.map(loan => {
                                        const isExpanded = expandedLoanId === loan._id;
                                        return (
                                            <Fragment key={loan._id}>
                                                <tr
                                                    className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group h-11 ${isExpanded ? 'bg-slate-50 dark:bg-white/5 border-l-4 border-l-blue-500' : ''}`}
                                                    onClick={async () => {
                                                        if (isExpanded) {
                                                            setExpandedLoanId(null);
                                                            setExpandedPayments([]);
                                                            return;
                                                        }
                                                        setExpandedLoanId(loan._id);
                                                        setExpandedPayments([]);
                                                        setExpandedLoading(true);
                                                        try {
                                                            const res = await fetch(`${API}/api/admin/loan-payments?status=all&limit=50&search=${encodeURIComponent(loan.loanId)}`, { headers: { Authorization: `Bearer ${token}` } });
                                                            const data = await res.json();
                                                            if (data.success) setExpandedPayments((data.payments || []).filter(p => p.status === 'confirmed'));
                                                        } catch { /* silent */ }
                                                        finally { setExpandedLoading(false); }
                                                    }}
                                                >
                                                    <td className="px-3.5 py-2 whitespace-nowrap font-inter text-xs font-semibold text-blue-600 dark:text-blue-400">{loan.loanId}</td>
                                                    <td className="px-3.5 py-2 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <p className="font-inter text-xs font-semibold text-slate-800 dark:text-white m-0 truncate">{loan.memberName}</p>
                                                            <p className="font-inter text-[10px] text-slate-500 dark:text-slate-400 m-0 truncate">{loan.email}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-3.5 py-2 whitespace-nowrap font-inter text-xs font-bold text-slate-800 dark:text-white">{fmt(loan.amount)}</td>
                                                    <td className="px-3.5 py-2 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">{loan.termMonths} months</td>
                                                    <td className="px-3.5 py-2 whitespace-nowrap font-inter text-xs font-bold text-emerald-600 dark:text-emerald-400">{fmt(loan.totalRepayment)}</td>
                                                    <td className="px-3.5 py-2 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">{fmtDate(loan.completedDate || loan.updatedAt)}</td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10">
                                                        <td colSpan={6}>
                                                            <div className="p-4">
                                                                <p className="font-inter text-xs font-bold text-slate-800 dark:text-white mb-2 m-0 uppercase tracking-wide">Payment History — {loan.loanId}</p>
                                                                {expandedLoading ? (
                                                                    <p className="text-xs text-slate-500 font-inter italic">Loading payments...</p>
                                                                ) : expandedPayments.length === 0 ? (
                                                                    <p className="text-xs text-slate-500 font-inter italic">No payment records found</p>
                                                                ) : (
                                                                    <table className="w-full text-left border-collapse bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden">
                                                                        <thead>
                                                                            <tr>
                                                                                <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3 py-2 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Date</th>
                                                                                <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3 py-2 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                                                                                <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3 py-2 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Method</th>
                                                                                <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-3 py-2 font-inter font-semibold text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Type</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {expandedPayments.map((p, i) => (
                                                                                <tr key={p._id || i}>
                                                                                    <td className="px-3 py-2 whitespace-nowrap text-xs">{fmtDate(p.confirmedAt || p.submittedAt)}</td>
                                                                                    <td className="px-3 py-2 whitespace-nowrap font-inter text-xs font-bold text-emerald-600 dark:text-emerald-400">{fmt(p.amount)}</td>
                                                                                    <td className="px-3 py-2 whitespace-nowrap font-inter text-xs text-slate-600 dark:text-slate-300 capitalize">{p.paymentMethod || 'cash'}</td>
                                                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.paymentType === 'full' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' : p.paymentType === 'advance' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                                                                            {p.paymentType || 'regular'}{p.monthsCovered > 1 ? ` (${p.monthsCovered}mo)` : ''}
                                                                                        </span>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={(newPage) => setPage(newPage)}
                    totalItems={totalCount}
                    itemsPerPage={LIMIT}
                    itemName="loans"
                />
            </div>

            {/* ══ Approve / Propose Terms Confirm Modal ══ */}
            {showApproveModal && selectedLoan && (
                (() => {
                    const amtDiff = Number(approvedAmount) !== Number(selectedLoan.amount);
                    const termDiff = Number(repaymentTerm) !== Number(selectedLoan.termMonths);
                    const isTermsModified = (amtDiff || termDiff) && !selectedLoan.memberApprovedTerms;

                    return (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setShowApproveModal(false)}>
                            <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[480px] p-6 shadow-2xl flex flex-col border border-slate-200 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
                                
                                {isTermsModified ? (
                                    <>
                                        <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto mb-2">
                                            <Edit3 size={28} className="text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <h2 className="font-inter text-lg font-bold text-slate-800 dark:text-white mb-1 text-center">
                                            Proposed Loan Terms Confirmation
                                        </h2>
                                        <p className="font-inter text-xs text-slate-500 dark:text-slate-400 text-center mb-4">
                                            You modified the original loan terms. The new proposed terms will be sent to <strong>{selectedLoan.memberName}</strong> for review and approval first.
                                        </p>

                                        {/* Comparison Box */}
                                        <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-4 border border-slate-200/80 dark:border-white/5 space-y-3 mb-4">
                                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                Terms Comparison
                                            </div>

                                            {/* Amount row */}
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500 dark:text-slate-400">Loan Amount:</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-semibold ${amtDiff ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {fmt(selectedLoan.amount)}
                                                    </span>
                                                    {amtDiff && (
                                                        <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded">
                                                            ➔ {fmt(approvedAmount)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Term months row */}
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500 dark:text-slate-400">Repayment Term:</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-semibold ${termDiff ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {selectedLoan.termMonths} mos
                                                    </span>
                                                    {termDiff && (
                                                        <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded">
                                                            ➔ {repaymentTerm} mos
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Calculated monthly */}
                                            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 dark:border-white/5">
                                                <span className="text-slate-500 dark:text-slate-400">New Monthly Payment:</span>
                                                <span className="font-bold text-slate-900 dark:text-white">
                                                    {fmt(calc?.monthly)} / mo
                                                </span>
                                            </div>
                                        </div>

                                        {/* Notice Banner */}
                                        <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl mb-5 flex items-start gap-2.5">
                                            <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                            <div className="font-inter text-[12px] text-amber-800 dark:text-amber-300 leading-snug">
                                                <strong>Member Notification:</strong> The user will receive an in-app & email notification to accept or decline these modified terms before the loan can proceed to final approval.
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 w-full">
                                            <button className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-inter text-[13px] font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border-none cursor-pointer" onClick={() => setShowApproveModal(false)}>
                                                Cancel
                                            </button>
                                            <button className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-inter text-[13px] font-semibold rounded-lg transition-colors border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" onClick={confirmApprove} disabled={!!actionLoading}>
                                                {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <><Send size={15} /> Send to Member</>}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                                            <CheckCircle size={28} className="text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <h2 className="font-inter text-lg font-bold text-slate-800 dark:text-white mb-1 text-center">Approve Loan Request?</h2>
                                        <p className="font-inter text-xs text-slate-500 dark:text-slate-400 text-center mb-5">
                                            Are you sure you want to approve loan <strong>{selectedLoan.loanId}</strong> for {selectedLoan.memberName}?
                                        </p>
                                        <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-4 flex flex-col gap-2.5 mb-6 border border-slate-100 dark:border-white/5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500 dark:text-slate-400">Approved Amount:</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(approvedAmount)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500 dark:text-slate-400">Repayment Term:</span>
                                                <span className="font-semibold text-slate-800 dark:text-white">{repaymentTerm} months</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 dark:border-white/5">
                                                <span className="text-slate-500 dark:text-slate-400">Monthly Payment:</span>
                                                <span className="font-bold text-slate-900 dark:text-white">{fmt(calc?.monthly)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 w-full">
                                            <button className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-inter text-[13px] font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border-none cursor-pointer" onClick={() => setShowApproveModal(false)}>Cancel</button>
                                            <button className="flex-1 px-4 py-2.5 bg-emerald-500 text-white font-inter text-[13px] font-semibold rounded-lg hover:bg-emerald-600 transition-colors border-none cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed" onClick={confirmApprove} disabled={!!actionLoading}>
                                                {actionLoading ? <Loader2 className="animate-spin" size={16} /> : 'Confirm Approval'}
                                            </button>
                                        </div>
                                    </>
                                )}

                            </div>
                        </div>
                    );
                })()
            )}

            {/* ══ Reject Confirm Modal ══ */}
            {showRejectModal && selectedLoan && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setShowRejectModal(false)}>
                    <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[420px] p-8 shadow-2xl flex flex-col border border-slate-200 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
                        <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mx-auto">
                            <XCircle size={32} color="#FF6467" />
                        </div>
                        <h2 className="font-inter text-xl font-bold text-slate-800 dark:text-white mt-4 mb-2 text-center">Reject Loan?</h2>
                        <p className="font-inter text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
                            Are you sure you want to reject loan <strong>{selectedLoan.loanId}</strong> for {selectedLoan.memberName}?
                        </p>
                        <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-4 flex flex-col gap-3 mb-6 border border-slate-100 dark:border-white/5">
                            <div className="flex items-center justify-between">
                                <span className="font-inter text-[13px] text-slate-500 dark:text-slate-400">Amount</span>
                                <span className="font-inter text-[13px] font-bold text-blue-600 dark:text-blue-400">{fmt(selectedLoan.amount)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-inter text-[13px] text-slate-500 dark:text-slate-400">Purpose</span>
                                <span className="font-inter text-[13px] font-semibold text-slate-800 dark:text-white">{selectedLoan.purpose}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 mb-6 w-full">
                            <label className="font-inter text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                                Rejection Reason <span className="required">*</span>
                            </label>
                            <textarea
                                className="w-full p-3 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-rose-500 dark:focus:border-rose-400 resize-none"
                                placeholder="e.g., Incomplete requirements, Insufficient documents..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                rows={4}
                            />
                            <p className="font-inter text-[11px] text-slate-500 dark:text-slate-400">This reason will be visible to the member and other admins.</p>
                        </div>
                        <div className="flex items-center gap-3 w-full">
                            <button
                                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-inter text-[13px] font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border-none cursor-pointer"
                                onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                            >
                                Cancel
                            </button>
                            <button
                                className="flex-1 px-4 py-2.5 bg-rose-500 text-white font-inter text-[13px] font-semibold rounded-lg hover:bg-rose-600 transition-colors border-none cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={confirmReject}
                                disabled={!rejectReason.trim() || !!actionLoading}
                            >
                                {actionLoading ? <Loader2 className="animate-spin" size={16} /> : 'Reject Loan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ DETAILS MODAL — HTML reference layout ══════════ */}
            {showDetailsModal && selectedLoan && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setShowDetailsModal(false)}>
                    <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[1240px] shadow-2xl flex flex-col border border-slate-200 dark:border-white/10 max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>

                        {/* ── Header ── */}
                        <div className="flex items-start justify-between p-[20px_24px] border-b border-slate-200 dark:border-white/10 shrink-0">
                            <div className="flex flex-col">
                                <p className="font-inter text-xl font-bold text-slate-800 dark:text-white m-0">Loan Details</p>
                                <p className="font-inter text-[13px] text-slate-500 dark:text-slate-400 m-0 mt-1">Request ID: {selectedLoan.loanId}</p>
                            </div>
                            <button className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border-none" onClick={() => setShowDetailsModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* ── Body ── */}
                        <div className="flex-1 overflow-y-auto p-[24px] flex flex-col gap-6 custom-scrollbar">

                            {/* Status Row */}
                            <div className={`flex items-center justify-between p-[12px_16px] rounded-xl border ${detailStatusClass === 'pending' ? 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20' : detailStatusClass === 'approved' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20' : detailStatusClass === 'completed' ? 'bg-purple-50 border-purple-200 dark:bg-purple-500/10 dark:border-purple-500/20' : detailStatusClass === 'rejected' ? 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20' : 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full ${detailStatusClass === 'pending' ? 'bg-amber-500' : detailStatusClass === 'approved' ? 'bg-emerald-500' : detailStatusClass === 'completed' ? 'bg-purple-500' : detailStatusClass === 'rejected' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                                    <span className={`font-inter text-[13px] font-semibold ${detailStatusClass === 'pending' ? 'text-amber-700 dark:text-amber-400' : detailStatusClass === 'approved' ? 'text-emerald-700 dark:text-emerald-400' : detailStatusClass === 'completed' ? 'text-purple-700 dark:text-purple-400' : detailStatusClass === 'rejected' ? 'text-rose-700 dark:text-rose-400' : 'text-blue-700 dark:text-blue-400'}`}>Status</span>
                                    <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${ detailStatusClass === 'pending' || detailStatusClass === 'awaiting' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : detailStatusClass === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : detailStatusClass === 'completed' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' : detailStatusClass === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'}`}>
                                        {detailStatusLabel}
                                    </span>
                                </div>
                                <span className={`font-inter text-[12px] text-right ${detailStatusClass === 'pending' ? 'text-amber-600 dark:text-amber-500' : detailStatusClass === 'approved' ? 'text-emerald-600 dark:text-emerald-500' : detailStatusClass === 'completed' ? 'text-purple-600 dark:text-purple-500' : detailStatusClass === 'rejected' ? 'text-rose-600 dark:text-rose-500' : 'text-blue-600 dark:text-blue-500'}`}>
                                    {detailStatusDesc}
                                </span>
                            </div>

                            {/* Member Decline Reason Banner (if member declined previously proposed terms) */}
                            {selectedLoan.declineReason && (
                                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-300 font-inter text-xs shadow-sm">
                                    <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-bold text-[13px] text-amber-800 dark:text-amber-300">Member Declined Previous Proposed Terms</span>
                                        <span className="text-[12px] text-slate-700 dark:text-slate-300">
                                            Reason: <strong className="text-amber-900 dark:text-amber-200">"{selectedLoan.declineReason}"</strong>
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* ── COLUMN 1: Primary Action & Loan Terms (Most Important) ── */}
                                <div className="flex flex-col gap-4">
                                    {/* Member Information */}
                                    <div>
                                        <div className="font-inter text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 m-0 mb-1.5">Member information</div>
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 bg-slate-50 dark:bg-[#252836] p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="font-inter text-[11px] font-medium text-slate-400 dark:text-slate-400">Member name</div>
                                                <div className="font-inter text-[14px] font-bold text-slate-900 dark:text-white truncate">{selectedLoan.memberName}</div>
                                            </div>
                                            <div className="flex flex-col gap-0.5 overflow-hidden">
                                                <div className="font-inter text-[11px] font-medium text-slate-400 dark:text-slate-400">Email address</div>
                                                <div className="font-inter text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate" title={selectedLoan.email}>{selectedLoan.email}</div>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="font-inter text-[11px] font-medium text-slate-400 dark:text-slate-400">Applied date</div>
                                                <div className="font-inter text-[13px] font-semibold text-slate-800 dark:text-slate-200">{fmtDate(selectedLoan.appliedDate)}</div>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="font-inter text-[11px] font-medium text-slate-400 dark:text-slate-400">Member savings</div>
                                                <div className="font-inter text-[15px] font-bold text-emerald-600 dark:text-emerald-400">{fmt(memberSavings)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Requested Loan Type */}
                                    <div>
                                        <div className="font-inter text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 m-0 mb-1.5">Requested loan type</div>
                                        <div className={`flex items-center justify-between p-4 rounded-xl border ${pillClass === 'emergency' ? 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20' : pillClass === 'short-term' ? 'bg-teal-50 border-teal-200 dark:bg-teal-500/10 dark:border-teal-500/20' : 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20'}`}>
                                            <div style={{ flex: 1 }}>
                                                <div className={`font-inter text-sm font-bold m-0 ${pillClass === 'emergency' ? 'text-amber-800 dark:text-amber-400' : pillClass === 'short-term' ? 'text-teal-800 dark:text-teal-400' : 'text-blue-800 dark:text-blue-400'}`}>
                                                    {selectedType?.name || 'Personal Loan'}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold bg-white/60 dark:bg-black/20 ${pillClass === 'emergency' ? 'text-amber-700 dark:text-amber-400' : pillClass === 'short-term' ? 'text-teal-700 dark:text-teal-400' : 'text-blue-700 dark:text-blue-400'}`}>{selectedType?.multiplier || 2}×</span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold bg-white/60 dark:bg-black/20 ${pillClass === 'emergency' ? 'text-amber-700 dark:text-amber-400' : pillClass === 'short-term' ? 'text-teal-700 dark:text-teal-400' : 'text-blue-700 dark:text-blue-400'}`}>{selectedType?.rateLabel || '2% / mo'}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold bg-white/60 dark:bg-black/20 ${pillClass === 'emergency' ? 'text-amber-700 dark:text-amber-400' : pillClass === 'short-term' ? 'text-teal-700 dark:text-teal-400' : 'text-blue-700 dark:text-blue-400'}`}>{selectedType?.minTerm || 3}–{selectedType?.maxTerm || 12}m</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end text-right ml-4 shrink-0">
                                                <div className="font-inter text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Requested</div>
                                                <div className={`font-inter text-lg font-bold m-0 ${pillClass === 'emergency' ? 'text-amber-700 dark:text-amber-400' : pillClass === 'short-term' ? 'text-teal-700 dark:text-teal-400' : 'text-blue-700 dark:text-blue-400'}`}>{fmt(selectedLoan.amount)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Admin — set repayment terms */}
                                    <div className="bg-slate-50 dark:bg-[#252836] border border-slate-200 dark:border-white/5 rounded-xl p-4 flex flex-col gap-3">
                                        <div className="font-inter text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                                            Admin — Set Repayment Terms
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="flex flex-col gap-1.5 flex-1">
                                                <label className="font-inter text-[11px] text-slate-500 dark:text-slate-400">Approved amount (₱)</label>
                                                <input
                                                    className="w-full p-2.5 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-[13px] font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors"
                                                    type="number"
                                                    value={approvedAmount}
                                                    onChange={(e) => setApprovedAmount(e.target.value)}
                                                    min="500"
                                                    max={maxLoanable || undefined}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5 flex-1">
                                                <label className="font-inter text-[11px] text-slate-500 dark:text-slate-400">Repayment term</label>
                                                <select
                                                    className="w-full p-2.5 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-[13px] font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors"
                                                    value={repaymentTerm}
                                                    onChange={(e) => setRepaymentTerm(e.target.value)}
                                                >
                                                    <option value="">Select term</option>
                                                    {termOptions.map(m => (
                                                        <option key={m} value={m}>{m} months</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        {maxLoanable > 0 && (
                                            <div className="font-inter text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                                Max loanable: {fmt(maxLoanable)} ({selectedType?.multiplier}× savings)
                                            </div>
                                        )}
                                        {calc && (
                                            <div className="flex items-center gap-3 mt-2">
                                                <div className="flex-1 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 flex flex-col gap-0.5">
                                                    <div className="font-inter text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Monthly</div>
                                                    <div className="font-inter text-[13px] font-semibold text-slate-800 dark:text-white">{fmt(calc.monthly)}</div>
                                                </div>
                                                <div className="flex-1 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 flex flex-col gap-0.5">
                                                    <div className="font-inter text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Interest</div>
                                                    <div className="font-inter text-[13px] font-bold text-amber-600 dark:text-amber-400">{fmt(calc.totalInterest)}</div>
                                                </div>
                                                <div className="flex-1 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 flex flex-col gap-0.5">
                                                    <div className="font-inter text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</div>
                                                    <div className="font-inter text-[13px] font-bold text-emerald-600 dark:text-emerald-400">{fmt(calc.totalRepayment)}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Disbursement Method */}
                                    <div>
                                        <div className="font-inter text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 m-0 mb-3">Disbursement method</div>
                                        <div className="flex items-center gap-3">
                                            {[
                                                { id: 'cash', label: 'Cash' },
                                                { id: 'e-wallet', label: 'E-Wallet' },
                                                { id: 'bank', label: 'Bank' },
                                            ].map(opt => {
                                                const active = selectedLoan.disbursementMethod === opt.id;
                                                return (
                                                    <div key={opt.id} className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border text-[13px] font-semibold font-inter transition-colors ${active ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-[#252836] dark:border-white/5 dark:text-slate-400'}`}>
                                                        <div className={`w-3 h-3 rounded-full border-2 ${active ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-500 bg-transparent'}`} />
                                                        <span className="m-0">{opt.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {selectedLoan.disbursementAccount && (
                                            <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
                                                Account: {selectedLoan.disbursementAccount}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* ── COLUMN 2: Verification & Decision Analysis (DSS Panel) ── */}
                                <div className="flex flex-col gap-4">
                                    {/* DSS Panel */}
                                    <DSSPanel 
                                        analysis={dssAnalysis} 
                                        loading={dssLoading} 
                                        onRefresh={() => fetchDSSAnalysis(selectedLoan, true)} 
                                        memberName={selectedLoan.memberName}
                                    />
                                </div>

                                {/* ── COLUMN 3: Verification Alerts, Documents & System Notes ── */}
                                <div className="flex flex-col gap-4">
                                    {/* OCR Results Analysis */}
                                    {ocrResults && (
                                        <div className={`p-4 rounded-xl border ${ocrResults.matchFound ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20'}`}>
                                            <div className="flex items-center gap-2 mb-3">
                                                {ocrResults.matchFound ? (
                                                    <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
                                                ) : (
                                                    <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400" />
                                                )}
                                                <span className={`font-inter text-sm font-bold ${ocrResults.matchFound ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
                                                    {ocrResults.matchFound ? 'OCR Identity Match' : 'OCR Verification Alert'}
                                                </span>
                                            </div>
                                            <ul className="m-0 pl-5 font-inter text-[13px] text-slate-700 dark:text-slate-300 space-y-1">
                                                {ocrResults.messages.map((m, idx) => (
                                                    <li key={idx}>{m}</li>
                                                ))}
                                            </ul>
                                            {!ocrResults.matchFound && (
                                                <div className="mt-3 p-3 bg-rose-100/50 dark:bg-rose-900/30 rounded-lg font-inter text-[12px] text-rose-800 dark:text-rose-300 leading-relaxed">
                                                    <strong>Important:</strong> The system could not confirm the member's name from the document scan. Please examine the images closely before approval.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Uploaded Documents */}
                                    <div>
                                        <div className="font-inter text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 m-0 mb-3">Uploaded documents</div>
                                        <div className="grid grid-cols-2 gap-3 mt-2">
                                            {/* Selfie with ID */}
                                            <div className="bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-md" onClick={() => handleDocClick(selectedLoan.selfieData, setViewingImage)}>
                                                <div className="h-24 bg-slate-100 dark:bg-black/20 flex items-center justify-center overflow-hidden border-b border-slate-200 dark:border-white/5">
                                                    {renderDocPreview(selectedLoan.selfieData)}
                                                </div>
                                                <div className="p-2 flex items-center justify-between">
                                                    <span className="font-inter text-[11px] font-semibold text-slate-700 dark:text-slate-300">Selfie w/ ID</span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedLoan.selfieData ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                                                        {selectedLoan.selfieData ? 'OK' : 'X'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Government ID */}
                                            <div className="bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-md" onClick={() => handleDocClick(selectedLoan.idData, setViewingImage)}>
                                                <div className="h-24 bg-slate-100 dark:bg-black/20 flex items-center justify-center overflow-hidden border-b border-slate-200 dark:border-white/5">
                                                    {renderDocPreview(selectedLoan.idData)}
                                                </div>
                                                <div className="p-2 flex items-center justify-between">
                                                    <span className="font-inter text-[11px] font-semibold text-slate-700 dark:text-slate-300">Valid ID</span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedLoan.idData ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                                                        {selectedLoan.idData ? 'OK' : 'X'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* COE */}
                                            <div className="bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-md" onClick={() => handleDocClick(selectedLoan.coeData, setViewingImage)}>
                                                <div className="h-24 bg-slate-100 dark:bg-black/20 flex items-center justify-center overflow-hidden border-b border-slate-200 dark:border-white/5">
                                                    {renderDocPreview(selectedLoan.coeData)}
                                                </div>
                                                <div className="p-2 flex items-center justify-between">
                                                    <span className="font-inter text-[11px] font-semibold text-slate-700 dark:text-slate-300">COE</span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedLoan.coeData ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                                                        {selectedLoan.coeData ? 'OK' : 'X'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* ITR */}
                                            <div className="bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-md" onClick={() => handleDocClick(selectedLoan.itrData, setViewingImage)}>
                                                <div className="h-24 bg-slate-100 dark:bg-black/20 flex items-center justify-center overflow-hidden border-b border-slate-200 dark:border-white/5">
                                                    {renderDocPreview(selectedLoan.itrData)}
                                                </div>
                                                <div className="p-2 flex items-center justify-between">
                                                    <span className="font-inter text-[11px] font-semibold text-slate-700 dark:text-slate-300">ITR</span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedLoan.itrData ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                                                        {selectedLoan.itrData ? 'OK' : 'X'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Payslip */}
                                            <div className="bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-md" onClick={() => handleDocClick(selectedLoan.payslipData, setViewingImage)}>
                                                <div className="h-24 bg-slate-100 dark:bg-black/20 flex items-center justify-center overflow-hidden border-b border-slate-200 dark:border-white/5">
                                                    {renderDocPreview(selectedLoan.payslipData)}
                                                </div>
                                                <div className="p-2 flex items-center justify-between">
                                                    <span className="font-inter text-[11px] font-semibold text-slate-700 dark:text-slate-300">Payslip</span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedLoan.payslipData ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                                                        {selectedLoan.payslipData ? 'OK' : 'X'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Active Loan Screenshot */}
                                            {selectedLoan.hasActiveLoan && (
                                                <div className="bg-white dark:bg-[#252836] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-md" onClick={() => handleDocClick(selectedLoan.activeLoanScreenshotData, setViewingImage)}>
                                                    <div className="h-24 bg-slate-100 dark:bg-black/20 flex items-center justify-center overflow-hidden border-b border-slate-200 dark:border-white/5">
                                                        {renderDocPreview(selectedLoan.activeLoanScreenshotData)}
                                                    </div>
                                                    <div className="p-2 flex items-center justify-between">
                                                        <span className="font-inter text-[11px] font-semibold text-slate-700 dark:text-slate-300">Active Loan</span>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedLoan.activeLoanScreenshotData ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                                                            {selectedLoan.activeLoanScreenshotData ? 'OK' : 'X'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* System Note */}
                                    <div className="p-4 bg-slate-50 dark:bg-[#252836] border border-slate-200 dark:border-white/5 rounded-xl">
                                        <div className="font-inter text-[12px] font-semibold text-slate-700 dark:text-slate-300 mb-1">System Note</div>
                                        <div className="font-inter text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                            Review within 2–3 days. Late penalty 3%/mo applies.
                                        </div>
                                    </div>

                                    {/* Rejection Reason (shown when loan is rejected) */}
                                    {selectedLoan.status && selectedLoan.status.toLowerCase() === 'rejected' && selectedLoan.rejectionReason && (
                                        <div className="p-4 bg-slate-50 dark:bg-[#252836] border border-slate-200 dark:border-white/5 rounded-xl" style={{ borderLeft: '4px solid #EF4444', background: '#FEF2F2' }}>
                                            <div className="font-inter text-[12px] font-semibold text-slate-700 dark:text-slate-300 mb-1" style={{ color: '#DC2626' }}>Rejection Reason</div>
                                            <div className="font-inter text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed" style={{ color: '#991B1B' }}>
                                                {selectedLoan.rejectionReason}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>{/* end dm-body */}

                        {/* ── Footer ── */}
                        <div className="flex items-center justify-between p-[16px_24px] border-t border-slate-200 dark:border-white/10 shrink-0 bg-white dark:bg-[#1E2130]">
                            <span className="font-inter text-[13px] text-slate-500 dark:text-slate-400">
                                Applied {fmtDate(selectedLoan.appliedDate)} ·{' '}
                                {selectedLoan.status === 'pending'
                                    ? 'Pending review'
                                    : selectedLoan.status === 'awaiting_member_approval'
                                        ? 'Awaiting member response'
                                        : detailStatusLabel}
                            </span>
                            <div className="flex items-center gap-3">
                                <button className="px-4 py-2 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-inter text-[13px] font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border-none cursor-pointer" onClick={() => setShowDetailsModal(false)}>
                                    Close
                                </button>

                                {selectedLoan.status === 'pending' && isOcrLoading && (
                                    <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5">
                                        <Loader2 className="animate-spin" size={16} />
                                        <span>Scanning Documents...</span>
                                    </div>
                                )}

                                {selectedLoan.status === 'awaiting_member_approval' && (
                                    <span className="font-inter text-[12px] text-amber-600 dark:text-amber-400 font-medium">⏳ Waiting for member approval</span>
                                )}

                                {selectedLoan.status === 'pending' && (
                                    <>
                                        <button
                                            className="px-4 py-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-inter text-[13px] font-semibold rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors border-none cursor-pointer"
                                            onClick={() => { setShowDetailsModal(false); handleReject(selectedLoan); }}
                                        >
                                            Reject Request
                                        </button>
                                        <button
                                            className="px-6 py-2 bg-emerald-500 text-white font-inter text-[13px] font-semibold rounded-lg hover:bg-emerald-600 transition-colors border-none cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={() => { setShowDetailsModal(false); handleApprove(selectedLoan); }}
                                            disabled={!!actionLoading}
                                        >
                                            Approve Loan
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* ══ Image Lightbox ══ */}
            {viewingImage && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setViewingImage(null)} style={{ zIndex: 1100 }}>
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setViewingImage(null)}
                            style={{
                                position: 'absolute', top: -12, right: -12, width: 32, height: 32,
                                borderRadius: '50%', background: '#fff', border: '1px solid #e5e7eb',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                zIndex: 1101, boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                            }}
                        >
                            <X size={16} color="#374151" />
                        </button>
                        <img
                            src={viewingImage}
                            alt="Document"
                            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}