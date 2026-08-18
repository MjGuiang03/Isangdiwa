import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import puacLogo from '../../assets/optimized/puaclogo.webp';
import useSwipeDownToClose from '../hooks/useSwipeDownToClose';

// Change the function signature to accept optional override props:
export default function VerifyEmailModal({ isOpen, onClose, email, onVerify, onResend }) {
  const navigate = useNavigate();
  const { verifyOTP, resendOTP } = useAuth();
  const swipeProps = useSwipeDownToClose(onClose);

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null)
  ];

  useEffect(() => {
    if (isOpen) {
      // Focus first input when modal opens
      if (inputRefs[0].current) {
        inputRefs[0].current.focus();
      }
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Re-enable body scroll
      document.body.style.overflow = '';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleChange = (index, value) => {
  // Strip anything non-numeric, take only last char
  const sanitized = value.replace(/\D/g, '').slice(-1);
  if (value && !sanitized) return;

  const newOtp = [...otp];
  newOtp[index] = sanitized;
  setOtp(newOtp);
  setError('');

  if (sanitized && index < 5) {
    inputRefs[index + 1].current?.focus();
  }
};

  const handleKeyDown = (index, e) => {
    
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
    
    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const digits = text.replace(/\D/g, '').slice(0, 6).split('');
        const newOtp = [...otp];
        digits.forEach((digit, i) => {
          if (i < 6) newOtp[i] = digit;
        });
        setOtp(newOtp);
        if (digits.length > 0) {
          inputRefs[Math.min(digits.length, 5)].current?.focus();
        }
      });
    }
  };

  const handleVerify = async (e) => {
  e.preventDefault();

  const otpString = otp.join('');
  if (otpString.length !== 6) { setError('Please enter all 6 digits'); return; }

  setLoading(true);
  setError('');

  // If a custom onVerify is passed (e.g. from Settings), use it
  if (onVerify) {
    const result = await onVerify(otpString);
    if (result.success) {
      setSuccess(true);
      toast.success('Verified successfully!');
      setTimeout(() => onClose(), 1500);
    } else {
      setError(result.message || 'Invalid or expired OTP');
      setOtp(['', '', '', '', '', '']);
      inputRefs[0].current?.focus();
    }
    setLoading(false);
    return;
  }

  // Default behavior (signup flow)
  const result = await verifyOTP(email, otpString);
  if (result.success) {
    setSuccess(true);
    toast.success('Email verified successfully!');
    setTimeout(() => { onClose(); navigate('/login'); }, 1500);
  } else {
    setError(result.error?.message || 'Invalid or expired OTP');
    toast.error('Verification failed');
    setOtp(['', '', '', '', '', '']);
    inputRefs[0].current?.focus();
  }
  setLoading(false);
};

  const handleResend = async () => {
  setResendLoading(true);
  setError('');
  setOtp(['', '', '', '', '', '']);

  // If a custom onResend is passed (e.g. from Settings), use it
  const result = onResend ? await onResend() : await resendOTP(email, 'email');

  if (result?.success) {
    toast.success('New OTP sent to your email');
  } else {
    toast.error(result?.message || 'Failed to resend OTP. Please try again.');
  }

  setResendLoading(false);
  inputRefs[0].current?.focus();
};



  if (!isOpen) return null;

  if (success) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white dark:bg-[#1E2130] rounded-2xl p-8 shadow-2xl border border-slate-200 dark:border-white/10 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Verification Successful!</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">Your email has been verified.</p>
          <p className="text-xs text-slate-400 mt-1">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div 
        ref={swipeProps.containerRef}
        onTouchStart={swipeProps.handleTouchStart}
        onTouchMove={swipeProps.handleTouchMove}
        onTouchEnd={swipeProps.handleTouchEnd}
        style={swipeProps.dragStyle}
        className="relative w-full max-w-md bg-white dark:bg-[#1E2130] rounded-t-3xl rounded-b-none sm:rounded-2xl p-6 sm:p-8 shadow-2xl border-t sm:border border-slate-200 dark:border-white/10 text-center animate-mobile-slide-up" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-2 sm:hidden" />
        {onClose && (
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full transition-colors" type="button" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        )}
        
        <div className="mb-6">
          <img src={puacLogo} alt="IsangDiwa Logo" className="h-12 w-auto mx-auto mb-3 object-contain" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Enter Verification Code</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            We sent a 6-digit code to your email
          </p>
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1">{email}</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`w-10 h-12 text-center text-lg font-bold bg-slate-50 dark:bg-slate-800/60 border ${error ? 'border-red-500' : digit ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-white/10'} rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all`}
                disabled={loading || success}
                autoComplete="off"
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-red-500 font-medium">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center text-xs"
            disabled={loading || otp.join('').length !== 6}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              'Verify Email'
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Didn't receive the code?</p>
          
          <button 
            type="button"
            onClick={handleResend}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
            disabled={resendLoading || loading}
          >
            {resendLoading ? 'Resending code...' : 'Resend Code'}
          </button>

          <p className="text-[11px] text-slate-400">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
