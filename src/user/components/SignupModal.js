import { useState, useEffect } from 'react';
import API from '../../utils/api';
import { ArrowLeft, CalendarDays, ChevronDown, Eye, EyeOff, Phone } from 'lucide-react';
import { toast } from 'sonner';

import VerifyEmailModal from '../components/VerifyEmail';
import useSwipeDownToClose from '../hooks/useSwipeDownToClose';

/* ─── Regex / Constants ─────────────────────────────────────── */
const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/;
const phoneRegex = /^\d{10}$/;
const emailLocalRegex = /^[a-zA-Z0-9._+-]+$/;
const passwordUppercase = /[A-Z]/;
const passwordLowercase = /[a-z]/;
const passwordNumber = /[0-9]/;
const passwordSymbol = /[^A-Za-z0-9]/;

const disposableDomains = [
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'throwaway.email', 'yopmail.com', 'trashmail.com', 'sharklasers.com'
];
const validDomains = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'live.com', 'msn.com', 'aol.com', 'protonmail.com', 'zoho.com', 'mail.com', 'yandex.com'
];

const MIN_AGE = 18;
const MAX_AGE = 100;
const today = new Date();
today.setHours(0, 0, 0, 0);
const maxBirthDate = new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate());
const minBirthDate = new Date(today.getFullYear() - MAX_AGE, today.getMonth(), today.getDate());

/* ─── Helpers ───────────────────────────────────────────────── */
const calculateAge = (birthDate) => {
  const dob = new Date(birthDate);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
};

/* ─── Email Validator ───────────────────────────────────────── */
const validateEmailAdvanced = (email) => {
  if (!email) return 'Email is required';
  if (/\s/.test(email)) return 'Email cannot contain spaces';
  if (!email.includes('@')) return 'Email must contain @';
  const parts = email.split('@');
  if (parts.length !== 2) return 'Email must have exactly one @';
  const [localPart, domain] = parts;
  if (!localPart) return 'Email must have a local part before @';
  if (!emailLocalRegex.test(localPart)) return 'Local part contains invalid characters';
  if (localPart.startsWith('.') || localPart.endsWith('.')) return 'Local part cannot start or end with a dot';
  if (/\.\./.test(localPart)) return 'Local part cannot have consecutive dots';
  if (localPart.length > 64) return 'Local part is too long (max 64 characters)';
  if (!domain) return 'Email must have a domain after @';
  if (domain.startsWith('.') || domain.endsWith('.')) return 'Domain cannot start or end with a dot';
  if (domain.startsWith('-') || domain.endsWith('-')) return 'Domain cannot start or end with a hyphen';
  if (!domain.includes('.')) return 'Domain must contain at least one dot';
  const domainParts = domain.split('.');
  if (domainParts.some(p => p.length === 0)) return 'Invalid domain format';
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2) return 'Invalid domain extension';
  if (/^\d+$/.test(tld)) return 'TLD cannot be all numbers';
  if (!/^[a-zA-Z0-9.-]+$/.test(domain)) return 'Domain contains invalid characters';
  const lowerDomain = domain.toLowerCase();
  if (disposableDomains.includes(lowerDomain)) return 'Disposable email addresses are not allowed';
  const isKnown = validDomains.includes(lowerDomain);
  const hasValidFormat = domainParts.length >= 2 && tld.length >= 2 && !/^\d+$/.test(tld);
  if (!isKnown && !hasValidFormat) return 'Please use a valid email domain';
  return '';
};

