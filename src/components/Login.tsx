import React, { useState, useEffect } from 'react';
import { Mail, Smartphone, RefreshCw, Lock, ArrowRight, ShieldCheck } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

type LoginMode = 'totp' | 'email-otp';

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  // Default to 'totp' immediately for instant form rendering without blocking network spinner delay
  const [mode, setMode] = useState<LoginMode>('totp');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // TOTP state
  const [totpCode, setTotpCode] = useState('');

  // Email OTP state
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Silently verify if TOTP is configured in the background without blocking rendering
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/totp-setup');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.configured === false) {
            setMode('email-otp');
          }
        }
      } catch {
        // Fallback gracefully without throwing UI errors
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // ── TOTP Login Submit ──────────────────────────────────────────────────────
  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.trim().length !== 6) return;

    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode.trim() })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        onLoginSuccess(data.token);
      } else {
        setError(data.error || 'Invalid code. Check your authenticator app.');
        setTotpCode('');
      }
    } catch {
      setError('Network error. Check connection and try again.');
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
        setError(data.error || 'Failed to send verification email.');
      }
    } catch {
      setError('Network error sending verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Email OTP — Verify Code ───────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim().length !== 6) return;

    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode.trim() })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        onLoginSuccess(data.token);
      } else {
        setError(data.error || 'Invalid OTP code. Try again.');
        setOtpCode('');
      }
    } catch {
      setError('Network error verifying code.');
    } finally {
      setIsLoading(false);
    }
  };

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
            ? 'Enter the 6-digit code from your Authenticator app.'
            : 'Enter the 6-digit verification code sent to your registered email.'}
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium text-center">
          {error}
        </div>
      )}

      {/* ── TOTP Mode ── */}
      {mode === 'totp' && (
        <form onSubmit={handleTotpSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <Smartphone className="w-8 h-8 text-blue-500" />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              placeholder="000000"
              value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-3xl font-extrabold tracking-widest py-3 px-4 bg-slate-50 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={totpCode.length !== 6 || isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 text-xs transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Authenticate</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => { setError(''); setMode('email-otp'); }}
              className="text-xs text-slate-500 hover:text-blue-600 font-medium"
            >
              Use Email OTP instead
            </button>
          </div>
        </form>
      )}

      {/* ── Email OTP Mode ── */}
      {mode === 'email-otp' && (
        <div className="space-y-4">
          {!otpSent ? (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-3 py-2">
                <Mail className="w-8 h-8 text-blue-500" />
                <span className="text-xs text-slate-600 text-center">
                  Click below to receive a 6-digit login code via email.
                </span>
              </div>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 text-xs transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send Login Code'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-emerald-500" />
                <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full font-medium">
                  Code sent! Check your inbox.
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  placeholder="000000"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-3xl font-extrabold tracking-widest py-3 px-4 bg-slate-50 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={otpCode.length !== 6 || isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 text-xs transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify Code & Log In'}
              </button>
            </form>
          )}

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => { setError(''); setMode('totp'); }}
              className="text-xs text-slate-500 hover:text-blue-600 font-medium"
            >
              Use Authenticator TOTP instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
