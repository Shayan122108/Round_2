import React from 'react';
import { Trophy, CheckCircle2, AlertCircle, Clock, Sparkles, Lock, ArrowRight, UserCheck } from 'lucide-react';
import Stage1Card from './Stage1Card';
import AnagramCard from './AnagramCard';
import Stage2Card from './Stage2Card';

export default function ContestantDashboard({
  authUser,
  dashboardData,
  csrfToken,
  onRefreshTeam,
  onOpenLogin
}) {
  if (!authUser) {
    return (
      <div className="p-16 text-center glass-panel max-w-lg mx-auto">
        <Lock className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold font-[Outfit] text-white">Sign In Required</h3>
        <p className="text-xs text-[var(--text-muted)] mt-2 mb-6">
          Please enter your assigned Registration ID (<code className="text-indigo-300 font-mono">SDC-2026-XXX</code>) to access the competition platform.
        </p>
        <button onClick={onOpenLogin} className="btn btn-primary text-xs px-6 py-2.5">
          Sign In Now
        </button>
      </div>
    );
  }

  const totalScore = dashboardData?.score?.total || 0;
  const webId = authUser.webId || dashboardData?.user?.webId;
  const formattedWebId = webId ? `WEB-${String(webId).padStart(3, '0')}` : 'WEB-???';

  const r1Completed = dashboardData?.stages?.stage1?.completed;
  const r1Status = dashboardData?.stages?.stage1?.status || 'IN_PROGRESS';
  const r1Pts = dashboardData?.breakdown?.round1 || 0;

  const r2Completed = dashboardData?.stages?.anagram?.completed;
  const r2Status = dashboardData?.stages?.anagram?.status || 'LOCKED';
  const r2Pts = dashboardData?.breakdown?.round2 || 0;

  const r3Completed = dashboardData?.stages?.stage2?.completed;
  const r3Status = dashboardData?.stages?.stage2?.status || 'LOCKED';
  const r3Pts = dashboardData?.breakdown?.round3 || 0;
  const r3Released = dashboardData?.stages?.stage2?.boilerplateReleased;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Participant Identity & HUD */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Participant Web ID Card */}
        <div className="col-span-2 sm:col-span-1 glass-card !p-4 border-indigo-500/40 bg-indigo-950/20">
          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] font-semibold uppercase">
            <span>Participant ID</span>
            <UserCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-mono font-black text-2xl sm:text-3xl text-white">
              {formattedWebId}
            </span>
          </div>
          <div className="text-[11px] text-indigo-300 font-mono mt-1">
            {authUser.registrationId}
          </div>
        </div>

        {/* Total Score Card */}
        <div className="col-span-2 sm:col-span-1 glass-card !p-4 border-amber-500/40 bg-amber-950/15">
          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] font-semibold uppercase">
            <span>Total Score</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="font-mono font-black text-3xl sm:text-4xl text-amber-300">
              {totalScore}
            </span>
            <span className="text-xs text-[var(--text-dim)] font-mono">/ 150</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-1">
            Max Score: 150 points
          </div>
        </div>

        {/* Round 1 Status Pill */}
        <div className={`glass-card !p-4 ${r1Completed ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-slate-800'}`}>
          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] font-semibold uppercase">
            <span>Round 1</span>
            {r1Completed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : r1Status === 'PENDING_VERIFICATION' ? (
              <Clock className="w-4 h-4 text-amber-400 animate-spin" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-600" />
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`font-mono font-black text-2xl ${r1Completed ? 'text-emerald-400' : 'text-slate-400'}`}>
              {r1Pts}
            </span>
            <span className="text-xs text-[var(--text-dim)] font-mono">/ 30 pts</span>
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-1 truncate">
            {r1Completed ? 'Verified & Approved' : r1Status === 'PENDING_VERIFICATION' ? 'Awaiting Verification' : 'Linear Regression'}
          </div>
        </div>

        {/* Round 2 Status Pill */}
        <div className={`glass-card !p-4 ${r2Completed ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-slate-800'}`}>
          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] font-semibold uppercase">
            <span>Round 2</span>
            {r2Completed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : !r1Completed ? (
              <Lock className="w-3.5 h-3.5 text-slate-600" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`font-mono font-black text-2xl ${r2Completed ? 'text-emerald-400' : 'text-slate-400'}`}>
              {r2Pts}
            </span>
            <span className="text-xs text-[var(--text-dim)] font-mono">/ 50 pts</span>
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-1 truncate">
            {r2Completed ? 'Anagram Solved' : !r1Completed ? 'Locked (Needs R1)' : 'Decode the Model'}
          </div>
        </div>

        {/* Round 3 Status Pill */}
        <div className={`glass-card !p-4 ${r3Completed ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-slate-800'}`}>
          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] font-semibold uppercase">
            <span>Round 3</span>
            {r3Completed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : !r2Completed ? (
              <Lock className="w-3.5 h-3.5 text-slate-600" />
            ) : r3Status === 'PENDING_VERIFICATION' ? (
              <Clock className="w-4 h-4 text-cyan-400 animate-spin" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`font-mono font-black text-2xl ${r3Completed ? 'text-emerald-400' : 'text-slate-400'}`}>
              {r3Pts}
            </span>
            <span className="text-xs text-[var(--text-dim)] font-mono">/ 70 pts</span>
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-1 truncate">
            {r3Completed ? 'Completed (+70 pts)' : !r2Completed ? 'Locked (Needs R2)' : !r3Released ? 'Awaiting Release' : 'Assigned ML Model'}
          </div>
        </div>
      </div>

      {/* Progress Milestone Notification */}
      {r3Completed ? (
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 to-indigo-950/40 border border-emerald-500/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs uppercase font-bold text-emerald-300">Competition Completed!</span>
              <p className="text-xs text-white font-medium">All 3 rounds verified and approved. Final score: 150/150 points.</p>
            </div>
          </div>
        </div>
      ) : r2Completed && !r3Released ? (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/60 to-indigo-950/40 border border-amber-500/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs uppercase font-bold text-amber-300">Round 2 Solved — Next Step</span>
              <p className="text-xs text-slate-300">
                You successfully solved the anagram! Please notify an invigilator to release your Round 3 model boilerplate starter code.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Round 1 Card */}
      <Stage1Card
        dashboardData={dashboardData}
        csrfToken={csrfToken}
        onRefreshTeam={onRefreshTeam}
      />

      {/* Round 2 Card */}
      <AnagramCard
        dashboardData={dashboardData}
        csrfToken={csrfToken}
        onRefreshTeam={onRefreshTeam}
      />

      {/* Round 3 Card */}
      <Stage2Card
        dashboardData={dashboardData}
        csrfToken={csrfToken}
        onRefreshTeam={onRefreshTeam}
      />
    </div>
  );
}
