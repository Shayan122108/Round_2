import React, { useState, useEffect } from 'react';
import {
  Shield, CheckCircle2, AlertCircle, Clock, RefreshCw, Search,
  Eye, ThumbsUp, ThumbsDown, Unlock, Lock, FileSpreadsheet,
  Sliders, History, Users, ArrowRight, X, AlertTriangle,
  Play, Pause, Square, RotateCcw, Download
} from 'lucide-react';

export default function AdminPanel({ authUser, csrfToken, onOpenLogin }) {
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'all' | 'benchmarks' | 'audit'
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [allParticipants, setAllParticipants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [benchmarks, setBenchmarks] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [notification, setNotification] = useState('');

  // Competition / Round controls state
  const [competition, setCompetition] = useState(null);
  const [compLoading, setCompLoading] = useState(false);
  const [durationInput, setDurationInput] = useState(60); // minutes
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [confirmStartOpen, setConfirmStartOpen] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Selected participant detail modal state
  const [selectedId, setSelectedId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Review confirmation modal state
  const [reviewConfirm, setReviewConfirm] = useState(null); // { round, action, reason }
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Benchmark edit state
  const [benchmarkForm, setBenchmarkForm] = useState(null);
  const [benchmarkSaving, setBenchmarkSaving] = useState(false);

  if (authUser?.role !== 'ADMIN') {
    return (
      <div className="p-16 text-center glass-panel max-w-lg mx-auto">
        <Shield className="w-12 h-12 text-rose-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold font-[Outfit] text-white">Administrator Access Required</h3>
        <p className="text-xs text-[var(--text-muted)] mt-2 mb-6">
          You must be signed in with an administrative wing account to access the manual verification and platform controls.
        </p>
        <button onClick={onOpenLogin} className="btn btn-primary text-xs px-6 py-2.5">
          Sign In as Wing Admin
        </button>
      </div>
    );
  }

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/admin/overview');
      if (res.ok) {
        const body = await res.json();
        setOverview(body.data);
        if (body.data?.competition) {
          setCompetition(body.data.competition);
          if (body.data.competition.durationSeconds) {
            setDurationInput(Math.round(body.data.competition.durationSeconds / 60));
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Timer Tick for live countdown in Admin Panel
  useEffect(() => {
    if (competition?.status !== 'RUNNING') return;
    const interval = setInterval(() => {
      setCompetition((prev) => {
        if (!prev) return prev;
        const rem = (prev.remainingSeconds ?? 0) - 1;
        if (rem <= 0) {
          fetchOverview();
          return { ...prev, remainingSeconds: 0, status: 'ENDED' };
        }
        return { ...prev, remainingSeconds: rem };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [competition?.status]);

  const formatTime = (secs) => {
    if (secs === null || secs === undefined || isNaN(secs)) return '00:00';
    const m = Math.floor(Math.max(0, secs) / 60);
    const s = Math.max(0, secs) % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Competition / Round action handlers
  const handleStartCompetition = async (force = false) => {
    setCompLoading(true);
    setConfirmStartOpen(false);
    try {
      const durationSeconds = Math.max(1, parseInt(durationInput, 10) || 60) * 60;
      const res = await fetch('/api/admin/competition/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ durationSeconds, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && !force) {
          setConfirmStartOpen(true);
          return;
        }
        throw new Error(data.error?.message || 'Failed to start round.');
      }
      setCompetition(data.data);
      setNotification(`Round started successfully! Duration: ${Math.round(durationSeconds / 60)} minutes.`);
      await fetchOverview();
    } catch (err) {
      setNotification(`Error: ${err.message}`);
    } finally {
      setCompLoading(false);
    }
  };

  const handlePauseCompetition = async () => {
    setCompLoading(true);
    try {
      const res = await fetch('/api/admin/competition/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to pause round.');
      }
      setCompetition(data.data);
      setNotification('Round paused. Participant submissions and verifications frozen.');
      await fetchOverview();
    } catch (err) {
      setNotification(`Error: ${err.message}`);
    } finally {
      setCompLoading(false);
    }
  };

  const handleResumeCompetition = async () => {
    setCompLoading(true);
    try {
      const res = await fetch('/api/admin/competition/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to resume round.');
      }
      setCompetition(data.data);
      setNotification('Round resumed! Submissions active.');
      await fetchOverview();
    } catch (err) {
      setNotification(`Error: ${err.message}`);
    } finally {
      setCompLoading(false);
    }
  };

  const handleEndCompetition = async () => {
    setCompLoading(true);
    setConfirmEndOpen(false);
    try {
      const res = await fetch('/api/admin/competition/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to end round.');
      }
      setCompetition(data.data);
      setNotification('Round ended. Submissions are closed.');
      await fetchOverview();
    } catch (err) {
      setNotification(`Error: ${err.message}`);
    } finally {
      setCompLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setExportingCsv(true);
    try {
      const res = await fetch('/api/admin/export/csv');
      if (!res.ok) {
        throw new Error('Failed to export CSV from server.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sdc_mlc_leaderboard_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setNotification('Participant CSV leaderboard exported successfully!');
    } catch (err) {
      setNotification(`Export error: ${err.message}`);
    } finally {
      setExportingCsv(false);
    }
  };

  const fetchQueue = async () => {
    try {
      const res = await fetch('/api/admin/pending-verifications');
      if (res.ok) {
        const body = await res.json();
        setPendingQueue(body.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllParticipants = async () => {
    try {
      const res = await fetch(`/api/admin/participants?search=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const body = await res.json();
        setAllParticipants(body.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBenchmarks = async () => {
    try {
      const res = await fetch('/api/admin/benchmarks');
      if (res.ok) {
        const body = await res.json();
        setBenchmarks(body.data);
        setBenchmarkForm(JSON.parse(JSON.stringify(body.data)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs');
      if (res.ok) {
        const body = await res.json();
        setAuditLogs(body.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchOverview(),
      fetchQueue(),
      fetchAllParticipants(),
      fetchBenchmarks(),
      fetchAuditLogs(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (activeTab === 'all') {
      fetchAllParticipants();
    }
  }, [searchQuery]);

  // Open participant detail modal
  const openParticipantDetail = async (id) => {
    setSelectedId(id);
    setDetailLoading(true);
    setRejectionReason('');
    setReviewConfirm(null);

    try {
      const res = await fetch(`/api/admin/participants/${id}`);
      if (res.ok) {
        const body = await res.json();
        setDetailData(body.data?.participant);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReviewAction = async (round, action) => {
    if (!selectedId) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/participants/${selectedId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          round,
          action,
          reason: rejectionReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Review action failed.');
      }

      setNotification(`Action successful: Round ${round} ${action.toLowerCase()}ed.`);
      setReviewConfirm(null);
      setRejectionReason('');
      await openParticipantDetail(selectedId);
      await fetchQueue();
      await fetchOverview();
      await fetchAllParticipants();
    } catch (err) {
      setNotification(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseBoilerplate = async (participantId) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/participants/${participantId}/release-boilerplate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to release boilerplate.');
      }

      setNotification(data.data?.message || 'Round 3 starter boilerplate released.');
      await openParticipantDetail(participantId);
      await fetchQueue();
      await fetchAllParticipants();
    } catch (err) {
      setNotification(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveBenchmarks = async (e) => {
    e.preventDefault();
    if (!benchmarkForm) return;

    setBenchmarkSaving(true);
    try {
      const res = await fetch('/api/admin/benchmarks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          round1: {
            mae: parseFloat(benchmarkForm.round1?.round1Mae),
            rmse: parseFloat(benchmarkForm.round1?.round1Rmse),
            mse: parseFloat(benchmarkForm.round1?.round1Mse),
          },
          variants: benchmarkForm.variants?.map((v) => ({
            id: v.id,
            mae: parseFloat(v.round3Mae),
            rmse: parseFloat(v.round3Rmse),
            mse: parseFloat(v.round3Mse),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to save benchmarks.');
      }

      setNotification('Reference benchmarks successfully updated!');
      await fetchBenchmarks();
    } catch (err) {
      setNotification(`Error saving benchmarks: ${err.message}`);
    } finally {
      setBenchmarkSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-[Outfit] text-white">
              Event Administration & Manual Verification
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Authorized Wing Member panel for round timer control, in-person metric verification, and results export
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            disabled={exportingCsv}
            className="btn bg-emerald-600 hover:bg-emerald-500 text-white !py-2 !px-3.5 text-xs flex items-center gap-1.5 font-bold shadow-lg shadow-emerald-600/25 transition-all"
            title="Download full participant leaderboard as CSV"
          >
            {exportingCsv ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Export CSV</span>
          </button>

          <button
            onClick={refreshAll}
            disabled={loading}
            className="btn btn-secondary !py-2 !px-3 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            <span>Refresh All</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-xs text-indigo-200 flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification('')} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Round & Competition Controls Bar */}
      <div className="glass-panel p-6 border-indigo-500/30 bg-gradient-to-r from-indigo-950/20 via-slate-900/40 to-slate-950/40">
        <div className="flex flex-wrap items-center justify-between gap-6">
          {/* Status & Timer */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Round Status
              </span>
              <div className="flex items-center gap-2">
                {competition?.status === 'RUNNING' && (
                  <span className="badge badge-emerald flex items-center gap-1.5 py-1 px-3 text-xs font-bold font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    RUNNING
                  </span>
                )}
                {competition?.status === 'PAUSED' && (
                  <span className="badge badge-amber flex items-center gap-1.5 py-1 px-3 text-xs font-bold font-mono">
                    <Pause className="w-3.5 h-3.5" />
                    PAUSED
                  </span>
                )}
                {competition?.status === 'ENDED' && (
                  <span className="badge badge-rose flex items-center gap-1.5 py-1 px-3 text-xs font-bold font-mono">
                    <Square className="w-3.5 h-3.5" />
                    ENDED
                  </span>
                )}
                {(!competition?.status || competition?.status === 'NOT_STARTED') && (
                  <span className="badge badge-indigo flex items-center gap-1.5 py-1 px-3 text-xs font-bold font-mono text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    NOT STARTED
                  </span>
                )}
              </div>
            </div>

            <div className="h-10 w-[1px] bg-slate-800 hidden sm:block" />

            {/* Timer Counter */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                Time Remaining
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-white flex items-center gap-2">
                <Clock className={`w-5 h-5 ${competition?.status === 'RUNNING' ? 'text-cyan-400 animate-spin' : 'text-slate-500'}`} />
                <span>{formatTime(competition?.remainingSeconds)}</span>
              </div>
            </div>

            <div className="h-10 w-[1px] bg-slate-800 hidden md:block" />

            {/* Duration setting */}
            <div className="hidden lg:flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Set Duration (Mins)
              </span>
              <div className="flex items-center gap-1.5">
                {[60, 45, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationInput(mins)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold border transition-colors ${
                      durationInput === mins
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="360"
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  className="w-16 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-md px-2 py-1 text-xs text-white font-mono text-center outline-none"
                  title="Custom minutes"
                />
              </div>
            </div>
          </div>

          {/* Action Control Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* START / RESTART */}
            {(!competition?.status || competition?.status === 'NOT_STARTED' || competition?.status === 'ENDED') ? (
              <button
                onClick={() => handleStartCompetition(false)}
                disabled={compLoading}
                className="btn bg-emerald-600 hover:bg-emerald-500 text-white font-bold !py-2.5 !px-4 text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Round</span>
              </button>
            ) : (
              <button
                onClick={() => setConfirmStartOpen(true)}
                disabled={compLoading}
                className="btn btn-secondary !py-2.5 !px-3 text-xs flex items-center gap-1.5 text-slate-300 hover:text-white"
                title="Restart Round timer from beginning"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Restart</span>
              </button>
            )}

            {/* PAUSE */}
            {competition?.status === 'RUNNING' && (
              <button
                onClick={handlePauseCompetition}
                disabled={compLoading}
                className="btn bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold !py-2.5 !px-4 text-xs flex items-center gap-2 shadow-lg shadow-amber-600/25"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause Round</span>
              </button>
            )}

            {/* RESUME */}
            {competition?.status === 'PAUSED' && (
              <button
                onClick={handleResumeCompetition}
                disabled={compLoading}
                className="btn bg-cyan-600 hover:bg-cyan-500 text-white font-bold !py-2.5 !px-4 text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/25"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume Round</span>
              </button>
            )}

            {/* END */}
            {(competition?.status === 'RUNNING' || competition?.status === 'PAUSED') && (
              <button
                onClick={() => setConfirmEndOpen(true)}
                disabled={compLoading}
                className="btn bg-rose-600/90 hover:bg-rose-500 text-white font-bold !py-2.5 !px-4 text-xs flex items-center gap-2 shadow-lg shadow-rose-600/25"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>End Round</span>
              </button>
            )}

            <div className="h-8 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

            {/* Export CSV button in controls */}
            <button
              onClick={handleExportCSV}
              disabled={exportingCsv}
              className="btn bg-emerald-600 hover:bg-emerald-500 text-white font-bold !py-2.5 !px-4 text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25"
              title="Download full participant leaderboard as CSV"
            >
              {exportingCsv ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stat Counters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="glass-card !p-4 border-slate-800">
          <div className="text-xs text-[var(--text-dim)] uppercase font-semibold">Total Participants</div>
          <div className="font-mono font-bold text-2xl text-white mt-1">
            {overview?.counts?.totalParticipants || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Registered identities</div>
        </div>

        <div className="glass-card !p-4 border-amber-500/40 bg-amber-950/20">
          <div className="text-xs text-amber-300 uppercase font-semibold flex items-center justify-between">
            <span>Pending Review</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="font-mono font-bold text-2xl text-amber-400 mt-1">
            {overview?.counts?.pendingVerifications || 0}
          </div>
          <div className="text-[11px] text-amber-300/70 mt-0.5">
            {overview?.counts?.pendingRound1 || 0} in R1, {overview?.counts?.pendingRound3 || 0} in R3
          </div>
        </div>

        <div className="glass-card !p-4 border-slate-800">
          <div className="text-xs text-[var(--text-dim)] uppercase font-semibold">Round 1 Approved</div>
          <div className="font-mono font-bold text-2xl text-emerald-400 mt-1">
            {overview?.counts?.round1Approved || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">+30 pts awarded</div>
        </div>

        <div className="glass-card !p-4 border-slate-800">
          <div className="text-xs text-[var(--text-dim)] uppercase font-semibold">Round 2 Solved</div>
          <div className="font-mono font-bold text-2xl text-cyan-400 mt-1">
            {overview?.counts?.round2Solved || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">+50 pts awarded</div>
        </div>

        <div className="glass-card !p-4 border-slate-800">
          <div className="text-xs text-[var(--text-dim)] uppercase font-semibold">Round 3 Completed</div>
          <div className="font-mono font-bold text-2xl text-indigo-400 mt-1">
            {overview?.counts?.round3Approved || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">+70 pts (Full 150)</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('queue')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'queue'
              ? 'border-amber-400 text-amber-300 bg-amber-950/15'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Pending Verifications Queue ({pendingQueue.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'all'
              ? 'border-indigo-500 text-indigo-300 bg-indigo-950/15'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-400" />
          <span>All Participants</span>
        </button>

        <button
          onClick={() => setActiveTab('benchmarks')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'benchmarks'
              ? 'border-cyan-500 text-cyan-300 bg-cyan-950/15'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>Reference Benchmarks</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'border-purple-500 text-purple-300 bg-purple-950/15'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4 text-purple-400" />
          <span>Decision Audit Trail</span>
        </button>
      </div>

      {/* TAB 1: Pending Verifications Queue */}
      {activeTab === 'queue' && (
        <div className="glass-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Offline Manual Verification Queue
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Participants waiting for an invigilator to verify their locally calculated MAE, RMSE, and MSE metrics in person.
              </p>
            </div>
            <button
              onClick={fetchQueue}
              className="btn btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Refresh Queue</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono uppercase border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Web ID</th>
                  <th className="py-2.5 px-3">Registration ID</th>
                  <th className="py-2.5 px-3">Round Awaiting Review</th>
                  <th className="py-2.5 px-3">Assigned Model</th>
                  <th className="py-2.5 px-3">Current Score</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {pendingQueue.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500">
                      No participants currently awaiting manual verification.
                    </td>
                  </tr>
                ) : (
                  pendingQueue.map((item) => (
                    <tr key={item.userId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3 font-bold text-indigo-300">{item.webId}</td>
                      <td className="py-3 px-3 text-white font-semibold">{item.registrationId}</td>
                      <td className="py-3 px-3">
                        <span className={`badge ${
                          item.round === 1 ? 'badge-indigo' : 'badge-cyan'
                        }`}>
                          Round {item.round} {item.round === 1 ? '(Linear Regression)' : '(Assigned ML Model)'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-purple-300">{item.variantName}</td>
                      <td className="py-3 px-3 font-bold text-amber-400">{item.currentScore} / 150</td>
                      <td className="py-3 px-3">
                        <span className="badge badge-amber py-0.5 px-2 text-[10px]">
                          Pending In-Person Review
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => openParticipantDetail(item.userId)}
                          className="btn btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1.5 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review Candidate</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: All Participants & Search */}
      {activeTab === 'all' && (
        <div className="glass-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                All Registered Participants ({allParticipants.length})
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Search by Registration ID (e.g. SDC-2026-001) or sequential Web ID
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportCSV}
                disabled={exportingCsv}
                className="btn bg-emerald-600 hover:bg-emerald-500 text-white !py-1.5 !px-3 text-xs flex items-center gap-1.5 font-bold shadow-md shadow-emerald-600/20"
                title="Download full participant leaderboard as CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <div className="relative w-72">
                <input
                  type="text"
                  placeholder="Search registration or web ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white font-mono uppercase outline-none"
                />
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono uppercase border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Web ID</th>
                  <th className="py-2.5 px-3">Registration ID</th>
                  <th className="py-2.5 px-3">Assigned Model</th>
                  <th className="py-2.5 px-3 text-center">Round 1</th>
                  <th className="py-2.5 px-3 text-center">Round 2</th>
                  <th className="py-2.5 px-3 text-center">Round 3</th>
                  <th className="py-2.5 px-3 text-right">Total Score</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {allParticipants.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-500">
                      No participants match the search criteria.
                    </td>
                  </tr>
                ) : (
                  allParticipants.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3 font-bold text-indigo-300">{p.webId}</td>
                      <td className="py-3 px-3 font-semibold text-white">{p.registrationId}</td>
                      <td className="py-3 px-3 text-purple-300">{p.hiddenModel || 'Unassigned'}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`badge py-0.5 px-2 text-[10px] ${
                          p.round1Status === 'APPROVED' ? 'badge-emerald' : p.round1Status === 'PENDING_VERIFICATION' ? 'badge-amber' : 'badge-slate text-slate-500'
                        }`}>
                          {p.round1Status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`badge py-0.5 px-2 text-[10px] ${
                          p.round2Status === 'SOLVED' ? 'badge-emerald' : 'badge-slate text-slate-500'
                        }`}>
                          {p.round2Status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`badge py-0.5 px-2 text-[10px] ${
                          p.round3Status === 'APPROVED' ? 'badge-emerald' : p.round3Status === 'PENDING_VERIFICATION' ? 'badge-cyan' : 'badge-slate text-slate-500'
                        }`}>
                          {p.round3Status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-amber-400">
                        {p.totalScore} / 150
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => openParticipantDetail(p.id)}
                          className="btn btn-secondary !py-1.5 !px-2.5 text-xs flex items-center gap-1 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Detail</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Reference Benchmarks Management */}
      {activeTab === 'benchmarks' && benchmarkForm && (
        <form onSubmit={handleSaveBenchmarks} className="glass-panel p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Authorized Reference Benchmarks (Invigilator Ground Truth)
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Reference values used by wing members during in-person manual metric verification. Stored securely on server only.
              </p>
            </div>

            <button
              type="submit"
              disabled={benchmarkSaving}
              className="btn btn-primary text-xs !py-2 !px-4 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{benchmarkSaving ? 'Saving...' : 'Save Benchmark Values'}</span>
            </button>
          </div>

          {/* Round 1 Reference Benchmarks */}
          <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4">
            <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">
              Round 1 — Linear Regression Reference Metrics
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Target MAE</label>
                <input
                  type="number"
                  step="0.0001"
                  value={benchmarkForm.round1?.round1Mae ?? 1.25}
                  onChange={(e) => setBenchmarkForm({
                    ...benchmarkForm,
                    round1: { ...benchmarkForm.round1, round1Mae: e.target.value }
                  })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Target RMSE</label>
                <input
                  type="number"
                  step="0.0001"
                  value={benchmarkForm.round1?.round1Rmse ?? 1.85}
                  onChange={(e) => setBenchmarkForm({
                    ...benchmarkForm,
                    round1: { ...benchmarkForm.round1, round1Rmse: e.target.value }
                  })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Target MSE</label>
                <input
                  type="number"
                  step="0.0001"
                  value={benchmarkForm.round1?.round1Mse ?? 3.42}
                  onChange={(e) => setBenchmarkForm({
                    ...benchmarkForm,
                    round1: { ...benchmarkForm.round1, round1Mse: e.target.value }
                  })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Round 3 Variant Benchmarks */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">
              Round 3 — Assigned Model Reference Metrics (By Variant)
            </h4>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {benchmarkForm.variants?.map((v, idx) => (
                <div key={v.id} className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">{v.label}: {v.hiddenModel}</span>
                    <span className="text-[10px] text-purple-300 font-mono">Variant #{v.id}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">MAE</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={v.round3Mae}
                        onChange={(e) => {
                          const updated = [...benchmarkForm.variants];
                          updated[idx].round3Mae = e.target.value;
                          setBenchmarkForm({ ...benchmarkForm, variants: updated });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">RMSE</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={v.round3Rmse}
                        onChange={(e) => {
                          const updated = [...benchmarkForm.variants];
                          updated[idx].round3Rmse = e.target.value;
                          setBenchmarkForm({ ...benchmarkForm, variants: updated });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">MSE</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={v.round3Mse}
                        onChange={(e) => {
                          const updated = [...benchmarkForm.variants];
                          updated[idx].round3Mse = e.target.value;
                          setBenchmarkForm({ ...benchmarkForm, variants: updated });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="glass-panel p-6">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" />
            Administrative Decision & Audit Log
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Target ID</th>
                  <th className="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-[11px]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500">
                      No audit records found.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-purple-300">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {log.actorName || log.actorId || 'SYSTEM'}
                      </td>
                      <td className="py-2.5 px-3 text-indigo-300">
                        {log.target || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PARTICIPANT DETAIL MODAL */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="glass-panel max-w-3xl w-full p-6 sm:p-8 border-indigo-500/40 shadow-2xl animate-in fade-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold font-mono">
                  {detailData?.webId || 'WEB'}
                </div>
                <div>
                  <h3 className="font-bold text-lg font-[Outfit] text-white flex items-center gap-2">
                    <span>{detailData?.registrationId}</span>
                    <span className="badge badge-indigo text-xs">{detailData?.webId}</span>
                  </h3>
                  <p className="text-xs text-[var(--text-dim)]">{detailData?.displayName}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                <span>Loading candidate record...</span>
              </div>
            ) : detailData ? (
              <div className="space-y-6">
                {/* Score & Assigned Model Card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Total Score</span>
                    <div className="text-2xl font-mono font-black text-amber-400 mt-1">
                      {detailData.totalScore} / 150
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 sm:col-span-2">
                    <span className="text-[10px] uppercase font-bold text-purple-400">
                      Assigned ML Model (Internal 4k Variant — Admin Only)
                    </span>
                    <div className="text-base font-mono font-bold text-white mt-1">
                      {detailData.variant ? (
                        <span>{detailData.variant.label}: {detailData.variant.hiddenModel} ({detailData.variant.estimator})</span>
                      ) : (
                        <span className="text-slate-500">Unassigned</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ground Truth Reference Values for this Candidate */}
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                      Ground Truth Reference Standards (In-Person Verification)
                    </span>
                    <span className="text-[10px] text-indigo-400 font-mono">Confidential Admin View</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                      <div className="text-[11px] font-bold text-slate-300 mb-1">Round 1 (Linear Regression)</div>
                      <div className="text-slate-400 space-y-0.5">
                        <div>MAE:  <span className="text-white font-bold">{detailData.referenceMetrics?.round1?.mae}</span></div>
                        <div>RMSE: <span className="text-white font-bold">{detailData.referenceMetrics?.round1?.rmse}</span></div>
                        <div>MSE:  <span className="text-white font-bold">{detailData.referenceMetrics?.round1?.mse}</span></div>
                      </div>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                      <div className="text-[11px] font-bold text-slate-300 mb-1">
                        Round 3 ({detailData.variant?.hiddenModel || 'Variant'})
                      </div>
                      <div className="text-slate-400 space-y-0.5">
                        <div>MAE:  <span className="text-white font-bold">{detailData.referenceMetrics?.round3?.mae}</span></div>
                        <div>RMSE: <span className="text-white font-bold">{detailData.referenceMetrics?.round3?.rmse}</span></div>
                        <div>MSE:  <span className="text-white font-bold">{detailData.referenceMetrics?.round3?.mse}</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ROUND 1 REVIEW CONTROLS */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white uppercase">Round 1 Review (30 pts)</span>
                      <span className={`badge py-0.5 px-2 text-[10px] ${
                        detailData.round1.status === 'APPROVED' ? 'badge-emerald' : detailData.round1.status === 'PENDING_VERIFICATION' ? 'badge-amber' : 'badge-slate'
                      }`}>
                        {detailData.round1.status}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-indigo-300">{detailData.round1.points} pts</span>
                  </div>

                  {detailData.round1.status !== 'APPROVED' ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => setReviewConfirm({ round: 1, action: 'APPROVE' })}
                        className="btn btn-emerald text-xs !py-1.5 !px-3 flex items-center gap-1.5"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Approve Round 1 (+30 pts)</span>
                      </button>

                      <button
                        onClick={() => setReviewConfirm({ round: 1, action: 'REJECT' })}
                        className="btn btn-danger text-xs !py-1.5 !px-3 flex items-center gap-1.5"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span>Reject Round 1</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approved by {detailData.round1.approvedBy || 'Admin'} on {new Date(detailData.round1.approvedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* ROUND 2 STATUS & ROUND 3 RELEASE CONTROL */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white uppercase">Round 2 Anagram & Round 3 Release</span>
                      <span className={`badge py-0.5 px-2 text-[10px] ${
                        detailData.round2.status === 'SOLVED' ? 'badge-emerald' : 'badge-slate'
                      }`}>
                        {detailData.round2.status}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-amber-400">{detailData.round2.points} pts</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="text-slate-400 font-mono">
                      Round 3 Boilerplate Release Status:{' '}
                      <span className={detailData.round3.boilerplateReleased ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {detailData.round3.boilerplateReleased ? 'RELEASED' : 'LOCKED'}
                      </span>
                    </div>

                    {!detailData.round3.boilerplateReleased && detailData.round2.status === 'SOLVED' && (
                      <button
                        onClick={() => handleReleaseBoilerplate(detailData.id)}
                        disabled={actionLoading}
                        className="btn btn-primary text-xs !py-1.5 !px-3 flex items-center gap-1.5"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Release Round 3 Starter Boilerplate</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* ROUND 3 REVIEW CONTROLS */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white uppercase">Round 3 Review (70 pts)</span>
                      <span className={`badge py-0.5 px-2 text-[10px] ${
                        detailData.round3.status === 'APPROVED' ? 'badge-emerald' : detailData.round3.status === 'PENDING_VERIFICATION' ? 'badge-cyan' : 'badge-slate'
                      }`}>
                        {detailData.round3.status}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-cyan-400">{detailData.round3.points} pts</span>
                  </div>

                  {detailData.round3.status !== 'APPROVED' ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => setReviewConfirm({ round: 3, action: 'APPROVE' })}
                        disabled={detailData.round2.status !== 'SOLVED'}
                        className="btn btn-emerald text-xs !py-1.5 !px-3 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Approve Round 3 (+70 pts)</span>
                      </button>

                      <button
                        onClick={() => setReviewConfirm({ round: 3, action: 'REJECT' })}
                        disabled={detailData.round2.status !== 'SOLVED'}
                        className="btn btn-danger text-xs !py-1.5 !px-3 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span>Reject Round 3</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approved by {detailData.round3.approvedBy || 'Admin'} on {new Date(detailData.round3.approvedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* DECISION HISTORY TABLE */}
                {detailData.decisions && detailData.decisions.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Decision History for this Candidate
                    </div>
                    <div className="space-y-1.5">
                      {detailData.decisions.map((d) => (
                        <div key={d.id} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between font-mono">
                          <div className="flex items-center gap-2">
                            <span className={`badge py-0.5 px-2 text-[10px] ${
                              d.action === 'APPROVE' ? 'badge-emerald' : 'badge-rose'
                            }`}>
                              Round {d.round} {d.action}
                            </span>
                            <span className="text-slate-300">{d.reason || 'No comment provided'}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            By {d.adminName} • {new Date(d.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG MODAL */}
      {reviewConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="glass-panel max-w-md w-full p-6 border-amber-500/50 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                reviewConfirm.action === 'APPROVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">
                  Confirm {reviewConfirm.action === 'APPROVE' ? 'Approval' : 'Rejection'}
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Round {reviewConfirm.round} • Participant: {detailData?.registrationId} ({detailData?.webId})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {reviewConfirm.action === 'APPROVE' ? (
                <span>
                  Are you sure you have verified the participant's locally calculated metrics against the ground truth reference values? This will award{' '}
                  <strong className="text-emerald-400">{reviewConfirm.round === 1 ? '30' : '70'} points</strong> and cannot be undone.
                </span>
              ) : (
                <span>
                  Are you sure you want to reject this attempt? No points will be awarded. You may specify an optional reason below.
                </span>
              )}
            </p>

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
                Decision Notes / Reason (Optional)
              </label>
              <textarea
                rows={2}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={reviewConfirm.action === 'APPROVE' ? 'Verified in person against reference metrics' : 'Metrics did not satisfy reference thresholds'}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewConfirm(null)}
                className="btn btn-secondary text-xs !py-2 !px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReviewAction(reviewConfirm.round, reviewConfirm.action)}
                disabled={actionLoading}
                className={`btn text-xs !py-2 !px-4 font-bold ${
                  reviewConfirm.action === 'APPROVE' ? 'btn-emerald' : 'btn-danger'
                }`}
              >
                {actionLoading ? 'Saving...' : `Confirm ${reviewConfirm.action === 'APPROVE' ? 'Approve' : 'Reject'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Round Confirmation Modal */}
      {confirmEndOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel max-w-md w-full p-6 border-rose-500/50 bg-[#0d1322]">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold font-[Outfit] text-white">End Competition Round?</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-6">
              Are you sure you want to immediately end this competition round? The remaining time will be set to zero and all incoming participant submissions and verification requests will be closed.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmEndOpen(false)}
                className="btn btn-secondary text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndCompetition}
                disabled={compLoading}
                className="btn bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-5 py-2"
              >
                {compLoading ? 'Ending...' : 'Yes, End Round Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restart Round Confirmation Modal */}
      {confirmStartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel max-w-md w-full p-6 border-amber-500/50 bg-[#0d1322]">
            <div className="flex items-center gap-3 text-amber-400 mb-4">
              <RotateCcw className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold font-[Outfit] text-white">Restart Competition Round?</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-6">
              The competition is currently active. Are you sure you want to restart the round with a new timer of {durationInput} minutes?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmStartOpen(false)}
                className="btn btn-secondary text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleStartCompetition(true)}
                disabled={compLoading}
                className="btn bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-5 py-2"
              >
                {compLoading ? 'Restarting...' : 'Yes, Restart Round'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
