import React, { useState, useEffect } from 'react';
import { Key, Mail, ShieldAlert, Check, RefreshCw, Smartphone, ArrowRight, Lock } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

type LoginMode = 'detecting' | 'totp' | 'email-otp';

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<LoginMode>('detecting');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // TOTP state
  const [totpCode, setTotpCode] = useState('');

  // Email OTP state
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // On mount: check if TOTP is configured to decide which login to show
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/totp-setup');
        const data = await res.json();
        // If TOTP is configured, show TOTP login directly as primary auth
        if (data.configured) {
          setMode('totp');
        } else {
          // Not configured yet — require email OTP first (bootstrap)
          setMode('email-otp');
        }
      } catch {
        setMode('email-otp'); // fallback
      }
    })();
  }, []);

  // ── TOTP Login ────────────────────────────────────────────────────────────
  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) return;

    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        onLoginSuccess(data.token);
      } else {
        setError(data.error || 'Invalid code. Try again.');
        setTotpCode('');
      }
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Email OTP — Send Code ─────────────────────────────────────────────────
  const handleSendOtp = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
      } else {
        setError(data.error || 'Failed to send code.');
      }
    } catch {
      setError('Network error sending code.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Email OTP — Verify Code ───────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) return;

    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        onLoginSuccess(data.token);
      } else {
        setError(data.error || 'Invalid code. Try again.');
        setOtpCode('');
      }
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Detecting state ───────────────────────────────────────────────────────
  if (mode === 'detecting') {
    return (
      <div className="max-w-sm mx-auto my-16 flex flex-col items-center gap-3 text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="text-xs font-semibold">Checking authentication status...</span>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6 text-slate-800 my-12">

      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-2xl mb-2">
          <Lock className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {mode === 'totp' ? 'Authenticator Login' : 'Email Verification'}
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          {mode === 'totp'
            ? 'Open Microsoft Authenticator and enter the current 6-digit code.'
            : 'No TOTP set up yet. Verify your identity via email to continue setup.'}
        </p>
      </div>

      {/* ── TOTP Mode ── */}
      {mode === 'totp' && (
        <form onSubmit={handleTotpSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <Smartphone className="w-8 h-8 text-blue-500" />
            <input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-4 border border-slate-200 rounded-2xl text-center font-mono text-3xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              autoFocus
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || totpCode.length !== 6}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            {isLoading ? 'Verifying...' : 'Log In'}
          </button>

          <button
            type="button"
            onClick={() => setMode('email-otp')}
            className="w-full text-xs text-slate-400 hover:text-slate-600 text-center py-1 transition"
          >
            Use email OTP instead
          </button>
        </form>
      )}

      {/* ── Email OTP Mode ── */}
      {mode === 'email-otp' && (
        <div className="space-y-4">
          {!otpSent ? (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sending code to</span>
                <p className="font-mono text-sm font-bold text-slate-800">shudarsanregmi555@gmail.com</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-medium">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleSendOtp}
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
              >
                {isLoading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />Sending...</>
                  : <><Mail className="w-4 h-4" />Send Code to My Email</>
                }
              </button>
            </>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-semibold">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                Code sent! Check your Gmail inbox.
              </div>

              <div className="flex flex-col items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-4 border border-slate-200 rounded-2xl text-center font-mono text-3xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  autoFocus
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtpCode(''); setError(''); }}
                  className="text-[10px] text-slate-400 hover:text-slate-600 transition"
                >
                  Resend code
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-medium">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {isLoading ? 'Verifying...' : 'Verify & Log In'}
              </button>
            </form>
          )}

          {/* Switch to TOTP if already configured */}
          <button
            type="button"
            onClick={() => setMode('totp')}
            className="w-full text-xs text-slate-400 hover:text-slate-600 text-center py-1 transition flex items-center justify-center gap-1"
          >
            <Smartphone className="w-3.5 h-3.5" />
            Use Authenticator app instead
          </button>
        </div>
      )}
    </div>
  );
};
