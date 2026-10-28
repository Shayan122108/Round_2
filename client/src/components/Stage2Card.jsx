import React, { useState } from 'react';
import { Lock, Download, Upload, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, Trophy, FileCode } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Stage2Card({
  dashboardData,
  csrfToken,
  onRefreshTeam
}) {
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submissionId, setSubmissionId] = useState(null);

  const isLocked = !dashboardData?.stages?.anagram?.completed;
  const isQualified = dashboardData?.stages?.stage2?.completed;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('Please select a trained scikit-learn .joblib model pipeline.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/submissions/stage2', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        body: formData
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Evaluation failed.');
      }

      setSubmissionId(data.data.submissionId);
      pollResult(data.data.submissionId);
    } catch (err) {
      setErrorMsg(err.message);
      setIsSubmitting(false);
    }
  };

  const pollResult = async (subId) => {
    try {
      const res = await fetch(`/api/submissions/${subId}`);
      if (res.ok) {
        const data = await res.json();
        const sub = data.data;
        if (sub.status === 'COMPLETED' || sub.status === 'FAILED') {
          setResult(sub.result);
          setIsSubmitting(false);
          if (sub.result?.qualified) {
            confetti({
              particleCount: 150,
              spread: 90,
              origin: { y: 0.5 }
            });
          }
          onRefreshTeam();
          return;
        }
      }
      setTimeout(() => pollResult(subId), 2000);
    } catch (err) {
      setTimeout(() => pollResult(subId), 3000);
    }
  };

  return (
    <div className={`glass-panel p-6 sm:p-8 transition-all ${
      isLocked
        ? 'opacity-65 border-slate-800'
        : isQualified
        ? 'border-emerald-500/50 bg-emerald-950/10'
        : 'border-cyan-500/30'
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
                : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
            }`}>
              03
            </span>
            <h2 className="text-xl sm:text-2xl font-bold font-[Outfit] text-white">
              Stage 2 — Secret Variant ML Benchmark (.joblib)
            </h2>
            {isQualified ? (
              <span className="badge badge-emerald">
                <CheckCircle2 className="w-3.5 h-3.5" /> Stage 2 Cleared (+70 pts)
              </span>
            ) : isLocked ? (
              <span className="badge badge-indigo text-slate-400 border-slate-700">
                <Lock className="w-3 h-3" /> Locked
              </span>
            ) : (
              <span className="badge bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                70 Points Available
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-2xl">
            {isLocked
              ? 'Solve the Anagram challenge to unlock the Stage 2 training dataset and custom model boilerplate.'
              : `Train your unlocked model (${dashboardData?.reveal?.algorithmName}) on stage2_train.csv and upload your exported .joblib pipeline.`}
          </p>
        </div>

        {/* Status Pill */}
        <div className="text-right">
          <div className="text-xs uppercase font-semibold text-[var(--text-dim)]">Status</div>
          <div className={`text-base font-bold ${
            isQualified ? 'text-emerald-400' : isLocked ? 'text-slate-500' : 'text-cyan-400'
          }`}>
            {isQualified ? 'Stage 2 Completed' : isLocked ? 'Locked' : 'Awaiting Submission'}
          </div>
        </div>
      </div>

      {isLocked ? (
        <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800 text-[var(--text-muted)] flex flex-col items-center justify-center">
          <Lock className="w-10 h-10 text-slate-600 mb-3" />
          <h4 className="font-bold text-white text-base">Stage 2 Benchmark Locked</h4>
          <p className="text-xs text-[var(--text-dim)] max-w-md mt-1">
            Solve the Anagram puzzle to unlock Stage 2 training data and model requirements.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Dataset Downloads */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
              Step 1: Download Stage 2 Training Dataset & Starter Module
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="/api/datasets/stage2/train"
                download="stage2_train.csv"
                className="btn btn-secondary !py-2.5 !px-3 text-xs flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>stage2_train.csv</span>
                </div>
                <span className="text-[10px] text-[var(--text-dim)] font-mono">1,200 rows</span>
              </a>

              <a
                href="/api/datasets/challenge-features"
                download="challenge_features.py"
                className="btn btn-secondary !py-2.5 !px-3 text-xs flex items-center justify-between group border-cyan-500/30"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>challenge_features.py</span>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono">Helper Script</span>
              </a>
            </div>
          </div>

          {/* Submission Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Step 2: Submit Trained Stage 2 Artifact (.joblib)
              </label>
              <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-6 text-center bg-slate-950/40 transition-all flex flex-col items-center justify-center relative cursor-pointer group">
                <input
                  type="file"
                  accept=".joblib"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-8 h-8 text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-semibold text-white">
                  {file ? file.name : 'Choose or drop stage2_model.joblib'}
                </p>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  Evaluated in non-root Docker sandbox against private holdout test features
                </p>
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
                Stage 2 qualification awards 70 milestone points (max 150 points total).
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !file}
                className="btn btn-primary bg-cyan-600 hover:bg-cyan-500"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Evaluating in Isolated Worker...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Stage 2 Model</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Evaluation Results Banner */}
          {result && (
            <div className={`mt-6 rounded-xl p-5 border transition-all ${
              result.qualified
                ? 'bg-emerald-950/20 border-emerald-500/40'
                : 'bg-amber-950/20 border-amber-500/40'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {result.qualified ? (
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
                      {result.qualified ? 'Stage 2 Completed!' : 'Benchmark Threshold Not Met'}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      {result.qualified
                        ? 'Sensational performance! Full Stage 2 points (70 pts) awarded.'
                        : result.message || 'Model did not satisfy the target accuracy and macro F1 requirements.'}
                    </p>
                  </div>
                </div>

                {result.accuracy !== null && (
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-[var(--text-dim)] font-semibold">Accuracy</div>
                      <div className="font-mono font-bold text-lg text-white">
                        {(result.accuracy * 100).toFixed(1)}%
                      </div>
                    </div>
                    {result.f1 !== null && (
                      <div className="text-right">
                        <div className="text-[10px] uppercase text-[var(--text-dim)] font-semibold">Macro F1</div>
                        <div className="font-mono font-bold text-lg text-cyan-300">
                          {(result.f1 * 100).toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
