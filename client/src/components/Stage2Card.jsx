import React, { useState } from 'react';
import { Lock, Download, CheckCircle2, AlertCircle, Clock, Trophy, RefreshCw, UserCheck, FileCode, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Stage2Card({
  dashboardData,
  csrfToken,
  onRefreshTeam
}) {
  const [requesting, setRequesting] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isR2Solved = dashboardData?.stages?.anagram?.completed;
  const stage2 = dashboardData?.stages?.stage2;
  const status = stage2?.status || 'LOCKED';
  const isApproved = stage2?.completed;
  const isPending = status === 'PENDING_VERIFICATION';
  const isRejected = status === 'REJECTED';
  const isReleased = stage2?.boilerplateReleased;
  const assignedModel = dashboardData?.reveal?.algorithmName;

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
        body: JSON.stringify({ round: 3 }),
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
    <div className={`glass-panel p-6 sm:p-8 transition-all relative overflow-hidden ${
      !isR2Solved
        ? 'opacity-65 border-slate-800'
        : isApproved
        ? 'border-emerald-500/50 bg-emerald-950/10'
        : isPending
        ? 'border-cyan-500/40 bg-cyan-950/10'
        : 'border-cyan-500/30'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center font-mono text-sm border ${
              !isR2Solved
                ? 'bg-slate-800 text-slate-500 border-slate-700'
                : isApproved
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
            }`}>
              03
            </span>
            <h2 className="text-xl sm:text-2xl font-bold font-[Outfit] text-white">
              Round 3 — Assigned ML Model Challenge
            </h2>
            {isApproved ? (
              <span className="badge badge-emerald">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approved (+70 pts)
              </span>
            ) : !isR2Solved ? (
              <span className="badge badge-indigo text-slate-400 border-slate-700">
                <Lock className="w-3 h-3" /> Locked
              </span>
            ) : !isReleased ? (
              <span className="badge badge-amber">
                <Clock className="w-3.5 h-3.5" /> Awaiting Admin Release
              </span>
            ) : isPending ? (
              <span className="badge badge-cyan">
                <Clock className="w-3.5 h-3.5 animate-spin" /> Pending In-Person Verification
              </span>
            ) : isRejected ? (
              <span className="badge badge-rose">
                <AlertCircle className="w-3.5 h-3.5" /> Needs Revision
              </span>
            ) : (
              <span className="badge bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                70 Points Available
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-2xl">
            {!isR2Solved
              ? 'Solve Round 2 Decode the Model to discover your assigned machine learning algorithm and unlock Round 3.'
              : 'Now prove your model. Train your assigned algorithm on train.csv and evaluate using MAE, RMSE, and MSE.'}
          </p>
        </div>

        {/* Status Pill */}
        <div className="text-right">
          <div className="text-xs uppercase font-semibold text-[var(--text-dim)]">Status</div>
          <div className={`text-base font-bold ${
            isApproved
              ? 'text-emerald-400'
              : !isR2Solved
              ? 'text-slate-500'
              : !isReleased
              ? 'text-amber-400'
              : isPending
              ? 'text-cyan-400'
              : isRejected
              ? 'text-rose-400'
              : 'text-cyan-400'
          }`}>
            {isApproved
              ? 'Challenge Completed (+70 pts)'
              : !isR2Solved
              ? 'Locked'
              : !isReleased
              ? 'Awaiting Admin Release'
              : isPending
              ? 'Awaiting Invigilator Review'
              : isRejected
              ? 'Rejected — Revise & Retest'
              : 'Ready to Train'}
          </div>
        </div>
      </div>

      {!isR2Solved ? (
        <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800 text-[var(--text-muted)] flex flex-col items-center justify-center">
          <Lock className="w-10 h-10 text-slate-600 mb-3" />
          <h4 className="font-bold text-white text-base">Round 3 Locked</h4>
          <p className="text-xs text-[var(--text-dim)] max-w-md mt-1">
            Solve the Round 2 anagram challenge first to unlock your assigned machine learning algorithm and Round 3 access.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Assigned Model Banner */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/20 border border-cyan-500/40">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Now Prove Your Model</span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xs text-slate-400 font-semibold">Your assigned model:</span>
                  <span className="text-xl sm:text-2xl font-black font-mono tracking-wider text-white">
                    {assignedModel || 'Loading...'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Implement and train this specific algorithm locally to compete for the final 70 points.
                </p>
              </div>

              {/* Boilerplate Download Button */}
              <div>
                {isReleased ? (
                  <a
                    href="/api/datasets/round3/boilerplate"
                    download="round3_boilerplate.py"
                    className="btn btn-emerald text-xs !py-3 !px-5 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Released Boilerplate</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="btn bg-slate-800/80 text-slate-500 border border-slate-700 text-xs !py-3 !px-5 flex items-center gap-2 cursor-not-allowed"
                    title="Boilerplate must be released by an invigilator first"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Boilerplate Locked (Awaiting Admin Release)</span>
                  </button>
                )}
              </div>
            </div>

            {!isReleased && (
              <div className="mt-4 p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2">
                <Clock className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>
                  <strong>Admin Action Required:</strong> Please inform an invigilator that you have reached Round 3. An authorized wing member will release your starter boilerplate through the admin panel.
                </span>
              </div>
            )}
          </div>

          {/* Offline Verification Instructions */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Step 2: Train Locally & Present Metrics
            </div>
            <div className="text-xs text-[var(--text-muted)] space-y-1.5 leading-relaxed">
              <p>1. Download your released starter boilerplate once enabled by the invigilator.</p>
              <p>2. Train your assigned model locally on <code className="text-cyan-300 font-mono">train.csv</code>.</p>
              <p>3. Calculate your local evaluation metrics: <strong>MAE</strong>, <strong>RMSE</strong>, and <strong>MSE</strong>.</p>
              <p>4. Once ready, call an invigilator to show your locally calculated metrics in person.</p>
              <p>5. The invigilator will compare your metrics against the authorized reference values for your assigned variant in the admin panel and finalize approval.</p>
            </div>
          </div>

          {/* Feedback Alerts */}
          {isRejected && (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-300">Attempt Needs Adjustment:</div>
                <p className="mt-0.5">
                  {stage2?.rejectionReason || 'Metrics did not satisfy reference thresholds.'}
                </p>
                <p className="mt-1 text-[11px] text-rose-300/80">
                  Refine your model and parameters locally, re-calculate your metrics, and request re-verification when ready.
                </p>
              </div>
            </div>
          )}

          {msg && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{msg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="text-xs text-[var(--text-dim)]">
              {isApproved ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Round 3 Approved! 70 points awarded. Maximum score of 150 points achieved!
                </span>
              ) : isPending ? (
                <span className="text-cyan-300 font-medium flex items-center gap-1.5">
                  <Clock className="w-4 h-4 animate-spin text-cyan-400" />
                  Your verification request is active. An invigilator will inspect your screen shortly.
                </span>
              ) : !isReleased ? (
                <span>Call an invigilator to release your starter boilerplate template.</span>
              ) : (
                <span>Train locally on your machine. Show metrics to an invigilator for manual approval.</span>
              )}
            </div>

            {!isApproved && isReleased && (
              <button
                type="button"
                onClick={handleRequestVerification}
                disabled={requesting || isPending}
                className={`btn text-xs !py-2.5 !px-5 flex items-center gap-2 ${
                  isPending
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 cursor-not-allowed'
                    : 'btn-primary bg-cyan-600 hover:bg-cyan-500 text-white'
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
      )}
    </div>
  );
}
