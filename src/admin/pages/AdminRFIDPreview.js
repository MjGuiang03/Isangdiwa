import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import API from '../../utils/api';
import { Play, Square, X, ArrowLeft, Radio, CheckCircle2, ShieldCheck, UserCheck } from 'lucide-react';
import QRCode from 'react-qr-code';

function StartServiceModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    branch: 'Bulacan Main',
    serviceType: 'Sunday Worship',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().substring(0, 5),
    gracePeriod: 15
  });
  const [saving, setSaving] = useState(false);

  const serviceTypes = [
    'Sunday Worship', 'Bible Study', 'Prayer Meeting', 'Youth Service', 'Midweek Service', 'Special Event'
  ];

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.branch || !form.serviceType || !form.date || !form.time) {
      return toast.error('Please fill all required fields');
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API}/api/admin/attendance/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success('Service session started! Scanner is active.');
      onSave();
    } catch (err) {
      toast.error(err.message || 'Failed to start session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200/80 dark:border-white/10 flex flex-col overflow-hidden font-inter space-y-0" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center shrink-0 shadow-xs">
              <Play size={22} />
            </div>
            <div>
              <h2 className="m-0 font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">Start Service Session</h2>
              <p className="m-0 text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">Initialize live RFID & QR check-in terminal</p>
            </div>
          </div>
          <button 
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors flex items-center justify-center border-none cursor-pointer" 
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Branch / Community</label>
            <select 
              name="branch" 
              value={form.branch} 
              onChange={handleChange} 
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              <optgroup label="Kalinga">
                <option>Tabuk</option><option>Zapote</option><option>Bliss</option>
                <option>Libanon</option><option>Batong Buhay</option><option>Balatoc</option><option>Lat-nog</option>
              </optgroup>
              <optgroup label="Isabela"><option>Santiago City</option></optgroup>
              <optgroup label="Abra">
                <option>Lamao</option><option>Lingey</option><option>Cabaruyan</option><option>Ducligan</option>
                <option>Gangal</option><option>Bila-Bila</option><option>Naguillian</option><option>Ud-udiao</option>
                <option>Villa Conchita</option><option>Ay-yeng Manabo</option><option>Dao-angan</option>
                <option>Kilong-olao</option><option>Bao-yan</option><option>Amti</option><option>Danac</option>
                <option>Bengued</option><option>Sappaac</option><option>Saccaang</option>
              </optgroup>
              <optgroup label="Benguet"><option>Baguio</option></optgroup>
              <optgroup label="Rizal"><option>Montalban</option></optgroup>
              <optgroup label="NCR">
                <option>Valenzuela City</option><option>Tandang Sora, Quezon City</option>
                <option>COA, Quezon City</option><option>Payatas, Quezon City</option><option>Malaria, Caloocan</option>
              </optgroup>
              <optgroup label="Bulacan">
                <option>Meycauayan City</option><option>Camalig</option><option>San Jose Del Monte</option>
              </optgroup>
              <optgroup label="Tarlac">
                <option>Pacpaco, San Manuel</option><option>Victoria</option>
              </optgroup>
              <optgroup label="Nueva Ecija"><option>Bambanaba, Cuyapo</option></optgroup>
              <optgroup label="Pangasinan">
                <option>Dagupan</option><option>Mangatarem</option><option>Laoak Langka</option>
                <option>Orbiztondo</option><option>Malasiqui, Bolaoit</option><option>Taloyan</option>
                <option>Binmaley</option><option>San Carlos</option><option>Manaoag</option>
                <option>Pozorrubio</option><option>Alcala</option>
              </optgroup>
              <optgroup label="Agusan Del Norte">
                <option>Butuan City</option><option>RTR</option><option>Jabonga, Bangonay</option>
                <option>Kasiklan</option><option>San Mateo</option><option>Fatima Kim.13</option>
                <option>Bayugan</option><option>Ibuan</option><option>Balubo</option>
              </optgroup>
              <optgroup label="Cebu">
                <option>Mandaue</option><option>Liloan</option><option>Calero</option><option>Compostela</option>
              </optgroup>
              <optgroup label="Surigao Del Norte">
                <option>Alegria</option><option>Bonifacio</option><option>Matin-ao</option><option>Ipil</option>
              </optgroup>
              <optgroup label="Surigao Del Sur"><option>Kinabigtasan, Tago</option></optgroup>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Service Type</label>
            <select 
              name="serviceType" 
              value={form.serviceType} 
              onChange={handleChange} 
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              {serviceTypes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Date</label>
              <input 
                type="date" 
                name="date" 
                value={form.date} 
                onChange={handleChange} 
                min={new Date().toISOString().split('T')[0]} 
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Time</label>
              <input 
                type="time" 
                name="time" 
                value={form.time} 
                onChange={handleChange} 
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-black/20 flex items-center justify-end gap-3">
          <button 
            className="h-10 px-5 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer" 
            onClick={onClose} 
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            className="h-10 px-5 rounded-xl text-xs font-bold border-none bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all cursor-pointer flex items-center gap-2" 
            onClick={handleSubmit} 
            disabled={saving}
          >
            {saving ? 'Starting...' : 'Start Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EndSessionModal({ onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-3xl w-full max-w-md shadow-2xl border border-slate-200/80 dark:border-white/10 flex flex-col overflow-hidden font-inter space-y-0" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 flex items-center justify-center shrink-0 shadow-xs">
              <Square size={22} />
            </div>
            <div>
              <h2 className="m-0 font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">End Service Session</h2>
              <p className="m-0 text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">Conclude check-ins & tally absences</p>
            </div>
          </div>
          <button 
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors flex items-center justify-center border-none cursor-pointer" 
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Message */}
        <div className="p-6">
          <div className="bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 rounded-2xl p-4 text-xs sm:text-sm text-rose-800 dark:text-rose-300 leading-relaxed">
            Ending this session will stop accepting new check-ins. All unregistered members from this branch will automatically be marked as <strong>Absent</strong>. This action cannot be undone.
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-black/20 flex items-center justify-end gap-3">
          <button 
            className="h-10 px-5 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="h-10 px-5 rounded-xl text-xs font-bold border-none bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all cursor-pointer" 
            onClick={onConfirm}
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminRFIDPreview() {
  const navigate = useNavigate();

  const [activeSessions, setActiveSessions] = useState([]);
  const [lastTappedUser, setLastTappedUser] = useState(null);
  const selectedSession = activeSessions.length > 0 ? activeSessions[0] : null;
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [sessionToEnd, setSessionToEnd] = useState(null);
  const rfidBuffer = useRef('');

  const fetchActiveSessions = useCallback(async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API}/api/admin/attendance/sessions/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActiveSessions(data.sessions);
        if (data.sessions.length === 0) {
          setShowStartModal(true);
        }
      }
    } catch (err) { console.error('Failed to get active sessions', err); }
  }, []);

  useEffect(() => {
    fetchActiveSessions();
  }, [fetchActiveSessions]);

  // Global RFID Listener
  const lastTapTime = useRef(0);
  const isProcessing = useRef(false);

  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'Enter') {
        const code = rfidBuffer.current.trim();
        rfidBuffer.current = '';
        if (code.length > 0) {
          if (!selectedSession) {
            toast.error('No active service session. Start a service first to log attendance.');
            return;
          }
          if (isProcessing.current) return;
          isProcessing.current = true;
          lastTapTime.current = Date.now();

          try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`${API}/api/admin/attendance/log-tap`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                cardId: code,
                method: 'RFID',
                minLevelSessionId: selectedSession.sessionId
              })
            });
            const data = await res.json();
            if (data.success) {
              toast.success(data.message);
              lastTapTime.current = Date.now();
              setLastTappedUser({ ...data.user, recordId: data.record?.recordId, status: data.user?.status || 'Present', alreadyLogged: data.alreadyLogged });
            } else {
              toast.error(data.message);
            }
          } catch (err) {
            toast.error('RFID processing error');
          } finally {
            isProcessing.current = false;
          }
        }
      } else {
        if (e.key.length === 1) {
          rfidBuffer.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSession]);

  // Poll for remote QR scans
  useEffect(() => {
    let interval;
    if (selectedSession) {
      interval = setInterval(async () => {
        if (Date.now() - lastTapTime.current < 4000) return;

        try {
          const token = localStorage.getItem('adminToken');
          const cacheBuster = `_t=${Date.now()}`;
          const res = await fetch(`${API}/api/admin/attendance?session=${selectedSession.sessionId}&limit=5&${cacheBuster}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && data.attendance && data.attendance.length > 0) {
            const checkedIn = data.attendance.find(a => a.status === 'Present' || a.status === 'Late');
            if (checkedIn) {
              const latest = checkedIn;
              setLastTappedUser(prev => {
                if (!prev || prev.recordId !== latest.recordId) {
                  return {
                    recordId: latest.recordId,
                    name: latest.member,
                    branch: latest.userBranch || latest.branch,
                    status: latest.status,
                    alreadyLogged: false
                  };
                }
                return prev;
              });
            }
          }
        } catch (e) {
          // silent error
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [selectedSession]);

  const confirmEndSession = (sessionId) => {
    setSessionToEnd(sessionId);
    setShowEndModal(true);
  };

  const endSession = async () => {
    if (!sessionToEnd) return;
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API}/api/admin/attendance/sessions/${sessionToEnd}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Session ended. Absences calculated.');
        fetchActiveSessions();
        setShowEndModal(false);
        setSessionToEnd(null);
        setLastTappedUser(null);
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      toast.error(err.message || 'Error ending session');
    }
  };

  const handleBack = () => {
    navigate('/admin/attendance');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] flex flex-col items-center py-8 px-4 font-inter text-left">
      {showStartModal && <StartServiceModal onClose={() => setShowStartModal(false)} onSave={() => { setShowStartModal(false); fetchActiveSessions(); }} />}
      {showEndModal && <EndSessionModal onClose={() => setShowEndModal(false)} onConfirm={endSession} />}

      {/* Top Header Navigation Bar */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Radio size={20} className={selectedSession ? 'animate-pulse' : ''} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight m-0">
              IsangDiwa RFID Terminal
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${selectedSession ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {selectedSession ? 'Scanner Active & Ready' : 'System Standby'}
              </span>
            </div>
          </div>
        </div>

        <button 
          className="h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
          onClick={handleBack}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Main Terminal Shell Card */}
      <div className="w-full max-w-3xl bg-white dark:bg-[#1E2130] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-8 space-y-6">
        
        {/* IDLE SCANNER STATE */}
        {!selectedSession && (
          <div className="flex flex-col items-center text-center py-10 px-4 space-y-6">
            
            {/* Animated Pulse Scanner Target */}
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <Radio size={40} className="animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-3xl border-2 border-emerald-500/30 animate-ping pointer-events-none" />
            </div>

            <div className="max-w-md space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight m-0">
                Scanner Idle
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-normal leading-relaxed m-0">
                No active service session found. Start a service session to begin scanning member RFID cards & QR codes.
              </p>
            </div>

            {/* Start Button */}
            <button
              className="h-12 px-8 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer border-none transition-all hover:scale-102 active:scale-98"
              onClick={() => setShowStartModal(true)}
            >
              <Play size={18} fill="currentColor" />
              <span>Start Service Session</span>
            </button>
          </div>
        )}

        {/* ACTIVE SCANNER STATE */}
        {selectedSession && (
          <div className="space-y-6">
            
            {/* Top Active Session Info Bar */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Active Service Session</span>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 dark:text-white text-base">{selectedSession.serviceType}</span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">· {selectedSession.branch}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-200/70 dark:border-white/10 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                <span className="text-slate-400">ID:</span>
                <span>{selectedSession.sessionId}</span>
              </div>
            </div>

            {/* Split Screen: Live Tap Reader + Mobile QR Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              
              {/* Left Column: Live Card Tap Target / Member Result */}
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 flex flex-col items-center justify-center text-center space-y-4 min-h-[260px]">
                {lastTappedUser ? (
                  <div className="flex flex-col items-center space-y-3 animate-in fade-in zoom-in duration-300">
                    <div className="relative">
                      <img
                        src={lastTappedUser.profilePicture ? `${API}${lastTappedUser.profilePicture}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(lastTappedUser.name)}&background=0D1F45&color=fff`}
                        alt="User Avatar"
                        className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-[#1E2130] shadow-lg"
                        onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(lastTappedUser.name)}&background=0D1F45&color=fff` }}
                      />
                      <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white dark:border-[#1E2130] shadow-xs">
                        <CheckCircle2 size={16} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="m-0 text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {lastTappedUser.name}
                      </h3>
                      <p className="m-0 text-xs font-medium text-slate-400 dark:text-slate-500">
                        {lastTappedUser.branch}
                      </p>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase ${
                      lastTappedUser.alreadyLogged 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300' 
                        : (lastTappedUser.status === 'Present' 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300')
                    }`}>
                      <UserCheck size={14} />
                      {lastTappedUser.alreadyLogged ? 'Already Checked In' : `Checked in as ${lastTappedUser.status}`}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3 text-slate-400 py-4">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
                      <Radio size={32} className="animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
                        Waiting for Card Tap...
                      </span>
                      <p className="text-xs text-slate-400 dark:text-slate-500 m-0">
                        Tap an RFID card or scan a member QR code
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: QR Code Display Card */}
              <div className="p-6 rounded-2xl bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center text-center space-y-3 shadow-xs">
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <QRCode value={selectedSession.sessionId} size={130} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Scan with Mobile App
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 block">
                    {selectedSession.sessionId}
                  </span>
                </div>
              </div>

            </div>

            {/* Bottom Controls */}
            <div className="pt-2 flex justify-end">
              <button
                className="h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer border-none"
                onClick={() => confirmEndSession(selectedSession.sessionId)}
              >
                <Square size={16} fill="currentColor" />
                <span>End Service Session</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
