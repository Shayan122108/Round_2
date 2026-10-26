import React from 'react';
import { Trophy, CheckCircle2, AlertTriangle, Sparkles, Code2, FileSpreadsheet, Clock } from 'lucide-react';
import Stage1Card from './Stage1Card';
import AnagramCard from './AnagramCard';
import Stage2Card from './Stage2Card';

export default function ContestantDashboard({
  currentTeam,
  onRefreshTeam,
  onOpenClueModal,
  onOpenBoilerplate
}) {
  if (!currentTeam) {
    return (
      <div className="p-12 text-center text-slate-400 glass-panel">
        <p className="text-sm">Please select a team to view the contestant dashboard.</p>
      </div>
    );
  }

  const s1Pts = currentTeam.stage1Points || 0;
  const anaPts = currentTeam.anagramPoints || 0;
  const s2Pts = currentTeam.stage2Points || 0;
  const penalties = (currentTeam.anagramIncorrectAttempts || 0) * 30;
  const totalScore = currentTeam.totalScore || 0;

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
            {currentTeam.stage1Qualified ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-600" />
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`font-mono font-black text-2xl ${
              currentTeam.stage1Qualified ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              {s1Pts}
            </span>
            <span className="text-xs text-[var(--text-dim)] font-mono">/ 30 pts</span>
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-1">
            Logistic Regression
          </div>
        </div>

        {/* Anagram Points */}
        <div className="glass-card !p-4 border-slate-800">
          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] font-semibold uppercase">
            <span>Anagram</span>
            {currentTeam.anagramSolved ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-600" />
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`font-mono font-black text-2xl ${
              currentTeam.anagramSolved ? 'text-emerald-400' : 'text-slate-400'
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
            {currentTeam.anagramIncorrectAttempts || 0} wrong {currentTeam.anagramIncorrectAttempts === 1 ? 'guess' : 'guesses'}
          </div>
        </div>

        {/* Stage 2 Points */}
        <div className="glass-card !p-4 border-slate-800">
          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] font-semibold uppercase">
            <span>Stage 2</span>
            {currentTeam.stage2Qualified ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-600" />
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`font-mono font-black text-2xl ${
              currentTeam.stage2Qualified ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              {s2Pts}
            </span>
            <span className="text-xs text-[var(--text-dim)] font-mono">/ 70 pts</span>
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-1">
            Final ML Benchmark
          </div>
        </div>

      </div>

      {/* Quick Action Banner for Unlocked Assets */}
      {(currentTeam.stage1Qualified || currentTeam.anagramSolved) && (
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
            {currentTeam.stage1Qualified && (
              <button
                onClick={onOpenClueModal}
                className="btn btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                <span>Clue Dataset (35 rows)</span>
              </button>
            )}
            {currentTeam.anagramSolved && (
              <button
                onClick={onOpenBoilerplate}
                className="btn btn-emerald !py-1.5 !px-3 text-xs flex items-center gap-1.5"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{currentTeam.algorithmName} Template</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stage 1 Component */}
      <Stage1Card
        team={currentTeam}
        onRefreshTeam={onRefreshTeam}
        onSubmissionSuccess={onRefreshTeam}
      />

      {/* Anagram Puzzle Component */}
      <AnagramCard
        team={currentTeam}
        onRefreshTeam={onRefreshTeam}
        onOpenClueModal={onOpenClueModal}
        onOpenBoilerplate={onOpenBoilerplate}
      />

      {/* Stage 2 Component */}
      <Stage2Card
        team={currentTeam}
        onRefreshTeam={onRefreshTeam}
      />

    </div>
  );
}
