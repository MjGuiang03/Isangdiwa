import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import SecretaryAdminSidebar from '../components/secretaryAdminSidebar';
import PageHeader from '../components/PageHeader';
import SecApprovedLoanDetailsModal from '../components/secApprovedLoanDetailsModal';
import SecProcessLoanModal from '../components/secProcessLoanModal';
import SecLoanReceiptModal from '../components/SecLoanReceiptModal';
import useDebounce from '../../hooks/useDebounce';


import API from '../../utils/api';
import { Banknote, Search } from 'lucide-react';

export default function SecretaryLoanProcess() {
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 400);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showProcessModal, setShowProcessModal] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [loading, setLoading] = useState(false);

    const [loans, setLoans] = useState([]);

    const token = localStorage.getItem('secretaryToken') || localStorage.getItem('adminToken') || localStorage.getItem('token');
    const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(async res => {
        if (!res.ok) throw new Error('Failed to fetch loans');
        return res.json();
    });

    const { data: loansData, error: loansError, isValidating: loadingLoans, mutate: fetchLoans } = useSWR(
        token ? `${API}/api/admin/loans?limit=10000&status=non_completed` : null,
        fetcherSingle,
        { revalidateOnFocus: false, revalidateIfStale: true }
    );

    useEffect(() => {
        if (loansError) {
            toast.error('Failed to fetch loans');
        }
    }, [loansError]);

    useEffect(() => {
        if (loansData && loansData.success && loansData.loans) {
            const awaitingDisbursement = loansData.loans.filter(l => l.status === 'approved' || (l.status === 'active' && !l.disbursed));
            setLoans(awaitingDisbursement);
        }
    }, [loansData]);

    useEffect(() => {
        setLoading(loadingLoans && !loansData);
    }, [loadingLoans, loansData]);

    const awaitingCount = loans.filter(l => !l.disbursed).length;
    const processedCount = loans.filter(l => l.disbursed).length;

    const handleViewDetails = async (loan) => {
        const token = localStorage.getItem('secretaryToken') || localStorage.getItem('adminToken') || localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        let loanHistoryCount = 0;
        let totalDonations = 0;
        let userChurchId = 'N/A';
        let userPosition = 'Member';

        // Provide immediate visual feedback
        const loadingToast = toast.loading('Loading member data...');

        try {
            // Run all three API calls simultaneously instead of sequentially to drastically reduce wait time
            const [histRes, donRes, memberRes] = await Promise.allSettled([
                fetch(`${API}/api/admin/loans?search=${encodeURIComponent(loan.email)}&limit=100`, { headers }),
                fetch(`${API}/api/admin/donations?search=${encodeURIComponent(loan.email)}`, { headers }),
                fetch(`${API}/api/admin/members?search=${encodeURIComponent(loan.email)}&limit=1`, { headers })
            ]);

            // Process Loan History
            if (histRes.status === 'fulfilled' && histRes.value.ok) {
                const histData = await histRes.value.json();
                if (histData.success && histData.loans) {
                    loanHistoryCount = histData.loans.filter(l => l.status === 'completed').length;
                }
            }

            // Process Donations
            if (donRes.status === 'fulfilled' && donRes.value.ok) {
                const donData = await donRes.value.json();
                if (donData.success && donData.donations) {
                    totalDonations = donData.donations.reduce((sum, d) => sum + Number(d.amount), 0);
                }
            }

            // Process Member Info (churchId, position)
            if (memberRes.status === 'fulfilled' && memberRes.value.ok) {
                const memberData = await memberRes.value.json();
                if (memberData.success && memberData.members && memberData.members.length > 0) {
                    const member = memberData.members.find(m => m.email === loan.email);
                    if (member) {
                        userChurchId = member.churchId || member.memberId || 'N/A';
                        userPosition = member.position || member.officerPosition || 'Member';
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch user details:', err);
        } finally {
            toast.dismiss(loadingToast);
        }

        // Synthesize data for the modal
        const loanWithDetails = {
            id: loan.loanId,
            member: loan.memberName,
            email: loan.email,
            amount: loan.amount,
            purpose: loan.purpose,
            approvedDate: new Date(loan.approvedDate || loan.appliedDate).toLocaleDateString('en-US'),
            status: loan.disbursed ? 'Processed' : 'Awaiting Processing',
            churchId: userChurchId,
            position: userPosition,
            disbursementMethod: loan.disbursementMethod || 'cash',
            disbursementAccount: loan.disbursementAccount || '',
            churchActive: 'Active',
            loanHistory: loanHistoryCount,
            totalDonations: totalDonations,
            _id: loan._id
        };
        setSelectedLoan(loanWithDetails);
        setShowDetailsModal(true);
    };

    const handleViewReceipt = (loan) => {
        const loanWithReceiptInfo = {
            ...loan,
            id: loan.loanId,
            member: loan.memberName,
            // Fields fetched from backend
            paymentMethod: loan.paymentMethod,
            disbursementDate: loan.disbursementDate,
            referenceNumber: loan.referenceNumber
        };
        setSelectedLoan(loanWithReceiptInfo);
        setShowReceiptModal(true);
    };

    const handleProcessLoan = async (paymentMethod, processReason) => {
        if (!selectedLoan || !selectedLoan._id) return;

        try {
            const token = localStorage.getItem('secretaryToken') || localStorage.getItem('adminToken') || localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

            const payload = { paymentMethod };
            if (paymentMethod !== selectedLoan.disbursementMethod && processReason) {
                payload.processReason = processReason;
            }

            const res = await fetch(`${API}/api/admin/loans/${selectedLoan._id}/process`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                const updatedLoan = {
                    ...selectedLoan,
                    paymentMethod,
                    disbursementDate: new Date().toISOString(),
                    referenceNumber: data.referenceNumber
                };
                setSelectedLoan(updatedLoan);
                fetchLoans(); // Refresh the list
                return { success: true, referenceNumber: data.referenceNumber, updatedLoan };
            } else {
                throw new Error(data.message || 'Failed to process loan');
            }
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    const filteredLoans = loans.filter(loan =>
        (loan.memberName || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (loan.loanId || '').toLowerCase().includes(debouncedSearch.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex h-screen bg-slate-100 dark:bg-[#161922] overflow-hidden font-inter">
                <SecretaryAdminSidebar />
                <div className="flex-1 overflow-y-auto p-6 pb-16 w-full animate-pulse flex flex-col gap-6">
                    {/* Header Skeleton */}
                    <div className="flex flex-col gap-2">
                        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
                        <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
                    </div>

                    {/* Stat Cards Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2].map((i) => (
                            <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm h-20 flex flex-col justify-between">
                                <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                                <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                            </div>
                        ))}
                    </div>

                    {/* Table Skeleton */}
                    <div className="w-full bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm p-4 flex flex-col gap-4">
                        <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-[#161922] overflow-hidden font-inter">
            <SecretaryAdminSidebar />

            <div className="flex-1 overflow-y-auto p-6 pb-16 w-full">
                    {/* Header */}
                    <PageHeader 
                        title="Loan Processing" 
                        subtitle="Process approved loans and handle disbursements." 
                    />

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm flex flex-col gap-1 transition-transform hover:-translate-y-0.5">
                            <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">Awaiting Processing</p>
                            <p className="font-inter font-bold text-2xl text-amber-500 m-0">{awaitingCount}</p>
                        </div>
                        <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm flex flex-col gap-1 transition-transform hover:-translate-y-0.5">
                            <p className="font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 m-0">Processed</p>
                            <p className="font-inter font-bold text-2xl text-navy dark:text-blue-400 m-0">{processedCount}</p>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-6">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by member name or loan ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-10 pl-11 pr-4 py-2 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-navy dark:focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Loans Table */}
                    <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto shadow-sm">
                        {loading ? (
                            <div className="p-10 text-center text-slate-500 font-inter text-sm">Loading loans...</div>
                        ) : (
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead>
                                    <tr>
                                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Loan ID</th>
                                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Member Name</th>
                                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Amount</th>
                                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Purpose</th>
                                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Approved Date</th>
                                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Status</th>
                                        <th className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 px-4 py-3 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLoans.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="text-center p-10 text-slate-500 font-inter text-sm">
                                                No loans found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLoans.map(loan => (
                                            <tr key={loan._id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-900 dark:text-white font-medium align-middle">{loan.loanId}</td>
                                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-inter align-middle">
                                                    <div className="flex flex-col gap-0.5">
                                                        <p className="font-medium text-[13px] text-slate-900 dark:text-white m-0">{loan.memberName}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 m-0">{loan.email}</p>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-900 dark:text-white font-semibold align-middle">₱{Number(loan.amount).toLocaleString()}</td>
                                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-900 dark:text-slate-200 align-middle">{loan.purpose}</td>
                                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-[13px] text-slate-900 dark:text-slate-200 align-middle">{new Date(loan.approvedDate || loan.appliedDate).toLocaleDateString('en-US')}</td>
                                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-inter align-middle">
                                                    {!loan.disbursed && (
                                                        <span className="inline-flex px-3 py-1 rounded-md font-inter font-medium text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 whitespace-nowrap">Awaiting Processing</span>
                                                    )}
                                                    {loan.disbursed && (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="inline-flex px-3 py-1 rounded-md font-inter font-medium text-[11px] bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 w-fit whitespace-nowrap">Processed</span>
                                                            <p className="font-inter text-[11px] text-slate-500 dark:text-slate-400 m-0">
                                                                {loan.paymentMethod === 'e-wallet' ? 'E-Wallet' : loan.paymentMethod === 'bank' ? 'Bank Transfer' : loan.paymentMethod} • {new Date(loan.disbursementDate).toLocaleDateString('en-US')}
                                                            </p>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 font-inter align-middle">
                                                    <div className="flex gap-2 items-center">
                                                        {loan.disbursed ? (
                                                            <button
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-inter text-[12px] font-semibold cursor-pointer transition-colors dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800/30 whitespace-nowrap"
                                                                onClick={() => handleViewReceipt(loan)}
                                                            >
                                                                <Banknote size={14} />
                                                                View Receipt
                                                            </button>
                                                        ) : (
                                                            <button
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-navy hover:bg-blue-800 text-white border-none rounded-lg font-inter text-[12px] font-semibold cursor-pointer transition-colors dark:bg-[#0D1F45] dark:hover:bg-blue-900 whitespace-nowrap"
                                                                onClick={() => handleViewDetails(loan)}
                                                            >
                                                                <Banknote size={14} />
                                                                Process Data
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        )}
                    </div>
                </div>

            {/* Modals */}
            {showDetailsModal && selectedLoan && (
                <SecApprovedLoanDetailsModal
                    loan={selectedLoan}
                    onClose={() => setShowDetailsModal(false)}
                    onProcess={() => {
                        setShowDetailsModal(false);
                        setShowProcessModal(true);
                    }}
                />
            )}

            {showProcessModal && selectedLoan && (
                <SecProcessLoanModal
                    loan={selectedLoan}
                    onClose={() => setShowProcessModal(false)}
                    onProcess={handleProcessLoan}
                    onShowReceipt={() => {
                        setShowProcessModal(false);
                        setShowReceiptModal(true);
                    }}
                />
            )}

            {showReceiptModal && selectedLoan && (
                <SecLoanReceiptModal
                    loan={selectedLoan}
                    onClose={() => {
                        setShowReceiptModal(false);
                        setSelectedLoan(null);
                    }}
                />
            )}
        </div>
    );
}
