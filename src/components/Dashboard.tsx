import React, { useEffect, useState } from 'react';
import { 
  BookOpen, Share2, FileText, ArrowRight, Award, 
  Shield, Check, Copy, RefreshCw, Smartphone
} from 'lucide-react';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
  progress: Record<string, any>;
  authToken: string | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ setActiveTab, progress, authToken }) => {
  // TOTP Config States
  const [totpData, setTotpData] = useState<{ secret: string; otpauthUrl: string; configured: boolean } | null>(null);
  const [loadingTotp, setLoadingTotp] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [testCode, setTestCode] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchTotpSetup = async () => {
    if (!authToken) return;
    setLoadingTotp(true);
    try {
      const res = await fetch('/api/auth/totp-setup', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTotpData(data);
      }
    } catch (err) {
      console.error('Failed to load TOTP setup:', err);
    } finally {
      setLoadingTotp(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchTotpSetup();
    }
  }, [authToken]);

  const handleCopySecret = () => {
    if (!totpData) return;
    navigator.clipboard.writeText(totpData.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleTestVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (testCode.trim().length !== 6) return;
    
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: testCode.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: 'Verification successful! Your authenticator is set up correctly.' });
        // Refresh setup status
        await fetchTotpSetup();
      } else {
        setTestResult({ success: false, message: data.error || 'Failed to verify code.' });
      }
    } catch (err) {
      setTestResult({ success: false, message: 'Network error checking code.' });
    } finally {
      setTesting(false);
    }
  };

  const handleResetTotp = async () => {
    if (!window.confirm('WARNING: Are you sure you want to reset your Authenticator settings? You will have to re-scan the new QR code in Microsoft Authenticator.')) {
      return;
    }

    setLoadingTotp(true);
    try {
      const res = await fetch('/api/auth/totp-reset', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        setTestCode('');
        setTestResult(null);
        await fetchTotpSetup();
      } else {
        alert('Failed to reset authenticator.');
      }
    } catch (err) {
      alert('Network error resetting authenticator.');
    } finally {
      setLoadingTotp(false);
    }
  };

  // Process Leetcode stats
  const leetcodeQuestions = [
    // Array, Hashing
    { id: 'two-sum', difficulty: 'Easy' },
    { id: 'contains-duplicate', difficulty: 'Easy' },
    { id: 'valid-anagram', difficulty: 'Easy' },
    { id: 'two-sum-ii', difficulty: 'Medium' },
    { id: 'group-anagrams', difficulty: 'Medium' },
    { id: 'top-k-frequent-elements', difficulty: 'Medium' },
    { id: 'product-of-array-except-self', difficulty: 'Medium' },
    { id: 'longest-consecutive-sequence', difficulty: 'Medium' },
    
    // Two Pointers
    { id: 'valid-palindrome', difficulty: 'Easy' },
    { id: 'two-sum-ii-input-array-is-sorted', difficulty: 'Medium' },
    { id: '3sum', difficulty: 'Medium' },
    { id: 'container-with-most-water', difficulty: 'Medium' },
    
    // Sliding Window
    { id: 'best-time-to-buy-and-sell-stock', difficulty: 'Easy' },
    { id: 'longest-substring-without-repeating-characters', difficulty: 'Medium' },
    { id: 'longest-repeating-character-replacement', difficulty: 'Medium' },
    { id: 'minimum-window-substring', difficulty: 'Hard' },
    
    // Stack
    { id: 'valid-parentheses', difficulty: 'Easy' },
    { id: 'min-stack', difficulty: 'Medium' },
    { id: 'evaluate-reverse-polish-notation', difficulty: 'Medium' },
    { id: 'generate-parentheses', difficulty: 'Medium' },
    { id: 'daily-temperatures', difficulty: 'Medium' },
    
    // Binary Search
    { id: 'binary-search', difficulty: 'Easy' },
    { id: 'search-a-2d-matrix', difficulty: 'Medium' },
    { id: 'koko-eating-bananas', difficulty: 'Medium' },
    { id: 'find-minimum-in-rotated-sorted-array', difficulty: 'Medium' },
    { id: 'search-in-rotated-sorted-array', difficulty: 'Medium' },
    { id: 'time-based-key-value-store', difficulty: 'Medium' },
    
    // Linked List
    { id: 'reverse-linked-list', difficulty: 'Easy' },
    { id: 'merge-two-sorted-lists', difficulty: 'Easy' },
    { id: 'linked-list-cycle', difficulty: 'Easy' },
    { id: 'reorder-list', difficulty: 'Medium' },
    { id: 'remove-nth-node-from-end-of-list', difficulty: 'Medium' },
    { id: 'copy-list-with-random-pointer', difficulty: 'Medium' },
    { id: 'add-two-numbers', difficulty: 'Medium' },
    { id: 'find-the-duplicate-number', difficulty: 'Medium' },
    { id: 'lru-cache', difficulty: 'Medium' },
    
    // Trees
    { id: 'invert-binary-tree', difficulty: 'Easy' },
    { id: 'maximum-depth-of-binary-tree', difficulty: 'Easy' },
    { id: 'same-tree', difficulty: 'Easy' },
    { id: 'subtree-of-another-tree', difficulty: 'Easy' },
    { id: 'lowest-common-ancestor-of-a-binary-search-tree', difficulty: 'Easy' },
    { id: 'binary-tree-level-order-traversal', difficulty: 'Medium' },
    { id: 'binary-tree-right-side-view', difficulty: 'Medium' },
    { id: 'count-good-nodes-in-binary-tree', difficulty: 'Medium' },
    { id: 'validate-binary-search-tree', difficulty: 'Medium' },
    { id: 'kth-smallest-element-in-a-bst', difficulty: 'Medium' },
    { id: 'construct-binary-tree-from-preorder-and-inorder-traversal', difficulty: 'Medium' },
    
    // Heap / Priority Queue
    { id: 'kth-largest-element-in-a-stream', difficulty: 'Easy' },
    { id: 'last-stone-weight', difficulty: 'Easy' },
    { id: 'k-closest-points-to-origin', difficulty: 'Medium' },
    { id: 'kth-largest-element-in-an-array', difficulty: 'Medium' },
    { id: 'task-scheduler', difficulty: 'Medium' },
    { id: 'design-twitter', difficulty: 'Medium' },
    
    // Backtracking
    { id: 'subsets', difficulty: 'Medium' },
    { id: 'combination-sum', difficulty: 'Medium' },
    { id: 'permutations', difficulty: 'Medium' },
    { id: 'subsets-ii', difficulty: 'Medium' },
    { id: 'word-search', difficulty: 'Medium' },
    
    // Graphs
    { id: 'number-of-islands', difficulty: 'Medium' },
    { id: 'clone-graph', difficulty: 'Medium' },
    { id: 'max-area-of-island', difficulty: 'Medium' },
    { id: 'course-schedule', difficulty: 'Medium' },
    { id: 'pacific-atlantic-water-flow', difficulty: 'Medium' },
    
    // Advanced Graphs
    { id: 'reconstruct-itinerary', difficulty: 'Hard' },
    { id: 'min-cost-to-connect-all-points', difficulty: 'Medium' },
    { id: 'network-delay-time', difficulty: 'Medium' },
    
    // Dynamic Programming
    { id: 'climbing-stairs', difficulty: 'Easy' },
    { id: 'min-cost-climbing-stairs', difficulty: 'Easy' },
    { id: 'house-robber', difficulty: 'Medium' },
    { id: 'house-robber-ii', difficulty: 'Medium' },
    { id: 'longest-palindromic-substring', difficulty: 'Medium' },
    { id: 'palindromic-substrings', difficulty: 'Medium' },
    { id: 'decode-ways', difficulty: 'Medium' },
    { id: 'coin-change', difficulty: 'Medium' },
    { id: 'maximum-product-subarray', difficulty: 'Medium' },
    { id: 'word-break', difficulty: 'Medium' },
    { id: 'longest-increasing-subsequence', difficulty: 'Medium' }
  ];

  const getStats = () => {
    let solved = 0;
    let inProgress = 0;
    let needsReview = 0;
    
    const breakdown = {
      easy: { solved: 0, total: 0 },
      medium: { solved: 0, total: 0 },
      hard: { solved: 0, total: 0 }
    };

    leetcodeQuestions.forEach(q => {
      const qStatus = progress[q.id]?.status;
      const diffKey = q.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard';
      breakdown[diffKey].total++;
      
      if (qStatus === 'solved') {
        solved++;
        breakdown[diffKey].solved++;
      } else if (qStatus === 'learning') {
        inProgress++;
      } else if (qStatus === 'review') {
        needsReview++;
      }
    });

    return { solved, inProgress, needsReview, total: leetcodeQuestions.length, ...breakdown };
  };

  const stats = getStats();
  const completionPercentage = Math.round((stats.solved / stats.total) * 100);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Welcome banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-750 text-xs font-semibold mb-4 border border-blue-100">
            <Award className="w-3.5 h-3.5 text-blue-600" />
            <span>Welcome to Shudkara Hub</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3 text-slate-900">
            Developer Workspace
          </h1>
          <p className="text-sm md:text-base text-slate-600 mb-6 max-w-xl leading-relaxed">
            Track your LeetCode prep, copy values instantly, drop images temporarily, or manage links recursively.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('leetcode')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl text-sm shadow-md shadow-blue-500/10 transition"
            >
              Start Revising
            </button>
            <button
              onClick={() => setActiveTab('airdrop')}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition border border-slate-200"
            >
              Drop a File
            </button>
          </div>
        </div>
      </div>

      {/* Authenticator settings card (Only shown to Logged-in Owner) */}
      {authToken && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                MFA Authenticator Settings
              </h2>
              <p className="text-xs text-slate-500">
                You are logged in as the Owner. Manage your Microsoft Authenticator registration details here.
              </p>
            </div>
            
            <button
              onClick={handleResetTotp}
              disabled={loadingTotp}
              className="px-4 py-2 border border-slate-200 hover:bg-red-50 text-red-650 hover:text-red-700 font-bold rounded-xl text-xs transition shrink-0"
            >
              Reset Credentials
            </button>
          </div>

          {loadingTotp ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="text-xs text-slate-500">Updating MFA setup...</span>
            </div>
          ) : totpData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              {/* QR Image */}
              <div className="md:col-span-1 flex flex-col items-center space-y-2">
                <div className="bg-white p-3 border border-slate-200 rounded-2xl w-40 h-40 shadow-sm flex items-center justify-center">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(totpData.otpauthUrl)}`}
                    alt="Scan Authenticator QR"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-[10px] text-slate-450 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-slate-450" />
                  Scan to Link Device
                </span>
              </div>

              {/* Settings parameters */}
              <div className="md:col-span-2 space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Secret Key (Manual Entry)
                  </label>
                  <div className="flex gap-2 items-center">
                    <code className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono select-all text-slate-700 flex-1 truncate">
                      {totpData.secret}
                    </code>
                    <button
                      onClick={handleCopySecret}
                      className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition shrink-0 text-slate-500"
                      title="Copy Key"
                    >
                      {copiedSecret ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Validation Test Form */}
                <form onSubmit={handleTestVerify} className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Verify Code Alignment
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      value={testCode}
                      onChange={(e) => setTestCode(e.target.value.replace(/\D/g, ''))}
                      className="px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 w-44 font-mono text-center tracking-widest text-lg font-bold"
                    />
                    <button
                      type="submit"
                      disabled={testing || testCode.length !== 6}
                      className="px-4 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 transition disabled:opacity-50"
                    >
                      Verify
                    </button>
                  </div>

                  {testResult && (
                    <p className={`text-xs font-semibold ${testResult.success ? 'text-emerald-700' : 'text-red-650'}`}>
                      {testResult.message}
                    </p>
                  )}
                </form>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-4">
              Unable to load TOTP configurator settings. Try reloading.
            </p>
          )}
        </div>
      )}

      {/* Main Sections Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Leetcode Progress Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="p-3 bg-amber-100 rounded-xl text-amber-600">
                <BookOpen className="w-6 h-6" />
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                Leetcode
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Blind 75 Revision</h3>
            <p className="text-sm text-slate-500 mb-6">
              Track notes, status, and revision counts for the classic Blind 75 list.
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Overall Progress</span>
                  <span>{stats.solved}/75 ({completionPercentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>

              {/* Mini Stats Breakdown */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-emerald-50 p-2.5 rounded-lg text-center">
                  <span className="block text-lg font-bold text-emerald-600">{stats.solved}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Solved</span>
                </div>
                <div className="bg-blue-50 p-2.5 rounded-lg text-center">
                  <span className="block text-lg font-bold text-blue-600">{stats.inProgress}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Learning</span>
                </div>
                <div className="bg-rose-50 p-2.5 rounded-lg text-center">
                  <span className="block text-lg font-bold text-rose-600">{stats.needsReview}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Review</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('leetcode')}
            className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-700 rounded-xl transition group border border-slate-100"
          >
            Open Tracker
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* P2P Airdrop Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="p-3 bg-blue-100 rounded-xl text-blue-600">
                <Share2 className="w-6 h-6" />
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                Serverless P2P
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">WebRTC Airdrop</h3>
            <p className="text-sm text-slate-500 mb-4">
              Instantly share files directly with another browser.
            </p>
            <ul className="text-xs text-slate-500 space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                No file size limits (Direct connection)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Files bypass server (Highly secure)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Uses WebRTC Data Channels
              </li>
            </ul>
          </div>

          <button
            onClick={() => setActiveTab('airdrop')}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-700 rounded-xl transition group border border-slate-100"
          >
            Start Transfer
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Shared Text Room Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="p-3 bg-slate-100 rounded-xl text-slate-700">
                <FileText className="w-6 h-6" />
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                No Login Required
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Shared Text Rooms</h3>
            <p className="text-sm text-slate-500 mb-4">
              Create an online text pad protected by a secret key.
            </p>
            <ul className="text-xs text-slate-500 space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Access from any device via URL
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Secured via custom edit passcodes
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Perfect for code snippets & notepad sharing
              </li>
            </ul>
          </div>

          <button
            onClick={() => setActiveTab('textroom')}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-700 rounded-xl transition group border border-slate-100"
          >
            Create Text Room
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Difficulty Breakdown panel */}
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/60">
        <h4 className="text-md font-bold text-slate-800 mb-4">Blind 75 Difficulty Breakdown</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Easy */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-emerald-600">Easy Questions</span>
              <span className="text-slate-500">{stats.easy.solved} / {stats.easy.total}</span>
            </div>
            <div className="w-full bg-slate-200/60 rounded-full h-1.5">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full" 
                style={{ width: `${stats.easy.total ? (stats.easy.solved / stats.easy.total) * 100 : 0}%` }}
              />
            </div>
          </div>
          {/* Medium */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-amber-500">Medium Questions</span>
              <span className="text-slate-500">{stats.medium.solved} / {stats.medium.total}</span>
            </div>
            <div className="w-full bg-slate-200/60 rounded-full h-1.5">
              <div 
                className="bg-amber-500 h-1.5 rounded-full" 
                style={{ width: `${stats.medium.total ? (stats.medium.solved / stats.medium.total) * 100 : 0}%` }}
              />
            </div>
          </div>
          {/* Hard */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-rose-600">Hard Questions</span>
              <span className="text-slate-500">{stats.hard.solved} / {stats.hard.total}</span>
            </div>
            <div className="w-full bg-slate-200/60 rounded-full h-1.5">
              <div 
                className="bg-rose-500 h-1.5 rounded-full" 
                style={{ width: `${stats.hard.total ? (stats.hard.solved / stats.hard.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
