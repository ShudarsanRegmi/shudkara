import React, { useEffect, useState } from 'react';
import { BookOpen, Share2, FileText, ArrowRight, Award } from 'lucide-react';
import { BLIND75_QUESTIONS } from '../data/blind75';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const [stats, setStats] = useState({
    total: 75,
    solved: 0,
    inProgress: 0,
    needsReview: 0,
    notStarted: 75,
    easy: { total: 0, solved: 0 },
    medium: { total: 0, solved: 0 },
    hard: { total: 0, solved: 0 },
  });

  useEffect(() => {
    // Calculate stats from localStorage
    const savedProgress = localStorage.getItem('shudkara_leetcode_progress');
    const progressMap = savedProgress ? JSON.parse(savedProgress) : {};

    let solved = 0;
    let inProgress = 0;
    let needsReview = 0;

    let easyTotal = 0;
    let easySolved = 0;
    let mediumTotal = 0;
    let mediumSolved = 0;
    let hardTotal = 0;
    let hardSolved = 0;

    BLIND75_QUESTIONS.forEach((q) => {
      // Category counts
      if (q.difficulty === 'Easy') easyTotal++;
      if (q.difficulty === 'Medium') mediumTotal++;
      if (q.difficulty === 'Hard') hardTotal++;

      const prog = progressMap[q.id];
      if (prog) {
        if (prog.status === 'Solved') {
          solved++;
          if (q.difficulty === 'Easy') easySolved++;
          if (q.difficulty === 'Medium') mediumSolved++;
          if (q.difficulty === 'Hard') hardSolved++;
        } else if (prog.status === 'In Progress') {
          inProgress++;
        } else if (prog.status === 'Needs Review') {
          needsReview++;
        }
      }
    });

    const notStarted = 75 - (solved + inProgress + needsReview);

    setStats({
      total: 75,
      solved,
      inProgress,
      needsReview,
      notStarted,
      easy: { total: easyTotal, solved: easySolved },
      medium: { total: mediumTotal, solved: mediumSolved },
      hard: { total: hardTotal, solved: hardSolved },
    });
  }, []);

  const completionPercentage = Math.round((stats.solved / stats.total) * 100);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Welcome banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-3xl p-8 text-white shadow-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-sm font-medium mb-4">
            <Award className="w-4 h-4 text-yellow-300" />
            <span>Welcome to Shudkara Hub</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Developer Workspace
          </h1>
          <p className="text-lg text-indigo-100 mb-6 max-w-xl">
            Track your LeetCode prep, instantly transfer files via secure WebRTC, or create ad-hoc collaborative text pads without logging in.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setActiveTab('leetcode')}
              className="px-6 py-3 bg-white text-indigo-600 font-semibold rounded-xl shadow-lg hover:bg-indigo-50 transition-colors duration-200"
            >
              Start Revising
            </button>
            <button
              onClick={() => setActiveTab('airdrop')}
              className="px-6 py-3 bg-indigo-500/30 hover:bg-indigo-500/40 text-white font-semibold rounded-xl border border-white/20 backdrop-blur-sm transition-colors duration-200"
            >
              Drop a File
            </button>
          </div>
        </div>
      </div>

      {/* Main Sections Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Leetcode Progress Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="p-3 bg-amber-100 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
                <BookOpen className="w-6 h-6" />
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                Leetcode
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Blind 75 Revision</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Track notes, status, and revision counts for the classic Blind 75 list.
            </p>

            {/* Circular or simple progress bar */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span>Overall Progress</span>
                  <span>{stats.solved}/75 ({completionPercentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>

              {/* Mini Stats Breakdown */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2.5 rounded-lg text-center">
                  <span className="block text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.solved}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Solved</span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 p-2.5 rounded-lg text-center">
                  <span className="block text-lg font-bold text-blue-600 dark:text-blue-400">{stats.inProgress}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Learning</span>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-lg text-center">
                  <span className="block text-lg font-bold text-rose-600 dark:text-rose-400">{stats.needsReview}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Review</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('leetcode')}
            className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300 rounded-xl transition-colors duration-150 group"
          >
            Open Tracker
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* P2P Airdrop Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="p-3 bg-blue-100 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400">
                <Share2 className="w-6 h-6" />
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                Serverless P2P
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">WebRTC Airdrop</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Instantly share files directly with another browser. 
            </p>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-2 mb-6">
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
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300 rounded-xl transition-colors duration-150 group"
          >
            Start Transfer
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Shared Text Room Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="p-3 bg-purple-100 dark:bg-purple-950/40 rounded-xl text-purple-600 dark:text-purple-400">
                <FileText className="w-6 h-6" />
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                No Login Required
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Shared Text Rooms</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Create an online text pad protected by a secret key.
            </p>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Access from any device via URL
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Secured via custom edit passcodes
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Perfect for code snippets & notepad sharing
              </li>
            </ul>
          </div>

          <button
            onClick={() => setActiveTab('textroom')}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300 rounded-xl transition-colors duration-150 group"
          >
            Create Text Room
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Difficulty Breakdown panel */}
      <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/50">
        <h4 className="text-md font-bold text-slate-800 dark:text-slate-200 mb-4">Blind 75 Difficulty Breakdown</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Easy */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-emerald-600">Easy Questions</span>
              <span className="text-slate-500 dark:text-slate-400">{stats.easy.solved} / {stats.easy.total}</span>
            </div>
            <div className="w-full bg-slate-200/60 dark:bg-slate-800 rounded-full h-1.5">
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
              <span className="text-slate-500 dark:text-slate-400">{stats.medium.solved} / {stats.medium.total}</span>
            </div>
            <div className="w-full bg-slate-200/60 dark:bg-slate-800 rounded-full h-1.5">
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
              <span className="text-slate-500 dark:text-slate-400">{stats.hard.solved} / {stats.hard.total}</span>
            </div>
            <div className="w-full bg-slate-200/60 dark:bg-slate-800 rounded-full h-1.5">
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
