import React, { useState } from 'react';
import { Lock, Unlock, AlertTriangle, CheckCircle2, FileSpreadsheet, Sparkles, Send, HelpCircle, Code2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function AnagramCard({
  team,
  onRefreshTeam,
  onOpenClueModal,
  onOpenBoilerplate
}) {
  const [guess, setGuess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const isLocked = !team.stage1Qualified;
  const isSolved = team.anagramSolved;
  const incorrectAttempts = team.anagramIncorrectAttempts || 0;
  const penaltyPoints = incorrectAttempts * 30;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!guess.trim()) {
      setErrorMsg('Please enter an algorithm name.');
      return;
    }

    setConfirmModalOpen(false);
    setIsSubmitting(true);
    setErrorMsg('');
    setFeedback(null);

    try {
      const res = await fetch('/api/anagram/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          answer: guess.trim()
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Submission failed.');
      }

      setFeedback(data);

      if (data.correct) {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 }
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
      {/* Background Accent Glow */}
      <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none ${
        isSolved ? 'bg-emerald-500/10' : !isLocked ? 'bg-amber-500/10' : 'bg-transparent'
      }`} />

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
              Anagram Challenge & Boilerplate Unlock
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
              ? 'Complete Stage 1 Logistic Regression qualification to unlock your team\'s personalized clue dataset and anagram puzzle.'
              : 'Rearrange your decoded ASCII letters to identify your team\'s secret machine learning algorithm. Solving unlocks your Stage 2 starter boilerplate.'}
          </p>
        </div>

        {/* Penalty HUD Indicator */}
        <div className="text-right">
          <div className="text-xs uppercase font-semibold text-[var(--text-dim)]">Incorrect Guesses</div>
          <div className={`text-base font-bold font-mono ${incorrectAttempts > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
            {incorrectAttempts} {incorrectAttempts === 1 ? 'penalty' : 'penalties'} ({penaltyPoints > 0 ? `-${penaltyPoints} pts` : '0 pts'})
          </div>
        </div>
      </div>

      {isLocked ? (
        <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800 text-[var(--text-muted)] flex flex-col items-center justify-center">
          <Lock className="w-10 h-10 text-slate-600 mb-3" />
          <h4 className="font-bold text-white text-base">Stage 2 Milestone Locked</h4>
          <p className="text-xs text-[var(--text-dim)] max-w-md mt-1">
            Qualify Stage 1 with &gt;= 75% accuracy to receive the personalized clue dataset and anagram solver.
          </p>
        </div>
      ) : (
        <div className="space-y-6 relative z-10">

          {/* Clue Dataset Access Section */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Personalized Clue Dataset (35 Samples)</h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Contains inspection measurements and vibration signatures tailored to your assigned anagram puzzle.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenClueModal}
                className="btn btn-secondary !py-2 !px-3 text-xs"
              >
                <span>Preview Data</span>
              </button>
              <a
                href={`/api/datasets/clue-dataset/${team.id}`}
                download="clue_dataset.csv"
                className="btn btn-primary !py-2 !px-3 text-xs"
              >
                <span>Download Clues CSV</span>
              </a>
            </div>
          </div>

          {/* Penalty Rules Alert */}
          {!isSolved && (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-300">Strict Scoring Rule:</span> Every incorrect algorithm guess applies an atomic{' '}
                <span className="font-bold underline text-white">30-point penalty</span> to your overall round score.
                <div className="mt-1 text-[11px] text-rose-300/80">
                  Penalty Schedule: 0 wrong = max 150 pts | 1 wrong = max 120 pts | 2 wrong = max 90 pts | 3 wrong = max 60 pts | 4 wrong = max 30 pts | 5+ wrong = 0 pts.
                </div>
              </div>
            </div>
          )}

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
                      Secret Algorithm Solved & Locked
                    </span>
                    <h3 className="text-2xl font-black font-mono tracking-wider text-white">
                      {team.algorithmName || 'ALGORITHM UNLOCKED'}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      +50 milestone points awarded. Starter boilerplate is now unlocked for Stage 2.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenBoilerplate}
                  className="btn btn-emerald text-sm"
                >
                  <Code2 className="w-4 h-4" />
                  <span>View Unlocked Boilerplate</span>
                </button>
              </div>
            </div>
          ) : (
            /* Submission Form */
            <form onSubmit={(e) => { e.preventDefault(); setConfirmModalOpen(true); }} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Submit Hidden Algorithm Name
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={guess}
                    onChange={(e) => { setGuess(e.target.value); setErrorMsg(''); }}
                    placeholder="e.g. RANDOM FOREST, DECISION TREE..."
                    className="flex-1 bg-slate-950/80 border border-slate-700 focus:border-amber-500/70 rounded-xl px-4 py-3 text-sm font-mono uppercase tracking-wider text-white outline-none placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setConfirmModalOpen(true)}
                    disabled={isSubmitting || !guess.trim()}
                    className="btn bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 shadow-lg shadow-amber-500/20"
                  >
                    <Send className="w-4 h-4" />
                    <span>Submit Answer</span>
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
                  {errorMsg}
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
                    <p className="text-[11px] text-rose-300/80">
                      Total penalties: {feedback.incorrectAttempts} (-{feedback.penaltyPoints} pts). Maximum potential score remaining: {feedback.remainingPossibleScore} pts.
                    </p>
                  )}
                </div>
              )}
            </form>
          )}

        </div>
      )}

      {/* Confirmation Modal to avoid accidental penalty */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel p-6 max-w-md w-full border-amber-500/40 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-lg text-white">Confirm Anagram Submission</h3>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-3">
              Are you sure you want to submit:
            </p>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center font-mono font-bold text-lg text-amber-300 mb-4 tracking-widest">
              {guess.toUpperCase()}
            </div>
            <p className="text-xs text-rose-300 bg-rose-950/30 border border-rose-500/30 p-2.5 rounded-lg mb-6">
              ⚠️ If this guess is wrong, a <strong>30-point penalty</strong> will be subtracted immediately from your round score!
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel & Double Check
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="btn bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
