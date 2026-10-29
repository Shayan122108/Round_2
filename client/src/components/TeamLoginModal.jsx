import React, { useState } from 'react';
import { X, Lock, KeyRound, ShieldAlert, Sparkles, Shield, UserCheck } from 'lucide-react';

export default function TeamLoginModal({
  isOpen,
  onClose,
  onLoginSuccess
}) {
  const [tab, setTab] = useState('participant'); // 'participant' | 'admin'
  const [regId, setRegId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedId = regId.trim().toUpperCase();
    if (!trimmedId) {
      setError('Registration ID is required.');
      return;
    }

    if (tab === 'admin' && !pin) {
      setError('Secret PIN is required for administrator login.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: trimmedId,
          pin: tab === 'admin' ? pin : '',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Login failed.');
      }
      onLoginSuccess(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setError('');
    setRegId('');
    setPin('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="glass-panel max-w-md w-full p-6 border-indigo-500/40 shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-[Outfit] text-white">SDC ML Challenge</h3>
              <p className="text-xs text-[var(--text-dim)]">Participant & Invigilator Portal</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => handleTabChange('participant')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              tab === 'participant'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Participant</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('admin')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              tab === 'admin'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Wing Admin</span>
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {tab === 'participant' ? 'Participant Registration ID' : 'Admin Account ID'}
            </label>
            <input
              type="text"
              placeholder={tab === 'participant' ? 'e.g. SDC-2026-001' : 'ADMIN'}
              value={regId}
              onChange={(e) => setRegId(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700 focus:border-indigo-500 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono uppercase tracking-wider outline-none"
              required
            />
            {tab === 'participant' && (
              <p className="text-[11px] text-[var(--text-dim)] mt-1.5">
                Format: <code className="text-indigo-300 font-mono">SDC-2026-XXX</code>. First-time sign in creates your permanent participant identity & sequential Web ID.
              </p>
            )}
          </div>

          {tab === 'admin' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admin Secret PIN / Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Enter administrator PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 focus:border-purple-500 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono pr-10 outline-none"
                  required
                />
                <KeyRound className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={`w-full btn text-xs py-2.5 font-bold flex items-center justify-center gap-2 ${
                tab === 'admin' ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'btn-primary'
              }`}
            >
              {loading ? (
                'Authenticating...'
              ) : tab === 'participant' ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Enter Competition Dashboard</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Sign In as Wing Admin</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-5 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-[var(--text-dim)] flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-300">Competition Sign In Notice</div>
            <div className="mt-0.5 text-slate-400">
              Participants enter their assigned Registration ID (<code className="text-indigo-300 font-mono">SDC-2026-XXX</code>). Wing Admin access is restricted to authorized personnel with designated credentials.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
