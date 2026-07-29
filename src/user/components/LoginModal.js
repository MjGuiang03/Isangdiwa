import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, X, AlertTriangle } from 'lucide-react';
import useSwipeDownToClose from '../hooks/useSwipeDownToClose';

// Valid email domains list
const validDomains = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'live.com', 'msn.com', 'aol.com', 'protonmail.com', 'zoho.com',
  'mail.com', 'yandex.com'
];

// Enhanced Email Validation
const validateEmailAdvanced = (email) => {
  if (!email) return '';
  if (/\s/.test(email)) return 'Email cannot contain spaces';
  if (!email.includes('@')) return 'Email must contain @';

  const parts = email.split('@');
  if (parts.length !== 2) return 'Email must have exactly one @';

  const [localPart, domain] = parts;

  if (!localPart || localPart.length === 0) return 'Email must have a local part before @';
  if (!/^[a-zA-Z0-9._-]+$/.test(localPart)) return 'Local part contains invalid characters';
  if (localPart.startsWith('.') || localPart.endsWith('.')) return 'Local part cannot start or end with a dot';
  if (/\.\./.test(localPart)) return 'Local part cannot have consecutive dots';

  if (!domain || domain.length === 0) return 'Email must have a domain after @';
  if (domain.startsWith('.') || domain.endsWith('.')) return 'Domain cannot start or end with a dot';
  if (!domain.includes('.')) return 'Domain must contain at least one dot';

  const domainParts = domain.split('.');
  if (domainParts.some(part => part.length === 0)) return 'Invalid domain format';

  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2) return 'Invalid domain extension';
  if (!/^[a-zA-Z0-9.-]+$/.test(domain)) return 'Domain contains invalid characters';
  if (domainParts.length < 2) return 'Please use a complete domain (e.g., example.com)';

  const isKnownDomain = validDomains.includes(domain.toLowerCase());
  const hasValidFormat = domainParts.length >= 2 && tld.length >= 2 && !/^\d+$/.test(tld);

  if (!isKnownDomain && !hasValidFormat) return 'Please use a valid email domain';

  return '';
};

