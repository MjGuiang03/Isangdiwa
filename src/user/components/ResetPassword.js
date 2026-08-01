import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { Mail, Lock, ArrowLeft, Eye, EyeOff, X, AlertTriangle, CheckCircle } from "lucide-react";
import puacLogo from "../../assets/puaclogo.png";
import useSwipeDownToClose from "../hooks/useSwipeDownToClose";


const RULES = [
  { key: "lower", label: "At least one lowercase letter", test: v => /[a-z]/.test(v) },
  { key: "upper", label: "At least one uppercase letter", test: v => /[A-Z]/.test(v) },
  { key: "number", label: "At least one number",          test: v => /[0-9]/.test(v) },
  { key: "symbol", label: "At least one symbol",          test: v => /[^A-Za-z0-9]/.test(v) },
  { key: "min8",   label: "Minimum 8 characters",         test: v => v.length >= 8 },
];

function allRulesPass(p) { return RULES.every(r => r.test(p)); }

/* ── Password rules checklist ── */
function PasswordRules({ password }) {
  return (
    <ul className="user-reset-rules-list">
      {RULES.map(rule => {
        const ok = rule.test(password);
        return (
          <li key={rule.key} className={`user-reset-rule ${ok ? "user-reset-rule-pass" : "user-reset-rule-fail"}`}>
            <span className="user-reset-rule-icon">{ok ? "✓" : "✗"}</span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

/* ── Rate-limit countdown banner ── */
function RateLimitBanner({ seconds, onExpire }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const t = setInterval(() => {
      setRemaining(prev => { if (prev <= 1) { clearInterval(t); onExpire(); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [onExpire, remaining]);

  const m = Math.floor(remaining / 60), s = remaining % 60;

  return (
    <div className="user-reset-alert-banner user-reset-alert-warning">
      <div className="user-reset-alert-banner::before" />
      <div className="user-reset-alert-body">
        <div className="user-reset-alert-icon user-reset-alert-icon-warning">
          <AlertTriangle size={16} />
        </div>
        <div className="user-reset-alert-content">
          <span className="user-reset-alert-heading user-reset-alert-heading-warning">Too many attempts</span>
          <span className="user-reset-alert-message user-reset-alert-message-warning">
            Please wait <strong>{m > 0 ? `${m}m ${s}s` : `${s}s`}</strong> before trying again.
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main component
   Props (modal mode):   isOpen, onClose
   Props (page mode):    neither — standalone
═══════════════════════════════════════════ */
export default function ResetPassword({ isOpen, onClose }) {
  const navigate  = useNavigate();
  const { resetPassword, verifyResetOTP, updatePasswordWithOTP } = useAuth();

  const [step,            setStep]            = useState(1);
  const [email,           setEmail]           = useState("");
  const [otp,             setOtp]             = useState(["","","","","",""]);
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [rateLimitSecs,   setRateLimitSecs]   = useState(0);
  const [successMsg,      setSuccessMsg]      = useState("");

  const otpRefs = useRef([]);

  /* detect modal vs page mode */
  const isModal = typeof isOpen !== "undefined";

  const handleClose = () => {
    if (isModal && onClose) onClose();
    else navigate("/login");
  };

  const swipeProps = useSwipeDownToClose(handleClose);

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
    else handleClose();
  };

  const withRateLimit = async fn => {
    setRateLimitSecs(0);
    try {
      const result = await fn();
      if (result?.retryAfter) { setRateLimitSecs(result.retryAfter); return { success: false }; }
      return result;
    } catch (err) {
      if (err?.retryAfter) setRateLimitSecs(err.retryAfter);
      return { success: false };
    }
  };

  /* Step 1 — send email */
  const handleEmailSubmit = async e => {
    e?.preventDefault();
    if (rateLimitSecs > 0) return;
    setLoading(true);
    const result = await withRateLimit(() => resetPassword(email));
    if (result.success) setStep(2);
    setLoading(false);
  };

  /* OTP helpers */
  const handleOTPChange = (i, val) => {
    if (isNaN(val)) return;
    const next = [...otp]; next[i] = val; setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  };
  const handleOTPKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };
  const handleOTPPaste = e => {
    e.preventDefault();
    const chars = e.clipboardData.getData("text").slice(0, 6).split("");
    while (chars.length < 6) chars.push("");
    setOtp(chars);
    otpRefs.current[5]?.focus();
  };

  /* Step 2 — verify OTP */
  const handleOTPSubmit = async e => {
    e.preventDefault();
    if (rateLimitSecs > 0) return;
    setLoading(true);
    const result = await withRateLimit(() => verifyResetOTP(email, otp.join("")));
    if (result.success) setStep(3);
    setLoading(false);
  };

  /* Step 3 — new password */
  const handlePasswordSubmit = async e => {
    e.preventDefault();
    if (!allRulesPass(newPassword) || newPassword !== confirmPassword) return;
    setLoading(true);
    const result = await withRateLimit(() => updatePasswordWithOTP(email, otp.join(""), newPassword));
    if (result.success) {
      setSuccessMsg("Password updated successfully!");
      setTimeout(() => { handleClose(); }, 1800);
    }
    setLoading(false);
  };

  /* ── shared step labels ── */
  const steps = ["Email", "Verify", "Password"];

  /* ── inner content per step ── */
  const renderContent = () => {
    /* ─ Step 1 ─ */
    if (step === 1) return (
      <>
        <div className="text-center mb-6">
          <img src={puacLogo} alt="IsangDiwa Logo" className="h-12 w-auto mx-auto mb-2 object-contain" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Reset Password</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enter your email and we'll send you a verification code</p>
        </div>

        {rateLimitSecs > 0 && <RateLimitBanner seconds={rateLimitSecs} onExpire={() => setRateLimitSecs(0)} />}

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3 text-slate-400 w-4 h-4 pointer-events-none" />
              <input
                type="email"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading || rateLimitSecs > 0}
              />
            </div>
          </div>

          <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center text-xs" disabled={loading || rateLimitSecs > 0}>
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : "Send Verification Code"}
          </button>
        </form>
      </>
    );

    /* ─ Step 2 ─ */
    if (step === 2) return (
      <>
        <div className="text-center mb-6">
          <img src={puacLogo} alt="IsangDiwa Logo" className="h-12 w-auto mx-auto mb-2 object-contain" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Enter Verification Code</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">We sent a 6-digit code to <strong>{email}</strong></p>
        </div>

        {rateLimitSecs > 0 && <RateLimitBanner seconds={rateLimitSecs} onExpire={() => setRateLimitSecs(0)} />}

        <form onSubmit={handleOTPSubmit} className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => (otpRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength="1"
                value={digit}
                onChange={e => handleOTPChange(i, e.target.value)}
                onKeyDown={e => handleOTPKeyDown(i, e)}
                onPaste={handleOTPPaste}
                className="w-10 h-12 text-center text-lg font-bold bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                disabled={loading || rateLimitSecs > 0}
              />
            ))}
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={handleEmailSubmit}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              disabled={loading || rateLimitSecs > 0}
            >
              Didn't receive a code? <span className="font-bold">Resend</span>
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center text-xs"
            disabled={loading || rateLimitSecs > 0 || otp.join("").length < 6}
          >
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : "Verify Code"}
          </button>
        </form>
      </>
    );

    /* ─ Step 3 ─ */
    return (
      <>
        <div className="text-center mb-6">
          <img src={puacLogo} alt="IsangDiwa Logo" className="h-12 w-auto mx-auto mb-2 object-contain" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Create New Password</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Make it strong and memorable</p>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">New Password</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 text-slate-400 w-4 h-4 pointer-events-none" />
              <input
                type={showNew ? "text" : "password"}
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={loading}
              />
              <button type="button" className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-white" onClick={() => setShowNew(v => !v)} disabled={loading}>
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {newPassword && <PasswordRules password={newPassword} />}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Confirm Password</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 text-slate-400 w-4 h-4 pointer-events-none" />
              <input
                type={showConfirm ? "text" : "password"}
                className={`w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/60 border ${confirmPassword && confirmPassword !== newPassword ? "border-red-500" : "border-slate-200 dark:border-white/10 focus:ring-blue-600"} rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 transition-all`}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={loading}
              />
              <button type="button" className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-white" onClick={() => setShowConfirm(v => !v)} disabled={loading}>
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-[11px] text-red-500 font-medium">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center text-xs"
            disabled={loading || !allRulesPass(newPassword) || newPassword !== confirmPassword}
          >
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : "Update Password"}
          </button>
        </form>
      </>
    );
  };

  /* ── Modal wrapper ── */
  const card = (
    <div
      ref={isModal ? swipeProps.containerRef : undefined}
      onTouchStart={isModal ? swipeProps.handleTouchStart : undefined}
      onTouchMove={isModal ? swipeProps.handleTouchMove : undefined}
      onTouchEnd={isModal ? swipeProps.handleTouchEnd : undefined}
      style={isModal ? swipeProps.dragStyle : undefined}
      className={`relative w-full max-w-md bg-white dark:bg-[#1E2130] p-6 sm:p-8 shadow-2xl border-slate-200 dark:border-white/10 ${
        isModal
          ? "rounded-t-3xl rounded-b-none sm:rounded-2xl border-t sm:border my-0 sm:my-auto max-h-[85vh] sm:max-h-none overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] animate-mobile-slide-up"
          : "rounded-2xl border my-auto"
      }`}
      onClick={e => e.stopPropagation()}
    >
      {/* Mobile Pull Handle Indicator */}
      {isModal && <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />}

      {/* Top nav: back arrow + step indicator + close */}
      <div className="relative flex items-center justify-center mb-6 pb-2 border-b border-slate-100 dark:border-white/5 min-h-[32px]">
        {step > 1 && (
          <button className="absolute left-0 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full transition-colors" onClick={handleBack} type="button">
            <ArrowLeft size={18} />
          </button>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-2 mx-auto">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${i + 1 < step ? "bg-emerald-500 text-white" : i + 1 === step ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                {i + 1 < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs font-semibold ${i + 1 === step ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>{label}</span>
              {i < steps.length - 1 && <div className={`w-3 h-0.5 ${i + 1 < step ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`} />}
            </div>
          ))}
        </div>

        {isModal && (
          <button className="absolute right-0 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full transition-colors" onClick={handleClose} type="button">
            <X size={18} />
          </button>
        )}
      </div>

      {renderContent()}
    </div>
  );

  /* Modal mode */
  if (isModal) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto" onClick={handleClose}>
        {card}
      </div>
    );
  }

  /* Standalone page mode */
  return <div className="min-h-screen bg-slate-100 dark:bg-[#161922] flex items-center justify-center p-4">{card}</div>;
}