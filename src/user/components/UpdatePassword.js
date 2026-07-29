import { useState } from 'react';


const API = import.meta.env.VITE_API_URL;

export default function UpdatePassword() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/update-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      alert('Password updated successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#161922] flex items-center justify-center p-4">
      <form onSubmit={handleUpdate} className="w-full max-w-md bg-white dark:bg-[#1E2130] rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center">Reset Password</h2>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">OTP</label>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            placeholder="6-digit OTP"
            required
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            required
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all"
          />
        </div>

        <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center text-xs">
          {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