export default function LoginModal({ isOpen = true, onClose, onSwitchToSignup, onSwitchToReset, embedded = false }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const swipeProps = useSwipeDownToClose(onClose);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  const [isLocked, setIsLocked] = useState(false);
  const [isPermanentlyLocked, setIsPermanentlyLocked] = useState(false);
  const [recommendReset, setRecommendReset] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);

  const timerRef = useRef(null);

  const startCountdown = (seconds) => {
    if (timerRef.current) clearInterval(timerRef.current);

    setLockTimeRemaining(seconds);
    setIsLocked(true);

    timerRef.current = setInterval(() => {
      setLockTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setIsLocked(false);
          setRecommendReset(false);
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(validateEmailAdvanced(value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLocked || isPermanentlyLocked) return;

    const emailValidationError = validateEmailAdvanced(email);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      return;
    }

    setLoading(true);

    const result = await signIn(email, password);

    if (result.success) {
      setIsLocked(false);
      setIsPermanentlyLocked(false);
      setRecommendReset(false);
      setLockTimeRemaining(0);
      if (timerRef.current) clearInterval(timerRef.current);

      if (onClose) onClose();

      const role = result.role || 'user';
      if (role === 'admin') {
        navigate('/admin/dashboard');
      } else if (role === 'loanAdmin' || role === 'loan') {
        navigate('/loan-admin/dashboard');
      } else if (role === 'secretaryAdmin' || role === 'secretary') {
        navigate('/secretary-admin/dashboard');
      } else {
        navigate('/home');
      }
    } else {
      const data = result.data || {};

      if (data.permanent) {
        setIsPermanentlyLocked(true);
        setIsLocked(false);
        setError(
          data.message ||
          'Your account has been permanently locked. Please reset your password to regain access.'
        );
      } else if (data.locked && data.remainingSeconds) {
        setRecommendReset(!!data.recommendReset);
        startCountdown(data.remainingSeconds);
        setError(data.message || 'Account locked. Please wait before trying again.');
      } else {
        setError(result.message || data.message || 'Invalid email or password.');
      }
    }

    setLoading(false);
  };

  const handleForgotPassword = () => {
    if (embedded && onSwitchToReset) {
      onSwitchToReset();
    } else {
      if (onClose) onClose();
      navigate('/reset-password');
    }
  };

  const getButtonLabel = () => {
    if (loading) return <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />;
    if (isPermanentlyLocked) return 'Account Locked';
    if (isLocked) return `Locked (${formatTime(lockTimeRemaining)})`;
    return 'Login';
  };

  const inputDisabled = loading || isLocked || isPermanentlyLocked;
  const buttonDisabled = inputDisabled || !!emailError;

  const getAlertHeading = () => {
    if (isPermanentlyLocked) return 'Account Permanently Locked';
    if (isLocked) return 'Account Temporarily Locked';
    return 'Sign-in Failed';
  };

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* EMAIL */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Email Address</label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="email"
            value={email}
            onChange={handleEmailChange}
            className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border ${emailError ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 dark:border-white/10 focus:ring-blue-600'} rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 transition-all`}
            placeholder="yourname@email.com"
            required
            disabled={inputDisabled}
          />
        </div>
        {emailError && <span className="text-xs text-red-500 font-medium block">{emailError}</span>}
      </div>

      {/* PASSWORD */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Password</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all"
            placeholder="••••••••"
            required
            disabled={inputDisabled}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            disabled={inputDisabled}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ALERT BANNER */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1 text-red-700 dark:text-red-300">
            <span className="font-bold block">{getAlertHeading()}</span>
            <p>{error}</p>
            {isLocked && lockTimeRemaining > 0 && (
              <div className="font-semibold text-red-800 dark:text-red-200 pt-1">
                Try again in {formatTime(lockTimeRemaining)}
              </div>
            )}
            {(isPermanentlyLocked || recommendReset) && (
              <button
                type="button"
                className="underline font-bold text-red-800 dark:text-red-200 hover:text-red-900 pt-1 block"
                onClick={handleForgotPassword}
              >
                Reset your password
              </button>
            )}
          </div>
        </div>
      )}

      {/* FORGOT PASSWORD */}
      <div className="flex justify-end">
        <button
          type="button"
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          onClick={handleForgotPassword}
        >
          Forgot password?
        </button>
      </div>

      {/* SUBMIT */}
      <button
        type="submit"
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center"
        disabled={buttonDisabled}
      >
        {getButtonLabel()}
      </button>

      {/* DIVIDER */}
      <div className="relative my-4 text-center">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-white/10"></div></div>
        <span className="relative px-3 bg-white dark:bg-[#1E2130] text-xs text-slate-400 uppercase tracking-wider">or</span>
      </div>

      {/* SWITCH TO SIGN UP */}
      <p className="text-center text-xs text-slate-600 dark:text-slate-400">
        Don't have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Sign Up
        </button>
      </p>
    </form>
  );

  if (embedded) {
    return (
      <div className="w-full bg-white dark:bg-[#1E2130] rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-white/10">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-3">Welcome Back</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sign in to access your account</p>
        </div>
        {renderForm()}
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div 
        ref={swipeProps.containerRef}
        onTouchStart={swipeProps.handleTouchStart}
        onTouchMove={swipeProps.handleTouchMove}
        onTouchEnd={swipeProps.handleTouchEnd}
        style={swipeProps.dragStyle}
        className="relative w-full max-w-md bg-white dark:bg-[#1E2130] rounded-t-3xl rounded-b-none sm:rounded-2xl p-6 sm:p-8 shadow-2xl border-t sm:border border-slate-200 dark:border-white/10 my-0 sm:my-auto max-h-[85vh] sm:max-h-none overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] animate-mobile-slide-up" 
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Mobile Pull Handle Indicator */}
        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-2">Welcome Back</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sign in to access your account</p>
        </div>

        {renderForm()}
      </div>
    </div>
  );
}