/* ─── Field Validators ──────────────────────────────────────── */
const validators = {
  name(value, fieldLabel) {
    if (!value?.trim()) return `${fieldLabel} is required`;
    if (value.trim().length < 2) return 'At least 2 characters required';
    if (value.length > 30) return 'Max 30 characters';
    if (!nameRegex.test(value)) return 'Letters, spaces, hyphens, or apostrophes only';
    if (/\s{2,}/.test(value)) return 'No consecutive spaces allowed';
    return '';
  },
  email: validateEmailAdvanced,
  phone(value) {
    if (!value) return 'Phone number is required';
    if (!phoneRegex.test(value)) return 'Exactly 10 digits required (e.g. 9171234567)';
    if (!/^9/.test(value)) return 'Philippine mobile numbers must start with 9';
    if (value.startsWith('0')) return 'Enter 10 digits after +63 (no leading 0)';
    return '';
  },
  gender(value) {
    if (!value) return 'Please select a gender';
    return '';
  },
  birthday(value) {
    if (!value) return 'Birthdate is required';
    const age = calculateAge(value);
    if (age < MIN_AGE) return `You must be at least ${MIN_AGE} years old`;
    if (age > MAX_AGE) return `Age must not exceed ${MAX_AGE} years`;
    return '';
  },
  community(value) {
    if (!value) return 'Please select your community';
    return '';
  },
  password(value) {
    const errs = [];
    if (!value) return ['Password is required'];
    if (value.length < 8) errs.push('At least 8 characters');
    if (value.length > 72) errs.push('Maximum 72 characters');
    if (!passwordUppercase.test(value)) errs.push('At least one uppercase letter');
    if (!passwordLowercase.test(value)) errs.push('At least one lowercase letter');
    if (!passwordNumber.test(value)) errs.push('At least one number');
    if (!passwordSymbol.test(value)) errs.push('At least one symbol (@#$%^&*)');
    return errs;
  },
  confirmPassword(value, password) {
    if (!value) return 'Confirm password is required';
    if (value !== password) return 'Passwords do not match';
    return '';
  },

};

/* ─── Region Mapping Helpers ───────────────────────────────── */
const REGION_MAP = {
  'CAR': 'Cordillera Administrative Region',
  'Region II': 'Cagayan Valley',
  'Region I': 'Ilocos Region',
  'Region III': 'Central Luzon',
  'NCR': 'National Capital Region',
  'Region IV-A': 'CALABARZON',
  'Region VII': 'Central Visayas',
  'Region XIII': 'Caraga Region',
};

const REGION_ORDER = ['CAR', 'Region II', 'Region I', 'Region III', 'NCR', 'Region IV-A', 'Region VII', 'Region XIII'];

const PROVINCE_TO_REGION_TAG = {
  'Kalinga': 'CAR', 'Abra': 'CAR', 'Benguet': 'CAR', 'Ifugao': 'CAR', 'Mountain Province': 'CAR', 'Apayao': 'CAR',
  'Isabela': 'Region II', 'Cagayan': 'Region II', 'Nueva Vizcaya': 'Region II', 'Quirino': 'Region II', 'Batanes': 'Region II',
  'Pangasinan': 'Region I', 'Ilocos Norte': 'Region I', 'Ilocos Sur': 'Region I', 'La Union': 'Region I',
  'Bulacan': 'Region III', 'Tarlac': 'Region III', 'Nueva Ecija': 'Region III', 'Pampanga': 'Region III', 'Bataan': 'Region III', 'Zambales': 'Region III', 'Aurora': 'Region III',
  'NCR': 'NCR', 'Metro Manila': 'NCR',
  'Rizal': 'Region IV-A', 'Cavite': 'Region IV-A', 'Laguna': 'Region IV-A', 'Batangas': 'Region IV-A', 'Quezon': 'Region IV-A',
  'Cebu': 'Region VII', 'Bohol': 'Region VII', 'Negros Oriental': 'Region VII', 'Siquijor': 'Region VII',
  'Agusan Del Norte': 'Region XIII', 'Agusan Del Sur': 'Region XIII', 'Surigao Del Norte': 'Region XIII', 'Surigao Del Sur': 'Region XIII', 'Dinagat Islands': 'Region XIII'
};

