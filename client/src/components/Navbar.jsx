import React from 'react';
import { Trophy, Clock, Shield, Terminal, Sparkles, LogOut, LogIn, UserCheck } from 'lucide-react';

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
    if (secs === null || isNaN(secs)) return '60:00';
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
                SDC <span className="text-indigo-400">ML CHALLENGE</span>
              </span>
              <span className="badge badge-indigo text-[10px] tracking-wide uppercase py-0.5 px-2">
                3-Round Competition
              </span>
            </div>
            <p className="text-xs text-[var(--text-dim)]">Precision Machine Learning Competition</p>
          </div>
        </div>

        {/* Round Timer Badge */}
        <div className="hidden md:flex items-center gap-4">
          <div className={`glass-card !py-1.5 !px-3.5 flex items-center gap-2.5 border ${
            competition?.status === 'PAUSED'
              ? 'border-amber-500/50 bg-amber-950/25 text-amber-300'
              : competition?.status === 'ENDED' || timeRemaining === 0
              ? 'border-rose-500/50 bg-rose-950/25 text-rose-300'
              : (!competition?.status || competition?.status === 'NOT_STARTED')
              ? 'border-slate-700 bg-slate-900/40 text-slate-400'
              : isLowTime
              ? 'border-rose-500/50 bg-rose-950/20 text-rose-300'
              : 'border-indigo-500/30 text-indigo-200'
          }`}>
            <Clock className={`w-4 h-4 ${
              competition?.status === 'RUNNING'
                ? isLowTime ? 'text-rose-400 animate-spin' : 'text-indigo-400 animate-pulse'
                : competition?.status === 'PAUSED'
                ? 'text-amber-400'
                : 'text-slate-500'
            }`} />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)] flex items-center gap-1.5">
                <span>Time Remaining</span>
                {competition?.status === 'PAUSED' && (
                  <span className="badge badge-amber text-[9px] py-0 px-1 font-mono">PAUSED</span>
                )}
                {competition?.status === 'ENDED' && (
                  <span className="badge badge-rose text-[9px] py-0 px-1 font-mono">ENDED</span>
                )}
              </div>
              <div className={`font-mono font-bold text-base tracking-widest ${
                competition?.status === 'PAUSED'
                  ? 'text-amber-300'
                  : competition?.status === 'ENDED'
                  ? 'text-rose-400'
                  : isLowTime
                  ? 'text-rose-400'
                  : 'text-white'
              }`}>
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
              <span>Participant Dashboard</span>
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
              <span>Admin Panel</span>
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
                  <div className="text-xs font-bold text-white leading-none flex items-center gap-1.5">
                    {authUser.webId ? (
                      <span className="badge badge-indigo text-[10px] py-0 px-1.5 font-mono">
                        WEB-{String(authUser.webId).padStart(3, '0')}
                      </span>
                    ) : null}
                    <span>{authUser.displayName || authUser.registrationId}</span>
                  </div>
                  <div className="text-[10px] text-indigo-300 font-mono mt-0.5">
                    {authUser.registrationId} • {authUser.role}
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
