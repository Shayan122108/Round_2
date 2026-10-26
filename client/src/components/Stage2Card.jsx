import React, { useState } from 'react';
import { Lock, Download, Upload, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, Trophy, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Stage2Card({
  team,
  onRefreshTeam
}) {
  const [file, setFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const isLocked = !team.anagramSolved;
  const isQualified = team.stage2Qualified;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && !csvText.trim()) {
      setErrorMsg('Please select a CSV file or paste predictions.');
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
      const res = await fetch('/api/submissions/stage2', {
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
          particleCount: 150,
          spread: 90,
          origin: { y: 0.4 }
        });
      }
      onRefreshTeam();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`glass-panel p-6 sm:p-8 transition-all ${
      isLocked
        ? 'opacity-65 border-slate-800'
        : isQualified
        ? 'border-emerald-500/40 bg-emerald-950/10'
        : 'border-indigo-500/30'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center font-mono text-sm border ${
              isLocked
                ? 'bg-slate-800 text-slate-500 border-slate-700'
                : isQualified
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
            }`}>
              03
            </span>
            <h2 className="text-xl sm:text-2xl font-bold font-[Outfit] text-white">
              Stage 2 — Final ML Evaluation
            </h2>
            {isQualified ? (
              <span className="badge badge-emerald">
                <CheckCircle2 className="w-3.5 h-3.5" /> Qualified (+70 pts)
              </span>
            ) : isLocked ? (
              <span className="badge badge-indigo text-slate-400 border-slate-700">
                <Lock className="w-3 h-3" /> Locked
              </span>
            ) : (
              <span className="badge badge-indigo">
                70 Points Available
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-2xl">
            {isLocked
              ? 'Solve the Anagram challenge to unlock this stage and receive your required algorithm boilerplate.'
              : 'Train your unlocked model on the Stage 2 dataset and submit final test predictions. The evaluator benchmarks against hidden variant-specific targets.'}
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs uppercase font-semibold text-[var(--text-dim)]">Status</div>
          <div className={`text-base font-bold ${
            isQualified ? 'text-emerald-400' : isLocked ? 'text-slate-500' : 'text-indigo-400'
          }`}>
            {isQualified ? 'Final Stage Cleared' : isLocked ? 'Locked' : 'Ready for Submission'}
          </div>
        </div>
      </div>

      {isLocked ? (
        <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800 text-[var(--text-muted)] flex flex-col items-center justify-center">
          <Lock className="w-10 h-10 text-slate-600 mb-3" />
          <h4 className="font-bold text-white text-base">Stage 2 Milestone Locked</h4>
          <p className="text-xs text-[var(--text-dim)] max-w-md mt-1">
            Solve the Anagram puzzle in Stage 2 to reveal your required model architecture and unlock submission access.
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Dataset Downloads */}
          <div className="bg-slate-900/60 rounded-xl p-4 border border-[var(--border-subtle)]">
            <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
              Step 1: Download Stage 2 Datasets
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="/api/datasets/stage2/train"
                download="stage2_train.csv"
                className="btn btn-secondary !py-2.5 !px-3 text-xs flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span>stage2_train.csv</span>
                </div>
                <span className="text-[10px] text-[var(--text-dim)] font-mono">Training Data</span>
              </a>

              <a
                href="/api/datasets/stage2/test"
                download="stage2_test.csv"
                className="btn btn-secondary !py-2.5 !px-3 text-xs flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>stage2_test.csv</span>
                </div>
                <span className="text-[10px] text-[var(--text-dim)] font-mono">Test Features</span>
              </a>
            </div>
          </div>

          {/* Submission Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Step 2: Submit Final Predictions (CSV)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-5 text-center bg-slate-950/40 transition-all flex flex-col items-center justify-center relative cursor-pointer group">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-8 h-8 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-semibold text-white">
                    {file ? file.name : 'Choose or drop stage2_submission.csv'}
                  </p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">
                    Columns: <span className="font-mono text-indigo-300">id, prediction</span>
                  </p>
                </div>

                <div>
                  <textarea
                    value={csvText}
                    onChange={(e) => { setCsvText(e.target.value); setFile(null); }}
                    placeholder="Or paste Stage 2 predictions:&#10;id,prediction&#10;P12001,67&#10;..."
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
                Evaluator assesses accuracy and Macro-F1 against your team's private benchmark.
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Evaluating Final Model...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Stage 2 Predictions</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Results Feedback */}
          {result && (
            <div className={`p-5 rounded-xl border transition-all ${
              result.passed
                ? 'bg-emerald-950/20 border-emerald-500/40'
                : 'bg-amber-950/20 border-amber-500/40'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  {result.passed ? (
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                      <Trophy className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-base text-white">
                      {result.passed ? 'Stage 2 Successfully Cleared!' : 'Evaluation Criteria Not Met'}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      {result.passed
                        ? 'Sensational! Your model achieved the target threshold. 70 milestone points awarded.'
                        : 'Your model predictions did not meet the required target accuracy or macro-F1. Try tuning hyper-parameters.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-[var(--text-dim)] font-semibold">Accuracy</div>
                    <div className="font-mono font-bold text-lg text-white">
                      {(result.metrics.accuracy * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-[var(--text-dim)] font-semibold">Macro F1</div>
                    <div className="font-mono font-bold text-lg text-cyan-400">
                      {(result.metrics.macroF1 * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