const NAME_TO_REGION_TAG = {
  'Paco': 'NCR', 'San Andres': 'NCR', 'Tandang Sora': 'NCR', 'Payatas': 'NCR', 'COA': 'NCR', 'Malaria': 'NCR', 'Valenzuela': 'NCR',
  'Meycauayan': 'Region III', 'Camalig': 'Region III', 'San Jose Del Monte': 'Region III', 'Pacpaco': 'Region III', 'Victoria': 'Region III', 'Bambanaba': 'Region III',
  'Tabuk': 'CAR', 'Zapote': 'CAR', 'Bliss': 'CAR', 'Libanon': 'CAR', 'Batong Buhay': 'CAR', 'Balatoc': 'CAR', 'Lat-nog': 'CAR',
  'Lamao': 'CAR', 'Lingey': 'CAR', 'Cabaruyan': 'CAR', 'Ducligan': 'CAR', 'Gangal': 'CAR', 'Bila-Bila': 'CAR', 'Naguillian': 'CAR', 'Ud-udiao': 'CAR', 'Villa Conchita': 'CAR', 'Ay-yeng Manabo': 'CAR', 'Dao-angan': 'CAR', 'Kilong-olao': 'CAR', 'Bao-yan': 'CAR', 'Amti': 'CAR', 'Danac': 'CAR', 'Bengued': 'CAR', 'Sappaac': 'CAR', 'Saccaang': 'CAR', 'Baguio': 'CAR',
  'Santiago City': 'Region II',
  'Dagupan': 'Region I', 'Mangatarem': 'Region I', 'Laoak Langka': 'Region I', 'Orbiztondo': 'Region I', 'Malasique': 'Region I', 'Taloyan': 'Region I', 'Binmaley': 'Region I', 'San Carlos': 'Region I', 'Manaoag': 'Region I', 'Pozorrobio': 'Region I', 'Alcala': 'Region I',
  'Montalban': 'Region IV-A',
  'Mandaue': 'Region VII', 'Li-loan': 'Region VII', 'Calero': 'Region VII', 'Compostela': 'Region VII',
  'Butuan City': 'Region XIII', 'RTR': 'Region XIII', 'Jabonga': 'Region XIII', 'Kasiklan': 'Region XIII', 'San Mateo': 'Region XIII', 'Fatima': 'Region XIII', 'Bayugan': 'Region XIII', 'Ibuan': 'Region XIII', 'Balubo': 'Region XIII', 'Alegria': 'Region XIII', 'Bonifacio': 'Region XIII', 'Matin-ao': 'Region XIII', 'Ipil': 'Region XIII', 'Kinabigtasan': 'Region XIII'
};

const getRegionInfoForBranch = (b) => {
  if (b.region && REGION_MAP[b.region]) return { tag: b.region, name: REGION_MAP[b.region] };
  if (b.name) {
    for (const [keyName, tag] of Object.entries(NAME_TO_REGION_TAG)) {
      if (b.name.toLowerCase().includes(keyName.toLowerCase())) return { tag, name: REGION_MAP[tag] };
    }
  }
  let province = b.province;
  if (!province && b.address) {
    const parts = b.address.split(', ');
    if (parts.length > 0) province = parts[0];
    if (parts.length > 1 && PROVINCE_TO_REGION_TAG[parts[1]]) {
      const tag = PROVINCE_TO_REGION_TAG[parts[1]];
      return { tag, name: REGION_MAP[tag] };
    }
  }
  if (province && PROVINCE_TO_REGION_TAG[province]) {
    const tag = PROVINCE_TO_REGION_TAG[province];
    return { tag, name: REGION_MAP[tag] };
  }
  if (b.address) {
    for (const tag of REGION_ORDER) {
      if (b.address.includes(tag) || b.address.includes(REGION_MAP[tag])) return { tag, name: REGION_MAP[tag] };
    }
  }
  return { tag: 'Other', name: 'Other Regions' };
};

