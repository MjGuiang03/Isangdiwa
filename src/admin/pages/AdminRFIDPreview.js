import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import API from '../../utils/api';
import { Play, Square, XCircle, ArrowLeft } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[500px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center p-6 border-b border-slate-200 dark:border-white/10 shrink-0 relative">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shadow-sm mx-auto mb-4">
            <Play size={20} />
          </div>
          <div className="flex flex-col text-center">
            <h2 className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">Start Service Session</h2>
            <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Initialize a new check-in period</p>
          </div>
          <button className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors border-none cursor-pointer" onClick={onClose}><XCircle size={20} color="#6B7280" /></button>
        </div>
        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Branch</label>
            <select name="branch" value={form.branch} onChange={handleChange} className="h-10 px-3 pr-8 appearance-none bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat w-full">
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
              <optgroup label="Nueva Ecija"><option>Bambanaba,  Cuyapo</option></optgroup>
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
          <div className="flex flex-col gap-1.5">
            <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Service Type</label>
            <select name="serviceType" value={form.serviceType} onChange={handleChange} className="h-10 px-3 pr-8 appearance-none bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat w-full">
              {serviceTypes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Date</label>
              <input type="date" name="date" value={form.date} onChange={handleChange} min={new Date().toISOString().split('T')[0]} className="h-10 px-3 bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Time</label>
              <input type="time" name="time" value={form.time} onChange={handleChange} className="h-10 px-3 bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full" />
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-end gap-3 shrink-0">
          <button className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer min-w-[100px]" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border-none bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer flex items-center justify-center min-w-[100px] gap-2" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Starting...' : 'Start Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EndSessionModal({ onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[500px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center p-6 border-b border-slate-200 dark:border-white/10 shrink-0 relative">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 flex items-center justify-center shadow-sm mx-auto mb-4">
            <Square size={20} />
          </div>
          <div className="flex flex-col text-center">
            <h2 className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">End Service Session</h2>
            <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">Are you sure you want to end this session?</p>
          </div>
        </div>
        <div className="p-6 flex flex-col gap-5">
          <p className="text-slate-600 dark:text-slate-400 text-sm font-inter text-center leading-relaxed">
            Ending this session will stop accepting new check-ins. All unregistered members from this branch will automatically be marked as <strong>Absent</strong>. This action cannot be undone.
          </p>
        </div>
        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-end gap-3 shrink-0">
          <button className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer min-w-[100px]" onClick={onClose}>Cancel</button>
          <button className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border-none bg-rose-600 text-white hover:bg-rose-700 cursor-pointer min-w-[100px]" onClick={onConfirm}>End Session</button>
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
        // Auto-open start modal if no sessions are active
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
          // Prevent overlapping API calls from rapid taps
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
              // Mark the tap time again after response to protect the display
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

  // Poll for remote QR scans (won't overwrite recent RFID taps)
  useEffect(() => {
    let interval;
    if (selectedSession) {
      interval = setInterval(async () => {
        // Skip poll if an RFID tap happened in the last 4 seconds
        if (Date.now() - lastTapTime.current < 4000) return;

        try {
          const token = localStorage.getItem('adminToken');
          const cacheBuster = `_t=${Date.now()}`;
          const res = await fetch(`${API}/api/admin/attendance?session=${selectedSession.sessionId}&limit=5&${cacheBuster}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && data.attendance && data.attendance.length > 0) {
            // Only show actual check-ins, not auto-generated absent records
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
    <div className="min-h-screen bg-slate-100 dark:bg-[#161922] flex flex-col items-center pt-[10vh] px-4">
      {showStartModal && <StartServiceModal onClose={() => setShowStartModal(false)} onSave={() => { setShowStartModal(false); fetchActiveSessions(); }} />}
      {showEndModal && <EndSessionModal onClose={() => setShowEndModal(false)} onConfirm={endSession} />}

      <div className="flex flex-col items-center mb-8">
        <h2>IsangDiwa RFID System</h2>
        <button className="absolute top-6 right-6 h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer flex items-center gap-2" style={{ display: 'flex', alignItems: 'center' }} onClick={handleBack}>
          <ArrowLeft size={16} style={{ marginRight: '6px' }} />
          Back
        </button>
      </div>

      <div className="bg-white dark:bg-[#1E2130] w-full max-w-[500px] rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 p-8 flex flex-col items-center text-center">
        {selectedSession && (
          <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch', marginBottom: '24px' }}>
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300" style={{ flex: 1, margin: 0 }}>
              {lastTappedUser ? (
                <>
                  <img
                    src={lastTappedUser.profilePicture ? `${API}${lastTappedUser.profilePicture}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(lastTappedUser.name)}&background=0D1F45&color=fff`}
                    alt="User"
                    className="w-24 h-24 rounded-full mb-4 object-cover border-4 border-white dark:border-[#1E2130] shadow-md"
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(lastTappedUser.name)}&background=0D1F45&color=fff` }}
                  />
                  <div className="flex flex-col items-center">
                    <h3 className="m-0 font-inter text-2xl font-bold text-slate-800 dark:text-white">{lastTappedUser.name}</h3>
                    <span className="m-0 font-inter text-sm text-slate-500 dark:text-slate-400 mt-1">{lastTappedUser.branch}</span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${lastTappedUser.alreadyLogged ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : (lastTappedUser.status === 'Present' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400')}`}>
                      {lastTappedUser.alreadyLogged ? 'Already Checked In' : `Checked in as ${lastTappedUser.status}`}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-center py-8">
                  <div className="w-24 h-24 rounded-full mb-4 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-3xl font-bold border-4 border-white dark:border-[#1E2130] shadow-md">
                    <span className="w-20 h-20 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 mb-6">?</span>
                  </div>
                  <span className="m-0 font-inter text-lg font-semibold text-slate-600 dark:text-slate-400">Waiting for next tap...</span>
                </div>
              )}
            </div>
            <div style={{ padding: '24px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '200px' }}>
              <QRCode value={selectedSession.sessionId} size={140} />
              <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: '#4B5563', fontWeight: '600' }}>Scan to Check In</p>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>{selectedSession.sessionId}</span>
            </div>
          </div>
        )}

        <div className={`flex flex-col items-center justify-center p-10 bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-lg w-full max-w-[600px] gap-6 transition-all ${selectedSession ? 'ring-2 ring-blue-500/50 shadow-blue-500/10' : 'opacity-80'}`}>
          <div className="scanner-status">
            <div className="pulse-indicator"></div>
            <h3>{selectedSession ? 'Scanner Active. Ready for Taps.' : 'Scanner Idle. Start a service to scan cards.'}</h3>
          </div>

          {selectedSession && (
            <div className="scanner-details">
              <div className="detail-item">
                <span className="label">Branch</span>
                <span className="value">{selectedSession.branch}</span>
              </div>
              <div className="detail-item">
                <span className="label">Service</span>
                <span className="value">{selectedSession.serviceType}</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center gap-4">
          {selectedSession ? (
            <button className="h-12 px-6 rounded-xl font-inter text-base font-semibold transition-all border-none bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-sm w-full sm:w-auto" onClick={() => confirmEndSession(selectedSession.sessionId)}>
              <Square size={20} /> End Session
            </button>
          ) : (
            <button className="h-12 px-6 rounded-xl font-inter text-base font-semibold transition-all border-none bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-sm w-full sm:w-auto" onClick={() => setShowStartModal(true)}>
              <Play size={20} /> Start Service
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
