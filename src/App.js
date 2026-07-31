import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './user/components/ProtectedRoute';
import AdminProtectedRoute from './admin/pages/AdminProtectedRoute';
import UserLayout from './user/components/UserLayout';

// Regular User Pages
const UpdatePassword = lazy(() => import('./user/components/UpdatePassword'));
const VerifyEmail = lazy(() => import('./user/components/VerifyEmail'));

const Home = lazy(() => import('./user/pages/Home'));
const Loans = lazy(() => import('./user/pages/Loans'));
const Donation = lazy(() => import('./user/pages/Donation'));
const Attendance = lazy(() => import('./user/pages/Attendance'));
const Branches = lazy(() => import('./user/pages/Branches'));
const Notifications = lazy(() => import('./user/pages/Notifications'));
const Settings = lazy(() => import('./user/pages/Settings'));
const LoanDetail = lazy(() => import('./user/pages/LoanDetail'));
const Savings = lazy(() => import('./user/pages/Savings'));
const Profile = lazy(() => import('./user/pages/Profile'));

// Admin Pages

const AdminLayout = lazy(() => import('./admin/pages/AdminLayout'));
const AdminDashboard = lazy(() => import('./admin/pages/AdminDashboard'));
const AdminMembers = lazy(() => import('./admin/pages/AdminMembers'));
const AdminDonations = lazy(() => import('./admin/pages/AdminDonations'));
const AdminAttendance = lazy(() => import('./admin/pages/AdminAttendance'));
const AdminBranches = lazy(() => import('./admin/pages/AdminBranches'));
const AdminSettings = lazy(() => import('./admin/pages/AdminSettings'));
const AdminNotifications = lazy(() => import('./admin/pages/AdminNotification'));

const AdminAnnouncements = lazy(() => import('./admin/pages/AdminAnnouncements'));
const AdminUserManagement = lazy(() => import('./admin/pages/AdminUserManagement'));
const AdminFinancialReport = lazy(() => import('./admin/pages/AdminFinancialReport'));
const AdminRFIDPreview = lazy(() => import('./admin/pages/AdminRFIDPreview'));

// Loan Admin Pages
const LoanAdminDashboard = lazy(() => import('./loanAdmin/pages/loanAdminDashboard'));
const LoanAdminNotif = lazy(() => import('./loanAdmin/pages/loanAdminNotif'));
const LoanAdminLoanManagement = lazy(() => import('./loanAdmin/pages/loanAdminLoanManagement'));
const LoanAdminPaymentStatus = lazy(() => import('./loanAdmin/pages/loanAdminPaymentStatus'));
const LoanAdminDelinquency = lazy(() => import('./loanAdmin/pages/loanAdminDelinquency'));
const LoanAdminSettings = lazy(() => import('./loanAdmin/pages/loanAdminSettings'));

// Secretary Admin Pages
const SecretaryAdminDashboard = lazy(() => import('./secretaryAdmin/pages/secretaryAdminDashboard'));
const SecretaryAdminNotif = lazy(() => import('./secretaryAdmin/pages/secretaryAdminNotif'));
const SecretaryAdminLoanProcess = lazy(() => import('./secretaryAdmin/pages/secretaryAdminLoanProcess'));
const SecretaryAdminRecords = lazy(() => import('./secretaryAdmin/pages/secretaryAdminRecords'));
const SecretaryAdminSettings = lazy(() => import('./secretaryAdmin/pages/secretaryAdminSettings'));
const WelcomePage = lazy(() => import('./user/pages/WelcomePage'));
const LandingPage = lazy(() => import('./user/pages/LandingPage'));


const GlobalLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', backgroundColor: '#f8fafc', color: '#1e3a8a', fontFamily: 'Inter, sans-serif' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <div className="user-spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(30, 58, 138, 0.1)', borderTopColor: '#1e3a8a', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ fontWeight: '600', fontSize: '14px', opacity: 0.8, textAlign: 'center' }}>
        Loading <span className="brand-text-isang">Isang</span><span className="brand-text-diwa">Diwa</span>...
        <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: '400', opacity: 0.8 }}>
          Philippine United Apostolic Church
        </div>
      </div>
    </div>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Toaster
            position="top-right"
            expand={false}
            duration={3000}
            toastOptions={{
              classNames: {
                toast: 'bg-[#0D1F45] dark:bg-[#1E2130] text-white border border-white/15 dark:border-white/10 rounded-xl shadow-2xl font-inter text-xs font-medium p-3.5',
                title: 'text-white font-semibold text-xs',
                description: 'text-slate-300 text-[11px]',
                icon: 'text-white',
              }
            }}
          />

          <Suspense fallback={<GlobalLoader />}>
            <Routes>
              {/* ========== PUBLIC ROUTES ========== */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/reset-password" element={<LandingPage />} />
              <Route path="/old-welcome" element={<WelcomePage />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />

              {/* Standalone RFID Preview Route */}
              <Route path="/admin/rfid-preview" element={<AdminProtectedRoute><AdminRFIDPreview /></AdminProtectedRoute>} />

              {/* Redirect /admin → /admin/dashboard */}
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

              {/*
              All protected admin routes share AdminLayout (sidebar rendered ONCE).
              AdminProtectedRoute wraps AdminLayout so unauthenticated users
              are redirected before the layout even mounts.
            */}
              <Route
                element={
                  <AdminProtectedRoute>
                    <AdminLayout />
                  </AdminProtectedRoute>
                }
              >
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/notification" element={<AdminNotifications />} />

                <Route path="/admin/members" element={<AdminMembers />} />
                <Route path="/admin/donations" element={<AdminDonations />} />
                <Route path="/admin/attendance" element={<AdminAttendance />} />
                <Route path="/admin/branches" element={<AdminBranches />} />

                <Route path="/admin/announcements" element={<AdminAnnouncements />} />
                <Route path="/admin/users" element={<AdminUserManagement />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/financial-report" element={<AdminFinancialReport />} />

              </Route>

              {/* ========== LOAN ADMIN ROUTES ========== */}
              {/* Redirect /loan-admin → /loan-admin/dashboard */}
              <Route path="/loan-admin" element={<Navigate to="/loan-admin/dashboard" replace />} />

              {/* Each loanAdmin page embeds its own sidebar, so no layout wrapper needed */}
              <Route path="/loan-admin/dashboard" element={<AdminProtectedRoute><LoanAdminDashboard /></AdminProtectedRoute>} />
              <Route path="/loan-admin/notifications" element={<AdminProtectedRoute><LoanAdminNotif /></AdminProtectedRoute>} />
              <Route path="/loan-admin/loan-management" element={<AdminProtectedRoute><LoanAdminLoanManagement /></AdminProtectedRoute>} />
              <Route path="/loan-admin/payments/loans" element={<AdminProtectedRoute><LoanAdminPaymentStatus /></AdminProtectedRoute>} />
              <Route path="/loan-admin/payments/savings" element={<AdminProtectedRoute><LoanAdminPaymentStatus /></AdminProtectedRoute>} />
              <Route path="/loan-admin/payment-status" element={<Navigate to="/loan-admin/payments/loans" replace />} />
              <Route path="/loan-admin/delinquency" element={<AdminProtectedRoute><LoanAdminDelinquency /></AdminProtectedRoute>} />
              <Route path="/loan-admin/settings" element={<AdminProtectedRoute><LoanAdminSettings /></AdminProtectedRoute>} />

              {/* ========== SECRETARY ADMIN ROUTES ========== */}
              {/* Redirect /secretary-admin → /secretary-admin/dashboard */}
              <Route path="/secretary-admin" element={<Navigate to="/secretary-admin/dashboard" replace />} />

              {/* Each secretaryAdmin page embeds its own sidebar */}
              <Route path="/secretary-admin/dashboard" element={<AdminProtectedRoute><SecretaryAdminDashboard /></AdminProtectedRoute>} />
              <Route path="/secretary-admin/notifications" element={<AdminProtectedRoute><SecretaryAdminNotif /></AdminProtectedRoute>} />
              <Route path="/secretary-admin/loan-process" element={<AdminProtectedRoute><SecretaryAdminLoanProcess /></AdminProtectedRoute>} />
              <Route path="/secretary-admin/records" element={<AdminProtectedRoute><SecretaryAdminRecords /></AdminProtectedRoute>} />
              <Route path="/secretary-admin/settings" element={<AdminProtectedRoute><SecretaryAdminSettings /></AdminProtectedRoute>} />

              {/* ========== USER ROUTES ========== */}
              <Route
                element={
                  <ProtectedRoute>
                    <UserLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/home" element={<Home />} />
                <Route path="/loans" element={<Loans />} />
                <Route path="/donation" element={<Donation />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/branches" element={<Branches />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/savings" element={<Savings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/loans/:loanId" element={<LoanDetail />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
