import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { Key, Mail, ShieldAlert, Check, RefreshCw, Smartphone } from 'lucide-react';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAnDRhOFQ_ArIoyvlbkqK9cmCU8nSveLfg",
  authDomain: "shudkara.firebaseapp.com",
  projectId: "shudkara",
  storageBucket: "shudkara.firebasestorage.app",
  messagingSenderId: "518253322103",
  appId: "1:518253322103:web:06dd94140a723f102b4b72"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [loginMethod, setLoginMethod] = useState<'totp' | 'email'>('totp');
  
  // TOTP state
  const [totpCode, setTotpCode] = useState('');
  const [totpError, setTotpError] = useState('');
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Email state
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Handle Firebase Email Link confirmation on mount
  useEffect(() => {
    if (isSignInWithEmailLink(firebaseAuth, window.location.href)) {
      setIsLoading(true);
      let savedEmail = window.localStorage.getItem('emailForSignIn') || '';
      if (!savedEmail) {
        savedEmail = window.prompt('Please enter your email for confirmation:') || '';
      }
      
      if (savedEmail) {
        signInWithEmailLink(firebaseAuth, savedEmail, window.location.href)
          .then((result) => {
            console.log('Firebase signInWithEmailLink success:', result.user?.email);
            window.localStorage.removeItem('emailForSignIn');
            // Clean up the URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Post email validation to backend
            return fetch('/api/auth/firebase-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: result.user?.email || savedEmail })
            });
          })
          .then(async (res) => {
            const data = await res.json();
            console.log('/firebase-login API status:', res.status, data);
            if (res.ok && data.token) {
              onLoginSuccess(data.token);
            } else {
              setEmailError(data.error || 'Access denied: Unrecognized email.');
            }
          })
          .catch((err: any) => {
            console.error('Sign in link error:', err);
            setEmailError('Failed to sign in: ' + err.message);
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        setIsLoading(false);
      }
    }
  }, [onLoginSuccess]);

  // Load TOTP configuration state
  const checkTotpSetup = async () => {
    try {
      const token = localStorage.getItem('shudkara_auth_token');
      const headers = token ? { 'X-Session-Token': token } : undefined;
      const res = await fetch('/api/auth/totp-setup', { headers });
      const data = await res.json();
      if (data.otpauthUrl) {
        setTotpSetupData({ secret: data.secret, otpauthUrl: data.otpauthUrl });
      } else {
        setTotpSetupData(null);
      }
    } catch (err) {
      console.error('Failed to load TOTP configuration:', err);
    }
  };

  useEffect(() => {
    if (loginMethod === 'totp') {
      checkTotpSetup();
    }
  }, [loginMethod]);

  // Handle TOTP submit
  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim() || totpCode.trim().length !== 6) {
      setTotpError('Please enter a 6-digit code.');
      return;
    }

    setIsLoading(true);
    setTotpError('');

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
        setTotpError(data.error || 'Invalid verification code.');
      }
    } catch (err) {
      setTotpError('Server error verifying code. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Email send
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setEmailError('Please enter your email.');
      return;
    }

    setIsLoading(true);
    setEmailError('');
    setEmailSent(false);

    const actionCodeSettings = {
      url: window.location.origin + window.location.pathname,
      handleCodeInApp: true,
    };

    try {
      await sendSignInLinkToEmail(firebaseAuth, email.trim(), actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email.trim());
      setEmailSent(true);
    } catch (err: any) {
      console.error(err);
      setEmailError(err.message || 'Failed to send sign-in link.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6 text-slate-800 my-12 animate-fade-in">
      
      {/* Title */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center justify-center gap-2">
          <Key className="w-6 h-6 text-blue-600" />
          Owner Login
        </h2>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          Sign in to gain management permissions for KeyVal, LinkManager, and Workspace Sync.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        <button
          onClick={() => setLoginMethod('totp')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
            loginMethod === 'totp' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          Authenticator
        </button>
        <button
          onClick={() => setLoginMethod('email')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
            loginMethod === 'email' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          Email OTP Link
        </button>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-6 space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-xs text-slate-500 font-semibold">Authenticating...</span>
        </div>
      )}

      {!isLoading && loginMethod === 'totp' && (
        <form onSubmit={handleTotpSubmit} className="space-y-4">
          
          {totpSetupData ? (
            /* Setup wizard (Only displays once until first scanned and saved to mongo) */
            <div className="space-y-4 text-center border-b border-slate-150 pb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                Setup Required
              </span>
              <p className="text-xs text-slate-500 leading-relaxed px-4">
                Scan this QR code in **Microsoft Authenticator** or **Google Authenticator** to link your device.
              </p>
              
              <div className="flex justify-center bg-white p-3 border border-slate-200 rounded-2xl w-48 h-48 mx-auto shadow-sm">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpSetupData.otpauthUrl)}`}
                  alt="Scan setup QR code"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="text-[10px] font-mono text-slate-400 select-all">
                Secret: {totpSetupData.secret}
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              6-Digit Authenticator Code
            </label>
            <input
              type="text"
              placeholder="000000"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-center font-mono text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50"
              required
            />
          </div>

          {totpError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-150 rounded-xl text-xs text-red-650 font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{totpError}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl text-sm shadow-md shadow-blue-500/10 transition"
          >
            Verify and Log In
          </button>
        </form>
      )}

      {!isLoading && loginMethod === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Owner Email Address
            </label>
            <input
              type="email"
              placeholder="e.g. shudarsanregmi555@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {emailSent && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-medium">
              <Check className="w-4 h-4 shrink-0" />
              <span>Sign-in link sent! Check your email inbox.</span>
            </div>
          )}

          {emailError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-150 rounded-xl text-xs text-red-650 font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{emailError}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl text-sm shadow-md shadow-blue-500/10 transition"
          >
            Send Sign-in Link
          </button>
        </form>
      )}

    </div>
  );
};
