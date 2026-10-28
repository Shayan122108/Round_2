import React, { useState, useEffect } from 'react';
import { X, Download, FileSpreadsheet, Sparkles, RefreshCw } from 'lucide-react';

export default function ClueDatasetModal({
  isOpen,
  onClose,
  unlocked
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && unlocked) {
      setLoading(true);
      fetch('/api/datasets/clue/preview')
        .then(res => res.json())
        .then(d => {
          setData(d.data || d);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isOpen, unlocked]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel max-w-5xl w-full max-h-[85vh] flex flex-col border-cyan-500/40 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg font-[Outfit] text-white">
                  Personalized Clue Dataset
                </h3>
                <span className="badge badge-indigo text-cyan-300 border-cyan-500/30 text-xs">
                  {data?.totalRows || 35} Samples
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)]">
                Tailored inspection samples supporting your team's anagram solution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/datasets/clue"
              download="clue_dataset.csv"
              className="btn btn-primary !py-2 !px-3 text-xs flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950/80">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <span className="text-xs">Loading clue samples...</span>
            </div>
          ) : data && data.preview && data.preview.length > 0 ? (
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs text-slate-300 font-mono">
                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] sticky top-0">
                  <tr>
                    {data.headers.map((h) => (
                      <th key={h} className="py-2.5 px-3 whitespace-nowrap border-b border-slate-800">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.preview.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      {data.headers.map((h) => (
                        <td key={h} className="py-2 px-3 whitespace-nowrap">
                          {row[h] !== undefined && row[h] !== '' ? row[h] : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No clue samples found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-slate-900/40 flex justify-between items-center text-xs text-[var(--text-dim)]">
          <span>Showing sample preview from assigned dataset</span>
          <button onClick={onClose} className="btn btn-secondary !py-1.5 !px-3 text-xs">
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
