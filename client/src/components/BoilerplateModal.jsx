import React, { useState } from 'react';
import { X, Copy, Check, Download, Code2, Terminal, Sparkles } from 'lucide-react';

export default function BoilerplateModal({
  isOpen,
  onClose,
  boilerplateCode,
  algorithmName
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (boilerplateCode) {
      navigator.clipboard.writeText(boilerplateCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!boilerplateCode) return;
    const blob = new Blob([boilerplateCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(algorithmName || 'model').toLowerCase().replace(/\s+/g, '_')}_boilerplate.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="glass-panel max-w-4xl w-full max-h-[90vh] flex flex-col border-indigo-500/40 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg font-[Outfit] text-white">
                  Unlocked Starter Boilerplate
                </h3>
                <span className="badge badge-emerald text-xs">
                  {algorithmName || 'Verified'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)]">
                Pre-configured scikit-learn pipeline for Stage 2 training & prediction
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="btn btn-secondary !py-2 !px-3 text-xs flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="btn btn-primary !py-2 !px-3 text-xs flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Download .py</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#070b14] font-mono text-xs leading-relaxed text-slate-300">
          <pre className="overflow-x-auto whitespace-pre">
            <code>{boilerplateCode || '# No boilerplate available yet.'}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-slate-900/40 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span>Train your model on <code className="text-indigo-300">stage2_train.csv</code> and submit predictions for Stage 2.</span>
          </div>
          <button onClick={onClose} className="btn btn-secondary !py-1.5 !px-3 text-xs">
            Close Viewer
          </button>
        </div>

      </div>
    </div>
  );
}
