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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      
      {/* Toast Notification */}
      {copied && (
        <div className="fixed top-6 bg-emerald-500 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 z-50">
          <Check className="w-4 h-4" />
          Prompt copied to clipboard!
        </div>
      )}

      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider">
              <Code2 className="w-4 h-4" />
              Shared Prompt
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {prompt.title}
            </h1>
          </div>

          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition shadow-lg shrink-0 ${
              copied 
                ? 'bg-emerald-600 text-white' 
                : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>
        </div>

        {/* Description */}
        {prompt.description && (
          <p className="text-sm text-slate-400 leading-relaxed bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
            {prompt.description}
          </p>
        )}

        {/* Prompt Content */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 uppercase tracking-widest px-1">
            <span>Prompt Content</span>
            <span>{prompt.prompt.length} chars</span>
          </div>
          <div className="relative group">
            <pre className="w-full p-5 bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 font-mono text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed overflow-x-auto selection:bg-blue-500 selection:text-white">
              {prompt.prompt}
            </pre>
          </div>
        </div>

        {/* Tags */}
        {prompt.tags && prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/60">
            {prompt.tags.map((tag, idx) => (
              <span 
                key={idx} 
                className="flex items-center gap-1 px-3 py-1 bg-slate-800/80 text-slate-300 text-xs font-medium rounded-xl border border-slate-700/50"
              >
                <TagIcon className="w-3 h-3 text-slate-500" />
                {tag}
              </span>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