/* ─── Communities ───────────────────────────────────────────── */
const CommunitySelect = ({ value, onChange, branches }) => {
  const grouped = branches.reduce((acc, b) => {
    const { tag, name } = getRegionInfoForBranch(b);
    const key = tag;
    const label = name ? `${tag} - ${name}` : tag;
    if (!acc[key]) acc[key] = { label, list: [] };
    acc[key].list.push(b.name);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const indexA = REGION_ORDER.indexOf(a);
    const indexB = REGION_ORDER.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <select name="community" value={value} onChange={onChange} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all appearance-none pr-8">
      <option value="">Select your Community</option>
      {sortedKeys.map(key => (
        <optgroup key={key} label={grouped[key].label}>
          {grouped[key].list.sort().map(branchName => (
            <option key={branchName} value={branchName}>{branchName}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};

/* ─── Component ─────────────────────────────────────────────── */
export default function SignupModal({ isOpen, onClose, onSwitchToLogin }) {
  const swipeProps = useSwipeDownToClose(onClose);
  const [dynamicBranches, setDynamicBranches] = useState([]);
  useEffect(() => {
    if (!isOpen) return;
    const loadBranches = async () => {
      try {
        const res = await fetch(`${API}/api/public/branches`);
        const data = await res.json();
        if (data.success) setDynamicBranches(data.branches || []);
      } catch (e) { console.error('Failed to load branches', e); }
    };
    loadBranches();
  }, [isOpen]);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    gender: '', birthday: '', community: '',
    password: '', confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [calculatedAge, setCalculatedAge] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const isAllAgreed = agreeTerms && agreePrivacy;

  if (!isOpen) return null;

  /* ── Validate single field ── */
  const validateField = (name, value, password = formData.password) => {
    let error = '';
    if (name === 'password') {
      error = validators.password(value);
    } else if (name === 'confirmPassword') {
      error = validators.confirmPassword(value, password);
    } else if (name === 'firstName' || name === 'lastName') {
      error = validators.name(value, name === 'firstName' ? 'First name' : 'Last name');
    } else if (validators[name]) {
      error = validators[name](value);
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  /* ── Handle input change ── */
  const handleChange = (e) => {
    const { name, value } = e.target;
    let sanitized = value;

    if (name === 'firstName' || name === 'lastName') {
      sanitized = value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'-]/g, '').slice(0, 30);
    }
    if (name === 'phone') {
      sanitized = value.replace(/\D/g, '').slice(0, 10);
    }

    if (name === 'birthday' && sanitized) {
      const age = calculateAge(sanitized);
      setCalculatedAge(age >= 0 && age <= MAX_AGE ? age : null);
    }

    setFormData(prev => {
      const updated = { ...prev, [name]: sanitized };
      if (name === 'password' && prev.confirmPassword) {
        validateField('confirmPassword', prev.confirmPassword, sanitized);
      }
      return updated;
    });

    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, sanitized);
  };

  /* ── Handle blur ── */
  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setLoading(true);
    try {
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
      const submitData = {
        fullName,
        email: formData.email.trim().toLowerCase(),
        phone: `+63${formData.phone}`,
        birthday: formData.birthday,
        gender: formData.gender,
        branch: formData.community,
        password: formData.password,
        role: 'member',
      };
      const response = await fetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });
      const data = await response.json();
      if (!response.ok) { toast.error(data.message || 'Registration failed'); return; }
      setRegisteredEmail(formData.email.trim().toLowerCase());
      setShowVerifyModal(true);
      toast.success('Registration successful! Please verify your email.');
    } catch (err) {
      console.error(err);
      toast.error('Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  const isFormValid =
    formData.firstName && formData.lastName && formData.email &&
    formData.phone && formData.birthday && formData.gender &&
    formData.community && formData.password && formData.confirmPassword &&
    Object.entries(errors).every(([, err]) => {
      return Array.isArray(err) ? err.length === 0 : !err;
    }) &&
    isAllAgreed;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div 
        ref={swipeProps.containerRef}
        onTouchStart={swipeProps.handleTouchStart}
        onTouchMove={swipeProps.handleTouchMove}
        onTouchEnd={swipeProps.handleTouchEnd}
        style={swipeProps.dragStyle}
        className="relative w-full max-w-2xl bg-white dark:bg-[#1E2130] rounded-t-3xl rounded-b-none sm:rounded-2xl p-6 sm:p-8 shadow-2xl border-t sm:border border-slate-200 dark:border-white/10 max-h-[88vh] sm:max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] my-0 sm:my-auto animate-mobile-slide-up" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Mobile Pull Handle Indicator */}
        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-2 sm:hidden" />

        {/* BACK BUTTON */}
        <button onClick={onClose} className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full transition-colors" type="button">
          <ArrowLeft size={20} />
        </button>

        {/* HEADER */}
        <div className="text-center mb-6 pt-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create Your Account</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Join our church community today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

          {/* ROW 1: First Name + Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="firstName" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">First Name:</label>
              <input
                id="firstName" name="firstName"
                value={formData.firstName}
                onChange={handleChange} onBlur={handleBlur}
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border ${touched.firstName && errors.firstName ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:ring-blue-600'} rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 transition-all`}
                placeholder="Enter your first name"
                autoComplete="given-name"
              />
              {touched.firstName && errors.firstName && (
                <span className="text-[11px] text-red-500 font-medium block">{errors.firstName}</span>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="lastName" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Last Name:</label>
              <input
                id="lastName" name="lastName"
                value={formData.lastName}
                onChange={handleChange} onBlur={handleBlur}
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border ${touched.lastName && errors.lastName ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:ring-blue-600'} rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 transition-all`}
                placeholder="Enter your last name"
                autoComplete="family-name"
              />
              {touched.lastName && errors.lastName && (
                <span className="text-[11px] text-red-500 font-medium block">{errors.lastName}</span>
              )}
            </div>
          </div>

          {/* ROW 2: Email + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Email:</label>
              <input
                id="email" name="email" type="email"
                value={formData.email}
                onChange={handleChange} onBlur={handleBlur}
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border ${touched.email && errors.email ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:ring-blue-600'} rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 transition-all`}
                placeholder="your.email@example.com"
                autoComplete="email"
              />
              {touched.email && errors.email && (
                <span className="text-[11px] text-red-500 font-medium block">{errors.email}</span>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Phone Number:</label>
              <div className="relative flex items-center">
                <Phone className="absolute left-3 text-slate-400 w-4 h-4 pointer-events-none" />
                <span className="absolute left-9 text-xs font-semibold text-slate-500 dark:text-slate-400">+63</span>
                <input
                  id="phone" name="phone" type="tel"
                  value={formData.phone}
                  onChange={handleChange} onBlur={handleBlur}
                  className={`w-full pl-16 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border ${touched.phone && errors.phone ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:ring-blue-600'} rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 transition-all`}
                  placeholder="917 123 4567"
                  autoComplete="tel"
                />
              </div>
              {touched.phone && errors.phone && (
                <span className="text-[11px] text-red-500 font-medium block">{errors.phone}</span>
              )}
            </div>
          </div>

          {/* ROW 3: Birthday + Community */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* BIRTHDAY */}
            <div className="space-y-1">
              <label htmlFor="birthday" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Birthday:</label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                <input
                  id="birthday" type="date" name="birthday"
                  value={formData.birthday}
                  onChange={handleChange} onBlur={handleBlur}
                  onKeyDown={e => e.preventDefault()}
                  min={minBirthDate.toISOString().split('T')[0]}
                  max={maxBirthDate.toISOString().split('T')[0]}
                  className={`w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border ${touched.birthday && errors.birthday ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:ring-blue-600'} rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 transition-all`}
                  placeholder="MM-DD-YYYY"
                  autoComplete="bday"
                />
              </div>
              {touched.birthday && errors.birthday && (
                <span className="text-[11px] text-red-500 font-medium block">{errors.birthday}</span>
              )}
              {touched.birthday && !errors.birthday && calculatedAge !== null && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block">✓ Age: {calculatedAge}</span>
              )}
            </div>

            {/* COMMUNITY */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Community:</label>
              <div className="relative">
                <CommunitySelect value={formData.community} onChange={handleChange} branches={dynamicBranches} />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              </div>
              {touched.community && errors.community && (
                <span className="text-[11px] text-red-500 font-medium block">{errors.community}</span>
              )}
            </div>
          </div>

          {/* ROW 4: Gender Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Gender:</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ].map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                    formData.gender === value
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                    formData.gender === value 
                      ? 'border-blue-600 bg-blue-600' 
                      : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700'
                  }`}>
                    {formData.gender === value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <input
                    type="radio"
                    name="gender"
                    value={value}
                    checked={formData.gender === value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="sr-only"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            {touched.gender && errors.gender && (
              <span className="text-[11px] text-red-500 font-medium block">{errors.gender}</span>
            )}
          </div>



          {/* Password Requirements Box */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 space-y-1.5">
            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Password must include:</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
              <li className={!formData.password ? 'text-slate-400' : (formData.password.length >= 8 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-500')}>
                ✓ Minimum 8 characters
              </li>
              <li className={!formData.password ? 'text-slate-400' : (passwordUppercase.test(formData.password) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-500')}>
                ✓ At least 1 uppercase letter (A–Z)
              </li>
              <li className={!formData.password ? 'text-slate-400' : (passwordLowercase.test(formData.password) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-500')}>
                ✓ At least 1 lowercase letter (a–z)
              </li>
              <li className={!formData.password ? 'text-slate-400' : (passwordNumber.test(formData.password) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-500')}>
                ✓ At least 1 number
              </li>
              <li className={!formData.password ? 'text-slate-400' : (passwordSymbol.test(formData.password) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-500')}>
                ✓ At least 1 symbol (@ # $ % * _)
              </li>
            </ul>
          </div>

          {/* ROW 4: Password + Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Password:</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange} onBlur={handleBlur}
                  className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Create a password"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Confirm Password:</label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange} onBlur={handleBlur}
                  className={`w-full pl-3.5 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/60 border ${touched.confirmPassword && errors.confirmPassword ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:ring-blue-600'} rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2`}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirmPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {touched.confirmPassword && errors.confirmPassword && (
                <span className="text-[11px] text-red-500 font-medium block">{errors.confirmPassword}</span>
              )}
            </div>
          </div>

          {/* TERMS */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              checked={isAllAgreed}
              onChange={(e) => {
                const checked = e.target.checked;
                setAgreeTerms(checked);
                setAgreePrivacy(checked);
              }}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <label className="text-xs text-slate-600 dark:text-slate-400">
              I agree to the{' '}
              <button type="button" onClick={() => setShowTerms(true)} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Terms and Conditions</button>
              {' and '}
              <button type="button" onClick={() => setShowPrivacy(true)} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</button>
            </label>
          </div>

          {/* SUBMIT */}
          <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center text-xs" disabled={!isFormValid || loading}>
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : 'Create Account'}
          </button>
        </form>

        {/* TERMS MODAL */}
        {showTerms && (
          <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowTerms(false)}>
            <div className="relative w-full max-w-xl bg-white dark:bg-[#1E2130] rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-4">
                <h3 className="font-bold text-slate-900 dark:text-white">Terms & Conditions</h3>
                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xl" onClick={() => setShowTerms(false)}>&times;</button>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
                <ol className="list-decimal pl-4 space-y-2">
                  <li><strong>Acceptance of Terms</strong><br />By accessing and using IsangDiwa, you agree to comply with these Terms and Conditions.</li>
                  <li><strong>Purpose of the System</strong><br />IsangDiwa is designed to facilitate transparent management of church-related financial records and loan requests.</li>
                  <li><strong>Authorized Users</strong><br />Only registered and approved church members, officers, and administrators are permitted to access IsangDiwa.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* PRIVACY MODAL */}
        {showPrivacy && (
          <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPrivacy(false)}>
            <div className="relative w-full max-w-xl bg-white dark:bg-[#1E2130] rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-4">
                <h3 className="font-bold text-slate-900 dark:text-white">Privacy Policy</h3>
                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xl" onClick={() => setShowPrivacy(false)}>&times;</button>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
                <ol className="list-decimal pl-4 space-y-2">
                  <li><strong>Data Collection</strong><br />IsangDiwa collects personal information necessary for membership and administrative purposes.</li>
                  <li><strong>Data Protection</strong><br />All personal data is processed in accordance with applicable data privacy regulations.</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      {showVerifyModal && (
        <VerifyEmailModal isOpen={showVerifyModal} onClose={() => setShowVerifyModal(false)} email={registeredEmail} />
      )}
    </div>
  );
}