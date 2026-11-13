import { useState, useEffect, useMemo } from 'react';
import {
  Hourglass,
  Clock,
  Sparkles,
  Trophy,
  Flame,
  Zap,
  Shield,
  Heart,
  Brain,
  Coins,
  Compass,
  Calendar,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Circle,
  Sliders,
  Download,
  Upload,
  Swords,
  Target,
  Check,
  X,
  Layers
} from 'lucide-react';
import { isDeviceOnline, enqueueOfflineAction } from '../utils/offlineSync';

export interface LifeProfile {
  id: string;
  dob: string; // ISO date e.g. "2001-01-01"
  maxAge: number; // e.g. 85
  heroName: string;
  heroTitle: string;
  heroClass: string;
  motto: string;
  updatedAt: string;
}

export type MilestoneCategory =
  | 'career'
  | 'wealth'
  | 'health'
  | 'skills'
  | 'travel'
  | 'relationships'
  | 'creative'
  | 'spirit';

export type RpgAttribute =
  | 'vitality'
  | 'intellect'
  | 'wealth'
  | 'agility'
  | 'charisma';

export interface LifeMilestone {
  id: string;
  title: string;
  description?: string;
  category: MilestoneCategory;
  targetAge: number | null; // null => Backlog
  targetDate?: string | null;
  status: 'backlog' | 'planned' | 'in_progress' | 'achieved';
  xp: number;
  attribute: RpgAttribute;
  isEpicBoss?: boolean;
  achievedAt?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_CONFIG: Record<
  MilestoneCategory,
  { label: string; color: string; bg: string; text: string; border: string; icon: any }
> = {
  career: {
    label: 'Career & Legacy',
    color: 'blue',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: Target
  },
  wealth: {
    label: 'Fortune & Assets',
    color: 'amber',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: Coins
  },
  health: {
    label: 'Vitality & Health',
    color: 'emerald',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: Heart
  },
  skills: {
    label: 'Knowledge & Skill',
    color: 'indigo',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    icon: Brain
  },
  travel: {
    label: 'Travel & Odyssey',
    color: 'teal',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    icon: Compass
  },
  relationships: {
    label: 'Bonds & Kin',
    color: 'rose',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    icon: Shield
  },
  creative: {
    label: 'Creative & Art',
    color: 'purple',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: Sparkles
  },
  spirit: {
    label: 'Spirit & Mind',
    color: 'violet',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    icon: Flame
  }
};

const ATTRIBUTE_CONFIG: Record<
  RpgAttribute,
  { label: string; icon: any; color: string; desc: string }
> = {
  vitality: { label: 'Vitality', icon: Heart, color: 'text-emerald-600', desc: 'Fitness, sleep & physical vigor' },
  intellect: { label: 'Intellect', icon: Brain, color: 'text-indigo-600', desc: 'Knowledge, reasoning & craft' },
  wealth: { label: 'Fortune', icon: Coins, color: 'text-amber-600', desc: 'Financial liberty & assets' },
  agility: { label: 'Agility', icon: Zap, color: 'text-teal-600', desc: 'Adventures, speed & wanderlust' },
  charisma: { label: 'Charisma', icon: Shield, color: 'text-rose-600', desc: 'Influence, bonds & leadership' }
};

const DEFAULT_PROFILE: LifeProfile = {
  id: 'main',
  dob: '2001-01-01',
  maxAge: 85,
  heroName: 'Chronomancer',
  heroTitle: 'Architect of Destiny',
  heroClass: 'Visionary',
  motto: 'Memento Mori • Carpe Diem • Level Up Every Year',
  updatedAt: new Date().toISOString()
};

const DEFAULT_MILESTONES: LifeMilestone[] = [
  {
    id: 'm-genesis',
    title: 'The Great Awakening (Spawn into World)',
    description: 'Began the legendary journey of life on Earth.',
    category: 'spirit',
    targetAge: 0,
    targetDate: null,
    status: 'achieved',
    xp: 100,
    attribute: 'vitality',
    isEpicBoss: true,
    achievedAt: '2001-01-01T00:00:00.000Z',
    notes: 'Level 0 unlocked.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm-quarter-century',
    title: 'Decadal Boss: Conquer Age 25',
    description: 'Reach financial independence baseline, peak fitness, ship flagship projects.',
    category: 'career',
    targetAge: 25,
    targetDate: null,
    status: 'in_progress',
    xp: 500,
    attribute: 'intellect',
    isEpicBoss: true,
    achievedAt: null,
    notes: 'Epic decadal trial of youth and mastery.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm-first-100k',
    title: 'Net Worth Milestone: $100K Liquid Vault',
    description: 'Build compounding investment portfolio and multi-channel asset streams.',
    category: 'wealth',
    targetAge: 27,
    targetDate: null,
    status: 'planned',
    xp: 350,
    attribute: 'wealth',
    isEpicBoss: false,
    achievedAt: null,
    notes: 'Asset allocation & financial resilience.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm-ironman',
    title: 'Run a Full 42.195km Marathon / Triathlon',
    description: 'Push physical vitality and lung endurance to elite athletic status.',
    category: 'health',
    targetAge: 28,
    targetDate: null,
    status: 'planned',
    xp: 400,
    attribute: 'vitality',
    isEpicBoss: true,
    achievedAt: null,
    notes: 'Zone 2 cardio mastery.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm-japan-odyssey',
    title: 'Wanderlust: Month-long Solo Expedition to Japan & Alps',
    description: 'Experience ancient cultures, mountaintop sunrises, and deep introspective wandering.',
    category: 'travel',
    targetAge: null, // In Backlog
    targetDate: null,
    status: 'backlog',
    xp: 250,
    attribute: 'agility',
    isEpicBoss: false,
    achievedAt: null,
    notes: 'Currently in backlog quests awaiting assigned target age.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const STORAGE_KEY_PROFILE = 'shudkara_life_odyssey_profile';
const STORAGE_KEY_MILESTONES = 'shudkara_life_odyssey_milestones';

interface Props {
  authToken: string | null;
}

export function LifeOdyssey({ authToken: _authToken }: Props) {
  // ── State Initialization ─────────────────────────────────────────────────
  const [profile, setProfile] = useState<LifeProfile>(() => {
    try {
      const local = localStorage.getItem(STORAGE_KEY_PROFILE);
      return local ? JSON.parse(local) : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [milestones, setMilestones] = useState<LifeMilestone[]>(() => {
    try {
      const local = localStorage.getItem(STORAGE_KEY_MILESTONES);
      return local ? JSON.parse(local) : DEFAULT_MILESTONES;
    } catch {
      return DEFAULT_MILESTONES;
    }
  });

  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline'>('synced');
  const [currentTab, setCurrentTab] = useState<'matrix' | 'timeline' | 'countdowns' | 'quests' | 'backlog'>('matrix');

  // Modals
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<LifeMilestone | null>(null);
  const [assignAgeModalItem, setAssignAgeModalItem] = useState<LifeMilestone | null>(null);
  const [assignAgeInput, setAssignAgeInput] = useState<string>('25');
  const [celebrationModal, setCelebrationModal] = useState<{ title: string; xp: number; attribute: string } | null>(null);

  // Filters & Matrix Decade Zoom
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedDecade, setSelectedDecade] = useState<number | 'all'>('all');

  // Live real-time ticking clock (1s interval)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Save to LocalStorage whenever state updates
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save profile locally', e);
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MILESTONES, JSON.stringify(milestones));
    } catch (e) {
      console.error('Failed to save milestones locally', e);
    }
  }, [milestones]);

  // Initial Fetch from Azure Functions Backend if online
  useEffect(() => {
    async function loadCloudData() {
      if (!isDeviceOnline()) {
        setSyncStatus('offline');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/life-odyssey');
        if (res.ok) {
          const data = await res.json();
          if (data.profile) setProfile(data.profile);
          if (Array.isArray(data.milestones) && data.milestones.length > 0) {
            setMilestones(data.milestones);
          }
          setSyncStatus('synced');
        }
      } catch (err) {
        console.warn('LifeOdyssey: Failed to fetch from cloud, continuing offline', err);
        setSyncStatus('offline');
      } finally {
        setLoading(false);
      }
    }
    loadCloudData();
  }, []);

  // ── Age & Odyssey Mathematics ─────────────────────────────────────────────
  const dobDate = useMemo(() => {
    const d = new Date(profile.dob);
    return isNaN(d.getTime()) ? new Date('2001-01-01') : d;
  }, [profile.dob]);

  const ageData = useMemo(() => {
    const nowMs = currentTime.getTime();
    const dobMs = dobDate.getTime();
    const diffMs = Math.max(0, nowMs - dobMs);

    // Exact fractional age
    const msInYear = 1000 * 60 * 60 * 24 * 365.2425;
    const exactAge = diffMs / msInYear;
    const currentAgeInt = Math.floor(exactAge);

    // Calendar age breakdown (Years, Months, Days, Hours, Mins, Secs)
    let y = currentTime.getFullYear() - dobDate.getFullYear();
    let m = currentTime.getMonth() - dobDate.getMonth();
    let d = currentTime.getDate() - dobDate.getDate();

    if (d < 0) {
      m -= 1;
      const prevMonthLastDay = new Date(currentTime.getFullYear(), currentTime.getMonth(), 0).getDate();
      d += prevMonthLastDay;
    }
    if (m < 0) {
      y -= 1;
      m += 12;
    }

    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();

    // Birthday and Next Level calculation
    const thisYearBirthday = new Date(currentTime.getFullYear(), dobDate.getMonth(), dobDate.getDate());
    let lastBirthday = thisYearBirthday;
    let nextBirthday = new Date(currentTime.getFullYear() + 1, dobDate.getMonth(), dobDate.getDate());

    if (currentTime < thisYearBirthday) {
      lastBirthday = new Date(currentTime.getFullYear() - 1, dobDate.getMonth(), dobDate.getDate());
      nextBirthday = thisYearBirthday;
    }

    const yearSpan = nextBirthday.getTime() - lastBirthday.getTime();
    const yearPassed = currentTime.getTime() - lastBirthday.getTime();
    const yearProgressPct = Math.min(100, Math.max(0, (yearPassed / yearSpan) * 100));
    const daysUntilNextLevel = Math.max(0, Math.ceil((nextBirthday.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)));

    // Total Life metrics
    const maxAge = Math.max(profile.maxAge || 85, currentAgeInt + 1);
    const totalLifeMs = maxAge * msInYear;
    const lifeLivedPct = Math.min(100, Math.max(0, (diffMs / totalLifeMs) * 100));
    const totalWeeksLived = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
    const totalMaxWeeks = maxAge * 52;
    const weeksRemaining = Math.max(0, totalMaxWeeks - totalWeeksLived);
    const daysRemaining = Math.max(0, Math.floor((totalLifeMs - diffMs) / (1000 * 60 * 60 * 24)));
    const estHeartbeats = Math.floor((diffMs / 1000) * 1.15); // ~70-75 bpm average

    // Current Life Season
    let seasonTitle = 'The Awakening & Foundations';
    let seasonDesc = 'Building core character, identity, curiosity, and boundless horizons.';
    if (exactAge >= 19 && exactAge < 30) {
      seasonTitle = 'The Crucible & Sovereign Prime';
      seasonDesc = 'Intense ambition, career building, compound foundation, and self-mastery.';
    } else if (exactAge >= 30 && exactAge < 50) {
      seasonTitle = 'The Empire of Grand Mastery';
      seasonDesc = 'Peak influence, leadership, wealth generation, and monumental creations.';
    } else if (exactAge >= 50 && exactAge < 70) {
      seasonTitle = 'The Golden Harvest & Mentorship';
      seasonDesc = 'Deep wisdom, guiding generations, financial summit, and freedom.';
    } else if (exactAge >= 70) {
      seasonTitle = 'The Transcendent Legacy';
      seasonDesc = 'Philosophical clarity, living legend, immortal impact, and gratitude.';
    }

    return {
      exactAge,
      currentAgeInt,
      years: y,
      months: m,
      days: d,
      hours,
      minutes,
      seconds,
      yearProgressPct,
      daysUntilNextLevel,
      maxAge,
      lifeLivedPct,
      totalWeeksLived,
      totalMaxWeeks,
      weeksRemaining,
      daysRemaining,
      estHeartbeats,
      seasonTitle,
      seasonDesc
    };
  }, [currentTime, dobDate, profile.maxAge]);

  // Calculate target date for a given age
  const getTargetDateForAge = (targetAge: number): Date => {
    const msInYear = 1000 * 60 * 60 * 24 * 365.2425;
    return new Date(dobDate.getTime() + targetAge * msInYear);
  };

  // RPG Attributes & Player Stats
  const rpgStats = useMemo(() => {
    const totals: Record<RpgAttribute, { xp: number; count: number }> = {
      vitality: { xp: 0, count: 0 },
      intellect: { xp: 0, count: 0 },
      wealth: { xp: 0, count: 0 },
      agility: { xp: 0, count: 0 },
      charisma: { xp: 0, count: 0 }
    };

    let totalEarnedXp = 0;
    let achievedCount = 0;
    let inProgressCount = 0;
    let backlogCount = 0;

    milestones.forEach((m) => {
      if (m.status === 'achieved') {
        achievedCount += 1;
        totalEarnedXp += m.xp || 100;
        if (totals[m.attribute]) {
          totals[m.attribute].xp += m.xp || 100;
          totals[m.attribute].count += 1;
        }
      } else if (m.status === 'in_progress') {
        inProgressCount += 1;
      } else if (m.status === 'backlog') {
        backlogCount += 1;
      }
    });

    // Tier/Rank title
    let rankTitle = 'Adept Traveler';
    let rankBadge = '🥉';
    if (totalEarnedXp >= 2500) {
      rankTitle = 'Immortal Legend';
      rankBadge = '👑';
    } else if (totalEarnedXp >= 1500) {
      rankTitle = 'Grand Chronomancer';
      rankBadge = '💎';
    } else if (totalEarnedXp >= 800) {
      rankTitle = 'Master Architect';
      rankBadge = '🥇';
    } else if (totalEarnedXp >= 350) {
      rankTitle = 'Vanguard Voyager';
      rankBadge = '🥈';
    }

    return {
      totals,
      totalEarnedXp,
      achievedCount,
      inProgressCount,
      backlogCount,
      rankTitle,
      rankBadge
    };
  }, [milestones]);

  // Milestone lookup by age for the matrix and timeline
  const milestonesByAge = useMemo(() => {
    const map = new Map<number, LifeMilestone[]>();
    milestones.forEach((m) => {
      if (m.targetAge !== null && m.targetAge !== undefined) {
        const ageFloor = Math.floor(m.targetAge);
        const existing = map.get(ageFloor) || [];
        existing.push(m);
        map.set(ageFloor, existing);
      }
    });
    return map;
  }, [milestones]);

  // Active countdown milestones (In Progress & Planned, with valid target dates or target ages)
  const countdownMilestones = useMemo(() => {
    return milestones
      .filter((m) => m.status !== 'achieved' && m.status !== 'backlog' && m.targetAge !== null)
      .map((m) => {
        const explicitDate = m.targetDate ? new Date(m.targetDate) : null;
        const targetDate = explicitDate && !isNaN(explicitDate.getTime())
          ? explicitDate
          : getTargetDateForAge(m.targetAge!);

        const diffMs = targetDate.getTime() - currentTime.getTime();
        const isPast = diffMs < 0;
        const absDiff = Math.abs(diffMs);

        const totalSecs = Math.floor(absDiff / 1000);
        const days = Math.floor(totalSecs / (3600 * 24));
        const hours = Math.floor((totalSecs % (3600 * 24)) / 3600);
        const minutes = Math.floor((totalSecs % 3600) / 60);
        const seconds = totalSecs % 60;

        return {
          ...m,
          targetDateObj: targetDate,
          diffMs,
          isPast,
          days,
          hours,
          minutes,
          seconds
        };
      })
      .sort((a, b) => a.targetDateObj.getTime() - b.targetDateObj.getTime());
  }, [milestones, currentTime, dobDate]);

  // Filtered milestones for the Quests & Backlog views
  const filteredMilestones = useMemo(() => {
    return milestones.filter((m) => {
      if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
      return true;
    });
  }, [milestones, categoryFilter]);

  // ── Actions: CRUD & Status Transitions ────────────────────────────────────
  const handleSaveProfile = async (newProfile: LifeProfile) => {
    setProfile(newProfile);
    setProfileModalOpen(false);

    if (isDeviceOnline()) {
      try {
        setSyncStatus('saving');
        const res = await fetch('/api/life-odyssey/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProfile)
        });
        if (res.ok) setSyncStatus('synced');
      } catch (err) {
        setSyncStatus('offline');
        enqueueOfflineAction({
          url: '/api/life-odyssey/profile',
          method: 'POST',
          body: newProfile,
          description: 'Update Life Odyssey Profile',
          subapp: 'lifeodyssey'
        });
      }
    } else {
      enqueueOfflineAction({
        url: '/api/life-odyssey/profile',
        method: 'POST',
        body: newProfile,
        description: 'Update Life Odyssey Profile (Offline)',
        subapp: 'lifeodyssey'
      });
      setSyncStatus('offline');
    }
  };

