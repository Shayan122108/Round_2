import React, { useState } from 'react';
import { X, Users, ArrowRight, ShieldCheck } from 'lucide-react';

export default function TeamLoginModal({
  isOpen,
  onClose,
  onSelectTeam
}) {
  const [regId, setRegId] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleManualLogin = (e) => {
    e.preventDefault();
    if (!regId.trim()) return;
    onSelectTeam(regId.trim());
    onClose();
  };

  const sampleTeams = [
    { id: 'REG-101', name: 'Neural Knights', desc: 'Variant A (All Cleared - 150 pts)' },
    { id: 'REG-102', name: 'Gradient Gurus', desc: 'Variant B (1 Anagram Penalty - 50 pts)' },
    { id: 'REG-103', name: 'Vector Voyagers', desc: 'Variant C (Stage 1 Qualified - 30 pts)' },
    { id: 'REG-104', name: 'Tensor Titans', desc: 'Variant D (Stage 1 In Progress - 0 pts)' },
    { id: 'REG-105', name: 'Deep Divers', desc: 'Variant A (2 Anagram Penalties - 0 pts)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="glass-panel max-w-md w-full p-6 border-indigo-500/40 shadow-2xl animate-in fade-in zoom-in-95">
        
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-[Outfit] text-white">Select or Login as Team</h3>
              <p className="text-xs text-[var(--text-dim)]">Enter Registration ID or quick-switch for testing</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Manual Login */}
        <form onSubmit={handleManualLogin} className="mb-6">
          <label className="block text-xs font-semibold text-slate-400 mb-2">
            Team Registration ID
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. REG-101"
              value={regId}
              onChange={(e) => setRegId(e.target.value)}
              className="flex-1 bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase"
            />
            <button type="submit" className="btn btn-primary text-xs !py-2 !px-3">
              <span>Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Quick Switch Pre-registered Teams */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Quick Switch (Demo & Pair Testing)
          </div>
          <div className="space-y-2">
            {sampleTeams.map((t) => (
              <button
                key={t.id}
                onClick={() => { onSelectTeam(t.id); onClose(); }}
                className="w-full text-left p-3 rounded-xl bg-slate-900/60 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-xs text-white group-hover:text-indigo-300 font-[Outfit] flex items-center gap-1.5">
                    <span>{t.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">({t.id})</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)]">{t.desc}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
