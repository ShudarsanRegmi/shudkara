import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Camera,
  Upload,
  Check,
  X,
  Snowflake,
  Bell,
  Volume2,
  VolumeX,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle2,
  LayoutGrid,
  Flame,
  Trophy,
  ShieldAlert,
  AlertTriangle,
  Award
} from 'lucide-react';
import { TimelineCameraModal, type SnappedPhoto } from './TimelineCameraModal';
import { enqueueOfflineAction, isDeviceOnline } from '../utils/offlineSync';

export interface StreakCheckIn {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  photoUrl?: string;
  photos?: string[];
  title?: string;
  notes?: string;
  isLeaveDay?: boolean;
}

export interface StreakItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  targetTime: string; // HH:mm format, e.g. "17:00"
  restDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  freezesRemaining: number;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt?: string;
  checkIns: StreakCheckIn[];
}

export interface StreakNotificationSettings {
  email: string;
  emailRemindersEnabled: boolean;
  browserNotificationsEnabled: boolean;
  remindHoursBefore: number[];
  annoyanceLevel: 'chill' | 'firm' | 'unhinged_duolingo';
}

const DEFAULT_SETTINGS: StreakNotificationSettings = {
  email: '',
  emailRemindersEnabled: true,
  browserNotificationsEnabled: true,
  remindHoursBefore: [2, 0.5],
  annoyanceLevel: 'unhinged_duolingo'
};

const CATEGORIES = [
  'Fitness & Gym',
  'Coding & Study',
  'Reading & Writing',
  'Health & Diet',
  'Mindfulness',
  'Creative & Art',
  'Daily Habit'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface StreaksProps {
  authToken?: string | null;
}

// Format Date YYYY-MM-DD local
export function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get array of photos from check-in (supports both multi-photo array and legacy single photoUrl)
export function getCheckInPhotos(checkIn?: StreakCheckIn): string[] {
  if (!checkIn) return [];
  if (Array.isArray(checkIn.photos) && checkIn.photos.length > 0) {
    return checkIn.photos;
  }
  if (checkIn.photoUrl) {
    return [checkIn.photoUrl];
  }
  return [];
}

// Sound Synthesizer via Web Audio API (Zero external audio file dependencies)
function playTone(type: 'success' | 'alert' | 'urgent') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.setValueAtTime(400, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'urgent') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.24);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    }
  } catch {
    // AudioContext blocked
  }
}