  const handleSaveMilestone = async (milestone: Partial<LifeMilestone>) => {
    const isEdit = Boolean(milestone.id && milestones.some((m) => m.id === milestone.id));
    const now = new Date().toISOString();

    let savedItem: LifeMilestone;

    if (isEdit) {
      savedItem = {
        ...milestones.find((m) => m.id === milestone.id)!,
        ...milestone,
        updatedAt: now
      } as LifeMilestone;

      setMilestones((prev) => prev.map((m) => (m.id === savedItem.id ? savedItem : m)));
    } else {
      const newId = `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      let initialStatus = milestone.status;
      if (!initialStatus) {
        initialStatus = milestone.targetAge === null ? 'backlog' : 'planned';
      }

      savedItem = {
        id: newId,
        title: milestone.title || 'Untitled Quest',
        description: milestone.description || '',
        category: milestone.category || 'career',
        targetAge: milestone.targetAge !== undefined ? milestone.targetAge : null,
        targetDate: milestone.targetDate || null,
        status: initialStatus,
        xp: milestone.xp || 100,
        attribute: milestone.attribute || 'intellect',
        isEpicBoss: Boolean(milestone.isEpicBoss),
        achievedAt: initialStatus === 'achieved' ? now : null,
        notes: milestone.notes || '',
        createdAt: now,
        updatedAt: now
      };

      setMilestones((prev) => [...prev, savedItem]);
    }

    setMilestoneModalOpen(false);
    setEditingMilestone(null);

    // Sync to backend
    if (isDeviceOnline()) {
      try {
        setSyncStatus('saving');
        const url = isEdit ? `/api/life-odyssey/milestones/${savedItem.id}` : '/api/life-odyssey/milestones';
        const method = isEdit ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(savedItem)
        });
        if (res.ok) setSyncStatus('synced');
      } catch (err) {
        setSyncStatus('offline');
      }
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this quest?')) return;
    setMilestones((prev) => prev.filter((m) => m.id !== id));

    if (isDeviceOnline()) {
      try {
        await fetch(`/api/life-odyssey/milestones/${id}`, { method: 'DELETE' });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleToggleStatus = async (item: LifeMilestone) => {
    const nextStatus = item.status === 'achieved' ? 'in_progress' : 'achieved';
    const achievedAt = nextStatus === 'achieved' ? new Date().toISOString() : null;

    const updated: LifeMilestone = {
      ...item,
      status: nextStatus,
      achievedAt,
      updatedAt: new Date().toISOString()
    };

    setMilestones((prev) => prev.map((m) => (m.id === item.id ? updated : m)));

    if (nextStatus === 'achieved') {
      // Trigger Gamification Celebration pop-up
      setCelebrationModal({
        title: item.title,
        xp: item.xp || 100,
        attribute: ATTRIBUTE_CONFIG[item.attribute]?.label || 'Wisdom'
      });
    }

    if (isDeviceOnline()) {
      try {
        await fetch(`/api/life-odyssey/milestones/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleAssignAge = async () => {
    if (!assignAgeModalItem) return;
    const ageNum = parseFloat(assignAgeInput);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 130) {
      alert('Please enter a valid age between 0 and 120');
      return;
    }

    const updated: LifeMilestone = {
      ...assignAgeModalItem,
      targetAge: ageNum,
      status: 'planned',
      updatedAt: new Date().toISOString()
    };

    setMilestones((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setAssignAgeModalItem(null);

    if (isDeviceOnline()) {
      try {
        await fetch(`/api/life-odyssey/milestones/${updated.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleExportJSON = () => {
    const data = { profile, milestones, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shudkara-life-odyssey-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.profile) setProfile(json.profile);
        if (Array.isArray(json.milestones)) setMilestones(json.milestones);
        alert('Life Odyssey imported successfully!');
        // Sync to backend
        if (isDeviceOnline()) {
          await fetch('/api/life-odyssey/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile: json.profile, milestones: json.milestones })
          });
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      
      {/* ── 1. Top HUD Hero Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 border border-indigo-900/60 shadow-2xl">
        {/* Subtle background cosmic grid overlay */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          
          {/* Hero Profile Info */}
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-linear-to-tr from-amber-400 via-rose-500 to-indigo-600 p-0.5 shadow-lg shadow-indigo-500/30 flex items-center justify-center">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex flex-col items-center justify-center">
                  <Hourglass className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400 animate-pulse" />
                  <span className="text-[10px] font-black tracking-wider text-amber-300 uppercase mt-0.5">
                    LVL {ageData.currentAgeInt}
                  </span>
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 text-xs px-1.5 py-0.5 bg-indigo-600 text-white font-extrabold rounded-full border border-indigo-400 shadow-xs">
                {rpgStats.rankBadge}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  {profile.heroName || 'Chronomancer'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {profile.heroClass || 'Visionary'}
                </span>
                <span className="text-xs text-indigo-300 font-medium">
                  • {rpgStats.rankTitle}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 font-medium italic">
                "{profile.motto || 'Memento Mori • Carpe Diem • Level Up Every Year'}"
              </p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  Born {dobDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span>•</span>
                <span className="text-indigo-200">
                  Est. Lifespan: <strong className="text-white">{ageData.maxAge} Yrs</strong>
                </span>
                <span>•</span>
                <button
                  onClick={() => setProfileModalOpen(true)}
                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 underline font-semibold transition"
                >
                  <Sliders className="w-3 h-3" /> Adjust Lifespan & Settings
                </button>
                {loading && <span className="text-[10px] text-indigo-300 animate-pulse">Syncing...</span>}
                {syncStatus === 'saving' && <span className="text-[10px] text-amber-300">Saving...</span>}
                {syncStatus === 'offline' && <span className="text-[10px] text-slate-400">(Offline Mode)</span>}
              </div>
            </div>
          </div>

          {/* Quick HUD Metrics & Level Up Progress */}
          <div className="w-full lg:w-80 bg-slate-800/80 backdrop-blur-md rounded-2xl p-4 border border-indigo-800/50 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" /> Next Level Up (Age {ageData.currentAgeInt + 1})
              </span>
              <span className="font-mono font-bold text-amber-300">{ageData.yearProgressPct.toFixed(1)}%</span>
            </div>

            {/* Birthday Progress bar */}
            <div className="w-full bg-slate-950/80 rounded-full h-2.5 p-0.5 border border-slate-700/60 overflow-hidden">
              <div
                className="bg-linear-to-r from-amber-400 via-rose-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${ageData.yearProgressPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{ageData.daysUntilNextLevel} days to birthday</span>
              <span>Total XP: <strong className="text-amber-300 font-mono">{rpgStats.totalEarnedXp}</strong></span>
            </div>
          </div>

        </div>

        {/* Real-time Live Age Counter Ticker Tape */}
        <div className="mt-6 pt-5 border-t border-indigo-900/80 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
          <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-700/50">
            <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">{ageData.years}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Years</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-700/50">
            <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">{ageData.months}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Months</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-700/50">
            <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">{ageData.days}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Days</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-700/50">
            <div className="text-2xl sm:text-3xl font-black font-mono text-indigo-300">
              {String(ageData.hours).padStart(2, '0')}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Hours</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-700/50">
            <div className="text-2xl sm:text-3xl font-black font-mono text-indigo-300">
              {String(ageData.minutes).padStart(2, '0')}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Minutes</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-700/50 relative overflow-hidden">
            <div className="text-2xl sm:text-3xl font-black font-mono text-rose-400 animate-pulse">
              {String(ageData.seconds).padStart(2, '0')}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Seconds</div>
          </div>
        </div>

        {/* Life Odyssey Big Picture Banner */}
        <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs bg-indigo-950/40 rounded-xl p-3 border border-indigo-800/40">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Current Era: <strong className="text-indigo-200">{ageData.seasonTitle}</strong>
              <span className="hidden sm:inline text-slate-400 ml-1.5">— {ageData.seasonDesc}</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-300 font-mono text-[11px] shrink-0">
            <span>
              Life Lived: <strong className="text-amber-300">{ageData.lifeLivedPct.toFixed(1)}%</strong>
            </span>
            <span>•</span>
            <span>
              Weeks Lived: <strong className="text-white">{ageData.totalWeeksLived.toLocaleString()}</strong> / {ageData.totalMaxWeeks.toLocaleString()}
            </span>
            <span>•</span>
            <span>
              Days Ahead: <strong className="text-emerald-400">{ageData.daysRemaining.toLocaleString()}</strong>
            </span>
          </div>
        </div>

      </div>

      {/* ── 2. RPG Attributes & Character Sheet Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.keys(ATTRIBUTE_CONFIG) as RpgAttribute[]).map((attrKey) => {
          const cfg = ATTRIBUTE_CONFIG[attrKey];
          const Icon = cfg.icon;
          const stat = rpgStats.totals[attrKey] || { xp: 0, count: 0 };
          return (
            <div
              key={attrKey}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cfg.label}</span>
                <span className={`p-1.5 rounded-lg bg-slate-50 ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <div className="text-xl font-black font-mono text-slate-900">{stat.xp} <span className="text-xs font-normal text-slate-400">XP</span></div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">{stat.count} quests achieved</p>
              </div>
              <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (stat.xp / 1000) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 3. Action Toolbar & Navigation Tabs ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setCurrentTab('matrix')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition shrink-0 ${
              currentTab === 'matrix' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Weeks Matrix</span>
          </button>

          <button
            onClick={() => setCurrentTab('timeline')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition shrink-0 ${
              currentTab === 'timeline' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Hourglass className="w-3.5 h-3.5" />
            <span>Age Timeline</span>
          </button>

          <button
            onClick={() => setCurrentTab('countdowns')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition shrink-0 ${
              currentTab === 'countdowns' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Countdowns</span>
            {countdownMilestones.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-400 text-slate-900 rounded-full text-[10px] font-black">
                {countdownMilestones.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab('quests')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition shrink-0 ${
              currentTab === 'quests' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>All Milestones</span>
          </button>

          <button
            onClick={() => setCurrentTab('backlog')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition shrink-0 ${
              currentTab === 'backlog' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Backlog</span>
            {rpgStats.backlogCount > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-black">
                {rpgStats.backlogCount}
              </span>
            )}
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => {
              setEditingMilestone(null);
              setMilestoneModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Milestone</span>
          </button>

          {/* Backup / Export Menu */}
          <button
            onClick={handleExportJSON}
            title="Export JSON backup"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <label
            title="Import JSON backup"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>

      </div>

      {/* ── 4. TAB CONTENTS ── */}

      {/* TAB 1: MEMENTO MORI: LIFE IN WEEKS MATRIX */}
      {currentTab === 'matrix' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Life in Weeks (Memento Mori Canvas)</span>
                <span className="text-xs font-normal text-slate-400">52 weeks per year</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Each square represents one week of your mortal life. Past weeks are etched in stone; the glowing square is this week.
              </p>
            </div>

            {/* Decade Quick-Filter Selector */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
              <button
                onClick={() => setSelectedDecade('all')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  selectedDecade === 'all' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Full Odyssey
              </button>
              {[0, 10, 20, 30, 40, 50, 60, 70, 80].map((dec) => {
                if (dec > ageData.maxAge) return null;
                return (
                  <button
                    key={dec}
                    onClick={() => setSelectedDecade(dec)}
                    className={`px-2 py-1 rounded-lg transition ${
                      selectedDecade === dec ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {dec}s
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-slate-800" />
              <span>Weeks Lived ({ageData.totalWeeksLived.toLocaleString()})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-amber-400 ring-2 ring-amber-300 animate-pulse" />
              <span>Current Week (You Are Here)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-indigo-500 border border-indigo-600" />
              <span>Milestone Target Flag</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-slate-100 border border-slate-200" />
              <span>Future Unwritten ({ageData.weeksRemaining.toLocaleString()})</span>
            </span>
          </div>

          {/* Weeks Matrix Grid */}
          <div className="overflow-x-auto pb-4">
            <div className="min-w-[760px] space-y-1">
              {Array.from({ length: ageData.maxAge + 1 }, (_, age) => {
                if (selectedDecade !== 'all') {
                  const decadeStart = selectedDecade;
                  const decadeEnd = decadeStart + 9;
                  if (age < decadeStart || age > decadeEnd) return null;
                }

                const ageMilestones = milestonesByAge.get(age) || [];
                const isCurrentAge = age === ageData.currentAgeInt;

                return (
                  <div key={age} className="flex items-center gap-2 group">
                    {/* Age Label */}
                    <div className="w-14 text-right shrink-0">
                      <span
                        className={`text-[11px] font-mono font-bold ${
                          isCurrentAge ? 'text-amber-600 underline' : 'text-slate-400'
                        }`}
                      >
                        Age {age}
                      </span>
                    </div>

                    {/* 52 Week Blocks */}
                    <div className="flex items-center gap-0.5 sm:gap-1 flex-1">
                      {Array.from({ length: 52 }, (_, weekIdx) => {
                        const globalWeekNum = age * 52 + weekIdx;
                        const isCurrentWeek = globalWeekNum === ageData.totalWeeksLived;
                        const isPastWeek = globalWeekNum < ageData.totalWeeksLived;
                        const hasMilestone = ageMilestones.length > 0 && weekIdx === 26; // Highlight mid-year for milestone

                        let cellClasses = 'w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[2px] transition-all cursor-pointer ';
                        if (isCurrentWeek) {
                          cellClasses += 'bg-amber-400 ring-2 ring-amber-300 ring-offset-1 z-10 scale-125 animate-pulse';
                        } else if (hasMilestone) {
                          cellClasses += 'bg-indigo-600 hover:bg-indigo-700 shadow-xs ring-1 ring-indigo-400';
                        } else if (isPastWeek) {
                          cellClasses += 'bg-slate-700 hover:bg-slate-900';
                        } else {
                          cellClasses += 'bg-slate-100 hover:bg-slate-200 border border-slate-200/60';
                        }

                        return (
                          <div
                            key={weekIdx}
                            className={cellClasses}
                            title={`Age ${age}, Week ${weekIdx + 1}${
                              isCurrentWeek ? ' (YOU ARE HERE)' : ''
                            }${hasMilestone ? ` - ${ageMilestones.length} Milestones set for Age ${age}` : ''}`}
                            onClick={() => {
                              if (ageMilestones.length > 0) {
                                setCurrentTab('quests');
                              } else {
                                setEditingMilestone({
                                  targetAge: age,
                                  category: 'career',
                                  attribute: 'intellect',
                                  xp: 100
                                } as any);
                                setMilestoneModalOpen(true);
                              }
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* Milestone Badge on the Row */}
                    <div className="w-24 shrink-0 text-left pl-2">
                      {ageMilestones.length > 0 && (
                        <button
                          onClick={() => setCurrentTab('quests')}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                        >
                          <Trophy className="w-2.5 h-2.5 text-amber-500" />
                          <span>{ageMilestones.length} {ageMilestones.length === 1 ? 'goal' : 'goals'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTERACTIVE AGE TIMELINE */}
      {currentTab === 'timeline' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>The Chronos Age Line</span>
                <span className="text-xs font-normal text-slate-400">From Age 0 to Age {ageData.maxAge}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Journey through your past conquests, present focus, and future horizons. Click any age node to add a quest.
              </p>
            </div>
          </div>

          {/* Interactive Timeline Track */}
          <div className="relative pl-6 sm:pl-10 space-y-8 before:absolute before:left-3 sm:before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-linear-to-b before:from-slate-800 before:via-indigo-500 before:to-slate-200">
            {Array.from({ length: ageData.maxAge + 1 }, (_, age) => {
              const ageMilestones = milestonesByAge.get(age) || [];
              const isCurrentAge = age === ageData.currentAgeInt;
              const isPast = age < ageData.currentAgeInt;
              const isDecade = age % 10 === 0;

              // Only show ages with milestones, decades, or current age to keep timeline legible and concise
              if (ageMilestones.length === 0 && !isCurrentAge && !isDecade && age !== 18 && age !== 21 && age !== 25) {
                return null;
              }

              return (
                <div key={age} className="relative group">
                  {/* Timeline Node Icon */}
                  <div
                    className={`absolute -left-6 sm:-left-10 mt-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-mono text-[10px] font-bold border-2 transition ${
                      isCurrentAge
                        ? 'bg-amber-400 text-slate-900 border-white ring-4 ring-amber-300/50 scale-125 z-20 animate-pulse'
                        : isPast
                        ? 'bg-slate-800 text-slate-100 border-white z-10'
                        : 'bg-white text-slate-500 border-indigo-400 z-10'
                    }`}
                  >
                    {age}
                  </div>

                  {/* Node Content Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        Age {age}
                        {isCurrentAge && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                            You Are Here (Level {ageData.currentAgeInt})
                          </span>
                        )}
                        {isDecade && !isCurrentAge && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            Decade Gate
                          </span>
                        )}
                      </h3>
                    </div>

                    <button
                      onClick={() => {
                        setEditingMilestone({
                          targetAge: age,
                          category: 'career',
                          attribute: 'intellect',
                          xp: 150
                        } as any);
                        setMilestoneModalOpen(true);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 self-start sm:self-auto opacity-80 group-hover:opacity-100 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Quest for Age {age}
                    </button>
                  </div>

                  {/* Milestones Cards for this age */}
                  {ageMilestones.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                      {ageMilestones.map((m) => {
                        const cat = CATEGORY_CONFIG[m.category] || CATEGORY_CONFIG.career;
                        const attr = ATTRIBUTE_CONFIG[m.attribute] || ATTRIBUTE_CONFIG.intellect;
                        const isAchieved = m.status === 'achieved';

                        return (
                          <div
                            key={m.id}
                            className={`rounded-2xl p-4 border transition-all ${
                              m.isEpicBoss
                                ? 'bg-linear-to-r from-amber-500/10 via-white to-amber-500/5 border-amber-300 shadow-sm'
                                : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleStatus(m)}
                                  className={`p-1 rounded-lg transition ${
                                    isAchieved
                                      ? 'text-emerald-600 hover:text-emerald-700'
                                      : 'text-slate-400 hover:text-slate-600'
                                  }`}
                                  title={isAchieved ? 'Mark In Progress' : 'Mark Achieved'}
                                >
                                  {isAchieved ? (
                                    <CheckCircle2 className="w-5 h-5 fill-emerald-100 text-emerald-600" />
                                  ) : (
                                    <Circle className="w-5 h-5" />
                                  )}
                                </button>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className={`text-sm font-bold ${isAchieved ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                      {m.title}
                                    </h4>
                                    {m.isEpicBoss && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                                        BOSS
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingMilestone(m);
                                    setMilestoneModalOpen(true);
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMilestone(m.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {m.description && (
                              <p className="text-xs text-slate-600 mt-2 pl-7 line-clamp-2">{m.description}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-2 mt-3 pl-7 text-[11px]">
                              <span className={`px-2 py-0.5 rounded-md font-semibold ${cat.bg} ${cat.text}`}>
                                {cat.label}
                              </span>
                              <span className="flex items-center gap-1 text-slate-500 font-medium">
                                <attr.icon className="w-3.5 h-3.5 text-indigo-500" />
                                +{m.xp} XP {attr.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic pl-1">
                      No milestones charted yet for Age {age}. Click add quest to set a target!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: DESTINY COUNTDOWN CLOCKS */}
      {currentTab === 'countdowns' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Destiny Countdown Clocks</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  {countdownMilestones.length} Active Targets
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live ticking count downs toward your most critical upcoming life milestones and age targets.
              </p>
            </div>
          </div>

          {countdownMilestones.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
              <Hourglass className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No active milestone countdowns</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Set target ages for your milestones to unlock real-time ticking destiny countdown clocks.
              </p>
              <button
                onClick={() => {
                  setEditingMilestone(null);
                  setMilestoneModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700 transition"
              >
                <Plus className="w-4 h-4" /> Create Countdown Quest
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {countdownMilestones.map((m) => {
                const cat = CATEGORY_CONFIG[m.category] || CATEGORY_CONFIG.career;
                const attr = ATTRIBUTE_CONFIG[m.attribute] || ATTRIBUTE_CONFIG.intellect;

                return (
                  <div
                    key={m.id}
                    className={`rounded-3xl p-6 border shadow-xs transition hover:shadow-md flex flex-col justify-between ${
                      m.isEpicBoss
                        ? 'bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border-amber-400/40 shadow-indigo-500/10'
                        : 'bg-white text-slate-900 border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                m.isEpicBoss
                                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                                  : `${cat.bg} ${cat.text}`
                              }`}
                            >
                              Target: Age {m.targetAge}
                            </span>
                            {m.isEpicBoss && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white flex items-center gap-1">
                                <Swords className="w-3 h-3" /> EPIC TRIAL
                              </span>
                            )}
                            <span className={`text-xs font-semibold flex items-center gap-1 ${m.isEpicBoss ? 'text-indigo-300' : 'text-slate-500'}`}>
                              <attr.icon className="w-3 h-3 text-indigo-400" />
                              +{m.xp} XP
                            </span>
                          </div>

                          <h3 className={`text-lg font-black tracking-tight ${m.isEpicBoss ? 'text-white' : 'text-slate-900'}`}>
                            {m.title}
                          </h3>
                        </div>

                        <button
                          onClick={() => handleToggleStatus(m)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1 shadow-xs shrink-0 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Done
                        </button>
                      </div>

                      {m.description && (
                        <p className={`text-xs mt-2 line-clamp-2 ${m.isEpicBoss ? 'text-slate-300' : 'text-slate-600'}`}>
                          {m.description}
                        </p>
                      )}
                    </div>

                    {/* Live Digital Countdown Clock */}
                    <div className="mt-6 pt-4 border-t border-slate-200/40">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        {m.isPast ? 'Target Age Passed (Overdue by)' : 'Time Remaining to Target'}
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className={`p-2 rounded-xl ${m.isEpicBoss ? 'bg-slate-800/80 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
                          <div className={`text-xl font-mono font-black ${m.isEpicBoss ? 'text-amber-400' : 'text-slate-900'}`}>
                            {m.days}
                          </div>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Days</div>
                        </div>
                        <div className={`p-2 rounded-xl ${m.isEpicBoss ? 'bg-slate-800/80 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
                          <div className={`text-xl font-mono font-black ${m.isEpicBoss ? 'text-amber-400' : 'text-slate-900'}`}>
                            {String(m.hours).padStart(2, '0')}
                          </div>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Hours</div>
                        </div>
                        <div className={`p-2 rounded-xl ${m.isEpicBoss ? 'bg-slate-800/80 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
                          <div className={`text-xl font-mono font-black ${m.isEpicBoss ? 'text-amber-400' : 'text-slate-900'}`}>
                            {String(m.minutes).padStart(2, '0')}
                          </div>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Mins</div>
                        </div>
                        <div className={`p-2 rounded-xl ${m.isEpicBoss ? 'bg-slate-800/80 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
                          <div className={`text-xl font-mono font-black ${m.isEpicBoss ? 'text-rose-400 animate-pulse' : 'text-indigo-600 animate-pulse'}`}>
                            {String(m.seconds).padStart(2, '0')}
                          </div>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Secs</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2">
                        <span>Est. Date: {m.targetDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <button
                          onClick={() => {
                            setEditingMilestone(m);
                            setMilestoneModalOpen(true);
                          }}
                          className="hover:underline text-indigo-400"
                        >
                          Edit Quest
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ALL QUESTS & MILESTONE BOARD */}
      {currentTab === 'quests' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Life Milestone Quest Board</span>
                <span className="text-xs font-normal text-slate-400">
                  {filteredMilestones.length} total goals
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage your life missions across all eras, track XP gain, and unlock legendary character achievements.
              </p>
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* Milestones List */}
          <div className="space-y-3">
            {filteredMilestones.map((m) => {
              const cat = CATEGORY_CONFIG[m.category] || CATEGORY_CONFIG.career;
              const attr = ATTRIBUTE_CONFIG[m.attribute] || ATTRIBUTE_CONFIG.intellect;
              const isAchieved = m.status === 'achieved';

              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isAchieved
                      ? 'bg-slate-50/60 border-slate-200 opacity-80'
                      : m.isEpicBoss
                      ? 'bg-amber-50/50 border-amber-200 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      onClick={() => handleToggleStatus(m)}
                      className="mt-0.5 text-slate-400 hover:text-emerald-600 transition"
                    >
                      {isAchieved ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm font-bold ${isAchieved ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {m.title}
                        </span>
                        {m.isEpicBoss && (
                          <span className="px-2 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                            BOSS QUEST
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.bg} ${cat.text}`}>
                          {cat.label}
                        </span>
                      </div>

                      {m.description && (
                        <p className="text-xs text-slate-600 line-clamp-2">{m.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                        <span>
                          Target:{' '}
                          <strong className="text-slate-700">
                            {m.targetAge !== null ? `Age ${m.targetAge}` : 'Backlog (Unassigned)'}
                          </strong>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <attr.icon className="w-3 h-3 text-indigo-500" />
                          +{m.xp} XP {attr.label}
                        </span>
                        {m.achievedAt && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-600 font-medium">
                              Achieved on {new Date(m.achievedAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {m.targetAge === null && (
                      <button
                        onClick={() => {
                          setAssignAgeModalItem(m);
                          setAssignAgeInput('25');
                        }}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                      >
                        Set Age
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingMilestone(m);
                        setMilestoneModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition hover:bg-slate-100"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMilestone(m.id)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-xl transition hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: UNWRITTEN BACKLOG */}
      {currentTab === 'backlog' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>The Unwritten Backlog (Ideas & Unscheduled Dreams)</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                  {rpgStats.backlogCount} Dreams
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Goals, dreams, and wild aspirations not yet tied to a specific age. When ready, assign them to a target age to promote them to the Active Timeline!
              </p>
            </div>

            <button
              onClick={() => {
                setEditingMilestone({
                  targetAge: null,
                  status: 'backlog',
                  category: 'creative',
                  attribute: 'intellect',
                  xp: 150
                } as any);
                setMilestoneModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Backlog</span>
            </button>
          </div>

          {milestones.filter((m) => m.targetAge === null || m.status === 'backlog').length === 0 ? (
            <div className="p-12 text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Target className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">Your Backlog is Clean</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                All your dreams currently have a timeline age assigned! Have a new wild goal or bucket-list item? Jot it down in the backlog.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {milestones
                .filter((m) => m.targetAge === null || m.status === 'backlog')
                .map((m) => {
                  const cat = CATEGORY_CONFIG[m.category] || CATEGORY_CONFIG.career;
                  const attr = ATTRIBUTE_CONFIG[m.attribute] || ATTRIBUTE_CONFIG.intellect;

                  return (
                    <div
                      key={m.id}
                      className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-indigo-200 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${cat.bg} ${cat.text}`}>
                            {cat.label}
                          </span>
                          <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                            <attr.icon className="w-3 h-3 text-indigo-500" />
                            +{m.xp} XP
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900">{m.title}</h3>
                        {m.description && <p className="text-xs text-slate-600 line-clamp-3">{m.description}</p>}
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <button
                          onClick={() => {
                            setAssignAgeModalItem(m);
                            setAssignAgeInput('28');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-2xs"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Assign Target Age</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingMilestone(m);
                              setMilestoneModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMilestone(m.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ── */}

      {/* 1. Profile & Lifespan Settings Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <span>Life Odyssey Profile</span>
              </h3>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveProfile({
                  ...profile,
                  heroName: String(formData.get('heroName') || profile.heroName),
                  heroTitle: String(formData.get('heroTitle') || profile.heroTitle),
                  heroClass: String(formData.get('heroClass') || profile.heroClass),
                  motto: String(formData.get('motto') || profile.motto),
                  dob: String(formData.get('dob') || profile.dob),
                  maxAge: Number(formData.get('maxAge')) || profile.maxAge
                });
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">Date of Birth (DOB)</label>
                <input
                  type="date"
                  name="dob"
                  defaultValue={profile.dob}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Used to power the live age ticker and 52-week Memento Mori matrix.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Estimated Max Life Age (Years): <strong className="text-indigo-600">{profile.maxAge}</strong>
                </label>
                <input
                  type="number"
                  name="maxAge"
                  min="40"
                  max="120"
                  defaultValue={profile.maxAge}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Most people plan for 80, 85, or 100 years of life canvas.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hero Name</label>
                  <input
                    type="text"
                    name="heroName"
                    defaultValue={profile.heroName}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">RPG Class</label>
                  <select
                    name="heroClass"
                    defaultValue={profile.heroClass}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Visionary">Visionary</option>
                    <option value="Alchemist">Alchemist</option>
                    <option value="Strategist">Strategist</option>
                    <option value="Nomad">Nomad</option>
                    <option value="Titan">Titan</option>
                    <option value="Sage">Sage</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Life Motto</label>
                <input
                  type="text"
                  name="motto"
                  defaultValue={profile.motto}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Milestone Create / Edit Modal */}
      {milestoneModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>{editingMilestone?.id ? 'Edit Milestone Quest' : 'Forge New Milestone Quest'}</span>
              </h3>
              <button
                onClick={() => setMilestoneModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const targetAgeVal = formData.get('targetAge');
                const targetAge = targetAgeVal !== '' && targetAgeVal !== null ? parseFloat(String(targetAgeVal)) : null;

                handleSaveMilestone({
                  id: editingMilestone?.id,
                  title: String(formData.get('title')),
                  description: String(formData.get('description')),
                  category: formData.get('category') as MilestoneCategory,
                  attribute: formData.get('attribute') as RpgAttribute,
                  targetAge,
                  targetDate: String(formData.get('targetDate') || '') || null,
                  xp: Number(formData.get('xp')) || 100,
                  isEpicBoss: formData.get('isEpicBoss') === 'on',
                  status: (formData.get('status') as any) || (targetAge === null ? 'backlog' : 'planned'),
                  notes: String(formData.get('notes') || '')
                });
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">Quest Title *</label>
                <input
                  type="text"
                  name="title"
                  defaultValue={editingMilestone?.title || ''}
                  required
                  placeholder="e.g. Build $10k/mo MRR SaaS or Run Marathon"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description & Strategy</label>
                <textarea
                  name="description"
                  defaultValue={editingMilestone?.description || ''}
                  rows={2}
                  placeholder="What does success look like? How will you conquer this?"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Age (Leave blank for Backlog)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="120"
                    name="targetAge"
                    defaultValue={editingMilestone?.targetAge !== undefined && editingMilestone?.targetAge !== null ? editingMilestone.targetAge : ''}
                    placeholder="e.g. 25, 30"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Date (Optional)</label>
                  <input
                    type="date"
                    name="targetDate"
                    defaultValue={editingMilestone?.targetDate || ''}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Life Pillar / Category</label>
                  <select
                    name="category"
                    defaultValue={editingMilestone?.category || 'career'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">RPG Stat Boost</label>
                  <select
                    name="attribute"
                    defaultValue={editingMilestone?.attribute || 'intellect'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {Object.entries(ATTRIBUTE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label} ({v.desc})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">XP Bounty Reward</label>
                  <input
                    type="number"
                    name="xp"
                    defaultValue={editingMilestone?.xp || 150}
                    step="50"
                    min="50"
                    max="1000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="pt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isEpicBoss"
                    name="isEpicBoss"
                    defaultChecked={Boolean(editingMilestone?.isEpicBoss)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="isEpicBoss" className="font-bold text-slate-800 cursor-pointer">
                    Decadal Epic Boss Trial ⚔️
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue={editingMilestone?.status || 'planned'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="planned">Planned (Upcoming Quest)</option>
                  <option value="in_progress">In Progress (Active Focus)</option>
                  <option value="achieved">Achieved (Conquered Trophy)</option>
                  <option value="backlog">Backlog (Unassigned)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMilestoneModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs cursor-pointer"
                >
                  Save Quest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Quick Assign Target Age Modal */}
      {assignAgeModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <span>Promote to Timeline</span>
              </h3>
              <button
                onClick={() => setAssignAgeModalItem(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Assign a target age to <strong>"{assignAgeModalItem.title}"</strong>:
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="120"
                  value={assignAgeInput}
                  onChange={(e) => setAssignAgeInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-sm font-bold text-center focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-xs font-bold text-slate-400">Years</span>
              </div>

              {/* Quick Age Buttons */}
              <div className="flex items-center justify-center gap-2">
                {[20, 25, 28, 30, 35, 40].map((quickAge) => (
                  <button
                    key={quickAge}
                    type="button"
                    onClick={() => setAssignAgeInput(String(quickAge))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                      assignAgeInput === String(quickAge)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {quickAge}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignAgeModalItem(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignAge}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
              >
                Assign & Promote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Gamification Level-Up / Milestone Conquered Modal */}
      {celebrationModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-linear-to-b from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl max-w-sm w-full p-6 text-center border-2 border-amber-400 shadow-2xl shadow-amber-500/20 space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-linear-to-tr from-amber-400 to-rose-500 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/50 animate-bounce">
              <Trophy className="w-8 h-8 text-white" />
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                QUEST CONQUERED!
              </div>
              <h3 className="text-lg font-black text-white">{celebrationModal.title}</h3>
            </div>

            <div className="bg-indigo-900/60 rounded-2xl p-3 border border-indigo-700/60 flex items-center justify-around">
              <div>
                <div className="text-xl font-mono font-black text-amber-300">+{celebrationModal.xp}</div>
                <div className="text-[10px] uppercase font-bold text-slate-400">XP Gained</div>
              </div>
              <div className="w-px h-8 bg-indigo-700/80" />
              <div>
                <div className="text-xl font-mono font-black text-emerald-400">+{Math.round(celebrationModal.xp / 10)}</div>
                <div className="text-[10px] uppercase font-bold text-slate-400">{celebrationModal.attribute}</div>
              </div>
            </div>

            <p className="text-xs text-indigo-200 italic">
              "Every milestone conquered turns fleeting time into permanent legendary greatness."
            </p>

            <button
              onClick={() => setCelebrationModal(null)}
              className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition shadow-md shadow-amber-400/20 cursor-pointer"
            >
              Continue My Odyssey 🚀
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
