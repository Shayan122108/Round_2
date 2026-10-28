import React from 'react';
import { Trophy, Clock, Shield, Terminal, Sparkles, LogOut, LogIn } from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  authUser,
  competition,
  timeRemaining,
  onOpenTeamModal,
  onLogout
}) {
  const formatTime = (secs) => {
    if (secs === null || isNaN(secs)) return '90:00';
    const m = Math.floor(Math.max(0, secs) / 60);
    const s = Math.max(0, secs) % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeRemaining !== null && timeRemaining < 10 * 60;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border-subtle)] bg-[#080d1a]/85 backdrop-blur-md">
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 h-20 flex items-center justify-between gap-4">
        {/* Brand & Competition Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/25 flex items-center justify-center">
            <div className="w-full h-full bg-[#0b0f19] rounded-[11px] flex items-center justify-center text-indigo-400">
              <Terminal className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight font-[Outfit] text-white">
                ML <span className="text-indigo-400">CHALLENGE</span>
              </span>
              <span className="badge badge-indigo text-[10px] tracking-wide uppercase py-0.5 px-2">
                Round 2 Platform
              </span>
            </div>
            <p className="text-xs text-[var(--text-dim)]">Precision Parts Sorting Line</p>
          </div>
        </div>

        {/* 90-Minute Timer Badge */}
        <div className="hidden md:flex items-center gap-4">
          <div className={`glass-card !py-1.5 !px-3.5 flex items-center gap-2.5 border ${
            isLowTime ? 'border-rose-500/50 bg-rose-950/20 text-rose-300' : 'border-indigo-500/30 text-indigo-200'
          }`}>
            <Clock className={`w-4 h-4 ${isLowTime ? 'text-rose-400 animate-spin' : 'text-indigo-400'}`} />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)]">Time Remaining</div>
              <div className={`font-mono font-bold text-base tracking-widest ${isLowTime ? 'text-rose-400' : 'text-white'}`}>
                {formatTime(timeRemaining)}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {authUser?.role === 'PARTICIPANT' && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`btn text-xs sm:text-sm !py-2 !px-3 sm:!px-4 ${
                activeTab === 'dashboard'
                  ? 'btn-primary'
                  : 'btn-secondary text-[var(--text-muted)] hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`btn text-xs sm:text-sm !py-2 !px-3 sm:!px-4 ${
              activeTab === 'leaderboard'
                ? 'btn-primary'
                : 'btn-secondary text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Leaderboard</span>
          </button>

          {authUser?.role === 'ADMIN' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`btn text-xs sm:text-sm !py-2 !px-3 sm:!px-4 ${
                activeTab === 'admin'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 hover:bg-purple-600/30'
                  : 'btn-secondary text-[var(--text-muted)] hover:text-purple-300'
              }`}
            >
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Admin Portal</span>
            </button>
          )}
        </nav>

        {/* User Identity / Login Button */}
        <div className="flex items-center gap-3">
          {authUser ? (
            <div className="flex items-center gap-2">
              <div className="glass-card !py-1.5 !px-3 border-indigo-500/30 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div className="text-left">
                  <div className="text-xs font-bold text-white leading-none">
                    {authUser.displayName || authUser.registrationId}
                  </div>
                  <div className="text-[10px] text-indigo-300 font-mono">
                    {authUser.registrationId} [{authUser.role}]
                  </div>
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="btn btn-secondary !p-2 text-slate-400 hover:text-rose-400"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenTeamModal}
              className="btn btn-primary text-xs !py-2 !px-3.5 flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
