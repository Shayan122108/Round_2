import React from 'react';
import { Trophy, CheckCircle2, AlertTriangle, Sparkles, Code2, FileSpreadsheet, Lock } from 'lucide-react';
import Stage1Card from './Stage1Card';
import AnagramCard from './AnagramCard';
import Stage2Card from './Stage2Card';

export default function ContestantDashboard({
  authUser,
  dashboardData,
  csrfToken,
  onRefreshTeam,
  onOpenClueModal,
  onOpenBoilerplate,
  onOpenLogin
}) {
  if (!authUser) {
    return (
      <div className="p-16 text-center glass-panel max-w-lg mx-auto">
        <Lock className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold font-[Outfit] text-white">Sign In Required</h3>
        <p className="text-xs text-[var(--text-muted)] mt-2 mb-6">
          Please log in with your assigned Team Registration ID and PIN to participate.
        </p>
        <button onClick={onOpenLogin} className="btn btn-primary text-xs px-6 py-2.5">
          Sign In Now
        </button>
      </div>
    );
  }

  const s1Pts = dashboardData?.breakdown?.stage1 || 0;
  const anaPts = dashboardData?.breakdown?.anagram || 0;
  const s2Pts = dashboardData?.breakdown?.stage2 || 0;
  const penalties = dashboardData?.breakdown?.penalties || 0;
  const totalScore = dashboardData?.score?.total || 0;

  const stage1Qualified = dashboardData?.stages?.stage1?.completed;
  const anagramSolved = dashboardData?.stages?.anagram?.completed;
  const stage2Qualified = dashboardData?.stages?.stage2?.completed;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* HUD Score Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Score Card */}
        <div className="col-span-2 sm:col-span-1 glass-card !p-4 border-indigo-500/40 bg-indigo-950/20">
          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] font-semibold uppercase">
            <span>Total Score</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="font-mono font-black text-3xl sm:text-4xl text-white">
              {totalScore}
            </span>
            <span className="text-xs text-[var(--text-dim)] font-mono">/ 150</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-1">
            Max potential: {Math.max(0, 150 - penalties)} pts
          </div>
        </div>

        {/* Stage 1 Points */}
        <div className="glass-card !p-4 border-slate-800">
          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] font-semibold uppercase">
            <span>Stage 1</span>
            {stage1Qualified ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-600" />
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`font-mono font-black text-2xl ${
              stage1Qualified ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              {s1Pts}
            </span>
            <span className="text-xs text-[var(--text-dim)] font-mono">/ 30 pts</span>
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-1">
            Logistic Regression (.joblib)
          </div>
        </div>

        {/* Anagram Points */}
        <div className="glass-card !p-4 border-slate-800">
          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] font-semibold uppercase">
            <span>Anagram</span>
            {anagramSolved ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-600" />
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`font-mono font-black text-2xl ${
              anagramSolved ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              {anaPts}
            </span>
            <span className="text-xs text-[var(--text-dim)] font-mono">/ 50 pts</span>
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-1">
            Algorithm Discovery
          </div>
        </div>

        {/* Anagram Penalties */}
        <div className={`glass-card !p-4 ${
          penalties > 0 ? 'border-rose-500/40 bg-rose-950/20' : 'border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] font-semibold uppercase">
            <span>Penalties</span>
            <AlertTriangle className={`w-4 h-4 ${penalties > 0 ? 'text-rose-400' : 'text-slate-600'}`} />
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`font-mono font-black text-2xl ${
              penalties > 0 ? 'text-rose-400' : 'text-slate-400'
            }`}>
              -{penalties}
            </span>
            <span className="text-xs text-[var(--text-dim)] font-mono">pts</span>
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-1">
            {dashboardData?.breakdown?.incorrectAttempts || 0} wrong attempt(s)
          </div>
        </div>

        {/* Stage 2 Points */}
        <div className="glass-card !p-4 border-slate-800">
          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] font-semibold uppercase">
            <span>Stage 2</span>
            {stage2Qualified ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-600" />
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`font-mono font-black text-2xl ${
              stage2Qualified ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              {s2Pts}
            </span>
            <span className="text-xs text-[var(--text-dim)] font-mono">/ 70 pts</span>
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-1">
            Variant Benchmark (.joblib)
          </div>
        </div>
      </div>

      {/* Quick Action Banner for Unlocked Assets */}
      {(stage1Qualified || anagramSolved) && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs uppercase font-bold text-indigo-300">Milestone Unlocks Available</span>
              <p className="text-xs text-[var(--text-dim)]">Access your team's personalized materials directly</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {stage1Qualified && (
              <button
                onClick={onOpenClueModal}
                className="btn btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                <span>Clue Dataset (Preview / Download)</span>
              </button>
            )}
            {anagramSolved && (
              <button
                onClick={onOpenBoilerplate}
                className="btn btn-emerald !py-1.5 !px-3 text-xs flex items-center gap-1.5"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{dashboardData?.reveal?.algorithmName} Template</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stage 1 Component */}
      <Stage1Card
        dashboardData={dashboardData}
        csrfToken={csrfToken}
        onRefreshTeam={onRefreshTeam}
      />

      {/* Anagram Puzzle Component */}
      <AnagramCard
        dashboardData={dashboardData}
        csrfToken={csrfToken}
        onRefreshTeam={onRefreshTeam}
        onOpenClueModal={onOpenClueModal}
        onOpenBoilerplate={onOpenBoilerplate}
      />

      {/* Stage 2 Component */}
      <Stage2Card
        dashboardData={dashboardData}
        csrfToken={csrfToken}
        onRefreshTeam={onRefreshTeam}
      />
    </div>
  );
}