export const Streaks: React.FC<StreaksProps> = ({ authToken: _authToken }) => {
  const [streaks, setStreaks] = useState<StreakItem[]>(() => {
    try {
      const cached = localStorage.getItem('shudkara_streaks_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState<StreakNotificationSettings>(DEFAULT_SETTINGS);

  // Modals state
  const [isNewStreakOpen, setIsNewStreakOpen] = useState(false);
  const [editingStreak, setEditingStreak] = useState<StreakItem | null>(null);
  const [checkInStreak, setCheckInStreak] = useState<StreakItem | null>(null);
  const [calendarStreak, setCalendarStreak] = useState<StreakItem | null>(null);
  const [calendarViewMode, setCalendarViewMode] = useState<'grid' | 'calendar'>('grid');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [proofModalData, setProofModalData] = useState<{ checkIn: StreakCheckIn; streak: StreakItem } | null>(null);
  const [proofActivePhotoIndex, setProofActivePhotoIndex] = useState(0);

  // Full-screen native-like Camera Modal state (like Timeline)
  const [showCameraModal, setShowCameraModal] = useState(false);

  // Form states for creating / editing streak
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formTargetTime, setFormTargetTime] = useState('17:00');
  const [formRestDays, setFormRestDays] = useState<number[]>([]);
  const [formColor, setFormColor] = useState('#ea580c');

  // Check-In Wizard state (supports multiple photos and photo editing/replacement)
  const [checkInPhotos, setCheckInPhotos] = useState<string[]>([]);
  const [checkInTitle, setCheckInTitle] = useState('');
  const [checkInNotes, setCheckInNotes] = useState('');
  const [checkInDate, setCheckInDate] = useState(() => toLocalDateString(new Date()));
  const [isLeaveDayCheck, setIsLeaveDayCheck] = useState(false);
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);

  // Calendar view state
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(() => new Date());

  // Notification testing states
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);

  // Load data
  const fetchStreaks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/streaks');
      if (res.ok) {
        const data = await res.json();
        const streakItems = data.streaks || [];
        setStreaks(streakItems);
        localStorage.setItem('shudkara_streaks_cache', JSON.stringify(streakItems));
        if (data.notificationSettings) {
          setNotificationSettings(data.notificationSettings);
        }
      }
    } catch (err) {
      console.warn('Failed to load streaks from API, using cached data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreaks();

    const handleSyncComplete = () => {
      fetchStreaks();
    };
    window.addEventListener('shudkara:sync-completed', handleSyncComplete);
    return () => {
      window.removeEventListener('shudkara:sync-completed', handleSyncComplete);
    };
  }, []);

  // Request browser notification permission if enabled
  useEffect(() => {
    if (notificationSettings.browserNotificationsEnabled && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [notificationSettings.browserNotificationsEnabled]);

  // Streak Calculation Engine (robust & loop-safe)
  const calculateStreakStats = (streak: StreakItem) => {
    const checkIns = Array.isArray(streak.checkIns) ? streak.checkIns : [];
    const restDays = Array.isArray(streak.restDays) ? streak.restDays : [];
    const checkInMap = new Map<string, StreakCheckIn>();
    checkIns.forEach(c => checkInMap.set(c.date, c));

    const todayStr = toLocalDateString(new Date());
    const todayChecked = checkInMap.has(todayStr);
    const todayCheckIn = checkInMap.get(todayStr);

    // Target Time calculation
    const [targetHour = 17, targetMinute = 0] = (streak.targetTime || '17:00').split(':').map(Number);
    const targetDate = new Date();
    targetDate.setHours(targetHour, targetMinute, 0, 0);

    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    const isOverdue = diffMs < 0 && !todayChecked;
    const minutesLeft = Math.round(diffMs / 60000);

    if (checkIns.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        todayChecked: false,
        todayCheckIn: undefined,
        isOverdue,
        minutesLeft,
        totalCheckIns: 0,
        leaveDaysCount: 0
      };
    }

    const sortedDates = Array.from(checkInMap.keys()).sort();
    const earliestDate = new Date(sortedDates[0] + 'T00:00:00');

    let count = 0;
    let curr = new Date();
    curr.setHours(0, 0, 0, 0);

    const todayDayOfWeek = curr.getDay();
    const isTodayRestDay = restDays.includes(todayDayOfWeek);

    if (todayChecked || isTodayRestDay) {
      if (todayChecked) count++;
      curr.setDate(curr.getDate() - 1);
    } else {
      curr.setDate(curr.getDate() - 1);
    }

    let safety = 0;
    while (curr >= earliestDate && safety < 3000) {
      safety++;
      const dateStr = toLocalDateString(curr);
      const dayOfWeek = curr.getDay();
      const hasCheckIn = checkInMap.has(dateStr);
      const isRestDay = restDays.includes(dayOfWeek);

      if (hasCheckIn) {
        count++;
        curr.setDate(curr.getDate() - 1);
      } else if (isRestDay) {
        curr.setDate(curr.getDate() - 1);
      } else {
        break;
      }
    }

    let maxStreak = 0;
    let temp = 0;
    let prevDate: Date | null = null;
    for (const dStr of sortedDates) {
      const d = new Date(dStr + 'T00:00:00');
      if (!prevDate) {
        temp = 1;
      } else {
        const diffDays = Math.round((d.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          temp++;
        } else {
          temp = 1;
        }
      }
      if (temp > maxStreak) maxStreak = temp;
      prevDate = d;
    }
    maxStreak = Math.max(maxStreak, count);

    return {
      currentStreak: count,
      longestStreak: maxStreak,
      todayChecked,
      todayCheckIn,
      isOverdue,
      minutesLeft,
      totalCheckIns: checkIns.filter(c => !c.isLeaveDay).length,
      leaveDaysCount: checkIns.filter(c => c.isLeaveDay).length
    };
  };

  // Reminder dialogue generator
  const duolingoState = useMemo(() => {
    if (streaks.length === 0) {
      return {
        mood: 'chill',
        quote: "No streaks yet? Start one today. Discipline creates freedom!",
        level: 'normal'
      };
    }

    const statsList = streaks.map(s => ({
      streak: s,
      stats: calculateStreakStats(s)
    }));

    const unchecked = statsList.filter(s => !s.stats.todayChecked);
    const overdue = unchecked.filter(s => s.stats.isOverdue);
    const criticalUrgent = unchecked.filter(s => s.stats.minutesLeft <= 60 && !s.stats.isOverdue);

    if (unchecked.length === 0) {
      return {
        mood: 'proud',
        quote: "All streaks completed today! Keep up the momentum. Sleep well, champion!",
        level: 'safe'
      };
    }

    if (overdue.length > 0) {
      const s = overdue[0];
      return {
        mood: 'furious',
        quote: `CRITICAL ALERT: You missed your ${s.streak.targetTime} target for "${s.streak.title}"! Upload your photo proof right now before midnight or your ${s.stats.currentStreak}-day streak gets reset!`,
        level: 'danger'
      };
    }

    if (criticalUrgent.length > 0) {
      const s = criticalUrgent[0];
      return {
        mood: 'aggressive',
        quote: `WARNING: Only ${Math.max(1, s.stats.minutesLeft)} minutes left to complete "${s.streak.title}"! Take your proof photo now to secure your streak!`,
        level: 'urgent'
      };
    }

    const highest = statsList.sort((a, b) => b.stats.currentStreak - a.stats.currentStreak)[0];
    return {
      mood: 'warning',
      quote: `Keep your ${highest.stats.currentStreak}-day streak alive! You have ${unchecked.length} pending challenge${unchecked.length > 1 ? 's' : ''}. Check in before target time.`,
      level: 'warning'
    };
  }, [streaks]);

  // Periodic Reminder Checker
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      streaks.forEach(s => {
        const stats = calculateStreakStats(s);
        if (!stats.todayChecked) {
          if ((stats.minutesLeft === 60 || stats.minutesLeft === 30 || stats.minutesLeft === 10 || stats.isOverdue) && soundEnabled) {
            playTone(stats.isOverdue ? 'urgent' : 'alert');
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200, 100, 400]);
            }
          }

          if (notificationSettings.browserNotificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            if (stats.minutesLeft === 30 || (stats.isOverdue && now.getMinutes() === 0)) {
              new Notification(`Streak in Danger: ${s.title}`, {
                body: `Only ${stats.minutesLeft > 0 ? stats.minutesLeft + ' mins left' : 'CRITICAL OVERDUE'}! Upload photo proof to save your ${stats.currentStreak}-day streak!`,
                icon: '/favicon.ico'
              });
            }
          }
        }
      });
    }, 60000);

    return () => clearInterval(timer);
  }, [streaks, soundEnabled, notificationSettings]);

  // Handle capture snaps from full-screen camera modal
  const handleCaptureSnaps = (snaps: SnappedPhoto[]) => {
    const newPhotos = snaps.map(s => s.base64);
    setCheckInPhotos(prev => [...prev, ...newPhotos]);
    setShowCameraModal(false);
    if (soundEnabled) playTone('success');
  };

  // Handle file uploads (supports multiple files)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setCheckInPhotos(prev => [...prev, compressed]);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
    if (soundEnabled) playTone('success');
  };

  const handleRemovePhoto = (index: number) => {
    setCheckInPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Open existing check-in for editing / replacing bad photos
  const openEditCheckIn = (streak: StreakItem, checkIn: StreakCheckIn) => {
    setCheckInStreak(streak);
    setCheckInDate(checkIn.date);
    setCheckInPhotos(getCheckInPhotos(checkIn));
    setCheckInTitle(checkIn.title || '');
    setCheckInNotes(checkIn.notes || '');
    setIsLeaveDayCheck(!!checkIn.isLeaveDay);
    setProofModalData(null);
  };

  // Submit Check-in or Check-in Edit
  const handleSubmitCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInStreak) return;

    if (!isLeaveDayCheck && checkInPhotos.length === 0) {
      alert('Please take or upload at least one photo proof to complete your daily challenge!');
      return;
    }

    const streakId = checkInStreak.id;
    const streakTitle = checkInStreak.title;
    const checkInPayload: StreakCheckIn = {
      id: `checkin_${Date.now()}`,
      date: checkInDate,
      timestamp: new Date().toISOString(),
      photos: isLeaveDayCheck ? [] : checkInPhotos,
      photoUrl: isLeaveDayCheck ? undefined : checkInPhotos[0],
      title: checkInTitle.trim() || undefined,
      notes: checkInNotes.trim() || undefined,
      isLeaveDay: isLeaveDayCheck
    };

    // Optimistically update local state & cache immediately
    setStreaks(prev => {
      const updated = prev.map(s => {
        if (s.id !== streakId) return s;
        const filtered = s.checkIns.filter(c => c.date !== checkInDate);
        return {
          ...s,
          checkIns: [...filtered, checkInPayload].sort((a, b) => a.date.localeCompare(b.date))
        };
      });
      localStorage.setItem('shudkara_streaks_cache', JSON.stringify(updated));
      return updated;
    });

    if (calendarStreak?.id === streakId) {
      setCalendarStreak(prev => {
        if (!prev) return prev;
        const filtered = prev.checkIns.filter(c => c.date !== checkInDate);
        return {
          ...prev,
          checkIns: [...filtered, checkInPayload].sort((a, b) => a.date.localeCompare(b.date))
        };
      });
    }

    if (soundEnabled) playTone('success');
    setCheckInStreak(null);
    setCheckInPhotos([]);
    setCheckInTitle('');
    setCheckInNotes('');
    setIsLeaveDayCheck(false);

    // If offline, queue action into outbox
    if (!isDeviceOnline()) {
      enqueueOfflineAction({
        url: `/api/streaks/${streakId}/checkin`,
        method: 'POST',
        body: checkInPayload,
        description: `Check-in for "${streakTitle}" (${checkInDate})`,
        subapp: 'streaks'
      });
      return;
    }

    setSubmittingCheckIn(true);
    try {
      const res = await fetch(`/api/streaks/${streakId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkInPayload)
      });

      if (!res.ok) {
        enqueueOfflineAction({
          url: `/api/streaks/${streakId}/checkin`,
          method: 'POST',
          body: checkInPayload,
          description: `Check-in for "${streakTitle}" (${checkInDate})`,
          subapp: 'streaks'
        });
      }
    } catch {
      enqueueOfflineAction({
        url: `/api/streaks/${streakId}/checkin`,
        method: 'POST',
        body: checkInPayload,
        description: `Check-in for "${streakTitle}" (${checkInDate})`,
        subapp: 'streaks'
      });
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  // Delete a specific check-in
  const handleDeleteCheckIn = async (streakId: string, date: string) => {
    if (!window.confirm(`Delete check-in for date ${date}?`)) return;

    // Optimistically update local state immediately
    setStreaks(prev => {
      const updated = prev.map(s => {
        if (s.id !== streakId) return s;
        return {
          ...s,
          checkIns: s.checkIns.filter(c => c.date !== date)
        };
      });
      localStorage.setItem('shudkara_streaks_cache', JSON.stringify(updated));
      return updated;
    });

    setCalendarStreak(prev => {
      if (!prev || prev.id !== streakId) return prev;
      return {
        ...prev,
        checkIns: prev.checkIns.filter(c => c.date !== date)
      };
    });

    if (proofModalData?.checkIn.date === date) {
      setProofModalData(null);
    }

    if (!isDeviceOnline()) {
      enqueueOfflineAction({
        url: `/api/streaks/${streakId}/checkin/${date}`,
        method: 'DELETE',
        description: `Delete check-in for date ${date}`,
        subapp: 'streaks'
      });
      return;
    }

    try {
      const res = await fetch(`/api/streaks/${streakId}/checkin/${date}`, { method: 'DELETE' });
      if (!res.ok) {
        enqueueOfflineAction({
          url: `/api/streaks/${streakId}/checkin/${date}`,
          method: 'DELETE',
          description: `Delete check-in for date ${date}`,
          subapp: 'streaks'
        });
      }
    } catch {
      enqueueOfflineAction({
        url: `/api/streaks/${streakId}/checkin/${date}`,
        method: 'DELETE',
        description: `Delete check-in for date ${date}`,
        subapp: 'streaks'
      });
    }
  };

  // Save / Update Streak Definition
  const handleSaveStreak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      category: formCategory,
      targetTime: formTargetTime,
      restDays: formRestDays,
      color: formColor,
      icon: 'Flame'
    };

    const newOrUpdatedStreak: StreakItem = editingStreak ? {
      ...editingStreak,
      ...payload,
      updatedAt: new Date().toISOString()
    } : {
      id: `streak_${Date.now()}`,
      ...payload,
      freezesRemaining: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checkIns: []
    };

    setStreaks(prev => {
      const index = prev.findIndex(s => s.id === newOrUpdatedStreak.id);
      const next = index >= 0
        ? prev.map(s => (s.id === newOrUpdatedStreak.id ? newOrUpdatedStreak : s))
        : [newOrUpdatedStreak, ...prev];
      localStorage.setItem('shudkara_streaks_cache', JSON.stringify(next));
      return next;
    });

    setEditingStreak(null);
    setIsNewStreakOpen(false);
    resetForm();

    if (!isDeviceOnline()) {
      enqueueOfflineAction({
        url: editingStreak ? `/api/streaks/${editingStreak.id}` : '/api/streaks',
        method: editingStreak ? 'PUT' : 'POST',
        body: payload,
        description: `Save streak "${payload.title}"`,
        subapp: 'streaks'
      });
      return;
    }

    try {
      if (editingStreak) {
        const res = await fetch(`/api/streaks/${editingStreak.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          enqueueOfflineAction({
            url: `/api/streaks/${editingStreak.id}`,
            method: 'PUT',
            body: payload,
            description: `Save streak "${payload.title}"`,
            subapp: 'streaks'
          });
        }
      } else {
        const res = await fetch('/api/streaks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          enqueueOfflineAction({
            url: '/api/streaks',
            method: 'POST',
            body: payload,
            description: `Save streak "${payload.title}"`,
            subapp: 'streaks'
          });
        }
      }
    } catch {
      enqueueOfflineAction({
        url: editingStreak ? `/api/streaks/${editingStreak.id}` : '/api/streaks',
        method: editingStreak ? 'PUT' : 'POST',
        body: payload,
        description: `Save streak "${payload.title}"`,
        subapp: 'streaks'
      });
    }
  };

  const handleDeleteStreak = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete streak "${title}" and all its history?`)) return;

    setStreaks(prev => {
      const next = prev.filter(s => s.id !== id);
      localStorage.setItem('shudkara_streaks_cache', JSON.stringify(next));
      return next;
    });

    if (!isDeviceOnline()) {
      enqueueOfflineAction({
        url: `/api/streaks/${id}`,
        method: 'DELETE',
        description: `Delete streak "${title}"`,
        subapp: 'streaks'
      });
      return;
    }

    try {
      const res = await fetch(`/api/streaks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        enqueueOfflineAction({
          url: `/api/streaks/${id}`,
          method: 'DELETE',
          description: `Delete streak "${title}"`,
          subapp: 'streaks'
        });
      }
    } catch {
      enqueueOfflineAction({
        url: `/api/streaks/${id}`,
        method: 'DELETE',
        description: `Delete streak "${title}"`,
        subapp: 'streaks'
      });
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCategory(CATEGORIES[0]);
    setFormTargetTime('17:00');
    setFormRestDays([]);
    setFormColor('#ea580c');
  };

  const openEditModal = (streak: StreakItem) => {
    setEditingStreak(streak);
    setFormTitle(streak.title);
    setFormDescription(streak.description || '');
    setFormCategory(streak.category);
    setFormTargetTime(streak.targetTime);
    setFormRestDays(streak.restDays || []);
    setFormColor(streak.color);
  };

  // Save Notification Settings
  const handleSaveNotificationSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/streaks/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationSettings)
      });
      if (res.ok) {
        alert('Notification settings saved successfully!');
        setIsSettingsOpen(false);
      }
    } catch {
      alert('Failed to save settings.');
    }
  };

  // Send Test Email Alert
  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch('/api/streaks/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streakTitle: streaks[0]?.title || 'Gym Workout Challenge',
          streakCount: 14,
          targetTime: streaks[0]?.targetTime || '5:00 PM',
          urgency: 'test',
          email: notificationSettings.email
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTestEmailResult(`Success! Test email sent to ${notificationSettings.email || 'your email'}. Check your inbox/spam!`);
      } else {
        setTestEmailResult(`Error: ${data.error || 'Failed to send test email.'}`);
      }
    } catch (err: any) {
      setTestEmailResult(`Network error: ${err.message}`);
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Monthly Calendar Grid Generator
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const calendarGrid = useMemo(() => {
    if (!calendarStreak) return [];
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();
    const daysCount = getDaysInMonth(year, month);
    const firstDayIndex = new Date(year, month, 1).getDay();

    const checkInMap = new Map<string, StreakCheckIn>();
    calendarStreak.checkIns.forEach(c => checkInMap.set(c.date, c));

    const cells: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      checkIn?: StreakCheckIn;
      isRestDay: boolean;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({
        dateStr: '',
        dayNum: 0,
        isCurrentMonth: false,
        isRestDay: false,
        isToday: false
      });
    }

    const todayStr = toLocalDateString(new Date());

    for (let d = 1; d <= daysCount; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = toLocalDateString(dateObj);
      const dayOfWeek = dateObj.getDay();
      const checkIn = checkInMap.get(dateStr);
      const isRestDay = calendarStreak.restDays.includes(dayOfWeek);

      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        checkIn,
        isRestDay,
        isToday: dateStr === todayStr
      });
    }

    return cells;
  }, [calendarStreak, currentCalendarMonth]);

  // Date-Annotated Grid Items (sorted descending: newest first)
  const annotatedGridItems = useMemo(() => {
    if (!calendarStreak) return [];
    const items = [...calendarStreak.checkIns];
    items.sort((a, b) => b.date.localeCompare(a.date));
    return items;
  }, [calendarStreak]);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* ── FULL-SCREEN CAMERA MODAL (Same as Timeline feature) ── */}
      {showCameraModal && (
        <TimelineCameraModal
          onCaptureSnaps={handleCaptureSnaps}
          onClose={() => setShowCameraModal(false)}
        />
      )}

      {/* ── TOP SASSY DUOLINGO BANNER ── */}
      <div
        className={`border rounded-3xl p-6 shadow-sm transition-all duration-300 ${
          duolingoState.level === 'danger'
            ? 'bg-rose-50 border-rose-200 text-rose-950'
            : duolingoState.level === 'urgent'
            ? 'bg-amber-50 border-amber-200 text-amber-950'
            : duolingoState.level === 'safe'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-transform hover:scale-105 ${
                duolingoState.level === 'danger'
                  ? 'bg-rose-500 text-white animate-pulse'
                  : duolingoState.level === 'urgent'
                  ? 'bg-amber-500 text-white'
                  : duolingoState.level === 'safe'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-orange-500 text-white'
              }`}
            >
              {duolingoState.level === 'danger' ? (
                <ShieldAlert className="w-7 h-7 text-white" />
              ) : duolingoState.level === 'urgent' ? (
                <AlertTriangle className="w-7 h-7 text-white" />
              ) : duolingoState.level === 'safe' ? (
                <Award className="w-7 h-7 text-white" />
              ) : (
                <Flame className="w-7 h-7 text-white" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-black/5">
                  Streak Guardian
                </span>
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                  Discipline engine & daily reminders
                </span>
              </div>
              <p className="text-sm md:text-base font-bold leading-relaxed max-w-2xl">
                {duolingoState.quote}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl border transition ${
                soundEnabled
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
              title={soundEnabled ? 'Sassy sound alerts enabled' : 'Sound alerts muted'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
              title="Notification Settings (Email & System Push)"
            >
              <Bell className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                resetForm();
                setIsNewStreakOpen(true);
              }}
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>New Streak</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── STREAKS LIST GRID ── */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">
          Loading your photo streaks...
        </div>
      ) : streaks.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto shadow-inner">
            <Flame className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-900">No Streaks Created Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first daily photo challenge (e.g. Gym 5PM, Daily Code, 30 Min Reading) and let the app hold you accountable every day.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setIsNewStreakOpen(true);
            }}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs inline-flex items-center gap-2 shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Streak</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {streaks.map(streak => {
            const stats = calculateStreakStats(streak);

            return (
              <div
                key={streak.id}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6 relative overflow-hidden group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                      {streak.category}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(streak)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title="Edit streak settings"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteStreak(streak.id, streak.title)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete streak"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 mb-1 group-hover:text-orange-600 transition truncate">
                    {streak.title}
                  </h3>
                  {streak.description && (
                    <p className="text-xs text-slate-500 line-clamp-1 mb-3">
                      {streak.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-xs font-semibold mb-6">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Target: {streak.targetTime}</span>

                    {stats.todayChecked ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Done
                      </span>
                    ) : stats.isOverdue ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold animate-pulse">
                        Overdue
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold">
                        {Math.floor(stats.minutesLeft / 60)}h {stats.minutesLeft % 60}m left
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-inner">
                        <Flame className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                          Current Streak
                        </span>
                        <span className="text-2xl font-black text-slate-900 tracking-tight">
                          {stats.currentStreak} <span className="text-xs font-bold text-slate-500">DAYS</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Record
                      </span>
                      <div className="flex items-center gap-1 justify-end">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-sm font-extrabold text-slate-700">
                          {stats.longestStreak}d
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {stats.todayChecked ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-800">
                          {stats.todayCheckIn?.isLeaveDay ? 'Frozen (Rest Day)' : 'Streak Secured Today!'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditCheckIn(streak, stats.todayCheckIn!)}
                          className="text-[11px] font-bold text-slate-600 hover:text-slate-900 border border-emerald-300 bg-white px-2 py-1 rounded-lg hover:bg-emerald-100/50 flex items-center gap-1 transition"
                          title="Replace or edit photos taken today"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        {getCheckInPhotos(stats.todayCheckIn).length > 0 && (
                          <button
                            onClick={() => {
                              setProofActivePhotoIndex(0);
                              setProofModalData({
                                checkIn: stats.todayCheckIn!,
                                streak
                              });
                            }}
                            className="text-[11px] font-bold text-emerald-700 hover:underline px-1"
                          >
                            Proof
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteCheckIn(streak.id, stats.todayCheckIn!.date)}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-800 border border-rose-200 bg-white px-2 py-1 rounded-lg hover:bg-rose-50 flex items-center gap-1 transition"
                          title="Delete today's check-in entry"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setCheckInStreak(streak);
                          setCheckInDate(toLocalDateString(new Date()));
                          setIsLeaveDayCheck(false);
                          setCheckInPhotos([]);
                          setCheckInTitle('');
                          setCheckInNotes('');
                        }}
                        className="py-2.5 px-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Check In</span>
                      </button>

                      <button
                        onClick={() => {
                          setCheckInStreak(streak);
                          setCheckInDate(toLocalDateString(new Date()));
                          setIsLeaveDayCheck(true);
                          setCheckInPhotos([]);
                          setCheckInTitle('');
                          setCheckInNotes('');
                        }}
                        className="py-2.5 px-3 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold border border-sky-200 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                        title="Mark today as rest or leave day without breaking streak"
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                        <span>Use Freeze</span>
                      </button>
                    </div>
                  )}

                  {/* Calendar & Annotated Grid View Button */}
                  <button
                    onClick={() => {
                      setCalendarStreak(streak);
                      setCurrentCalendarMonth(new Date());
                      setCalendarViewMode('grid');
                    }}
                    className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Photos & History</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: CREATE / EDIT STREAK ── */}
      {(isNewStreakOpen || editingStreak) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-extrabold text-slate-900">
                {editingStreak ? 'Edit Streak Challenge' : 'Create New Streak Challenge'}
              </h3>
              <button
                onClick={() => {
                  setIsNewStreakOpen(false);
                  setEditingStreak(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStreak} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Challenge Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gym Workout, 1 LeetCode Problem, Read 20 Mins"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Optional Description
                </label>
                <input
                  type="text"
                  placeholder="Short motivation or rule (e.g. minimum 45 mins session)"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Target Time (Daily Deadline) *
                  </label>
                  <input
                    type="time"
                    required
                    value={formTargetTime}
                    onChange={e => setFormTargetTime(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Scheduled Rest Days (Streak doesn't break)
                </label>
                <div className="grid grid-cols-7 gap-1.5 pt-1">
                  {WEEKDAYS.map((dayName, idx) => {
                    const isSelected = formRestDays.includes(idx);
                    return (
                      <button
                        type="button"
                        key={dayName}
                        onClick={() => {
                          setFormRestDays(prev =>
                            prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
                          );
                        }}
                        className={`py-2 text-xs font-bold rounded-xl border transition ${
                          isSelected
                            ? 'bg-sky-50 text-sky-700 border-sky-300'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {dayName}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewStreakOpen(false);
                    setEditingStreak(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs shadow-sm transition"
                >
                  {editingStreak ? 'Save Changes' : 'Create Streak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: PHOTO CHECK-IN & PHOTO EDITING WIZARD ── */}
      {checkInStreak && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  {isLeaveDayCheck ? (
                    <>
                      <Snowflake className="w-5 h-5 text-sky-600" />
                      <span>Mark Leave / Freeze Day</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 text-orange-600" />
                      <span>Daily Photo Proof</span>
                    </>
                  )}
                </h3>
                <p className="text-xs text-slate-500">
                  Challenge: <span className="font-bold text-orange-600">{checkInStreak.title}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setCheckInStreak(null);
                  setCheckInPhotos([]);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCheckIn} className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700">Check-In Date</span>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={e => setCheckInDate(e.target.value)}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                />
              </div>

              {/* Mode Toggle */}
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsLeaveDayCheck(false)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    !isLeaveDayCheck ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5 text-orange-600" />
                  <span>Upload / Take Photos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLeaveDayCheck(true)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    isLeaveDayCheck ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <Snowflake className="w-3.5 h-3.5 text-sky-600" />
                  <span>Mark Freeze / Rest Day</span>
                </button>
              </div>

              {!isLeaveDayCheck ? (
                <div className="space-y-4">
                  {/* Photo Thumbnails & Management (Allows editing / replacing bad photos) */}
                  {checkInPhotos.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Attached Photos ({checkInPhotos.length})
                        </label>
                        <span className="text-[10px] text-slate-400">Click remove button to delete</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        {checkInPhotos.map((photo, index) => (
                          <div key={index} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 group bg-slate-100 shadow-xs">
                            <img src={photo} alt={`proof-${index}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(index)}
                              className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-red-600 text-white rounded-lg transition shadow-md"
                              title="Delete this photo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-bold">
                              #{index + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions: Open Camera or Upload Files */}
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center space-y-3 bg-slate-50/50">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowCameraModal(true)}
                        className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition active:scale-95"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Launch Camera</span>
                      </button>

                      <label className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-xs transition active:scale-95">
                        <Upload className="w-4 h-4" />
                        <span>Upload Photos</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Take multiple snaps or upload multiple proofs. You can remove and replace bad photos anytime.
                    </p>
                  </div>

                  {/* Caption / Title */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Optional Caption / Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chest & Triceps completed, 5km morning run"
                      value={checkInTitle}
                      onChange={e => setCheckInTitle(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-xs text-sky-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <Snowflake className="w-4 h-4 text-sky-600" />
                    <span>Streak Freeze Activated for {checkInDate}</span>
                  </div>
                  <p className="text-sky-800 text-[11px] leading-relaxed">
                    This day will be marked as a rest/leave day. Your streak counter will remain protected and will not break!
                  </p>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Optional Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="How did you feel? Any records or reflection..."
                  value={checkInNotes}
                  onChange={e => setCheckInNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <div>
                  {checkInStreak?.checkIns.some(c => c.date === checkInDate) && (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleDeleteCheckIn(checkInStreak.id, checkInDate);
                        setCheckInStreak(null);
                        setCheckInPhotos([]);
                      }}
                      className="px-3 py-2 text-xs font-bold text-rose-650 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-1.5 transition"
                      title="Delete existing entry for this day"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Day Entry</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCheckInStreak(null);
                      setCheckInPhotos([]);
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCheckIn || (!isLeaveDayCheck && checkInPhotos.length === 0)}
                    className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>{submittingCheckIn ? 'Saving...' : 'Confirm Check-In'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DATE-ANNOTATED GRID & MONTHLY CALENDAR VISUALIZATION ── */}
      {calendarStreak && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-orange-600" />
                  <span>Streak Proofs & History</span>
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  {calendarStreak.title} • {calendarStreak.checkIns.length} total entries recorded
                </p>
              </div>
              <button
                onClick={() => setCalendarStreak(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode Toggle: Date-Annotated Grid vs Monthly Calendar */}
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setCalendarViewMode('grid')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  calendarViewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-orange-600" />
                <span>Date-Annotated Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setCalendarViewMode('calendar')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  calendarViewMode === 'calendar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>Monthly Calendar</span>
              </button>
            </div>

            {/* ── VIEW 1: DATE-ANNOTATED GRID ── */}
            {calendarViewMode === 'grid' ? (
              <div className="space-y-4">
                {annotatedGridItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No check-ins or photos recorded for this streak challenge yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {annotatedGridItems.map(checkIn => {
                      const photos = getCheckInPhotos(checkIn);

                      return (
                        <div
                          key={checkIn.id || checkIn.date}
                          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3"
                        >
                          {/* Date Header Row */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold text-slate-900">
                                {new Date(checkIn.date + 'T00:00:00').toLocaleDateString(undefined, {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>

                              {checkIn.isLeaveDay ? (
                                <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-bold flex items-center gap-1 border border-sky-200">
                                  <Snowflake className="w-3 h-3 text-sky-600" /> Rest / Freeze Day
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 text-[10px] font-bold flex items-center gap-1 border border-orange-200">
                                  <Flame className="w-3 h-3 text-orange-600" /> {photos.length} Photo{photos.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>

                            {/* Actions on this date: Edit / Replace Photos or Delete */}
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => openEditCheckIn(calendarStreak, checkIn)}
                                className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition"
                                title="Edit caption, notes, or replace photos"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit Photos</span>
                              </button>
                              <button
                                onClick={() => handleDeleteCheckIn(calendarStreak.id, checkIn.date)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition"
                                title="Delete check-in"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Caption & Notes */}
                          {(checkIn.title || checkIn.notes) && (
                            <div className="space-y-0.5">
                              {checkIn.title && (
                                <p className="text-xs font-bold text-slate-800">{checkIn.title}</p>
                              )}
                              {checkIn.notes && (
                                <p className="text-[11px] text-slate-500">{checkIn.notes}</p>
                              )}
                            </div>
                          )}

                          {/* Photos Grid for that Day */}
                          {photos.length > 0 && (
                            <div className={`grid gap-2 ${
                              photos.length === 1
                                ? 'grid-cols-1 sm:grid-cols-2 max-w-sm'
                                : photos.length === 2
                                ? 'grid-cols-2'
                                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                            }`}>
                              {photos.map((photoUrl, pIdx) => (
                                <div
                                  key={pIdx}
                                  onClick={() => {
                                    setProofActivePhotoIndex(pIdx);
                                    setProofModalData({
                                      checkIn,
                                      streak: calendarStreak
                                    });
                                  }}
                                  className="relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 cursor-pointer group bg-slate-900/5 hover:shadow-md transition"
                                >
                                  <img
                                    src={photoUrl}
                                    alt={`proof-${pIdx}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                    <span className="text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-2 py-0.5 rounded-md">
                                      View Photo
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* ── VIEW 2: MONTHLY CALENDAR (Kept completely intact) ── */
              <div className="space-y-4">
                {/* Month Navigator */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <button
                    onClick={() => {
                      const d = new Date(currentCalendarMonth);
                      d.setMonth(d.getMonth() - 1);
                      setCurrentCalendarMonth(d);
                    }}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-sm font-bold text-slate-800">
                    {currentCalendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>

                  <button
                    onClick={() => {
                      const d = new Date(currentCalendarMonth);
                      d.setMonth(d.getMonth() + 1);
                      setCurrentCalendarMonth(d);
                    }}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="space-y-2">
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {WEEKDAYS.map(w => (
                      <div key={w}>{w}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {calendarGrid.map((cell, idx) => {
                      if (!cell.isCurrentMonth) {
                        return <div key={idx} className="aspect-square bg-slate-50/40 rounded-xl" />;
                      }

                      const photos = getCheckInPhotos(cell.checkIn);
                      const hasProof = photos.length > 0;
                      const isLeave = !!cell.checkIn?.isLeaveDay;
                      const isChecked = !!cell.checkIn;

                      return (
                        <button
                          key={cell.dateStr}
                          disabled={!cell.checkIn}
                          onClick={() => {
                            if (cell.checkIn) {
                              setProofActivePhotoIndex(0);
                              setProofModalData({
                                checkIn: cell.checkIn,
                                streak: calendarStreak
                              });
                            }
                          }}
                          className={`aspect-square rounded-xl p-1 flex flex-col items-center justify-between transition border text-xs font-bold relative group ${
                            cell.isToday ? 'ring-2 ring-orange-500' : ''
                          } ${
                            hasProof
                              ? 'bg-orange-500 text-white border-orange-600 shadow-xs hover:scale-105'
                              : isLeave
                              ? 'bg-sky-100 text-sky-800 border-sky-300'
                              : isChecked
                              ? 'bg-emerald-500 text-white border-emerald-600'
                              : cell.isRestDay
                              ? 'bg-slate-100 text-slate-400 border-slate-200'
                              : 'bg-slate-50 text-slate-700 border-slate-100'
                          }`}
                        >
                          <span className="text-[10px] self-start leading-none opacity-80">
                            {cell.dayNum}
                          </span>

                          <div className="text-center">
                            {hasProof ? (
                              <div className="flex items-center gap-0.5 justify-center">
                                <Flame className="w-3.5 h-3.5 text-white" />
                                {photos.length > 1 && (
                                  <span className="text-[9px] bg-black/40 px-1 rounded-full">{photos.length}</span>
                                )}
                              </div>
                            ) : isLeave ? (
                              <Snowflake className="w-3.5 h-3.5 text-sky-600" />
                            ) : isChecked ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : cell.isRestDay ? (
                              <span className="text-[9px] font-bold text-slate-400">REST</span>
                            ) : null}
                          </div>

                          <div className="w-1 h-1" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500 font-semibold pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-orange-500 inline-block" /> Completed with Photo
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-sky-200 inline-block" /> Streak Freeze / Rest Day
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md border-2 border-orange-500 inline-block" /> Today
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: FULL PHOTO PROOF CAROUSEL & VIEWER ── */}
      {proofModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl space-y-4">
            {(() => {
              const photos = getCheckInPhotos(proofModalData.checkIn);
              const currentPhoto = photos[proofActivePhotoIndex] || photos[0];

              return (
                <div>
                  {currentPhoto ? (
                    <div className="relative aspect-4/3 bg-slate-950 flex items-center justify-center">
                      <img
                        src={currentPhoto}
                        alt="Proof"
                        className="w-full h-full object-contain"
                      />

                      {/* Navigation Carousel Arrows if multiple photos */}
                      {photos.length > 1 && (
                        <>
                          <button
                            onClick={() =>
                              setProofActivePhotoIndex(prev => (prev - 1 + photos.length) % photos.length)
                            }
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black text-white rounded-full transition"
                            title="Previous photo"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              setProofActivePhotoIndex(prev => (prev + 1) % photos.length)
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black text-white rounded-full transition"
                            title="Next photo"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <span className="absolute bottom-3 right-3 bg-black/60 px-2.5 py-1 rounded-md text-white text-xs font-bold">
                            {proofActivePhotoIndex + 1} / {photos.length}
                          </span>
                        </>
                      )}

                      <button
                        onClick={() => setProofModalData(null)}
                        className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                          {proofModalData.checkIn.isLeaveDay ? (
                            <Snowflake className="w-5 h-5" />
                          ) : (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            {proofModalData.checkIn.isLeaveDay ? 'Streak Freeze (Rest Day)' : 'Check-In Entry'}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium">
                            {proofModalData.checkIn.date}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setProofModalData(null)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  <div className="p-6 pt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-bold text-slate-900">
                          {proofModalData.checkIn.title || proofModalData.streak.title}
                        </h4>
                        <p className="text-xs text-slate-500 font-semibold">
                          Date: {proofModalData.checkIn.date}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditCheckIn(proofModalData.streak, proofModalData.checkIn)}
                          className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                          title="Replace bad photos or edit caption"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit / Replace Photos</span>
                        </button>
                        <button
                          onClick={() => handleDeleteCheckIn(proofModalData.streak.id, proofModalData.checkIn.date)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                          title="Delete this day's check-in entry"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete Entry</span>
                        </button>
                      </div>
                    </div>

                    {proofModalData.checkIn.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {proofModalData.checkIn.notes}
                      </p>
                    )}

                    <button
                      onClick={() => setProofModalData(null)}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── MODAL: NOTIFICATION & AGGRESSIVE REMINDERS SETTINGS ── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-600" />
                  <span>Notification & Reminder Alerts</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Configure phone push & email alerts to never drop your streak.
                </p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNotificationSettings} className="space-y-5">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 block">
                    Phone / Browser System Notifications
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Alerts on your phone screen when deadline is near
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.browserNotificationsEnabled}
                  onChange={e =>
                    setNotificationSettings(prev => ({
                      ...prev,
                      browserNotificationsEnabled: e.target.checked
                    }))
                  }
                  className="w-5 h-5 accent-orange-600 rounded cursor-pointer"
                />
              </div>

              <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 block">
                      Email Reminder Alerts
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Sends urgent warning emails before target time
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationSettings.emailRemindersEnabled}
                    onChange={e =>
                      setNotificationSettings(prev => ({
                        ...prev,
                        emailRemindersEnabled: e.target.checked
                      }))
                    }
                    className="w-5 h-5 accent-orange-600 rounded cursor-pointer"
                  />
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Recipient Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="your-email@gmail.com"
                    value={notificationSettings.email}
                    onChange={e =>
                      setNotificationSettings(prev => ({
                        ...prev,
                        email: e.target.value
                      }))
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Duolingo Annoyance Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['chill', 'firm', 'unhinged_duolingo'] as const).map(lvl => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() =>
                        setNotificationSettings(prev => ({
                          ...prev,
                          annoyanceLevel: lvl
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-xs font-bold capitalize transition text-center ${
                        notificationSettings.annoyanceLevel === lvl
                          ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {lvl.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  disabled={sendingTestEmail}
                  onClick={handleSendTestEmail}
                  className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingTestEmail ? 'Sending Test Email...' : 'Send Test Alert Email Now'}</span>
                </button>
                {testEmailResult && (
                  <p className="text-[11px] text-slate-600 font-semibold mt-2 text-center">
                    {testEmailResult}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs shadow-sm transition"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
