import React, { useState } from 'react';
import { Copy, Check, Code2, Tag as TagIcon } from 'lucide-react';
import type { AIPrompt } from './PromptVault';

interface SharedPromptViewerProps {
  prompt: AIPrompt;
}

export const SharedPromptViewer: React.FC<SharedPromptViewerProps> = ({ prompt }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 sm:p-8 font-sans select-none">
      
      {/* Toast Notification */}
      {copied && (
        <div className="fixed top-6 bg-emerald-600 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 z-50">
          <Check className="w-4 h-4" />
          Prompt copied to clipboard!
        </div>
      )}

      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">
              <Code2 className="w-3.5 h-3.5" />
              Shared AI Prompt
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {prompt.title}
            </h1>
          </div>

          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm shrink-0 ${
              copied 
                ? 'bg-emerald-600 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>
        </div>

        {/* Description */}
        {prompt.description && (
          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            {prompt.description}
          </p>
        )}

        {/* Prompt Content Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest px-1">
            <span>Prompt Text</span>
            <span>{prompt.prompt.length} characters</span>
          </div>
          <div className="relative group">
            <pre className="w-full p-5 bg-slate-900 text-slate-100 rounded-2xl font-mono text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed overflow-x-auto selection:bg-blue-500 selection:text-white shadow-inner">
              {prompt.prompt}
            </pre>
          </div>
        </div>

        {/* Tags */}
        {prompt.tags && prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {prompt.tags.map((tag, idx) => (
              <span 
                key={idx} 
                className="flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200"
              >
                <TagIcon className="w-3 h-3 text-slate-400" />
                {tag}
              </span>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
