import React, { useState, useEffect } from 'react';
import { Shield, Play, Pause, Square, RefreshCw, AlertTriangle, Users, Database, Clock } from 'lucide-react';

export default function AdminPanel({ authUser, csrfToken, onOpenLogin }) {
  const [overview, setOverview] = useState(null);
  const [teams, setTeams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetConfirm, setResetConfirm] = useState('');
  const [msg, setMsg] = useState('');

  if (authUser?.role !== 'ADMIN') {
    return (
      <div className="p-16 text-center glass-panel max-w-lg mx-auto">
        <Shield className="w-12 h-12 text-rose-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold font-[Outfit] text-white">Administrator Access Required</h3>
        <p className="text-xs text-[var(--text-muted)] mt-2 mb-6">
          You must be signed in with an administrative account to access platform management.
        </p>
        <button onClick={onOpenLogin} className="btn btn-primary text-xs px-6 py-2.5">
          Sign In as Admin
        </button>
      </div>
    );
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ovRes, teamsRes, subsRes] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/admin/teams'),
        fetch('/api/admin/submissions?limit=25')
      ]);

      if (ovRes.ok) {
        const body = await ovRes.json();
        setOverview(body.data);
      }
      if (teamsRes.ok) {
        const body = await teamsRes.json();
        setTeams(body.data || []);
      }
      if (subsRes.ok) {
        const body = await subsRes.json();
        setSubmissions(body.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTimerAction = async (endpoint) => {
    setMsg('');
    try {
      const res = await fetch(`/api/admin/competition/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
      });
      if (res.ok) {
        setMsg(`Competition timer action '${endpoint}' succeeded.`);
        fetchData();
      }
    } catch (err) {
      setMsg(`Action failed: ${err.message}`);
    }
  };

  const handleResetScores = async () => {
    if (resetConfirm !== 'RESET ALL SCORES') {
      setMsg('Must type "RESET ALL SCORES" exactly to confirm reset.');
      return;
    }
    setMsg('');
    try {
      const res = await fetch('/api/admin/reset-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ confirm: 'RESET ALL SCORES' })
      });
      if (res.ok) {
        setMsg('All competition scores and submissions have been reset.');
        setResetConfirm('');
        fetchData();
      }
    } catch (err) {
      setMsg(`Reset failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-[Outfit] text-white">
              Event Administration & Control
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Real-time competition timer controls, queue metrics, variant assignments, and score audit
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="btn btn-secondary !py-2 !px-3 text-xs flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          <span>Refresh State</span>
        </button>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-xs text-indigo-300">
          {msg}
        </div>
      )}

      {/* Timer & Controls Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 border-purple-500/30 md:col-span-2">
          <div className="text-xs font-semibold uppercase text-purple-300 tracking-wider mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Competition Lifecycle Controls
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => handleTimerAction('start')}
              className="btn btn-emerald text-xs !py-2 !px-3.5 flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> Start / Restart (90m)
            </button>
            <button
              onClick={() => handleTimerAction('pause')}
              className="btn btn-secondary text-xs !py-2 !px-3.5 flex items-center gap-1.5"
            >
              <Pause className="w-3.5 h-3.5 text-amber-400" /> Pause
            </button>
            <button
              onClick={() => handleTimerAction('resume')}
              className="btn btn-secondary text-xs !py-2 !px-3.5 flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 text-cyan-400" /> Resume
            </button>
            <button
              onClick={() => handleTimerAction('end')}
              className="btn btn-danger text-xs !py-2 !px-3.5 flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" /> End Round
            </button>
          </div>
        </div>

        {/* Queue Stats */}
        <div className="glass-panel p-5 border-slate-800">
          <div className="text-xs font-semibold uppercase text-[var(--text-dim)] tracking-wider mb-2 flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" /> BullMQ Queue
          </div>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Waiting:</span>
              <span className="text-white font-bold">{overview?.queue?.waiting || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Active (Running):</span>
              <span className="text-cyan-400 font-bold">{overview?.queue?.active || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Completed:</span>
              <span className="text-emerald-400 font-bold">{overview?.queue?.completed || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Failed:</span>
              <span className="text-rose-400 font-bold">{overview?.queue?.failed || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Teams & Variant Configurations */}
      <div className="glass-panel p-6">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" /> Registered Participant Teams ({teams.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono uppercase border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Team</th>
                <th className="py-2.5 px-3">Assigned Variant</th>
                <th className="py-2.5 px-3">Stage 1</th>
                <th className="py-2.5 px-3">Anagram</th>
                <th className="py-2.5 px-3">Stage 2</th>
                <th className="py-2.5 px-3 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {teams.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-3 font-sans font-semibold text-white">{t.name}</td>
                  <td className="py-3 px-3 text-purple-300">{t.variantLabel}</td>
                  <td className="py-3 px-3 text-slate-300">{t.progress?.stage1Points || 0} pts</td>
                  <td className="py-3 px-3 text-slate-300">{t.progress?.anagramPoints || 0} pts</td>
                  <td className="py-3 px-3 text-slate-300">{t.progress?.stage2Points || 0} pts</td>
                  <td className="py-3 px-3 text-right font-bold text-indigo-400">{t.progress?.totalScore || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="glass-panel p-6 border-rose-500/30 bg-rose-950/10">
        <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm mb-2">
          <AlertTriangle className="w-5 h-5" /> Danger Zone: Reset Competition Scores
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4 max-w-xl">
          Permanently wipes all submissions, resets participant scores to 0, deletes stored joblib artifacts, and resets stage milestones.
        </p>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder='Type "RESET ALL SCORES" to confirm'
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase"
          />
          <button
            onClick={handleResetScores}
            disabled={resetConfirm !== 'RESET ALL SCORES'}
            className="btn btn-danger text-xs !py-2 !px-4"
          >
            Confirm & Reset All Scores
          </button>
        </div>
      </div>
    </div>
  );
}
