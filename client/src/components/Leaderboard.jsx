import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Search, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function Leaderboard({ currentTeamId }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      if (data.leaderboard) {
        setTeams(data.leaderboard);
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    let interval = null;
    if (autoRefresh) {
      interval = setInterval(fetchLeaderboard, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(filter.toLowerCase()) ||
    t.id.toLowerCase().includes(filter.toLowerCase())
  );

  const top3 = teams.slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Title & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold font-[Outfit] text-white flex items-center gap-2.5">
            <Trophy className="w-8 h-8 text-amber-400" />
            <span>Competition Leaderboard</span>
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Official rankings: Milestone points earned minus 30-point anagram penalties, bounded between 0 and 150.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search team or ID..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-900/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-indigo-500 w-48 sm:w-60"
            />
          </div>

          <button
            onClick={fetchLeaderboard}
            className="btn btn-secondary !p-2"
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {teams.length >= 3 && !filter && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          
          {/* #2 Silver */}
          <div className="glass-card flex flex-col items-center text-center p-6 border-slate-400/30 relative order-2 md:order-1 mt-4 md:mt-6">
            <div className="w-12 h-12 rounded-full bg-slate-300/10 border border-slate-300/40 text-slate-300 flex items-center justify-center font-bold text-xl mb-3 shadow-lg">
              <Medal className="w-6 h-6 text-slate-300" />
            </div>
            <span className="badge badge-secondary text-[11px] mb-1 font-mono uppercase tracking-wider text-slate-300">
              Rank #2
            </span>
            <h3 className="font-bold text-lg text-white font-[Outfit]">{top3[1]?.name}</h3>
            <span className="text-xs text-[var(--text-dim)] font-mono">{top3[1]?.id}</span>
            <div className="font-mono font-black text-3xl text-slate-200 mt-3">
              {top3[1]?.totalScore} <span className="text-xs font-normal text-slate-400">pts</span>
            </div>
            <div className="flex gap-2 mt-4 text-[10px]">
              <span className={`badge ${top3[1]?.stage1Qualified ? 'badge-emerald' : 'badge-secondary'}`}>S1: 30</span>
              <span className={`badge ${top3[1]?.anagramSolved ? 'badge-emerald' : 'badge-secondary'}`}>Ana: 50</span>
              <span className={`badge ${top3[1]?.stage2Qualified ? 'badge-emerald' : 'badge-secondary'}`}>S2: 70</span>
            </div>
          </div>

          {/* #1 Gold */}
          <div className="glass-card flex flex-col items-center text-center p-6 border-amber-500/50 relative order-1 md:order-2 bg-amber-950/10 shadow-xl shadow-amber-500/10">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center font-bold text-2xl mb-3 shadow-xl shadow-amber-500/30">
              <Trophy className="w-8 h-8 text-amber-400" />
            </div>
            <span className="badge badge-amber text-xs mb-1 font-mono uppercase tracking-wider">
              Leader #1
            </span>
            <h3 className="font-bold text-xl text-white font-[Outfit]">{top3[0]?.name}</h3>
            <span className="text-xs text-amber-400/80 font-mono">{top3[0]?.id}</span>
            <div className="font-mono font-black text-4xl text-amber-300 mt-3">
              {top3[0]?.totalScore} <span className="text-sm font-normal text-amber-400/70">pts</span>
            </div>
            <div className="flex gap-2 mt-4 text-[10px]">
              <span className={`badge ${top3[0]?.stage1Qualified ? 'badge-emerald' : 'badge-secondary'}`}>S1: 30</span>
              <span className={`badge ${top3[0]?.anagramSolved ? 'badge-emerald' : 'badge-secondary'}`}>Ana: 50</span>
              <span className={`badge ${top3[0]?.stage2Qualified ? 'badge-emerald' : 'badge-secondary'}`}>S2: 70</span>
            </div>
          </div>

          {/* #3 Bronze */}
          <div className="glass-card flex flex-col items-center text-center p-6 border-amber-700/40 relative order-3 mt-4 md:mt-8">
            <div className="w-12 h-12 rounded-full bg-amber-800/20 border border-amber-700/50 text-amber-600 flex items-center justify-center font-bold text-xl mb-3 shadow-lg">
              <Award className="w-6 h-6 text-amber-600" />
            </div>
            <span className="badge badge-secondary text-[11px] mb-1 font-mono uppercase tracking-wider text-amber-600">
              Rank #3
            </span>
            <h3 className="font-bold text-lg text-white font-[Outfit]">{top3[2]?.name}</h3>
            <span className="text-xs text-[var(--text-dim)] font-mono">{top3[2]?.id}</span>
            <div className="font-mono font-black text-3xl text-amber-500 mt-3">
              {top3[2]?.totalScore} <span className="text-xs font-normal text-slate-400">pts</span>
            </div>
            <div className="flex gap-2 mt-4 text-[10px]">
              <span className={`badge ${top3[2]?.stage1Qualified ? 'badge-emerald' : 'badge-secondary'}`}>S1: 30</span>
              <span className={`badge ${top3[2]?.anagramSolved ? 'badge-emerald' : 'badge-secondary'}`}>Ana: 50</span>
              <span className={`badge ${top3[2]?.stage2Qualified ? 'badge-emerald' : 'badge-secondary'}`}>S2: 70</span>
            </div>
          </div>

        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="glass-panel overflow-hidden border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-[var(--text-dim)] uppercase font-mono tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Rank</th>
                <th className="py-3.5 px-4">Team</th>
                <th className="py-3.5 px-4 text-center">Stage 1 (30p)</th>
                <th className="py-3.5 px-4 text-center">Anagram (50p)</th>
                <th className="py-3.5 px-4 text-center">Penalties (-30p ea)</th>
                <th className="py-3.5 px-4 text-center">Stage 2 (70p)</th>
                <th className="py-3.5 px-4 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredTeams.map((team, idx) => {
                const isCurrent = team.id === currentTeamId;
                const penalties = team.anagramIncorrectAttempts || 0;
                return (
                  <tr
                    key={team.id}
                    className={`transition-colors ${
                      isCurrent
                        ? 'bg-indigo-950/40 hover:bg-indigo-950/60 font-semibold'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-slate-300">
                      {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-[Outfit] text-sm">
                          {team.name}
                        </span>
                        <span className="text-[11px] text-[var(--text-dim)]">({team.id})</span>
                        {isCurrent && (
                          <span className="badge badge-indigo text-[10px] py-0 px-1.5">You</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {team.stage1Qualified ? (
                        <span className="text-emerald-400 font-bold flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> +30
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {team.anagramSolved ? (
                        <span className="text-emerald-400 font-bold flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> +50
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {penalties > 0 ? (
                        <span className="text-rose-400 font-bold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/30">
                          {penalties} ({`-${penalties * 30}`})
                        </span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {team.stage2Qualified ? (
                        <span className="text-emerald-400 font-bold flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> +70
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-base font-extrabold text-white">
                        {team.totalScore}
                      </span>
                      <span className="text-[10px] text-[var(--text-dim)] ml-1">/ 150</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
