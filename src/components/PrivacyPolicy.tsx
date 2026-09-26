import React from 'react';
import { ShieldCheck, ArrowLeft, Lock, Database, Eye } from 'lucide-react';

export const PrivacyPolicy: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8 text-left select-text">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
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
            <Lock className="w-5 h-5 text-emerald-600" />
            <span>1. Overview & Data Ownership</span>
          </h2>
          <p>
            Shudkara is a privacy-first personal productivity and workspace management platform. 
            Your personal data, notes, inventory records, and timeline documents belong strictly to you. 
            We do not sell, rent, monetise, or share your personal data with third-party advertisers or data brokers.
          </p>
        </section>

        <section className="bg-white border border-slate-200 p-6 rounded-3xl space-y-3 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <span>2. Information Collection & Use</span>
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              <strong>Google Drive Integration:</strong> If you connect Google Drive to back up timeline memories or inventory records, 
              Shudkara requests standard OAuth 2.0 file creation and management permissions (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">https://www.googleapis.com/auth/drive</code>). 
              Media files uploaded through Shudkara are stored directly inside your personal Google Drive account.
            </li>
            <li>
              <strong>Local & Database Storage:</strong> Temporary preferences, session keys, and ephemeral pastes are stored in encrypted form in your browser session or secure MongoDB cloud database.
            </li>
          </ul>
        </section>

        <section className="bg-white border border-slate-200 p-6 rounded-3xl space-y-3 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <span>3. Data Security & Protection</span>
          </h2>
          <p>
            We implement TLS/SSL network encryption for all client-server communications and enforce password-protected, single-user access controls on private views.
          </p>
        </section>

        <section className="bg-white border border-slate-200 p-6 rounded-3xl space-y-3 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">4. Contact Us</h2>
          <p className="text-xs text-slate-600">
            If you have questions regarding this Privacy Policy or your data security, please contact the application owner at{' '}
            <a href="mailto:shudarsanregmi555@gmail.com" className="text-blue-600 font-bold hover:underline">
              shudarsanregmi555@gmail.com
            </a>.
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
