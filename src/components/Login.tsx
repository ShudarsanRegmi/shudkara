import React, { useState, useEffect, useRef } from 'react';
import { Mail, Smartphone, RefreshCw, Lock, ArrowRight, ShieldCheck, KeyRound, Eye, EyeOff, Sparkles } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

type LoginMode = 'totp' | 'email-otp' | 'password';

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<LoginMode>('totp');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // TOTP state
  const [totpCode, setTotpCode] = useState('');

  // Email OTP state
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Master Password state (Unlocked after 10 taps)
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordUnlocked, setPasswordUnlocked] = useState(false);

  // 10-tap detector state
  const [tapCount, setTapCount] = useState(0);
  const tapResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHeaderTap = () => {
    setTapCount(prev => {
      const nextCount = prev + 1;
      if (nextCount >= 10) {
        setPasswordUnlocked(true);
        setMode('password');
        setError('');
        return 0;
      }
      return nextCount;
    });

    if (tapResetTimer.current) clearTimeout(tapResetTimer.current);
    tapResetTimer.current = setTimeout(() => {
      setTapCount(0);
    }, 4000);
  };

  // Silently check TOTP setup status in background
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/totp-setup');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.configured === false && mode !== 'password') {
            setMode('email-otp');
          }
        }
      } catch {
        // Fallback gracefully
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

  // ── Master Password — Verify Secret Password ──────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        onLoginSuccess(data.token);
      } else {
        setError(data.error || 'Invalid password.');
        setPassword('');
      }
    } catch {
      setError('Network error verifying password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6 text-slate-800 my-12 relative overflow-hidden">
      
      {/* 10-Tap Interactive Trigger Header */}
      <div 
        onClick={handleHeaderTap}
        className="text-center space-y-1.5 cursor-pointer select-none transition-transform active:scale-95 group"
        title="Tap 10 times to unlock secret mode"
      >
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-2xl mb-2 group-hover:bg-blue-100 transition-colors relative">
          <Lock className="w-6 h-6 text-blue-600" />
          {tapCount > 0 && tapCount < 10 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow">
              {tapCount}
            </span>
          )}
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {mode === 'password'
            ? 'Master Password Login'
            : mode === 'totp'
            ? 'Authenticator Login'
            : 'Email Verification'}
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          {mode === 'password'
            ? 'Enter your master environment password to gain instant access.'
            : mode === 'totp'
            ? 'Enter the 6-digit code from your Authenticator app.'
            : 'Enter the 6-digit verification code sent to your registered email.'}
        </p>
      </div>

      {/* Secret Password Unlocked Notification Banner */}
      {passwordUnlocked && mode === 'password' && (
        <div className="p-2.5 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl font-medium flex items-center justify-center space-x-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span>Secret Password Authentication Mode Unlocked!</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium text-center">
          {error}
        </div>
      )}

      {/* ── Password Mode ── */}
      {mode === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center space-x-2 text-indigo-600 mb-1">
              <KeyRound className="w-6 h-6" />
              <span className="text-xs font-bold uppercase tracking-wider">Secret Password</span>
            </div>
            
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                required
                placeholder="Enter Master Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full text-center text-base font-semibold py-3 pl-4 pr-10 bg-slate-50 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!password.trim() || isLoading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/20 text-xs transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Authenticate Password</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => { setError(''); setMode('totp'); }}
              className="text-xs text-slate-500 hover:text-indigo-600 font-medium"
            >
              Switch back to Authenticator TOTP
            </button>
          </div>
        </form>
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

          <div className="pt-2 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => { setError(''); setMode('email-otp'); }}
              className="text-slate-500 hover:text-blue-600 font-medium"
            >
              Use Email OTP
            </button>

            {passwordUnlocked && (
              <button
                type="button"
                onClick={() => { setError(''); setMode('password'); }}
                className="text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                Use Password
              </button>
            )}
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

          <div className="pt-2 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => { setError(''); setMode('totp'); }}
              className="text-slate-500 hover:text-blue-600 font-medium"
            >
              Use Authenticator TOTP
            </button>

            {passwordUnlocked && (
              <button
                type="button"
                onClick={() => { setError(''); setMode('password'); }}
                className="text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                Use Password
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
