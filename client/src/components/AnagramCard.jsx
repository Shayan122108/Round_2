import React, { useState } from 'react';
import { Lock, CheckCircle2, Download, Send, RefreshCw, AlertCircle, Sparkles, KeyRound } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function AnagramCard({
  dashboardData,
  csrfToken,
  onRefreshTeam
}) {
  const [guess, setGuess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const isLocked = !dashboardData?.stages?.stage1?.completed;
  const isSolved = dashboardData?.stages?.anagram?.completed;
  const attempts = dashboardData?.stages?.anagram?.attempts || 0;
  const revealedModel = dashboardData?.reveal?.algorithmName;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!guess.trim()) {
      setErrorMsg('Please enter a decoded model name.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setFeedback(null);

    try {
      const res = await fetch('/api/rounds/round2/check-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ answer: guess.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Answer submission failed.');
      }

      setFeedback(data.data);

      if (data.data?.correct) {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 },
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
    <div className={`glass-panel p-6 sm:p-8 transition-all relative overflow-hidden ${
      isLocked
        ? 'opacity-65 border-slate-800'
        : isSolved
        ? 'border-emerald-500/40 bg-emerald-950/10'
        : 'border-amber-500/30'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center font-mono text-sm border ${
              isLocked
                ? 'bg-slate-800 text-slate-500 border-slate-700'
                : isSolved
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              02
            </span>
            <h2 className="text-xl sm:text-2xl font-bold font-[Outfit] text-white">
              Round 2 — Decode the Model
            </h2>
            {isSolved ? (
              <span className="badge badge-emerald">
                <CheckCircle2 className="w-3.5 h-3.5" /> Solved (+50 pts)
              </span>
            ) : isLocked ? (
              <span className="badge badge-indigo text-slate-400 border-slate-700">
                <Lock className="w-3 h-3" /> Locked
              </span>
            ) : (
              <span className="badge badge-amber">
                50 Points Available
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-2xl">
            {isLocked
              ? 'Complete and receive approval for Round 1 Linear Regression to unlock Round 2 materials.'
              : 'Generate numerical predictions locally on small_test.csv, convert the values to ASCII characters, and solve the anagram to identify your secret assigned model.'}
          </p>
        </div>

        {/* Status & Attempts */}
        <div className="text-right">
          <div className="text-xs uppercase font-semibold text-[var(--text-dim)]">Status</div>
          <div className={`text-base font-bold ${
            isSolved ? 'text-emerald-400' : isLocked ? 'text-slate-500' : 'text-amber-400'
          }`}>
            {isSolved ? 'Solved (+50 pts)' : isLocked ? 'Locked' : 'Awaiting Solution'}
          </div>
          {!isLocked && !isSolved && (
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              Attempts: {attempts} (Unlimited / No penalties)
            </div>
          )}
        </div>
      </div>

      {isLocked ? (
        <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800 text-[var(--text-muted)] flex flex-col items-center justify-center">
          <Lock className="w-10 h-10 text-slate-600 mb-3" />
          <h4 className="font-bold text-white text-base">Round 2 Locked</h4>
          <p className="text-xs text-[var(--text-dim)] max-w-md mt-1">
            Round 1 Linear Regression must be approved by an authorized invigilator before you can download small_test.csv and submit the anagram answer.
          </p>
        </div>
      ) : (
        <div className="space-y-6 relative z-10">
          {/* Download small_test.csv */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Step 1: Download small_test.csv</h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Contains your assigned test parts for local prediction generation.
                </p>
              </div>
            </div>

            <a
              href="/api/datasets/round2/small-test"
              download="small_test.csv"
              className="btn btn-secondary !py-2 !px-4 text-xs flex items-center gap-2 group"
            >
              <Download className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Download small_test.csv</span>
            </a>
          </div>

          {/* Decoding Instructions */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Step 2: Prediction Decoding & Anagram Instructions
            </div>
            <div className="text-xs text-[var(--text-muted)] space-y-1.5 leading-relaxed">
              <p>1. Predict sorting bins for each row in <code className="text-cyan-300 font-mono">small_test.csv</code> using your trained model.</p>
              <p>2. Convert each predicted integer value into its ASCII character equivalent (e.g. 65 → 'A', 66 → 'B', ..., 90 → 'Z').</p>
              <p>3. Unscramble the resulting set of letters to identify your assigned machine learning algorithm name.</p>
              <p>4. Type the algorithm name into the field below and click <strong>Check Answer</strong>.</p>
            </div>
          </div>

          {/* Solved State Display */}
          {isSolved ? (
            <div className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-500/50">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                      Secret Algorithm Discovered & Solved!
                    </span>
                    <h3 className="text-2xl font-black font-mono tracking-wider text-white">
                      {revealedModel || 'ALGORITHM UNLOCKED'}
                    </h3>
                    <p className="text-xs text-emerald-200/80 mt-0.5">
                      +50 points awarded. Proceed to Round 3 below to request your starter boilerplate from the invigilator.
                    </p>
                  </div>
                </div>

                <div className="badge badge-emerald py-2 px-3 text-xs font-mono">
                  Round 3 Unlocked
                </div>
              </div>
            </div>
          ) : (
            /* Answer Submission Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Step 3: Submit Decoded Model Name
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={guess}
                    onChange={(e) => {
                      setGuess(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder=""
                    className="flex-1 bg-slate-950/80 border border-slate-700 focus:border-amber-500/70 rounded-xl px-4 py-3 text-sm font-mono uppercase tracking-wider text-white outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !guess.trim()}
                    className="btn bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Check Answer</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {feedback && (
                <div className={`p-4 rounded-xl border text-xs ${
                  feedback.correct
                    ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-500/50 text-rose-300'
                }`}>
                  <p className="font-semibold text-sm mb-1">{feedback.message}</p>
                  {!feedback.correct && (
                    <p className="text-[11px] text-slate-400">
                      Unlimited attempts are allowed without penalty. Please re-check your ASCII conversion and predictions.
                    </p>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
