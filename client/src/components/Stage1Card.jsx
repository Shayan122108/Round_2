import React, { useState } from 'react';
import { Download, CheckCircle2, AlertCircle, Clock, FileCode, ArrowRight, UserCheck, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Stage1Card({
  dashboardData,
  csrfToken,
  onRefreshTeam
}) {
  const [requesting, setRequesting] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const stage1 = dashboardData?.stages?.stage1;
  const status = stage1?.status || 'IN_PROGRESS';
  const isApproved = stage1?.completed;
  const isPending = status === 'PENDING_VERIFICATION';
  const isRejected = status === 'REJECTED';

  const handleRequestVerification = async () => {
    setRequesting(true);
    setMsg('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/rounds/request-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ round: 1 }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to request verification.');
      }

      setMsg('Verification requested! Please call an invigilator to show your locally calculated metrics.');
      onRefreshTeam();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className={`glass-panel p-6 sm:p-8 transition-all ${
      isApproved
        ? 'border-emerald-500/40 bg-emerald-950/10'
        : isPending
        ? 'border-amber-500/40 bg-amber-950/10'
        : 'border-indigo-500/20'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center font-mono text-sm border border-indigo-500/30">
              01
            </span>
            <h2 className="text-xl sm:text-2xl font-bold font-[Outfit] text-white">
              Round 1 — Linear Regression
            </h2>
            {isApproved ? (
              <span className="badge badge-emerald">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approved (+30 pts)
              </span>
            ) : isPending ? (
              <span className="badge badge-amber">
                <Clock className="w-3.5 h-3.5 animate-spin" /> Pending In-Person Verification
              </span>
            ) : isRejected ? (
              <span className="badge badge-rose">
                <AlertCircle className="w-3.5 h-3.5" /> Needs Revision
              </span>
            ) : (
              <span className="badge badge-indigo">
                30 Points Available
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-2xl">
            Train a <strong>Linear Regression</strong> model locally using VS Code, Jupyter Notebook, or Google Colab. Evaluate your model using <strong>MAE</strong>, <strong>RMSE</strong>, and <strong>MSE</strong>.
          </p>
        </div>

        {/* Status Pill */}
        <div className="text-right">
          <div className="text-xs uppercase font-semibold text-[var(--text-dim)]">Status</div>
          <div className={`text-base font-bold ${
            isApproved
              ? 'text-emerald-400'
              : isPending
              ? 'text-amber-400'
              : isRejected
              ? 'text-rose-400'
              : 'text-indigo-400'
          }`}>
            {isApproved
              ? 'Approved (+30 pts)'
              : isPending
              ? 'Awaiting Invigilator Review'
              : isRejected
              ? 'Rejected — Revise & Retest'
              : 'In Progress'}
          </div>
        </div>
      </div>

      {/* Downloads Section */}
      <div className="mb-6 bg-slate-900/60 rounded-xl p-4 sm:p-5 border border-[var(--border-subtle)]">
        <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Step 1: Download Challenge Datasets & Starter Boilerplate
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="/api/datasets/round1/train"
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
            href="/api/datasets/round1/test"
            download="test.csv"
            className="btn btn-secondary !py-2.5 !px-3 text-xs flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>test.csv</span>
            </div>
            <span className="text-[10px] text-[var(--text-dim)] font-mono">Holdout Set</span>
          </a>

          <a
            href="/api/datasets/round1/boilerplate"
            download="linear_regression_boilerplate.py"
            className="btn btn-secondary !py-2.5 !px-3 text-xs flex items-center justify-between group border-indigo-500/30"
          >
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Starter Boilerplate</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono">Python Template</span>
          </a>
        </div>
      </div>

      {/* Instructions & Offline Verification Flow */}
      <div className="p-4 sm:p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 mb-6">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Step 2: Train Locally & Show Metrics In Person
        </div>
        <div className="text-xs text-[var(--text-muted)] space-y-1.5 leading-relaxed">
          <p>• Participants train and evaluate their model <strong>locally on their own machine</strong>.</p>
          <p>• Calculate your evaluation metrics: <strong>Mean Absolute Error (MAE)</strong>, <strong>Root Mean Squared Error (RMSE)</strong>, and <strong>Mean Squared Error (MSE)</strong>.</p>
          <p>• Once ready, call an invigilator to your desk and show your locally calculated metrics for manual verification.</p>
          <p>• The invigilator will compare your metrics against authorized admin reference values and approve or reject your submission directly in the admin panel.</p>
        </div>
      </div>

      {/* Feedback & Notifications */}
      {isRejected && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-200 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-rose-300">Attempt Needs Adjustment:</div>
            <p className="mt-0.5">
              {stage1?.rejectionReason || 'Your locally calculated metrics did not meet the reference thresholds.'}
            </p>
            <p className="mt-1 text-[11px] text-rose-300/80">
              Refine your hyperparameters, re-calculate MAE, RMSE, and MSE, and call an invigilator when ready for re-verification.
            </p>
          </div>
        </div>
      )}

      {msg && (
        <div className="p-3 mb-4 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 mb-4 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="text-xs text-[var(--text-dim)]">
          {isApproved ? (
            <span className="text-emerald-400 font-medium">
              ✓ Round 1 Approved! 30 points awarded. Proceed to Round 2 below.
            </span>
          ) : isPending ? (
            <span className="text-amber-300 font-medium flex items-center gap-1.5">
              <Clock className="w-4 h-4 animate-spin text-amber-400" />
              Your request is active. An invigilator will review your laptop screen shortly.
            </span>
          ) : (
            <span>No uploads required. All verification takes place offline with an invigilator.</span>
          )}
        </div>

        {!isApproved && (
          <button
            type="button"
            onClick={handleRequestVerification}
            disabled={requesting || isPending}
            className={`btn text-xs !py-2.5 !px-5 flex items-center gap-2 ${
              isPending
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-not-allowed'
                : 'btn-primary'
            }`}
          >
            {requesting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Requesting...</span>
              </>
            ) : isPending ? (
              <>
                <Clock className="w-4 h-4" />
                <span>Awaiting Invigilator Review</span>
              </>
            ) : isRejected ? (
              <>
                <UserCheck className="w-4 h-4" />
                <span>Call Invigilator for Re-Verification</span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                <span>Call Invigilator / Request Verification</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
