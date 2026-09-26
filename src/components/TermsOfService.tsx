import React from 'react';
import { FileText, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';

export const TermsOfService: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8 text-left select-text">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Terms of Service</h1>
          </div>
          <p className="text-xs font-medium text-slate-500">Effective Date: September 26, 2026 • Shudkara Productivity Suite</p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to App</span>
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
        <section className="bg-slate-50 border border-slate-200 p-6 rounded-3xl space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            <span>1. Acceptance of Terms</span>
          </h2>
          <p>
            By accessing and using Shudkara ("the Application"), you agree to be bound by these Terms of Service. 
            If you do not agree to these terms, you may not access or use the application.
          </p>
        </section>

        <section className="bg-white border border-slate-200 p-6 rounded-3xl space-y-3 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <span>2. Permitted Use & Acceptable Use Policy</span>
          </h2>
          <p className="text-xs text-slate-600">
            Shudkara is provided for personal productivity, memory logging, task management, and knowledge organization. 
            You agree not to misuse the Application, attempt unauthorized access to system APIs, or upload malicious code.
          </p>
        </section>

        <section className="bg-white border border-slate-200 p-6 rounded-3xl space-y-3 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">3. Third-Party Integrations</h2>
          <p className="text-xs text-slate-600">
            Shudkara integrates with external services including Google Drive for media backups. 
            Your use of third-party services is subject to their respective Terms of Service and Privacy Policies.
          </p>
        </section>

        <section className="bg-white border border-slate-200 p-6 rounded-3xl space-y-3 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">4. Modifications to Terms</h2>
          <p className="text-xs text-slate-600">
            We reserve the right to update these terms at any time. Continued use of the application following updates constitutes acceptance of the new terms.
          </p>
        </section>
      </div>

      {/* Footer link back */}
      <div className="pt-4 border-t border-slate-200 text-center">
        <a href="/" className="text-xs font-bold text-blue-600 hover:underline">
          ← Back to Shudkara Dashboard
        </a>
      </div>
    </div>
  );
};
