import React, { useState } from 'react';
import { Download, Upload, CheckCircle2, AlertCircle, FileText, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Stage1Card({
  team,
  onRefreshTeam,
  onSubmissionSuccess
}) {
  const [file, setFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showDetailedRows, setShowDetailedRows] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && !csvText.trim()) {
      setErrorMsg('Please select a CSV file or paste submission content.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setResult(null);

    const formData = new FormData();
    formData.append('teamId', team.id);
    if (file) {
      formData.append('file', file);
    } else {
      formData.append('csvContent', csvText);
    }

    try {
      const res = await fetch('/api/submissions/stage1', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Evaluation failed.');
      }

      setResult(data);
      if (data.passed) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
        if (onSubmissionSuccess) onSubmissionSuccess();
      }
      onRefreshTeam();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseBaselineSample = () => {
    // Helpful testing helper: populates sample submission or test predictions
    const sampleText = `id,prediction\n`;
    setCsvText(sampleText);
  };

  return (
    <div className={`glass-panel p-6 sm:p-8 transition-all ${
      team.stage1Qualified ? 'border-emerald-500/40' : 'border-indigo-500/20'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center font-mono text-sm border border-indigo-500/30">
              01
            </span>
            <h2 className="text-xl sm:text-2xl font-bold font-[Outfit] text-white">
              Stage 1 — Logistic Regression
            </h2>
            {team.stage1Qualified ? (
              <span className="badge badge-emerald">
                <CheckCircle2 className="w-3.5 h-3.5" /> Qualified (+30 pts)
              </span>
            ) : (
              <span className="badge badge-indigo">
                30 Points Available
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-2xl">
            Train a <strong>Logistic Regression</strong> model on the 1,600 training parts to classify 26 sorting bins (ASCII codes 65–90). Predict the test parts and decode the hidden letters.
          </p>
        </div>

        {/* Status Pill */}
        <div className="text-right">
          <div className="text-xs uppercase font-semibold text-[var(--text-dim)]">Status</div>
          <div className={`text-base font-bold ${team.stage1Qualified ? 'text-emerald-400' : 'text-amber-400'}`}>
            {team.stage1Qualified ? 'Stage 1 Completed' : 'Awaiting Qualification'}
          </div>
        </div>
      </div>

      {/* Dataset Download Section */}
      <div className="mb-6 bg-slate-900/60 rounded-xl p-4 border border-[var(--border-subtle)]">
        <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Step 1: Download Required Datasets
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="/api/datasets/train"
            download="train.csv"
            className="btn btn-secondary !py-2.5 !px-3 text-xs flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>train.csv</span>
            </div>
            <span className="text-[10px] text-[var(--text-dim)] font-mono">1,600 rows</span>
          </a>

          <a
            href={`/api/datasets/test/${team.id}`}
            download="test.csv"
            className="btn btn-secondary !py-2.5 !px-3 text-xs flex items-center justify-between group border-indigo-500/30"
          >
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>test.csv</span>
            </div>
            <span className="text-[10px] text-cyan-400 font-mono">Assigned Test</span>
          </a>

          <a
            href={`/api/datasets/sample-submission/${team.id}`}
            download="sample_submission.csv"
            className="btn btn-secondary !py-2.5 !px-3 text-xs flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-[var(--text-dim)] group-hover:scale-110 transition-transform" />
              <span>sample_submission.csv</span>
            </div>
            <span className="text-[10px] text-[var(--text-dim)] font-mono">id,prediction</span>
          </a>
        </div>
      </div>

      {/* Submission Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Step 2: Submit Predictions (CSV)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* File Chooser Drag Area */}
            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-5 text-center bg-slate-950/40 transition-all flex flex-col items-center justify-center relative cursor-pointer group">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-8 h-8 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-semibold text-white">
                {file ? file.name : 'Choose or drop submission.csv'}
              </p>
              <p className="text-xs text-[var(--text-dim)] mt-1">
                Required columns: <span className="font-mono text-indigo-300">id, prediction</span>
              </p>
            </div>

            {/* Quick Paste or Manual Entry */}
            <div>
              <textarea
                value={csvText}
                onChange={(e) => { setCsvText(e.target.value); setFile(null); }}
                placeholder="Or paste CSV content here:&#10;id,prediction&#10;P78165,65&#10;P56216,68&#10;..."
                className="w-full h-32 bg-slate-950/70 border border-slate-800 focus:border-indigo-500/70 rounded-xl p-3 text-xs font-mono text-slate-200 outline-none resize-none"
              />
            </div>

          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-[var(--text-dim)]">
            Retries are permitted until the 90-minute deadline. Qualifying awards 30 points once.
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Evaluating against Hidden Labels...</span>
              </>
            ) : (
              <>
                <span>Evaluate Predictions</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Evaluation Results Banner / Modal Details */}
      {result && (
        <div className={`mt-6 rounded-xl p-5 border transition-all ${
          result.passed
            ? 'bg-emerald-950/20 border-emerald-500/40'
            : 'bg-amber-950/20 border-amber-500/40'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              {result.passed ? (
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
                  <AlertCircle className="w-6 h-6" />
                </div>
              )}
              <div>
                <h4 className="font-bold text-base text-white">
                  {result.passed ? 'Stage 1 Qualified!' : 'Threshold Not Met'}
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  {result.passed
                    ? 'Congratulations! You qualified for Stage 1. 30 milestone points awarded.'
                    : `Achieved accuracy of ${(result.metrics.accuracy * 100).toFixed(1)}% is below the required ${(result.metrics.targetAccuracy * 100).toFixed(0)}% target.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase text-[var(--text-dim)] font-semibold">Accuracy</div>
                <div className="font-mono font-bold text-lg text-white">
                  {(result.metrics.accuracy * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase text-[var(--text-dim)] font-semibold">Correct Letters</div>
                <div className="font-mono font-bold text-lg text-cyan-400">
                  {result.metrics.correctCount} / {result.metrics.totalCount}
                </div>
              </div>
            </div>
          </div>

          {/* Decoded Letter Sequence Preview */}
          {result.metrics.decodedString && (
            <div className="mt-3 p-3 bg-slate-900/80 rounded-lg border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-dim)]">Decoded Letters from Predictions:</span>
                <span className="font-mono font-bold tracking-widest text-indigo-300 text-sm bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30">
                  {result.metrics.decodedString}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailedRows(!showDetailedRows)}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                {showDetailedRows ? 'Hide row breakdown' : 'View row-by-row breakdown'}
              </button>
            </div>
          )}

          {/* Detailed Row-by-Row Table */}
          {showDetailedRows && result.detailedBreakdown && (
            <div className="mt-4 max-h-60 overflow-y-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs text-[var(--text-muted)]">
                <thead className="bg-slate-950 text-[var(--text-dim)] uppercase font-mono sticky top-0">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Test ID</th>
                    <th className="py-2 px-3">Predicted Sort Bin</th>
                    <th className="py-2 px-3">ASCII Character</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {result.detailedBreakdown.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 font-mono">
                      <td className="py-2 px-3 text-[var(--text-dim)]">{r.row}</td>
                      <td className="py-2 px-3 font-semibold text-white">{r.id}</td>
                      <td className="py-2 px-3 text-cyan-300">{r.predictedCode}</td>
                      <td className="py-2 px-3 text-indigo-300 font-bold">{r.decodedChar}</td>
                      <td className="py-2 px-3">
                        {r.isCorrect ? (
                          <span className="text-emerald-400 font-semibold">Match</span>
                        ) : (
                          <span className="text-amber-400">Mismatch</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
