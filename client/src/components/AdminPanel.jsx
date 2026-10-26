import React, { useState, useEffect } from 'react';
import { Shield, Play, Pause, RotateCcw, Save, Users, Key, Terminal, FileText, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function AdminPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'variants', 'audit', 'settings'
  const [msg, setMsg] = useState('');
  const [newTeam, setNewTeam] = useState({ id: '', name: '', variantId: 1, pin: '1234' });
  const [timerDuration, setTimerDuration] = useState(90);

  const fetchAdminOverview = async () => {
    try {
      const res = await fetch('/api/admin/overview');
      const d = await res.json();
      setData(d);
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminOverview();
  }, []);

  const handleTimerAction = async (action) => {
    try {
      const res = await fetch('/api/admin/timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, durationMinutes: timerDuration })
      });
      const d = await res.json();
      if (d.success) {
        setMsg(`Timer ${action} successful.`);
        fetchAdminOverview();
        setTimeout(() => setMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReassignVariant = async (teamId, variantId) => {
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/reassign-variant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId })
      });
      const d = await res.json();
      if (d.success) {
        setMsg(`Reassigned team ${teamId} to Variant ${variantId}.`);
        fetchAdminOverview();
        setTimeout(() => setMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeam.id || !newTeam.name) return;
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTeam)
      });
      const d = await res.json();
      if (d.success) {
        setMsg(`Team ${newTeam.name} created successfully.`);
        setNewTeam({ id: '', name: '', variantId: 1, pin: '1234' });
        fetchAdminOverview();
        setTimeout(() => setMsg(''), 3000);
      } else {
        alert(d.error || 'Failed to create team');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetScores = async () => {
    if (!window.confirm('Are you sure you want to reset all competition scores, submissions, and penalties?')) return;
    try {
      const res = await fetch('/api/admin/reset-scores', { method: 'POST' });
      const d = await res.json();
      if (d.success) {
        setMsg('All competition scores reset successfully.');
        fetchAdminOverview();
        setTimeout(() => setMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !data) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
        <span className="text-xs">Loading Admin Panel...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center border border-purple-500/30">
              <Shield className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold font-[Outfit] text-white">
                Admin Control Center
              </h2>
              <p className="text-xs text-[var(--text-dim)]">
                Confidential management of variants, team mappings, timer, metrics, and audit logs
              </p>
            </div>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`btn text-xs !py-2 !px-3 ${
              activeTab === 'overview' ? 'btn-primary' : 'btn-secondary text-slate-400'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team Mappings</span>
          </button>
          <button
            onClick={() => setActiveTab('variants')}
            className={`btn text-xs !py-2 !px-3 ${
              activeTab === 'variants' ? 'btn-primary' : 'btn-secondary text-slate-400'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>4 Variants (Confidential)</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`btn text-xs !py-2 !px-3 ${
              activeTab === 'audit' ? 'btn-primary' : 'btn-secondary text-slate-400'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Submissions Audit ({data.submissionsCount})</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{msg}</span>
        </div>
      )}

      {/* Timer Controls Strip */}
      <div className="glass-panel p-5 border-purple-500/30 bg-purple-950/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-bold text-purple-400 tracking-wider">Competition Clock</span>
            <div className="flex items-center gap-3 mt-1">
              <span className={`badge ${
                data.competition.status === 'running' ? 'badge-emerald' : 'badge-amber'
              }`}>
                Status: {data.competition.status.toUpperCase()}
              </span>
              <span className="text-xs text-slate-400">
                Duration: {data.competition.durationMinutes} Minutes
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTimerAction('start')}
              className="btn btn-emerald !py-2 !px-3 text-xs"
            >
              <Play className="w-3.5 h-3.5" /> Start
            </button>
            <button
              onClick={() => handleTimerAction('pause')}
              className="btn btn-secondary !py-2 !px-3 text-xs"
            >
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
            <button
              onClick={() => handleTimerAction('reset')}
              className="btn btn-secondary !py-2 !px-3 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset (90m)
            </button>
            <button
              onClick={handleResetScores}
              className="btn btn-danger !py-2 !px-3 text-xs ml-2"
            >
              Reset Scores
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Confidential Team Mappings */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="glass-panel overflow-hidden border-slate-800">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Team Variant Assignments (Confidential)</h3>
                <p className="text-xs text-[var(--text-dim)]">
                  Strictly hidden from contestant dashboards. Contestants only discover algorithm through anagram.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Reg ID</th>
                    <th className="py-3 px-4">Team Name</th>
                    <th className="py-3 px-4">Assigned Variant</th>
                    <th className="py-3 px-4">Hidden Algorithm</th>
                    <th className="py-3 px-4">Letters</th>
                    <th className="py-3 px-4 text-center">Stage 1</th>
                    <th className="py-3 px-4 text-center">Anagram</th>
                    <th className="py-3 px-4 text-center">Stage 2</th>
                    <th className="py-3 px-4 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.teams.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-indigo-300">{t.id}</td>
                      <td className="py-3 px-4 font-semibold text-white font-[Outfit]">{t.name}</td>
                      <td className="py-3 px-4">
                        <select
                          value={t.variantId}
                          onChange={(e) => handleReassignVariant(t.id, e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-indigo-300 font-bold outline-none"
                        >
                          <option value={1}>Variant A (1)</option>
                          <option value={2}>Variant B (2)</option>
                          <option value={3}>Variant C (3)</option>
                          <option value={4}>Variant D (4)</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 font-bold text-purple-300">{t.hiddenAlgorithm}</td>
                      <td className="py-3 px-4 text-[10px] text-slate-400 tracking-widest">{t.shuffledLetters}</td>
                      <td className="py-3 px-4 text-center">
                        {t.stage1Qualified ? <span className="text-emerald-400 font-bold">Pass</span> : <span className="text-slate-600">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {t.anagramSolved ? <span className="text-emerald-400 font-bold">Solved</span> : <span className="text-slate-600">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {t.stage2Qualified ? <span className="text-emerald-400 font-bold">Pass</span> : <span className="text-slate-600">-</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">{t.totalScore} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Team Card */}
          <div className="glass-card p-5 border-slate-800">
            <h4 className="font-bold text-sm text-white mb-3">Register New Team</h4>
            <form onSubmit={handleCreateTeam} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <input
                type="text"
                placeholder="ID (e.g. REG-106)"
                value={newTeam.id}
                onChange={(e) => setNewTeam({ ...newTeam, id: e.target.value })}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                required
              />
              <input
                type="text"
                placeholder="Team Name"
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white sm:col-span-2"
                required
              />
              <select
                value={newTeam.variantId}
                onChange={(e) => setNewTeam({ ...newTeam, variantId: parseInt(e.target.value, 10) })}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value={1}>Variant A (Random Forest)</option>
                <option value={2}>Variant B (Decision Tree)</option>
                <option value={3}>Variant C (Naive Bayes)</option>
                <option value={4}>Variant D (Gradient Boosting)</option>
              </select>
              <button type="submit" className="btn btn-primary text-xs">
                Add Team
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: Four Private Variants Configuration */}
      {activeTab === 'variants' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.values(data.variants).map((v) => (
            <div key={v.id} className="glass-panel p-6 border-indigo-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="badge badge-indigo">{v.label}</span>
                  <h3 className="font-bold text-lg text-white font-[Outfit]">{v.hiddenModel}</h3>
                </div>
                <span className="font-mono text-xs text-slate-400">Variant #{v.id}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Shuffled Letters:</span>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono font-bold tracking-widest text-indigo-300 mt-1 text-sm">
                  {v.shuffledLetters}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase">Stage 1 Target</span>
                  <div className="font-mono font-bold text-white mt-1">
                    {(v.targetAccuracyStage1 * 100).toFixed(0)}% Accuracy
                  </div>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase">Stage 2 Benchmark</span>
                  <div className="font-mono font-bold text-cyan-300 mt-1">
                    Acc &gt;= {(v.stage2Config.targetAccuracy * 100).toFixed(0)}% | F1 &gt;= {(v.stage2Config.targetF1 * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Boilerplate Preview:</span>
                <pre className="bg-[#070b14] p-3 rounded-lg text-[10px] font-mono text-slate-300 h-28 overflow-y-auto mt-1 border border-slate-800">
                  {v.boilerplate}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Submissions & Anagram Audit Trail */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="glass-panel overflow-hidden border-slate-800">
            <div className="p-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Live Submission Audit Trail</h3>
              <p className="text-xs text-[var(--text-dim)]">
                Every model evaluation attempt logged with server timestamp, metrics, and error reasons.
              </p>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Team</th>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3">Filename</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Metrics / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.recentSubmissions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 text-[var(--text-dim)]">
                        {new Date(s.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">{s.teamName}</td>
                      <td className="py-2.5 px-3">Stage {s.stage}</td>
                      <td className="py-2.5 px-3 text-slate-400">{s.filename}</td>
                      <td className="py-2.5 px-3">
                        <span className={`badge ${
                          s.status === 'QUALIFIED'
                            ? 'badge-emerald'
                            : s.status === 'NOT_QUALIFIED'
                            ? 'badge-amber'
                            : 'badge-rose'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {s.metrics
                          ? `Acc: ${(s.metrics.accuracy * 100).toFixed(1)}% (${s.metrics.correctCount}/${s.metrics.totalCount})`
                          : s.error || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Anagram Guess Log */}
          <div className="glass-panel overflow-hidden border-slate-800">
            <div className="p-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Anagram Guess History & Penalties</h3>
              <p className="text-xs text-[var(--text-dim)]">
                Tracks each guess, penalties applied (-30 pts), and points awarded (+50 pts).
              </p>
            </div>
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Team</th>
                    <th className="py-2.5 px-3">Guess</th>
                    <th className="py-2.5 px-3">Result</th>
                    <th className="py-2.5 px-3">Score Effect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.anagramAudit.map((a, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 text-[var(--text-dim)]">
                        {new Date(a.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">{a.teamName}</td>
                      <td className="py-2.5 px-3 font-bold text-indigo-300">{a.guess}</td>
                      <td className="py-2.5 px-3">
                        {a.isCorrect ? (
                          <span className="text-emerald-400 font-bold">CORRECT</span>
                        ) : (
                          <span className="text-rose-400 font-bold">WRONG</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        {a.isCorrect ? (
                          <span className="text-emerald-400">+50 Points</span>
                        ) : (
                          <span className="text-rose-400">-30 Points Penalty</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
