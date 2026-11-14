import { Db } from 'mongodb';

export interface OverdueLend {
  id: string;
  personName: string;
  amount: number;
  expectedReturnDate: string;
  daysOverdue: number;
  contact?: string;
}

export interface OverdueBorrow {
  id: string;
  personName: string;
  amount: number;
  expectedReturnDate: string;
  daysOverdue: number;
  contact?: string;
}

export interface StreakPulse {
  id: string;
  title: string;
  targetTime: string;
  currentStreak: number;
  checkedInToday: boolean;
  isInDanger: boolean;
}

export interface UpcomingLifeMilestone {
  id: string;
  title: string;
  category: string;
  targetAge: number | null;
  targetDate?: string | null;
  daysRemaining: number;
  isEpicBoss?: boolean;
}

export interface SystemStateSnapshot {
  timestamp: string;
  user: {
    heroName: string;
    heroClass: string;
    currentAge: number;
    daysToNextBirthday: number;
    weeksLivedPct: number;
    weeksRemaining: number;
  };
  finance: {
    totalActiveLent: number;
    totalActiveBorrowed: number;
    overdueLends: OverdueLend[];
    overdueBorrows: OverdueBorrow[];
    thisMonthExpenseSum: number;
  };
  streaks: {
    totalStreaks: number;
    completedTodayCount: number;
    pendingTodayCount: number;
    inDangerCount: number;
    items: StreakPulse[];
  };
  lifeOdyssey: {
    totalMilestones: number;
    achievedCount: number;
    backlogCount: number;
    upcomingMilestones: UpcomingLifeMilestone[];
  };
  todos: {
    pendingCount: number;
    overdueCount: number;
    highPriority: string[];
  };
  timers: {
    activeCount: number;
  };
  workstreams: {
    activeCount: number;
    activeTitles: string[];
  };
}

