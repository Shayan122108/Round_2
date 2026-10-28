import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw, Medal } from 'lucide-react';

export default function Leaderboard({ authUser }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const body = await res.json();
        setData(body.data?.leaderboard || []);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-panel p-6 sm:p-8 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-[Outfit] text-white">
              Official Live Leaderboard
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Rankings determined by authoritative database scores with time-based tie breaking
            </p>
          </div>
        </div>

        <button
          onClick={fetchLeaderboard}
          disabled={loading}
          className="btn btn-secondary !py-2 !px-3 text-xs flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-[var(--text-dim)] uppercase font-mono border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Rank</th>
              <th className="py-3 px-4">Participant / Team</th>
              <th className="py-3 px-4 text-center">Stage 1</th>
              <th className="py-3 px-4 text-center">Anagram</th>
              <th className="py-3 px-4 text-center">Stage 2</th>
              <th className="py-3 px-4 text-right">Total Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {data.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-8 text-center text-slate-500">
                  {loading ? 'Loading rankings...' : 'No participant scores recorded yet.'}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={item.rank}
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-3.5 px-4 font-bold">
                    {item.rank === 1 ? (
                      <span className="flex items-center gap-1 text-amber-400">
                        <Medal className="w-4 h-4" /> 1
                      </span>
                    ) : item.rank === 2 ? (
                      <span className="flex items-center gap-1 text-slate-300">
                        <Medal className="w-4 h-4" /> 2
                      </span>
                    ) : item.rank === 3 ? (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Medal className="w-4 h-4" /> 3
                      </span>
                    ) : (
                      <span className="text-slate-400">#{item.rank}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-sans font-semibold text-white">
                    {item.name}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {item.stages?.stage1 ? (
                      <span className="badge badge-emerald py-0.5 px-2 text-[10px]">30 pts</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {item.stages?.anagram ? (
                      <span className="badge badge-emerald py-0.5 px-2 text-[10px]">50 pts</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {item.stages?.stage2 ? (
                      <span className="badge badge-emerald py-0.5 px-2 text-[10px]">70 pts</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-sm text-indigo-400">
                    {item.totalScore} / 150
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
