import React, { useState } from 'react';
import { Download, Upload, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, FileCode } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Stage1Card({
  dashboardData,
  csrfToken,
  onRefreshTeam
}) {
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submissionId, setSubmissionId] = useState(null);

  const stage1Qualified = dashboardData?.stages?.stage1?.completed;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('Please select a trained scikit-learn .joblib pipeline file.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/submissions/stage1', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        body: formData
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Submission failed.');
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
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
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
      stage1Qualified ? 'border-emerald-500/40' : 'border-indigo-500/20'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center font-mono text-sm border border-indigo-500/30">
              01
            </span>
            <h2 className="text-xl sm:text-2xl font-bold font-[Outfit] text-white">
              Stage 1 — Logistic Regression Pipeline (.joblib)
            </h2>
            {stage1Qualified ? (
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
            Train a scikit-learn <strong>LogisticRegression</strong> Pipeline on the training parts (target <code>sort_bin</code> ASCII 65-90). Upload your exported <code>.joblib</code> artifact for sandbox evaluation.
          </p>
        </div>

        {/* Status Pill */}
        <div className="text-right">
          <div className="text-xs uppercase font-semibold text-[var(--text-dim)]">Status</div>
          <div className={`text-base font-bold ${stage1Qualified ? 'text-emerald-400' : 'text-amber-400'}`}>
            {stage1Qualified ? 'Stage 1 Completed' : 'Awaiting Qualification'}
          </div>
        </div>
      </div>

      {/* Dataset & Helper Download Section */}
      <div className="mb-6 bg-slate-900/60 rounded-xl p-4 border border-[var(--border-subtle)]">
        <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Step 1: Download Permitted Datasets & Feature Engineering Helper
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="/api/datasets/stage1/train"
            download="train.csv"
            className="btn btn-secondary !py-2.5 !px-3 text-xs flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>train.csv</span>
            </div>
            <span className="text-[10px] text-[var(--text-dim)] font-mono">1,600 rows (18 features + sort_bin)</span>
          </a>

          <a
            href="/api/datasets/challenge-features"
            download="challenge_features.py"
            className="btn btn-secondary !py-2.5 !px-3 text-xs flex items-center justify-between group border-indigo-500/30"
          >
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>challenge_features.py</span>
            </div>
            <span className="text-[10px] text-cyan-400 font-mono">Pre-installed Sandbox Module</span>
          </a>
        </div>
      </div>

      {/* Submission Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Step 2: Submit Trained Logistic Regression Model (.joblib)
          </label>
          <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-6 text-center bg-slate-950/40 transition-all flex flex-col items-center justify-center relative cursor-pointer group">
            <input
              type="file"
              accept=".joblib"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <Upload className="w-8 h-8 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-sm font-semibold text-white">
              {file ? file.name : 'Choose or drop trained model.joblib'}
            </p>
            <p className="text-xs text-[var(--text-dim)] mt-1">
              File must be a scikit-learn Pipeline created with <span className="font-mono text-indigo-300">joblib.dump(pipeline, "model.joblib")</span>
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
            Asynchronously evaluated in an isolated Docker container against private test features.
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !file}
            className="btn btn-primary"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Evaluating in Sandbox Queue...</span>
              </>
            ) : (
              <>
                <span>Submit .joblib Model</span>
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
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
                  <AlertCircle className="w-6 h-6" />
                </div>
              )}
              <div>
                <h4 className="font-bold text-base text-white">
                  {result.qualified ? 'Stage 1 Qualified!' : 'Evaluation Threshold Not Met'}
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  {result.qualified
                    ? 'Congratulations! You qualified Stage 1. 30 milestone points awarded.'
                    : result.message || `Accuracy of ${(result.accuracy * 100).toFixed(1)}% is below the required 75% threshold.`}
                </p>
              </div>
            </div>

            {result.accuracy !== null && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] uppercase text-[var(--text-dim)] font-semibold">Test Accuracy</div>
                  <div className="font-mono font-bold text-lg text-white">
                    {(result.accuracy * 100).toFixed(1)}%
                  </div>
                </div>
                {result.durationMs && (
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-[var(--text-dim)] font-semibold">Duration</div>
                    <div className="font-mono font-bold text-sm text-cyan-400">
                      {result.durationMs}ms
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