export async function harvestSystemState(db: Db): Promise<SystemStateSnapshot> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentHour = now.getHours();

  // ── 1. Finance Aggregations ───────────────────────────────────────────────
  const lendsCol = db.collection('finance_lends');
  const borrowsCol = db.collection('finance_borrows');
  const expensesCol = db.collection('finance_expenses');

  let activeLends: any[] = [];
  let activeBorrows: any[] = [];
  let thisMonthExpenses: any[] = [];

  try {
    activeLends = await lendsCol.find({
      status: { $in: ['active', 'partially_returned'] },
      isRotation: false
    }).toArray();
  } catch (e) {
    // collection might not exist yet
  }

  try {
    activeBorrows = await borrowsCol.find({
      status: { $in: ['active', 'partially_repaid'] },
      isRotation: false
    }).toArray();
  } catch (e) {}

  try {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    thisMonthExpenses = await expensesCol.find({
      date: { $gte: startOfMonth },
      isRotation: false
    }).toArray();
  } catch (e) {}

  let totalActiveLent = 0;
  const overdueLends: OverdueLend[] = [];

  for (const lend of activeLends) {
    const repaymentsSum = Array.isArray(lend.repayments)
      ? lend.repayments.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)
      : 0;
    const remaining = Math.max(0, (Number(lend.amount) || 0) - repaymentsSum);
    totalActiveLent += remaining;

    if (lend.expectedReturnDate && lend.expectedReturnDate < todayStr && remaining > 0) {
      const expDate = new Date(lend.expectedReturnDate);
      const diffDays = Math.max(1, Math.floor((now.getTime() - expDate.getTime()) / (1000 * 3600 * 24)));
      overdueLends.push({
        id: lend.id || String(lend._id),
        personName: lend.personName || 'Unknown Person',
        amount: remaining,
        expectedReturnDate: lend.expectedReturnDate,
        daysOverdue: diffDays,
        contact: lend.contact
      });
    }
  }

  let totalActiveBorrowed = 0;
  const overdueBorrows: OverdueBorrow[] = [];

  for (const borrow of activeBorrows) {
    const repaymentsSum = Array.isArray(borrow.repayments)
      ? borrow.repayments.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)
      : 0;
    const remaining = Math.max(0, (Number(borrow.amount) || 0) - repaymentsSum);
    totalActiveBorrowed += remaining;

    if (borrow.expectedReturnDate && borrow.expectedReturnDate < todayStr && remaining > 0) {
      const expDate = new Date(borrow.expectedReturnDate);
      const diffDays = Math.max(1, Math.floor((now.getTime() - expDate.getTime()) / (1000 * 3600 * 24)));
      overdueBorrows.push({
        id: borrow.id || String(borrow._id),
        personName: borrow.personName || 'Unknown Person',
        amount: remaining,
        expectedReturnDate: borrow.expectedReturnDate,
        daysOverdue: diffDays,
        contact: borrow.contact
      });
    }
  }

  const thisMonthExpenseSum = thisMonthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // ── 2. Streaks Aggregations ───────────────────────────────────────────────
  const streaksCol = db.collection('streaks');
  let rawStreaks: any[] = [];
  try {
    rawStreaks = await streaksCol.find({}).toArray();
  } catch (e) {}

  const streakItems: StreakPulse[] = [];
  let completedTodayCount = 0;
  let inDangerCount = 0;

  for (const st of rawStreaks) {
    const checkIns = Array.isArray(st.checkIns) ? st.checkIns : [];
    const checkedToday = checkIns.some((c: any) => c.date === todayStr);
    if (checkedToday) completedTodayCount++;

    // In danger if not checked in and current time is past 18:00 (6 PM)
    const inDanger = !checkedToday && currentHour >= 18;
    if (inDanger) inDangerCount++;

    // Calculate current streak
    let streakCount = 0;
    const sorted = [...checkIns].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
    if (sorted.length > 0) {
      const hasToday = sorted[0].date === todayStr;
      const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      const hasYesterday = sorted.some((c: any) => c.date === yesterday);
      if (hasToday || hasYesterday) {
        streakCount = sorted.length;
      }
    }

    streakItems.push({
      id: st.id || String(st._id),
      title: st.title || 'Daily Streak',
      targetTime: st.targetTime || '20:00',
      currentStreak: streakCount,
      checkedInToday: checkedToday,
      isInDanger: inDanger
    });
  }

  // ── 3. Life Odyssey Aggregations ──────────────────────────────────────────
  const profileCol = db.collection('life_odyssey_profiles');
  const milestoneCol = db.collection('life_odyssey_milestones');

  let profile: any = null;
  let rawMilestones: any[] = [];
  try {
    profile = await profileCol.findOne({ id: 'main' });
    rawMilestones = await milestoneCol.find({}).toArray();
  } catch (e) {}

  const dob = profile?.dob ? new Date(profile.dob) : new Date('2001-01-01');
  const maxAge = Number(profile?.maxAge) || 85;
  const msInYear = 1000 * 60 * 60 * 24 * 365.2425;
  const currentAge = (now.getTime() - dob.getTime()) / msInYear;
  const totalMaxWeeks = maxAge * 52;
  const totalWeeksLived = Math.floor((now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 7));
  const weeksRemaining = Math.max(0, totalMaxWeeks - totalWeeksLived);
  const weeksLivedPct = Math.min(100, Math.max(0, (totalWeeksLived / totalMaxWeeks) * 100));

  const thisYearBirthday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
  let nextBirthday = thisYearBirthday;
  if (now > thisYearBirthday) {
    nextBirthday = new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate());
  }
  const daysToNextBirthday = Math.max(0, Math.ceil((nextBirthday.getTime() - now.getTime()) / (1000 * 3600 * 24)));

  let achievedCount = 0;
  let backlogCount = 0;
  const upcomingMilestones: UpcomingLifeMilestone[] = [];

  for (const m of rawMilestones) {
    if (m.status === 'achieved') {
      achievedCount++;
      continue;
    }
    if (m.targetAge === null || m.targetAge === undefined || m.status === 'backlog') {
      backlogCount++;
      continue;
    }

    const targetDate = m.targetDate
      ? new Date(m.targetDate)
      : new Date(dob.getTime() + Number(m.targetAge) * msInYear);

    const daysRemaining = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    upcomingMilestones.push({
      id: m.id || String(m._id),
      title: m.title || 'Milestone',
      category: m.category || 'career',
      targetAge: m.targetAge,
      targetDate: m.targetDate || null,
      daysRemaining,
      isEpicBoss: Boolean(m.isEpicBoss)
    });
  }

  // Sort upcoming milestones by closest days remaining
  upcomingMilestones.sort((a, b) => a.daysRemaining - b.daysRemaining);

  // ── 4. Todos & Timers Aggregations ────────────────────────────────────────
  const todosCol = db.collection('todos');
  const timersCol = db.collection('timers');
  let rawTodos: any[] = [];
  let rawTimers: any[] = [];
  try {
    rawTodos = await todosCol.find({ completed: { $ne: true } }).toArray();
    rawTimers = await timersCol.find({}).toArray();
  } catch (e) {}

  let overdueTodoCount = 0;
  const highPriorityTodos: string[] = [];
  for (const td of rawTodos) {
    if (td.dueDate && td.dueDate < todayStr) {
      overdueTodoCount++;
    }
    if (td.priority === 'high' || td.isPinned) {
      highPriorityTodos.push(td.title || td.text || 'High priority task');
    }
  }

  // ── 5. Workstreams Aggregations ───────────────────────────────────────────
  const workstreamsCol = db.collection('workstreams');
  let rawWorkstreams: any[] = [];
  try {
    rawWorkstreams = await workstreamsCol.find({ status: 'active' }).toArray();
  } catch (e) {}

  return {
    timestamp: now.toISOString(),
    user: {
      heroName: profile?.heroName || 'Aparichit',
      heroClass: profile?.heroClass || 'Visionary',
      currentAge: Number(currentAge.toFixed(1)),
      daysToNextBirthday,
      weeksLivedPct: Number(weeksLivedPct.toFixed(1)),
      weeksRemaining
    },
    finance: {
      totalActiveLent,
      totalActiveBorrowed,
      overdueLends: overdueLends.slice(0, 5),
      overdueBorrows: overdueBorrows.slice(0, 5),
      thisMonthExpenseSum
    },
    streaks: {
      totalStreaks: rawStreaks.length,
      completedTodayCount,
      pendingTodayCount: Math.max(0, rawStreaks.length - completedTodayCount),
      inDangerCount,
      items: streakItems.slice(0, 8)
    },
    lifeOdyssey: {
      totalMilestones: rawMilestones.length,
      achievedCount,
      backlogCount,
      upcomingMilestones: upcomingMilestones.slice(0, 5)
    },
    todos: {
      pendingCount: rawTodos.length,
      overdueCount: overdueTodoCount,
      highPriority: highPriorityTodos.slice(0, 5)
    },
    timers: {
      activeCount: rawTimers.length
    },
    workstreams: {
      activeCount: rawWorkstreams.length,
      activeTitles: rawWorkstreams.map((w: any) => w.title || 'Untitled Stream').slice(0, 5)
    }
  };
}
