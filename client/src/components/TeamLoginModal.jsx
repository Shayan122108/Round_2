import React, { useState } from 'react';
import { X, Lock, KeyRound, ShieldAlert } from 'lucide-react';

export default function TeamLoginModal({
  isOpen,
  onClose,
  onLoginSuccess
}) {
  const [regId, setRegId] = useState('REG-101');
  const [pin, setPin] = useState('1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!regId.trim() || !pin) {
      setError('Registration ID and PIN are required.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: regId.trim(), pin })
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="glass-panel max-w-md w-full p-6 border-indigo-500/40 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-[Outfit] text-white">Platform Sign In</h3>
              <p className="text-xs text-[var(--text-dim)]">Enter Registration ID and PIN</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
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
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Registration ID
            </label>
            <input
              type="text"
              placeholder="e.g. REG-101 or ADMIN"
              value={regId}
              onChange={(e) => setRegId(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono uppercase"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Secret PIN
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono pr-10"
                required
              />
              <KeyRound className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary text-xs py-2.5"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </div>
        </form>

        <div className="mt-5 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-[var(--text-dim)]">
          <span className="font-semibold text-slate-400">Default Participant Accounts:</span> REG-101 through REG-105 (PIN: 1234).
          <br />
          <span className="font-semibold text-slate-400">Administrator:</span> Registration ID: ADMIN.
        </div>
      </div>
    </div>
  );
}
