import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, Plus, Calendar, ArrowUpRight, ArrowDownLeft,
  RefreshCw, Clock, AlertTriangle, Filter,
  Trash2, X, DollarSign, Layers, ChevronRight,
  TrendingDown, TrendingUp, User, Phone, Check, CreditCard,
  Users, Edit2, Tag, Bell, BellRing, Send,
  Settings, Gift, Sliders, CheckSquare, Square, Loader2, Mail, Copy, LayoutGrid, List,
  BarChart3, PieChart, LineChart, Eye, ArrowRight
} from 'lucide-react';

export interface SplitParticipant {
  personName: string;
  amount: number;
  originalAmount?: number;
  isSponsored?: boolean;
}

export interface ExpenseGroup {
  id: string;
  name: string;
  description?: string;
  members: string[]; // names of people
  defaultSplitMode?: 'equal' | 'custom';
  expenseCount?: number;
  totalSpent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSettings {
  defaultCurrency: 'NPR' | 'INR' | 'USD' | 'EUR';
  exchangeRates: {
    NPR: number;
    INR: number;
    USD: number;
    EUR: number;
    [key: string]: number;
  };
  defaultPaymentMethod: string;
  defaultCompanion: string;
  defaultExpenseGroup?: string;
  defaultCategory: string;
  defaultDateOption: 'today' | 'yesterday' | 'custom' | 'keep_last';
  customDefaultDate?: string;
  defaultSplitMode: 'none' | '50_50' | 'group' | 'custom';
  updatedAt?: string;
}

export const CURRENCIES = [
  { code: 'NPR', label: 'NPR (Nepali Rupee)', symbol: 'NPR' },
  { code: 'INR', label: 'INR (Indian Rupee ₹)', symbol: '₹' },
  { code: 'USD', label: 'USD ($ Dollar)', symbol: '$' },
  { code: 'EUR', label: 'EUR (€ Euro)', symbol: '€' }
];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  NPR: 'NPR',
  INR: '₹',
  USD: '$',
  EUR: '€'
};

const DEFAULT_SETTINGS: FinanceSettings = {
  defaultCurrency: 'NPR',
  exchangeRates: {
    NPR: 1.0,
    INR: 1.6, // Standard Nepal-India currency peg: 1 INR = 1.60 NPR
    USD: 134.5,
    EUR: 142.0
  },
  defaultPaymentMethod: 'Bank / Card',
  defaultCompanion: '',
  defaultExpenseGroup: '',
  defaultCategory: 'Food & Dining',
  defaultDateOption: 'today',
  customDefaultDate: '',
  defaultSplitMode: 'none'
};

export interface FinanceCategory {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseSet {
  id: string;
  name: string;
  category: string;
  budget?: number | null;
  currency: string;
  startDate: string;
  endDate?: string | null;
  status: 'active' | 'archived';
  notes?: string;
  totalSpent?: number;
  entryCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseItem {
  id: string;
  expenseSetId?: string | null;
  groupId?: string | null;
  amount: number;
  totalAmount?: number | null;
  currency: string;
  originalAmount?: number | null;
  exchangeRate?: number | null;
  category: string;
  description: string;
  date: string;
  time?: string;
  paymentMethod: string;
  isRotation: boolean;
  rotationNote?: string | null;
  splitPersonName?: string | null;
  splitAmount?: number | null;
  splits?: SplitParticipant[];
  paidByPersonName?: string | null;
  tags?: string[];
  receiptUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RepaymentRecord {
  id: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface LendItem {
  id: string;
  sourceExpenseId?: string | null;
  expenseSetId?: string | null;
  groupId?: string | null;
  personName: string;
  contact?: string;
  amount: number;
  currency?: string;
  originalAmount?: number;
  lentDate: string;
  expectedReturnDate: string;
  isRotation: boolean;
  status: 'active' | 'partially_returned' | 'returned' | 'forgiven';
  reminderSent?: boolean;
  reminderSentAt?: string;
  notes?: string;
  repayments: RepaymentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface BorrowItem {
  id: string;
  sourceExpenseId?: string | null;
  expenseSetId?: string | null;
  groupId?: string | null;
  personName: string;
  contact?: string;
  amount: number;
  currency?: string;
  originalAmount?: number;
  borrowedDate: string;
  expectedReturnDate: string;
  isRotation: boolean;
  status: 'active' | 'partially_repaid' | 'repaid';
  notes?: string;
  repayments: RepaymentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  isDefault?: boolean;
  notes?: string;
  netReceivable?: number;
  netPayable?: number;
  netBalance?: number;
  activeLendsCount?: number;
  activeBorrowsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BankBacklogItem {
  id: string;
  rawSms: string;
  sender: string;
  bank: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  date: string;
  account?: string;
  counterpartyAccount?: string;
  upiRef?: string;
  status: 'pending' | 'reconciled' | 'rotated_ignored';
  reconciledExpenseId?: string | null;
  reconciledLendId?: string | null;
  splitPersonName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FinanceProps {
  authToken: string | null;
}

const EXPENSE_CATEGORIES = [
  'Food & Dining', 'Transport & Fuel', 'Groceries', 'Entertainment & Outing',
  'Shopping', 'Health & Medical', 'Bills & Utilities', 'Work & Tools',
  'Education', 'Travel & Stay', 'Miscellaneous'
];

const PAYMENT_METHODS = ['Bank / Card', 'UPI', 'Cash', 'eSewa', 'Khalti', 'Other'];

export interface ParticipantItem {
  name: string;
  included: boolean;
  isSponsored: boolean;
  customAmount: string;
}

export const Finance: React.FC<FinanceProps> = ({ authToken }) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'analytics' | 'expenses' | 'sets' | 'lends' | 'borrows' | 'people' | 'categories' | 'settings'>('overview');
  const [viewCurrency, setViewCurrency] = useState<string>(() => {
    try {
      const cached = localStorage.getItem('shudkara_finance_view_currency');
      if (cached && ['NPR', 'INR', 'USD', 'EUR'].includes(cached)) return cached;
    } catch {}
    return 'NPR';
  });
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'7d' | 'month' | '30d' | '90d' | 'all'>('month');
  const [viewSetEntriesTarget, setViewSetEntriesTarget] = useState<ExpenseSet | null>(null);
  const [viewConsolidatedBreakdownTarget, setViewConsolidatedBreakdownTarget] = useState<any | null>(null);
  const [peopleViewMode, setPeopleViewMode] = useState<'people' | 'groups'>('people');
  const [peopleDisplayMode, setPeopleDisplayMode] = useState<'list' | 'grid'>('list');
  const [lendsViewMode, setLendsViewMode] = useState<'consolidated' | 'individual'>('consolidated');
  const [emailReminderTarget, setEmailReminderTarget] = useState<{
    personName: string;
    email: string;
    setName: string;
    expenseSetId?: string | null;
    totalReceivable: number;
    totalSponsored: number;
    items: Array<{ id?: string; description: string; date: string; amount: number }>;
    sponsoredItems: Array<{ description: string; date: string; amount: number }>;
    lendIds: string[];
    customMessage: string;
  } | null>(null);
  const [isSendingEmailReminder, setIsSendingEmailReminder] = useState(false);
  const [loading, setLoading] = useState(true);

  // Settings state (offline-first with cache)
  const [settings, setSettings] = useState<FinanceSettings>(() => {
    try {
      const cached = localStorage.getItem('shudkara_finance_settings');
      if (cached) return JSON.parse(cached);
    } catch {}
    return DEFAULT_SETTINGS;
  });

  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [expenseSets, setExpenseSets] = useState<ExpenseSet[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [lends, setLends] = useState<LendItem[]>([]);
  const [borrows, setBorrows] = useState<BorrowItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [backlog, setBacklog] = useState<BankBacklogItem[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);

  // Async Button Feedback States
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isSavingSet, setIsSavingSet] = useState(false);
  const [isSavingLend, setIsSavingLend] = useState(false);
  const [isSavingBorrow, setIsSavingBorrow] = useState(false);
  const [isSavingPerson, setIsSavingPerson] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isSavingRepay, setIsSavingRepay] = useState(false);
  const [isSavingReconcile, setIsSavingReconcile] = useState(false);

  // Filter states for expenses
  const [filterSetId, setFilterSetId] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [hideRotations, setHideRotations] = useState<boolean>(true);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSetModalOpen, setIsSetModalOpen] = useState(false);
  const [isLendModalOpen, setIsLendModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedPersonLedger, setSelectedPersonLedger] = useState<Person | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<BankBacklogItem | null>(null);
  const [repayTarget, setRepayTarget] = useState<{ type: 'lend' | 'borrow'; item: LendItem | BorrowItem } | null>(null);

  // Category form state
  const [categoryForm, setCategoryForm] = useState({
    id: '',
    name: '',
    color: '#6366f1'
  });

  // Group form state
  const [groupForm, setGroupForm] = useState({
    id: '',
    name: '',
    description: '',
    members: [] as string[],
    newMemberInput: ''
  });

  // Settings form state (for editing inside the settings tab)
  const [settingsForm, setSettingsForm] = useState<FinanceSettings>(DEFAULT_SETTINGS);

  // Keep settingsForm in sync with loaded settings
  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    id: '',
    amount: '',
    currency: 'NPR',
    description: '',
    category: EXPENSE_CATEGORIES[0],
    expenseSetId: '',
    groupId: '',
    paymentMethod: PAYMENT_METHODS[0],
    isRotation: false,
    rotationNote: '',
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    splitOption: 'none' as 'none' | 'split' | 'paid_by_other',
    splitPersonName: '',
    splitMode: 'equal' as '50_50' | 'equal' | 'custom' | '100_them',
    participants: [] as ParticipantItem[],
    newParticipantInput: '',
    customMyShare: '',
    customTheirShare: '',
    paidByPersonName: '',
    expectedReturnDate: ''
  });

  const [setForm, setSetForm] = useState({
    id: '',
    name: '',
    category: 'Outing / Trip',
    budget: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    notes: ''
  });

  const [lendForm, setLendForm] = useState({
    id: '',
    personName: '',
    contact: '',
    amount: '',
    currency: 'NPR',
    lentDate: new Date().toISOString().slice(0, 10),
    expectedReturnDate: '',
    isRotation: false,
    notes: ''
  });

  const [borrowForm, setBorrowForm] = useState({
    id: '',
    personName: '',
    contact: '',
    amount: '',
    currency: 'NPR',
    borrowedDate: new Date().toISOString().slice(0, 10),
    expectedReturnDate: '',
    isRotation: false,
    notes: ''
  });

  const [personForm, setPersonForm] = useState({
    id: '',
    name: '',
    contact: '',
    email: '',
    isDefault: false,
    notes: ''
  });

  const [reconcileForm, setReconcileForm] = useState({
    description: '',
    category: EXPENSE_CATEGORIES[0],
    expenseSetId: '',
    splitMode: 'none' as 'none' | '50_50' | '100_them' | 'custom',
    splitPersonName: '',
    customMyAmount: '',
    customTheirAmount: '',
    expectedReturnDate: ''
  });

  const [repayAmount, setRepayAmount] = useState('');
  const [repayNotes, setRepayNotes] = useState('');

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'X-Session-Token': authToken, 'Authorization': `Bearer ${authToken}` } : {})
  };

  // Currency conversion helpers
  const convertToBase = (amount: number, fromCurrency: string): { baseAmount: number; rate: number } => {
    const baseCurr = settings.defaultCurrency || 'NPR';
    if (!amount || isNaN(amount)) return { baseAmount: 0, rate: 1 };
    if (fromCurrency === baseCurr) return { baseAmount: amount, rate: 1 };
    const rates = settings.exchangeRates || DEFAULT_SETTINGS.exchangeRates;
    const nprPerFrom = Number(rates[fromCurrency as keyof typeof rates]) || 1;
    const nprPerBase = Number(rates[baseCurr as keyof typeof rates]) || 1;
    const rate = nprPerFrom / nprPerBase;
    const baseAmount = parseFloat((amount * rate).toFixed(2));
    return { baseAmount, rate };
  };

  const convertBaseToTarget = (amountInNPR: number, targetCurrency: string = viewCurrency): number => {
    if (!amountInNPR || isNaN(amountInNPR)) return 0;
    const rates = settings.exchangeRates || DEFAULT_SETTINGS.exchangeRates;
    const nprPerTarget = Number(rates[targetCurrency as keyof typeof rates]) || 1;
    return amountInNPR / nprPerTarget;
  };

  const formatMoney = (amountInNPR: number, targetCurrency: string = viewCurrency): string => {
    const converted = convertBaseToTarget(amountInNPR, targetCurrency);
    const symbol = getCurrencySymbol(targetCurrency);
    if (targetCurrency === 'USD' || targetCurrency === 'EUR') {
      return `${symbol} ${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${symbol} ${Math.round(converted).toLocaleString()}`;
  };

  const handleSelectViewCurrency = (curr: string) => {
    setViewCurrency(curr);
    try {
      localStorage.setItem('shudkara_finance_view_currency', curr);
    } catch {}
  };

  const getCurrencySymbol = (currency?: string) => {
    const c = currency || viewCurrency || settings.defaultCurrency || 'NPR';
    return CURRENCY_SYMBOLS[c] || c;
  };

  const fetchAllData = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const [ovRes, setsRes, expRes, lendsRes, borrowsRes, peopleRes, backlogRes, catRes, groupsRes, settingsRes] = await Promise.all([
        fetch('/api/finance/overview', { headers: authHeaders }),
        fetch('/api/finance/expense-sets', { headers: authHeaders }),
        fetch('/api/finance/expenses', { headers: authHeaders }),
        fetch('/api/finance/lends', { headers: authHeaders }),
        fetch('/api/finance/borrows', { headers: authHeaders }),
        fetch('/api/finance/people', { headers: authHeaders }),
        fetch('/api/finance/backlog?status=pending', { headers: authHeaders }),
        fetch('/api/finance/categories', { headers: authHeaders }),
        fetch('/api/finance/groups', { headers: authHeaders }),
        fetch('/api/finance/settings', { headers: authHeaders })
      ]);

      if (ovRes.ok) setOverview(await ovRes.json());
      if (setsRes.ok) setExpenseSets(await setsRes.json());
      if (expRes.ok) setExpenses(await expRes.json());
      if (lendsRes.ok) setLends(await lendsRes.json());
      if (borrowsRes.ok) setBorrows(await borrowsRes.json());
      if (peopleRes.ok) setPeople(await peopleRes.json());
      if (backlogRes.ok) setBacklog(await backlogRes.json());
      if (groupsRes.ok) setGroups(await groupsRes.json());
      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        if (sData) {
          setSettings(sData);
          try {
            localStorage.setItem('shudkara_finance_settings', JSON.stringify(sData));
          } catch {}
        }
      }
      if (catRes.ok) {
        const catData = await catRes.json();
        if (Array.isArray(catData)) {
          const seen = new Set<string>();
          const dedupedCats = catData.filter((c: any) => {
            const lower = (c.name || '').trim().toLowerCase();
            if (!lower || seen.has(lower)) return false;
            seen.add(lower);
            return true;
          });
          setCategories(dedupedCats);
        }
      }
    } catch (err) {
      console.error('Error fetching finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Notification states
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [notiBannerMsg, setNotiBannerMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
  }, [authToken]);

  // Request Notification Permission
  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('System notifications are not supported on this device/browser.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        setNotiBannerMsg('Due date notifications enabled! Checking return alerts...');
        setTimeout(() => setNotiBannerMsg(null), 3000);
        checkAndSendDueNotifications(true);
      } else {
        alert('Notification permission was not granted. Please allow notifications in your browser settings.');
      }
    } catch (err: any) {
      console.error('Notification permission error:', err);
    }
  };

  // Check & Trigger System Notifications for Overdue Return Dates
  const checkAndSendDueNotifications = (isManualTrigger = false) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const todayStr = new Date().toISOString().slice(0, 10);
    let count = 0;

    // 1. Money Lent: check if borrower's return time expired or due today
    lends.forEach(l => {
      if (l.status === 'returned' || l.status === 'forgiven') return;
      if (!l.expectedReturnDate) return;
      if (l.expectedReturnDate <= todayStr) {
        const key = `finance_noti_lend_${l.id}_${todayStr}`;
        if (isManualTrigger || !sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, 'true');
          const diffDays = Math.round((new Date(l.expectedReturnDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
          const dueMsg = diffDays < 0 ? `Overdue by ${Math.abs(diffDays)} day(s)!` : 'Due today!';
          new Notification(`⚠️ Return Overdue: ${l.personName}`, {
            body: `${l.personName} was expected to return ${formatMoney(l.amount)} on ${l.expectedReturnDate}. ${dueMsg}`,
            icon: '/favicon.ico'
          });
          count++;
        }
      }
    });

    // 2. Money Taken (Borrowed): remind user if expected return date expired or due today
    borrows.forEach(b => {
      if (b.status === 'repaid') return;
      if (!b.expectedReturnDate) return;
      if (b.expectedReturnDate <= todayStr) {
        const key = `finance_noti_borrow_${b.id}_${todayStr}`;
        if (isManualTrigger || !sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, 'true');
          const diffDays = Math.round((new Date(b.expectedReturnDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
          const dueMsg = diffDays < 0 ? `Expired ${Math.abs(diffDays)} day(s) ago!` : 'Due today!';
          new Notification(`⏰ Debt Repayment Due: ${b.personName}`, {
            body: `Reminder: You were expected to return ${formatMoney(b.amount)} to ${b.personName} on ${b.expectedReturnDate}. ${dueMsg}`,
            icon: '/favicon.ico'
          });
          count++;
        }
      }
    });

    if (isManualTrigger) {
      if (count > 0) {
        setNotiBannerMsg(`Sent ${count} return deadline alert(s) to system notification!`);
      } else {
        setNotiBannerMsg('All return deadlines are up to date! No overdue lends or borrows.');
      }
      setTimeout(() => setNotiBannerMsg(null), 4000);
    }
  };

  // Run notification check on data load
  useEffect(() => {
    if (lends.length > 0 || borrows.length > 0) {
      checkAndSendDueNotifications(false);
    }
  }, [lends, borrows]);

  // Handle Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const newName = categoryForm.name.trim();
    if (!newName) return;

    setIsSavingCategory(true);
    try {
      const res = await fetch(
        categoryForm.id ? `/api/finance/categories/${categoryForm.id}` : '/api/finance/categories',
        {
          method: categoryForm.id ? 'PUT' : 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            name: newName,
            color: categoryForm.color || '#6366f1'
          })
        }
      );
      if (res.ok) {
        setIsCategoryModalOpen(false);
        setCategoryForm({ id: '', name: '', color: '#6366f1' });
        // Make newly created category instantly selected in expense prompt
        setExpenseForm(prev => ({ ...prev, category: newName }));
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to save category');
      }
    } catch (err: any) {
      console.error('Save category error:', err);
      alert(err.message || 'Error saving category');
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Handle Delete Category
  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"? Existing expenses will preserve their text label.`)) return;
    try {
      const res = await fetch(`/api/finance/categories/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (res.ok) {
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete category');
      }
    } catch (err: any) {
      console.error('Delete category error:', err);
      alert(err.message || 'Error deleting category');
    }
  };

  // Reset Expense Form applying settings defaults and custom dates/groups
  const resetExpenseForm = (overrideSetId?: string, overrideGroupId?: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
    const initialDate = settings.defaultDateOption === 'yesterday'
      ? yesterday
      : settings.defaultDateOption === 'custom' && settings.customDefaultDate
      ? settings.customDefaultDate
      : today;

    const targetGroupId = overrideGroupId || (settings.defaultSplitMode === 'group' ? settings.defaultExpenseGroup : '') || '';
    const selectedGroup = targetGroupId ? groups.find(g => g.id === targetGroupId) : null;
    const defCompanion = settings.defaultCompanion || people.find(p => p.isDefault)?.name || (people[0]?.name || '');

    let splitOption: 'none' | 'split' | 'paid_by_other' = 'none';
    let splitMode: '50_50' | 'equal' | 'custom' | '100_them' = 'equal';
    let participants: ParticipantItem[] = [];

    if (overrideGroupId || settings.defaultSplitMode === 'group') {
      splitOption = 'split';
      splitMode = selectedGroup?.defaultSplitMode === 'custom' ? 'custom' : 'equal';
      if (selectedGroup) {
        participants = selectedGroup.members.map(m => ({
          name: m,
          included: true,
          isSponsored: false,
          customAmount: ''
        }));
      } else if (defCompanion) {
        participants = [{ name: defCompanion, included: true, isSponsored: false, customAmount: '' }];
      }
    } else if (settings.defaultSplitMode === '50_50') {
      splitOption = 'split';
      splitMode = '50_50';
      if (defCompanion) {
        participants = [{ name: defCompanion, included: true, isSponsored: false, customAmount: '' }];
      }
    }

    setExpenseForm({
      id: '',
      amount: '',
      currency: settings.defaultCurrency || 'NPR',
      description: selectedGroup ? `Outing with ${selectedGroup.name}` : '',
      category: settings.defaultCategory || effectiveCategories[0] || 'Food & Dining',
      expenseSetId: overrideSetId || '',
      groupId: selectedGroup?.id || '',
      paymentMethod: settings.defaultPaymentMethod || PAYMENT_METHODS[0],
      isRotation: false,
      rotationNote: '',
      date: initialDate,
      time: new Date().toTimeString().slice(0, 5),
      splitOption,
      splitPersonName: defCompanion,
      splitMode,
      participants,
      newParticipantInput: '',
      customMyShare: '',
      customTheirShare: '',
      paidByPersonName: '',
      expectedReturnDate: ''
    });
  };

  // Memoized sanitized people list (ensures clean profile names only, no composite or sponsored artifacts)
  const sanitizedPeople = useMemo(() => {
    return people.filter(p => {
      const raw = (p.name || '').trim();
      const lower = raw.toLowerCase();
      return raw.length > 0 &&
        !lower.includes('sponsored') &&
        !raw.includes('(') &&
        !raw.includes(')') &&
        !raw.includes('+') &&
        !raw.includes(',');
    });
  }, [people]);

  // Memoized consolidated lends grouped by person & expense set (including sponsored treats)
  const consolidatedLends = useMemo(() => {
    const map = new Map<string, {
      groupKey: string;
      personName: string;
      contact?: string;
      email?: string;
      expenseSetId?: string | null;
      setName: string;
      items: LendItem[];
      sponsoredItems: Array<{
        id: string;
        expenseId: string;
        description: string;
        amount: number;
        date: string;
      }>;
      totalAmount: number;
      totalRepaid: number;
      remaining: number;
      totalSponsored: number;
      latestDate: string;
      allComplete: boolean;
      hasReminderSent: boolean;
    }>();

    // 1. Process all lend items
    for (const item of lends) {
      const key = `${(item.personName || '').trim().toLowerCase()}___${item.expenseSetId || 'general'}`;
      const totalRepaidItem = (item.repayments || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const remainingItem = Math.max(0, item.amount - totalRepaidItem);

      const setName = item.expenseSetId
        ? (expenseSets.find(s => s.id === item.expenseSetId)?.name || 'Expense Set')
        : 'Standalone / Direct Lends';

      const personObj = people.find(p => p.name.toLowerCase() === item.personName.trim().toLowerCase());

      if (!map.has(key)) {
        map.set(key, {
          groupKey: key,
          personName: item.personName,
          contact: item.contact || personObj?.contact,
          email: personObj?.email,
          expenseSetId: item.expenseSetId,
          setName,
          items: [item],
          sponsoredItems: [],
          totalAmount: item.amount,
          totalRepaid: totalRepaidItem,
          remaining: remainingItem,
          totalSponsored: 0,
          latestDate: item.lentDate,
          allComplete: item.status === 'returned',
          hasReminderSent: Boolean(item.reminderSent)
        });
      } else {
        const grp = map.get(key)!;
        grp.items.push(item);
        grp.totalAmount += item.amount;
        grp.totalRepaid += totalRepaidItem;
        grp.remaining += remainingItem;
        if (item.lentDate > grp.latestDate) grp.latestDate = item.lentDate;
        if (item.status !== 'returned') grp.allComplete = false;
        if (item.reminderSent) grp.hasReminderSent = true;
        if (!grp.contact && (item.contact || personObj?.contact)) grp.contact = item.contact || personObj?.contact;
        if (!grp.email && personObj?.email) grp.email = personObj.email;
      }
    }

    // 2. Process all sponsored items from expenses for this expense set & person
    for (const exp of expenses) {
      if (!exp.splits || exp.splits.length === 0) continue;
      for (const sp of exp.splits) {
        if (!sp.isSponsored) continue;
        const pName = (sp.personName || '').trim();
        if (!pName) continue;
        const key = `${pName.toLowerCase()}___${exp.expenseSetId || 'general'}`;
        const setName = exp.expenseSetId
          ? (expenseSets.find(s => s.id === exp.expenseSetId)?.name || 'Expense Set')
          : 'Standalone / Direct Lends';

        const spItem = {
          id: `${exp.id}_${pName}`,
          expenseId: exp.id,
          description: exp.description || 'Sponsored treat',
          amount: sp.amount || 0,
          date: exp.date
        };

        const personObj = people.find(p => p.name.toLowerCase() === pName.toLowerCase());

        if (!map.has(key)) {
          map.set(key, {
            groupKey: key,
            personName: pName,
            contact: personObj?.contact,
            email: personObj?.email,
            expenseSetId: exp.expenseSetId,
            setName,
            items: [],
            sponsoredItems: [spItem],
            totalAmount: 0,
            totalRepaid: 0,
            remaining: 0,
            totalSponsored: spItem.amount,
            latestDate: exp.date,
            allComplete: true,
            hasReminderSent: false
          });
        } else {
          const grp = map.get(key)!;
          if (!grp.sponsoredItems) grp.sponsoredItems = [];
          grp.sponsoredItems.push(spItem);
          grp.totalSponsored = (grp.totalSponsored || 0) + spItem.amount;
          if (exp.date > grp.latestDate) grp.latestDate = exp.date;
          if (!grp.email && personObj?.email) grp.email = personObj.email;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.allComplete !== b.allComplete) return a.allComplete ? 1 : -1;
      return b.latestDate.localeCompare(a.latestDate);
    });
  }, [lends, expenseSets, expenses, people]);

  // Open Expense Wizard pre-populated with a specific Expense Group
  const openExpenseWithGroup = (group: ExpenseGroup) => {
    const today = new Date().toISOString().slice(0, 10);
    const groupParticipants = group.members.map(m => ({
      name: m,
      included: true,
      isSponsored: false,
      customAmount: ''
    }));

    setExpenseForm({
      id: '',
      amount: '',
      currency: settings.defaultCurrency || 'NPR',
      description: `Outing with ${group.name}`,
      category: settings.defaultCategory || effectiveCategories[0] || 'Food & Dining',
      expenseSetId: '',
      groupId: group.id,
      paymentMethod: settings.defaultPaymentMethod || PAYMENT_METHODS[0],
      isRotation: false,
      rotationNote: '',
      date: today,
      time: new Date().toTimeString().slice(0, 5),
      splitOption: 'split',
      splitPersonName: '',
      splitMode: group.defaultSplitMode === 'custom' ? 'custom' : 'equal',
      participants: groupParticipants,
      newParticipantInput: '',
      customMyShare: '',
      customTheirShare: '',
      paidByPersonName: '',
      expectedReturnDate: ''
    });
    setIsExpenseModalOpen(true);
  };

  // Handle Save Expense (with Multi-Currency, Multi-Participant Split, Deselection, and Sponsoring)
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const selectedCurrency = expenseForm.currency || settings.defaultCurrency || 'NPR';
    const { baseAmount: totalBaseAmount, rate: exchangeRate } = convertToBase(amountNum, selectedCurrency);

    let finalAmount = totalBaseAmount;
    let splitPersonName: string | null = null;
    let splitAmount: number | null = null;
    let paidByPersonName: string | null = null;
    let splits: SplitParticipant[] = [];

    if (expenseForm.splitOption === 'split') {
      const activeParticipants = expenseForm.participants.filter(p => p.included && p.name.trim());

      if (activeParticipants.length > 0) {
        if (expenseForm.splitMode === '50_50') {
          const first = activeParticipants[0];
          const halfOriginal = parseFloat((amountNum / 2).toFixed(2));
          const { baseAmount: halfBase } = convertToBase(halfOriginal, selectedCurrency);

          splits = [{
            personName: first.name.trim(),
            amount: halfBase,
            originalAmount: halfOriginal,
            isSponsored: Boolean(first.isSponsored)
          }];

          if (first.isSponsored) {
            finalAmount = totalBaseAmount;
            splitPersonName = first.name.trim();
            splitAmount = 0;
          } else {
            finalAmount = parseFloat((totalBaseAmount - halfBase).toFixed(2));
            splitPersonName = first.name.trim();
            splitAmount = halfBase;
          }
        } else if (expenseForm.splitMode === 'equal') {
          // Divides bill equally among (1 + count of active participants)
          const totalPeopleCount = 1 + activeParticipants.length;
          const shareOriginal = parseFloat((amountNum / totalPeopleCount).toFixed(2));
          const { baseAmount: shareBase } = convertToBase(shareOriginal, selectedCurrency);

          splits = activeParticipants.map(p => ({
            personName: p.name.trim(),
            amount: shareBase,
            originalAmount: shareOriginal,
            isSponsored: Boolean(p.isSponsored)
          }));

          const nonSponsoredSplits = splits.filter(s => !s.isSponsored);
          const totalReceivable = nonSponsoredSplits.reduce((acc, s) => acc + s.amount, 0);

          finalAmount = Math.max(0, parseFloat((totalBaseAmount - totalReceivable).toFixed(2)));

          const nonSpNames = nonSponsoredSplits.map(s => s.personName).join(', ');
          splitPersonName = (nonSpNames || activeParticipants.map(p => p.name.trim()).join(', ')).trim() || null;
          splitAmount = totalReceivable;
        } else if (expenseForm.splitMode === '100_them') {
          // Entire bill is split among participants, your personal share = 0 (unless sponsoring)
          const shareOriginal = parseFloat((amountNum / activeParticipants.length).toFixed(2));
          const { baseAmount: shareBase } = convertToBase(shareOriginal, selectedCurrency);

          splits = activeParticipants.map(p => ({
            personName: p.name.trim(),
            amount: shareBase,
            originalAmount: shareOriginal,
            isSponsored: Boolean(p.isSponsored)
          }));

          const nonSponsoredSplits = splits.filter(s => !s.isSponsored);
          const totalReceivable = nonSponsoredSplits.reduce((acc, s) => acc + s.amount, 0);
          finalAmount = Math.max(0, parseFloat((totalBaseAmount - totalReceivable).toFixed(2)));

          splitPersonName = activeParticipants.map(p => p.name.trim()).join(', ');
          splitAmount = totalReceivable;
        } else if (expenseForm.splitMode === 'custom') {
          // Custom amount specified for each friend
          splits = activeParticipants.map(p => {
            const pAmtOrig = parseFloat(p.customAmount) || 0;
            const { baseAmount: pBase } = convertToBase(pAmtOrig, selectedCurrency);
            return {
              personName: p.name.trim(),
              amount: pBase,
              originalAmount: pAmtOrig,
              isSponsored: Boolean(p.isSponsored)
            };
          });

          const nonSponsoredSplits = splits.filter(s => !s.isSponsored);
          const sponsoredSplits = splits.filter(s => s.isSponsored);
          const totalReceivable = nonSponsoredSplits.reduce((acc, s) => acc + s.amount, 0);

          if (expenseForm.customMyShare) {
            const myOrig = parseFloat(expenseForm.customMyShare) || 0;
            const { baseAmount: myBase } = convertToBase(myOrig, selectedCurrency);
            const sponsoredTotalBase = sponsoredSplits.reduce((acc, s) => acc + s.amount, 0);
            finalAmount = myBase + sponsoredTotalBase;
          } else {
            finalAmount = Math.max(0, parseFloat((totalBaseAmount - totalReceivable).toFixed(2)));
          }

          const nonSpNames = nonSponsoredSplits.map(s => s.personName).join(', ');
          splitPersonName = (nonSpNames || activeParticipants.map(p => p.name.trim()).join(', ')).trim() || null;
          splitAmount = totalReceivable;
        }
      } else if (expenseForm.splitPersonName.trim()) {
        splitPersonName = expenseForm.splitPersonName.trim();
        const halfOriginal = parseFloat((amountNum / 2).toFixed(2));
        const { baseAmount: halfBase } = convertToBase(halfOriginal, selectedCurrency);
        splitAmount = halfBase;
        finalAmount = parseFloat((totalBaseAmount - halfBase).toFixed(2));
      }
    } else if (expenseForm.splitOption === 'paid_by_other' && expenseForm.paidByPersonName.trim()) {
      paidByPersonName = expenseForm.paidByPersonName.trim();
    }

    const payload: any = {
      amount: finalAmount,
      totalAmount: totalBaseAmount,
      currency: selectedCurrency,
      originalAmount: amountNum,
      exchangeRate,
      groupId: expenseForm.groupId || null,
      description: expenseForm.description.trim() || 'Expense',
      category: expenseForm.category,
      expenseSetId: expenseForm.expenseSetId ? expenseForm.expenseSetId : null,
      paymentMethod: expenseForm.paymentMethod,
      isRotation: expenseForm.isRotation,
      rotationNote: expenseForm.rotationNote.trim() || null,
      date: expenseForm.date,
      time: expenseForm.time,
      splitPersonName,
      splitAmount,
      splits: splits.length > 0 ? splits : undefined,
      paidByPersonName,
      expectedReturnDate: expenseForm.expectedReturnDate || undefined
    };

    setIsSavingExpense(true);
    try {
      const res = await fetch(
        expenseForm.id ? `/api/finance/expenses/${expenseForm.id}` : '/api/finance/expenses',
        {
          method: expenseForm.id ? 'PUT' : 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload)
        }
      );
      if (res.ok) {
        setIsExpenseModalOpen(false);
        resetExpenseForm();
        fetchAllData();
      }
    } catch (err) {
      console.error('Save expense error:', err);
    } finally {
      setIsSavingExpense(false);
    }
  };

  // Handle Save Expense Group
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim()) return;

    const payload = {
      name: groupForm.name.trim(),
      description: groupForm.description.trim(),
      members: groupForm.members
    };

    setIsSavingGroup(true);
    try {
      const res = await fetch(
        groupForm.id ? `/api/finance/groups/${groupForm.id}` : '/api/finance/groups',
        {
          method: groupForm.id ? 'PUT' : 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload)
        }
      );
      if (res.ok) {
        setIsGroupModalOpen(false);
        setGroupForm({ id: '', name: '', description: '', members: [], newMemberInput: '' });
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to save group');
      }
    } catch (err: any) {
      console.error('Save group error:', err);
      alert(err.message || 'Error saving group');
    } finally {
      setIsSavingGroup(false);
    }
  };

  // Handle Delete Expense Group
  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete expense group "${name}"? Past expenses will remain intact.`)) return;
    try {
      const res = await fetch(`/api/finance/groups/${id}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok) fetchAllData();
    } catch (err) {
      console.error('Delete group error:', err);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      setSettings(settingsForm);
      try {
        localStorage.setItem('shudkara_finance_settings', JSON.stringify(settingsForm));
      } catch {}

      const res = await fetch('/api/finance/settings', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(settingsForm)
      });
      if (res.ok) {
        const saved = await res.json();
        setSettings(saved);
        setSettingsForm(saved);
        try {
          localStorage.setItem('shudkara_finance_settings', JSON.stringify(saved));
        } catch {}
        setSettingsSavedSuccess(true);
        setTimeout(() => setSettingsSavedSuccess(false), 3000);
        setNotiBannerMsg('Finance default variables & currency exchange rates saved successfully!');
        setTimeout(() => setNotiBannerMsg(null), 3500);
      } else {
        alert('Failed to save settings to server.');
      }
    } catch (err) {
      console.error('Save settings error:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle Save Person
  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personForm.name.trim()) return;

    setIsSavingPerson(true);
    try {
      const res = await fetch(
        personForm.id ? `/api/finance/people/${personForm.id}` : '/api/finance/people',
        {
          method: personForm.id ? 'PUT' : 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            name: personForm.name.trim(),
            contact: personForm.contact.trim(),
            email: personForm.email.trim(),
            isDefault: personForm.isDefault,
            notes: personForm.notes.trim()
          })
        }
      );
      if (res.ok) {
        setIsPersonModalOpen(false);
        setPersonForm({ id: '', name: '', contact: '', email: '', isDefault: false, notes: '' });
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to save person');
      }
    } catch (err: any) {
      console.error('Save person error:', err);
      alert(err.message || 'Error saving person');
    } finally {
      setIsSavingPerson(false);
    }
  };

  // Handle Delete Person
  const handleDeletePerson = async (id: string, name: string) => {
    if (!confirm(`Delete ${name} from your people & ledgers directory?`)) return;
    try {
      const res = await fetch(`/api/finance/people/${id}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok) fetchAllData();
    } catch (err) {
      console.error('Delete person error:', err);
    }
  };

  // Handle Settle Person Balance
  const handleSettlePerson = async (person: Person) => {
    const balance = person.netBalance || 0;
    const msg = balance > 0
      ? `Mark ${person.name}'s balance of ${formatMoney(balance)} as fully settled / received?`
      : balance < 0
      ? `Mark your debt of ${formatMoney(Math.abs(balance))} to ${person.name} as fully paid / settled?`
      : `Mark all open records for ${person.name} as settled?`;

    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/finance/people/${person.id}/settle`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          notes: 'Settled via Web App'
        })
      });
      if (res.ok) fetchAllData();
    } catch (err) {
      console.error('Settle person error:', err);
    }
  };

  // Handle Reconcile Backlog Item (Log / Split)
  const handleReconcileBacklog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcileTarget) return;

    let myAmount = reconcileTarget.amount;
    let theirAmount = 0;
    let splitPersonName = reconcileForm.splitPersonName.trim() || undefined;

    if (reconcileForm.splitMode === '50_50') {
      theirAmount = parseFloat((reconcileTarget.amount / 2).toFixed(2));
      myAmount = parseFloat((reconcileTarget.amount - theirAmount).toFixed(2));
    } else if (reconcileForm.splitMode === '100_them') {
      theirAmount = reconcileTarget.amount;
      myAmount = 0;
    } else if (reconcileForm.splitMode === 'custom') {
      theirAmount = parseFloat(reconcileForm.customTheirAmount) || 0;
      myAmount = Math.max(0, parseFloat((reconcileTarget.amount - theirAmount).toFixed(2)));
    }

    setIsSavingReconcile(true);
    try {
      const res = await fetch(`/api/finance/backlog/${reconcileTarget.id}/reconcile`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          myAmount,
          theirAmount,
          splitPersonName,
          category: reconcileForm.category,
          description: reconcileForm.description.trim() || `${reconcileTarget.bank} Transaction`,
          expenseSetId: reconcileForm.expenseSetId ? reconcileForm.expenseSetId : null,
          expectedReturnDate: reconcileForm.expectedReturnDate || undefined
        })
      });
      if (res.ok) {
        setReconcileTarget(null);
        fetchAllData();
      }
    } catch (err) {
      console.error('Reconcile backlog error:', err);
    } finally {
      setIsSavingReconcile(false);
    }
  };

  // Handle Ignore Backlog Item (Mark Rotated)
  const handleIgnoreBacklog = async (id: string) => {
    // Optimistic UI update
    setBacklog(prev => prev.filter(b => b.id !== id));
    try {
      const res = await fetch(`/api/finance/backlog/${id}/ignore`, {
        method: 'POST',
        headers: authHeaders
      });
      if (res.ok) {
        if (reconcileTarget?.id === id) setReconcileTarget(null);
        fetchAllData();
      }
    } catch (err) {
      console.error('Ignore backlog error:', err);
    }
  };

  // Handle Delete Backlog Item
  const handleDeleteBacklog = async (id: string) => {
    if (!confirm('Remove this SMS transaction from your backlog?')) return;
    setBacklog(prev => prev.filter(b => b.id !== id));
    try {
      const res = await fetch(`/api/finance/backlog/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (res.ok) {
        if (reconcileTarget?.id === id) setReconcileTarget(null);
        fetchAllData();
      }
    } catch (err) {
      console.error('Delete backlog error:', err);
    }
  };

  // Handle Delete Expense
  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense? Any linked lending/split records will also be removed.')) return;
    try {
      const res = await fetch(`/api/finance/expenses/${id}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok) fetchAllData();
    } catch (err) {
      console.error('Delete expense error:', err);
    }
  };

  // Handle Edit Expense
  const handleEditExpense = (item: ExpenseItem) => {
    const hasSplits = item.splits && item.splits.length > 0;
    let splitOption: 'none' | 'split' | 'paid_by_other' = 'none';
    let splitMode: '50_50' | 'equal' | 'custom' | '100_them' = 'equal';
    let participants: ParticipantItem[] = [];

    if (item.paidByPersonName) {
      splitOption = 'paid_by_other';
    } else if (hasSplits || item.splitPersonName) {
      splitOption = 'split';
      if (hasSplits) {
        participants = item.splits!.map(s => ({
          name: s.personName,
          included: true,
          isSponsored: Boolean(s.isSponsored),
          customAmount: s.originalAmount !== undefined ? String(s.originalAmount) : String(s.amount)
        }));
        if (participants.length === 1 && !participants[0].customAmount) {
          splitMode = '50_50';
        } else if (participants.some(p => p.customAmount && parseFloat(p.customAmount) > 0)) {
          splitMode = 'custom';
        } else {
          splitMode = 'equal';
        }
      } else if (item.splitPersonName) {
        participants = [{
          name: item.splitPersonName,
          included: true,
          isSponsored: false,
          customAmount: item.splitAmount ? String(item.splitAmount) : ''
        }];
        splitMode = '50_50';
      }
    }

    const linkedLend = lends.find(l => l.sourceExpenseId === item.id);
    const expectedReturnDate = linkedLend?.expectedReturnDate || '';

    const displayAmount = item.originalAmount !== null && item.originalAmount !== undefined
      ? String(item.originalAmount)
      : (item.totalAmount !== null && item.totalAmount !== undefined ? String(item.totalAmount) : String(item.amount));

    setExpenseForm({
      id: item.id,
      amount: displayAmount,
      currency: item.currency || settings.defaultCurrency || 'NPR',
      description: item.description,
      category: item.category,
      expenseSetId: item.expenseSetId || '',
      groupId: item.groupId || '',
      paymentMethod: item.paymentMethod || PAYMENT_METHODS[0],
      isRotation: Boolean(item.isRotation),
      rotationNote: item.rotationNote || '',
      date: item.date,
      time: item.time || '',
      splitOption,
      splitPersonName: item.splitPersonName || '',
      splitMode,
      participants,
      newParticipantInput: '',
      customMyShare: '',
      customTheirShare: '',
      paidByPersonName: item.paidByPersonName || '',
      expectedReturnDate
    });
    setIsExpenseModalOpen(true);
  };

  // Handle Edit Expense Set
  const handleEditSet = (set: ExpenseSet) => {
    setSetForm({
      id: set.id,
      name: set.name,
      category: set.category,
      budget: set.budget !== null && set.budget !== undefined ? String(set.budget) : '',
      startDate: set.startDate,
      endDate: set.endDate || '',
      notes: set.notes || ''
    });
    setIsSetModalOpen(true);
  };

  // Handle Edit Lend Record
  const handleEditLend = (item: LendItem) => {
    setLendForm({
      id: item.id,
      personName: item.personName,
      contact: item.contact || '',
      amount: String(item.originalAmount !== null && item.originalAmount !== undefined ? item.originalAmount : item.amount),
      currency: item.currency || settings.defaultCurrency || 'NPR',
      lentDate: item.lentDate,
      expectedReturnDate: item.expectedReturnDate || '',
      isRotation: Boolean(item.isRotation),
      notes: item.notes || ''
    });
    setIsLendModalOpen(true);
  };

  // Handle Edit Borrow Record
  const handleEditBorrow = (item: BorrowItem) => {
    setBorrowForm({
      id: item.id,
      personName: item.personName,
      contact: item.contact || '',
      amount: String(item.originalAmount !== null && item.originalAmount !== undefined ? item.originalAmount : item.amount),
      currency: item.currency || settings.defaultCurrency || 'NPR',
      borrowedDate: item.borrowedDate,
      expectedReturnDate: item.expectedReturnDate || '',
      isRotation: Boolean(item.isRotation),
      notes: item.notes || ''
    });
    setIsBorrowModalOpen(true);
  };

  // Handle Save Expense Set
  const handleSaveSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setForm.name.trim()) return;

    const payload = {
      name: setForm.name.trim(),
      category: setForm.category,
      budget: setForm.budget ? parseFloat(setForm.budget) : null,
      startDate: setForm.startDate,
      endDate: setForm.endDate || null,
      notes: setForm.notes.trim()
    };

    setIsSavingSet(true);
    try {
      const res = await fetch(
        setForm.id ? `/api/finance/expense-sets/${setForm.id}` : '/api/finance/expense-sets',
        {
          method: setForm.id ? 'PUT' : 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload)
        }
      );
      if (res.ok) {
        setIsSetModalOpen(false);
        setSetForm({ id: '', name: '', category: 'Outing / Trip', budget: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', notes: '' });
        fetchAllData();
      }
    } catch (err) {
      console.error('Save set error:', err);
    } finally {
      setIsSavingSet(false);
    }
  };

  // Handle Delete Expense Set
  const handleDeleteSet = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Expense Set? Attached expenses will remain as standalone.')) return;
    try {
      const res = await fetch(`/api/finance/expense-sets/${id}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok) fetchAllData();
    } catch (err) {
      console.error('Delete set error:', err);
    }
  };

  // Handle Save Lend
  const handleSaveLend = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(lendForm.amount);
    if (!lendForm.personName.trim() || isNaN(amountNum) || amountNum <= 0) return;

    const curr = lendForm.currency || settings.defaultCurrency || 'NPR';
    const { baseAmount } = convertToBase(amountNum, curr);

    // Contact is automatically retrieved from Person / User management
    const personRecord = people.find(p => p.name.toLowerCase() === lendForm.personName.trim().toLowerCase());
    const payload = {
      personName: lendForm.personName.trim(),
      contact: personRecord?.contact || '',
      amount: baseAmount,
      currency: curr,
      originalAmount: amountNum,
      lentDate: lendForm.lentDate,
      expectedReturnDate: lendForm.expectedReturnDate,
      isRotation: lendForm.isRotation,
      notes: lendForm.notes.trim()
    };

    setIsSavingLend(true);
    try {
      const endpoint = lendForm.id ? `/api/finance/lends/${lendForm.id}` : '/api/finance/lends';
      const method = lendForm.id ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsLendModalOpen(false);
        setLendForm({ id: '', personName: '', contact: '', amount: '', currency: settings.defaultCurrency || 'NPR', lentDate: new Date().toISOString().slice(0, 10), expectedReturnDate: '', isRotation: false, notes: '' });
        fetchAllData();
      }
    } catch (err) {
      console.error('Save lend error:', err);
    } finally {
      setIsSavingLend(false);
    }
  };

  // Handle Save Borrow
  const handleSaveBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(borrowForm.amount);
    if (!borrowForm.personName.trim() || isNaN(amountNum) || amountNum <= 0) return;

    const curr = borrowForm.currency || settings.defaultCurrency || 'NPR';
    const { baseAmount } = convertToBase(amountNum, curr);

    // Contact is automatically retrieved from Person / User management
    const personRecord = people.find(p => p.name.toLowerCase() === borrowForm.personName.trim().toLowerCase());
    const payload = {
      personName: borrowForm.personName.trim(),
      contact: personRecord?.contact || '',
      amount: baseAmount,
      currency: curr,
      originalAmount: amountNum,
      borrowedDate: borrowForm.borrowedDate,
      expectedReturnDate: borrowForm.expectedReturnDate,
      isRotation: borrowForm.isRotation,
      notes: borrowForm.notes.trim()
    };

    setIsSavingBorrow(true);
    try {
      const endpoint = borrowForm.id ? `/api/finance/borrows/${borrowForm.id}` : '/api/finance/borrows';
      const method = borrowForm.id ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsBorrowModalOpen(false);
        setBorrowForm({ id: '', personName: '', contact: '', amount: '', currency: settings.defaultCurrency || 'NPR', borrowedDate: new Date().toISOString().slice(0, 10), expectedReturnDate: '', isRotation: false, notes: '' });
        fetchAllData();
      }
    } catch (err) {
      console.error('Save borrow error:', err);
    } finally {
      setIsSavingBorrow(false);
    }
  };

  // Toggle Reminder Status on Lend Item (with Check Mark)
  const handleToggleReminder = async (lend: LendItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStatus = !lend.reminderSent;
    setLends(prev => prev.map(l => l.id === lend.id ? { ...l, reminderSent: newStatus, reminderSentAt: newStatus ? new Date().toISOString() : undefined } : l));
    try {
      const res = await fetch(`/api/finance/lends/${lend.id}/remind`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ reminderSent: newStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setLends(prev => prev.map(l => l.id === lend.id ? updated : l));
      }
    } catch (err) {
      console.error('Toggle reminder error:', err);
    }
  };

  // Open Reminder / Settlement Modal for an individual lend
  const handleOpenIndividualReminder = (item: LendItem) => {
    const person = people.find(p => p.name.toLowerCase() === item.personName.toLowerCase());
    const repaid = (item.repayments || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const remaining = Math.max(0, item.amount - repaid);

    // Find any sponsored items for this person under the same expense set (if any)
    const matchingSponsored = item.expenseSetId
      ? expenses.flatMap(e => {
          if (e.expenseSetId !== item.expenseSetId || !e.splits) return [];
          return e.splits
            .filter(s => (s.personName || '').toLowerCase() === item.personName.toLowerCase() && s.isSponsored)
            .map(s => ({ description: e.description || 'Sponsored treat', date: e.date, amount: s.amount }));
        })
      : [];

    const setName = item.expenseSetId
      ? (expenseSets.find(s => s.id === item.expenseSetId)?.name || 'Expense Set')
      : 'Direct Lend';

    setEmailReminderTarget({
      personName: item.personName,
      email: person?.email || '',
      setName,
      expenseSetId: item.expenseSetId,
      totalReceivable: remaining,
      totalSponsored: matchingSponsored.reduce((s, it) => s + it.amount, 0),
      items: [{ id: item.id, description: item.notes || `Lend on ${item.lentDate}`, date: item.lentDate, amount: remaining }],
      sponsoredItems: matchingSponsored,
      lendIds: [item.id],
      customMessage: ''
    });
  };

  // Open Reminder / Settlement Modal for a consolidated expense set & person
  const handleOpenConsolidatedReminder = (grp: typeof consolidatedLends[0]) => {
    const person = people.find(p => p.name.toLowerCase() === grp.personName.toLowerCase());
    const items = grp.items.map(it => {
      const repaid = (it.repayments || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
      return {
        id: it.id,
        description: it.notes || `Lend on ${it.lentDate}`,
        date: it.lentDate,
        amount: Math.max(0, it.amount - repaid)
      };
    });
    const sponsoredItems = (grp.sponsoredItems || []).map(sp => ({
      description: sp.description,
      date: sp.date,
      amount: sp.amount
    }));

    setEmailReminderTarget({
      personName: grp.personName,
      email: person?.email || grp.email || '',
      setName: grp.setName,
      expenseSetId: grp.expenseSetId,
      totalReceivable: grp.remaining,
      totalSponsored: grp.totalSponsored || 0,
      items,
      sponsoredItems,
      lendIds: grp.items.map(it => it.id),
      customMessage: ''
    });
  };

  // Open Reminder / Settlement Modal directly for a Person profile
  const handleOpenPersonReminder = (p: Person) => {
    const norm = p.name.toLowerCase();
    const pLends = lends.filter(l => (l.personName || '').toLowerCase() === norm && l.status !== 'returned');
    const items = pLends.map(it => {
      const repaid = (it.repayments || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
      return {
        id: it.id,
        description: it.notes || `Lend on ${it.lentDate}`,
        date: it.lentDate,
        amount: Math.max(0, it.amount - repaid)
      };
    });

    const matchingSponsored = expenses.flatMap(e => {
      if (!e.splits) return [];
      return e.splits
        .filter(s => (s.personName || '').toLowerCase() === norm && s.isSponsored)
        .map(s => ({ description: e.description || 'Sponsored treat', date: e.date, amount: s.amount }));
    });

    const totalReceivable = items.reduce((s, it) => s + it.amount, 0);
    const totalSponsored = matchingSponsored.reduce((s, it) => s + it.amount, 0);

    setEmailReminderTarget({
      personName: p.name,
      email: p.email || '',
      setName: 'Personal Account Balance',
      expenseSetId: null,
      totalReceivable,
      totalSponsored,
      items,
      sponsoredItems: matchingSponsored,
      lendIds: pLends.map(l => l.id),
      customMessage: ''
    });
  };

  // Send Settlement Email
  const handleSendEmailReminder = async () => {
    if (!emailReminderTarget) return;
    if (!emailReminderTarget.email || !emailReminderTarget.email.includes('@')) {
      alert('Please enter a valid recipient email address.');
      return;
    }

    setIsSendingEmailReminder(true);
    try {
      const res = await fetch('/api/finance/send-reminder-email', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          personName: emailReminderTarget.personName,
          email: emailReminderTarget.email.trim(),
          setName: emailReminderTarget.setName,
          expenseSetId: emailReminderTarget.expenseSetId,
          totalReceivable: emailReminderTarget.totalReceivable,
          totalSponsored: emailReminderTarget.totalSponsored,
          items: emailReminderTarget.items,
          sponsoredItems: emailReminderTarget.sponsoredItems,
          lendIds: emailReminderTarget.lendIds,
          customMessage: emailReminderTarget.customMessage
        })
      });

      if (res.ok) {
        setNotiBannerMsg(`Settlement reminder email successfully sent to ${emailReminderTarget.email}!`);
        setTimeout(() => setNotiBannerMsg(null), 4000);
        setEmailReminderTarget(null);
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to send reminder email');
      }
    } catch (err: any) {
      console.error('Error sending reminder email:', err);
      alert(err.message || 'Error sending reminder email');
    } finally {
      setIsSendingEmailReminder(false);
    }
  };

  // Generate readable settlement text for WhatsApp or clipboard
  const generateReminderText = (target: typeof emailReminderTarget) => {
    if (!target) return '';
    let txt = `Hi ${target.personName},\nHere is our shared expense summary for ${target.setName || 'our recent outing'}:\n\n`;
    if (target.totalReceivable > 0) {
      txt += `💰 Remaining to settle: ${formatMoney(target.totalReceivable)}\n`;
      if (target.items.length > 0) {
        target.items.forEach(it => {
          txt += `  • ${it.date}: ${it.description} - ${formatMoney(it.amount)}\n`;
        });
      }
    } else {
      txt += `✅ Shared balance is all settled!\n`;
    }
    if (target.totalSponsored > 0) {
      txt += `\n🎁 Sponsored / Treated by Shudarsan (No repayment required):\n`;
      target.sponsoredItems.forEach(sp => {
        txt += `  • ${sp.date}: ${sp.description} - ${formatMoney(sp.amount)}\n`;
      });
      txt += `  Total Sponsored: ${formatMoney(target.totalSponsored)}\n`;
    }
    txt += `\nThank you!`;
    return txt;
  };

  // Send Reminder Prompt (WhatsApp / SMS / Clipboard + Auto-check mark)
  const handleSendReminderPrompt = async (lend: LendItem) => {
    handleOpenIndividualReminder(lend);
  };

  // Handle Record Repayment
  const handleRecordRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayTarget) return;
    const amountNum = parseFloat(repayAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const endpoint = repayTarget.type === 'lend'
      ? `/api/finance/lends/${repayTarget.item.id}/repay`
      : `/api/finance/borrows/${repayTarget.item.id}/repay`;

    setIsSavingRepay(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          amount: amountNum,
          date: new Date().toISOString().slice(0, 10),
          notes: repayNotes.trim()
        })
      });
      if (res.ok) {
        setRepayTarget(null);
        setRepayAmount('');
        setRepayNotes('');
        fetchAllData();
      }
    } catch (err) {
      console.error('Record repayment error:', err);
    } finally {
      setIsSavingRepay(false);
    }
  };

  // Handle Delete Lend Entry
  const handleDeleteLend = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lend entry?')) return;
    try {
      const res = await fetch(`/api/finance/lends/${id}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok) fetchAllData();
    } catch (err) {
      console.error('Delete lend error:', err);
    }
  };

  // Handle Delete Borrow Entry
  const handleDeleteBorrow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this borrow entry?')) return;
    try {
      const res = await fetch(`/api/finance/borrows/${id}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok) fetchAllData();
    } catch (err) {
      console.error('Delete borrow error:', err);
    }
  };

  // Effective categories list (strictly deduplicated case-insensitively)
  const effectiveCategories = useMemo(() => {
    const sourceList = categories.length > 0 ? categories.map(c => c.name) : EXPENSE_CATEGORIES;
    const seen = new Set<string>();
    const result: string[] = [];
    for (const c of sourceList) {
      const trimmed = (c || '').trim();
      const lower = trimmed.toLowerCase();
      if (trimmed && !seen.has(lower)) {
        seen.add(lower);
        result.push(trimmed);
      }
    }
    return result.length > 0 ? result : EXPENSE_CATEGORIES;
  }, [categories]);

  // Filtered expenses
  const filteredExpenses = expenses.filter(e => {
    if (hideRotations && e.isRotation) return false;
    if (filterSetId === 'standalone' && e.expenseSetId) return false;
    if (filterSetId !== 'all' && filterSetId !== 'standalone' && e.expenseSetId !== filterSetId) return false;
    if (filterCategory !== 'all' && e.category !== filterCategory) return false;
    return true;
  });

  const getDaysRemainingBadge = (dueDateStr: string) => {
    if (!dueDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
          <AlertTriangle className="w-3 h-3" />
          Overdue by {Math.abs(diffDays)}d
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
          <Clock className="w-3 h-3" />
          Due Today
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
          <Calendar className="w-3 h-3" />
          Due in {diffDays}d
        </span>
      );
    }
  };

  const getFilteredAnalyticsData = () => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentMonthStr = todayStr.slice(0, 7);

    let dateLimit = '';
    if (analyticsTimeframe === '7d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      dateLimit = d.toISOString().slice(0, 10);
    } else if (analyticsTimeframe === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      dateLimit = d.toISOString().slice(0, 10);
    } else if (analyticsTimeframe === '90d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      dateLimit = d.toISOString().slice(0, 10);
    }

    const timeframeExpenses = expenses.filter(e => {
      if (analyticsTimeframe === 'month') {
        return (e.date || '').startsWith(currentMonthStr);
      }
      if (analyticsTimeframe === 'all') return true;
      return (e.date || '') >= dateLimit;
    });

    const netExpenses = timeframeExpenses.filter(e => !e.isRotation);
    const totalNetSpendBase = netExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const totalRotationsBase = timeframeExpenses.filter(e => e.isRotation).reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const daysCount = analyticsTimeframe === '7d' ? 7 : analyticsTimeframe === '30d' ? 30 : analyticsTimeframe === '90d' ? 90 : analyticsTimeframe === 'month' ? now.getDate() : Math.max(1, Math.ceil((now.getTime() - new Date(expenses[expenses.length - 1]?.date || now).getTime()) / (1000 * 3600 * 24)));
    const dailyAverageBase = totalNetSpendBase / Math.max(1, daysCount);

    const peakExpense = netExpenses.reduce((max, e) => (Number(e.amount) > Number(max?.amount || 0) ? e : max), null as ExpenseItem | null);

    let totalSponsoredBase = 0;
    netExpenses.forEach(e => {
      if (e.splits && e.splits.length > 0) {
        e.splits.filter(s => s.isSponsored).forEach(s => {
          totalSponsoredBase += (Number(s.amount) || 0);
        });
      }
    });

    const categoryMap: Record<string, { count: number; totalBase: number; color?: string }> = {};
    const defaultColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#f43f5e', '#64748b'];
    netExpenses.forEach(e => {
      const cat = e.category || 'Miscellaneous';
      if (!categoryMap[cat]) {
        const foundCat = categories.find(c => c.name.toLowerCase() === cat.toLowerCase());
        const colorIdx = Object.keys(categoryMap).length % defaultColors.length;
        categoryMap[cat] = { count: 0, totalBase: 0, color: foundCat?.color || defaultColors[colorIdx] };
      }
      categoryMap[cat].count += 1;
      categoryMap[cat].totalBase += (Number(e.amount) || 0);
    });
    const categoryBreakdown = Object.entries(categoryMap)
      .map(([name, data]) => ({ name, ...data, percentage: totalNetSpendBase > 0 ? (data.totalBase / totalNetSpendBase) * 100 : 0 }))
      .sort((a, b) => b.totalBase - a.totalBase);

    const paymentMap: Record<string, number> = {};
    netExpenses.forEach(e => {
      const m = e.paymentMethod || 'Other';
      paymentMap[m] = (paymentMap[m] || 0) + (Number(e.amount) || 0);
    });
    const paymentBreakdown = Object.entries(paymentMap)
      .map(([method, totalBase]) => ({ method, totalBase, percentage: totalNetSpendBase > 0 ? (totalBase / totalNetSpendBase) * 100 : 0 }))
      .sort((a, b) => b.totalBase - a.totalBase);

    const daysToShow = analyticsTimeframe === '7d' ? 7 : analyticsTimeframe === 'month' ? Math.min(31, now.getDate()) : 14;
    const dailyPoints: Array<{ date: string; label: string; amountBase: number }> = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const dayTotal = netExpenses.filter(e => e.date === dStr).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      dailyPoints.push({
        date: dStr,
        label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
        amountBase: dayTotal
      });
    }

    const setComparison = expenseSets.map(s => {
      const setExp = expenses.filter(e => e.expenseSetId === s.id);
      const spentBase = setExp.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const budgetBase = Number(s.budget) || 0;
      return {
        id: s.id,
        name: s.name,
        category: s.category,
        spentBase,
        budgetBase,
        entriesCount: setExp.length
      };
    }).filter(s => s.spentBase > 0 || s.budgetBase > 0).sort((a, b) => b.spentBase - a.spentBase);

    const companionMap: Record<string, { splitBase: number; sponsoredBase: number; outingCount: number }> = {};
    expenses.forEach(e => {
      if (e.splits && e.splits.length > 0) {
        e.splits.forEach(sp => {
          const pName = sp.personName || (sp as any).name;
          if (!pName) return;
          if (!companionMap[pName]) {
            companionMap[pName] = { splitBase: 0, sponsoredBase: 0, outingCount: 0 };
          }
          companionMap[pName].outingCount += 1;
          if (sp.isSponsored) {
            companionMap[pName].sponsoredBase += (Number(sp.amount) || 0);
          } else {
            companionMap[pName].splitBase += (Number(sp.amount) || 0);
          }
        });
      }
    });
    const companionMatrix = Object.entries(companionMap)
      .map(([name, data]) => ({ name, ...data, totalOutingBase: data.splitBase + data.sponsoredBase }))
      .sort((a, b) => b.totalOutingBase - a.totalOutingBase);

    return {
      netExpenses,
      totalNetSpendBase,
      totalRotationsBase,
      dailyAverageBase,
      peakExpense,
      totalSponsoredBase,
      categoryBreakdown,
      paymentBreakdown,
      dailyPoints,
      setComparison,
      companionMatrix
    };
  };

  const navTabs = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'analytics', label: 'Analytics & Insights', icon: BarChart3, badge: 'New' },
    { key: 'expenses', label: 'Expenses', icon: CreditCard, count: expenses.length },
    { key: 'sets', label: 'Expense Sets', icon: Layers, count: expenseSets.length },
    { key: 'lends', label: 'Lends (Money Given)', icon: ArrowUpRight, count: lends.filter(l => l.status !== 'returned').length },
    { key: 'borrows', label: 'Borrows (Money Taken)', icon: ArrowDownLeft, count: borrows.filter(b => b.status !== 'repaid').length },
    { key: 'people', label: 'People & Groups', icon: Users, count: sanitizedPeople.length },
    { key: 'categories', label: 'Categories', icon: Tag, count: categories.length },
    { key: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
              <Wallet className="w-5 h-5" />
            </span>
            Finance & Cashflow
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Expense sets, daily spending, lend/borrow ledger, rotations, and auto-SMS companion tracking
          </p>
        </div>

        {/* Right side: Currency Selector + Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Viewing Currency Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            {[
              { code: 'NPR', label: 'NPR' },
              { code: 'INR', label: '₹ INR' },
              { code: 'USD', label: '$ USD' },
              { code: 'EUR', label: '€ EUR' }
            ].map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => handleSelectViewCurrency(c.code)}
                className={`px-2.5 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                  viewCurrency === c.code
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              resetExpenseForm();
              setIsExpenseModalOpen(true);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/10 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>

          <button
            onClick={() => {
              setPersonForm({ id: '', name: '', contact: '', email: '', isDefault: false, notes: '' });
              setIsPersonModalOpen(true);
            }}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <User className="w-4 h-4" />
            + Person
          </button>

          <button
            onClick={() => {
              setGroupForm({ id: '', name: '', description: '', members: [], newMemberInput: '' });
              setIsGroupModalOpen(true);
            }}
            className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Users className="w-4 h-4" />
            + Group
          </button>

          <button
            onClick={() => {
              setCategoryForm({ id: '', name: '', color: '#6366f1' });
              setIsCategoryModalOpen(true);
            }}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Tag className="w-4 h-4" />
            + Category
          </button>

          <button
            onClick={() => {
              setSetForm({ id: '', name: '', category: 'Outing / Trip', budget: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', notes: '' });
              setIsSetModalOpen(true);
            }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            New Expense Set
          </button>

          {/* Notification Alerts Status / Trigger */}
          {notificationPermission !== 'granted' ? (
            <button
              onClick={requestNotificationPermission}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              title="Enable notifications for overdue returns and borrow deadlines"
            >
              <Bell className="w-4 h-4" />
              Enable Due Alerts
            </button>
          ) : (
            <button
              onClick={() => checkAndSendDueNotifications(true)}
              className="p-2 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition cursor-pointer"
              title="System Notifications Active: Click to check & send overdue alerts now"
            >
              <BellRing className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={fetchAllData}
            title="Refresh Data"
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Toast / Notification Banner */}
      {notiBannerMsg && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs font-semibold text-indigo-900 flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-indigo-600 shrink-0" />
            {notiBannerMsg}
          </span>
          <button onClick={() => setNotiBannerMsg(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-200 pb-2">
        {navTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  isActive ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              )}
              {tab.badge && !isActive && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. OVERVIEW TAB */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Spent this Month */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Month Spending</span>
                <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                  <TrendingDown className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {formatMoney(overview?.totalSpentThisMonth || 0)}
              </div>
              <div className="text-[11px] text-slate-500">
                Excludes dummy rotation transfers
              </div>
            </div>

            {/* Active Lends (Owed to you) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Lends (To Receive)</span>
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-600">
                {formatMoney(overview?.totalLentBalance || 0)}
              </div>
              <div className="text-[11px] text-slate-500">
                {lends.filter(l => l.status !== 'returned').length} pending return
              </div>
            </div>

            {/* Active Borrows (You owe) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Borrows (To Pay Back)</span>
                <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                  <ArrowDownLeft className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-amber-600">
                {formatMoney(overview?.totalBorrowedBalance || 0)}
              </div>
              <div className="text-[11px] text-slate-500">
                {borrows.filter(b => b.status !== 'repaid').length} active borrowings
              </div>
            </div>

            {/* People & Companions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>People & Ledgers</span>
                <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {sanitizedPeople.length} <span className="text-xs font-normal text-slate-500">contacts</span>
              </div>
              <div className="text-[11px] text-slate-500 flex justify-between items-center">
                <span>Net: {formatMoney(sanitizedPeople.reduce((s, p) => s + (p.netBalance || 0), 0))}</span>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('people')}
                  className="text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  View Ledgers
                </button>
              </div>
            </div>
          </div>

          {/* Local Visualizations: 14-Day Spending Velocity & Cashflow Balance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">14-Day Spending Velocity</h3>
                </div>
                <span className="text-[11px] text-slate-400 font-semibold">in {viewCurrency}</span>
              </div>
              {/* Mini SVG Velocity Histogram */}
              {(() => {
                const now = new Date();
                const pts: Array<{ date: string; label: string; amountBase: number }> = [];
                for (let i = 13; i >= 0; i--) {
                  const d = new Date(now);
                  d.setDate(d.getDate() - i);
                  const dStr = d.toISOString().slice(0, 10);
                  const dayTotal = expenses.filter(e => !e.isRotation && e.date === dStr).reduce((s, e) => s + (Number(e.amount) || 0), 0);
                  pts.push({
                    date: dStr,
                    label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
                    amountBase: dayTotal
                  });
                }
                const maxV = Math.max(...pts.map(p => convertBaseToTarget(p.amountBase)), 1);

                return (
                  <div className="w-full">
                    <svg viewBox="0 0 420 80" className="w-full h-20 select-none">
                      <line x1="10" y1="65" x2="410" y2="65" stroke="#e2e8f0" strokeWidth="1" />
                      {pts.map((pt, i) => {
                        const val = convertBaseToTarget(pt.amountBase);
                        const barH = maxV > 0 ? (val / maxV) * 52 : 0;
                        const x = 14 + i * 28.5;
                        const y = 65 - barH;
                        return (
                          <g key={pt.date} className="group cursor-pointer">
                            <title>{`${pt.date}: ${formatMoney(pt.amountBase)}`}</title>
                            <rect
                              x={x}
                              y={y}
                              width="16"
                              height={Math.max(barH, val > 0 ? 2 : 0)}
                              rx="2.5"
                              fill={val > 0 ? "#6366f1" : "#e2e8f0"}
                              className="transition-all"
                            />
                            <text
                              x={x + 8}
                              y="76"
                              textAnchor="middle"
                              className="text-[7.5px] fill-slate-400 font-bold"
                            >
                              {pt.label.split(' ')[0][0]}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              })()}
            </div>

            {/* Net Position Standings & Jump to Analytics */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <PieChart className="w-4 h-4 text-emerald-600" />
                    Net Cashflow Standing
                  </h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Lent (Receivable):</span>
                    <span className="font-bold text-emerald-600">{formatMoney(overview?.totalLentBalance || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Borrowed (Payable):</span>
                    <span className="font-bold text-amber-600">{formatMoney(overview?.totalBorrowedBalance || 0)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-black">
                    <span className="text-slate-700">Net Standing:</span>
                    <span className={`${(overview?.totalLentBalance || 0) - (overview?.totalBorrowedBalance || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {formatMoney((overview?.totalLentBalance || 0) - (overview?.totalBorrowedBalance || 0))}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveSubTab('analytics')}
                className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span>Deep Analytics & Insights</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Pending Bank SMS Backlog Card */}
          {backlog.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-emerald-500/10 border-2 border-indigo-200 rounded-2xl p-5 shadow-md space-y-3 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600"></span>
                  </span>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      Pending Bank SMS Inbox ({backlog.length})
                    </h2>
                    <p className="text-[11px] text-slate-600">
                      Auto-detected from Bank SMS (City Union Bank) on your companion phone. Log, split with a friend, or mark as rotated.
                    </p>
                  </div>
                </div>
                <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                  Real-time bi-directional sync
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {backlog.map(item => (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-3.5 shadow-sm space-y-2.5 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          item.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {item.type}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {item.bank || 'CUB'} {item.account ? `(${item.account})` : ''}
                        </span>
                      </div>
                      <div className="text-sm font-black text-slate-900">
                        {formatMoney(item.amount)}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span>Date: <span className="font-semibold text-slate-700">{item.date}</span></span>
                        {item.upiRef && <span className="font-mono text-[10px]">UPI: {item.upiRef}</span>}
                      </div>
                      {item.counterpartyAccount && (
                        <div className="truncate text-slate-400 text-[10px]">To: {item.counterpartyAccount}</div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const defPerson = people.find(p => p.isDefault)?.name || (people.length > 0 ? people[0].name : '');
                            setReconcileTarget(item);
                            setReconcileForm({
                              description: `${item.bank} ${item.upiRef ? `UPI ${item.upiRef}` : 'Transaction'}`,
                              category: item.type === 'CREDIT' ? 'Miscellaneous' : 'Food & Dining',
                              expenseSetId: '',
                              splitMode: 'none',
                              splitPersonName: defPerson,
                              customMyAmount: item.amount.toString(),
                              customTheirAmount: '0',
                              expectedReturnDate: ''
                            });
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm transition"
                        >
                          Log / Split
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIgnoreBacklog(item.id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition"
                          title="Mark as Rotated (Not an expense)"
                        >
                          Rotated (Pass)
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteBacklog(item.id)}
                        className="text-slate-400 hover:text-red-500 p-1 transition"
                        title="Delete from backlog"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Expense Sets Row */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Active Expense Sets
                </h2>
                <p className="text-[11px] text-slate-500">Current trips, outings, and dedicated activity buckets</p>
              </div>
              <button
                onClick={() => setActiveSubTab('sets')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                View all sets <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {expenseSets.filter(s => s.status === 'active').length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl space-y-2">
                <p className="text-xs text-slate-500">No active expense sets right now.</p>
                <button
                  onClick={() => setIsSetModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                >
                  Create Trip / Outing Set
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {expenseSets.filter(s => s.status === 'active').map(set => {
                  const spent = set.totalSpent || 0;
                  const budget = set.budget || 0;
                  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : null;

                  return (
                    <div key={set.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{set.name}</div>
                          <span className="text-[10px] font-semibold text-slate-500">{set.category}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Total Spent:</span>
                          <span className="font-bold text-slate-900">{formatMoney(spent)}</span>
                        </div>
                        {budget > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-slate-500">
                              <span>Budget: {formatMoney(budget)}</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full ${pct! >= 100 ? 'bg-rose-500' : pct! >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[11px]">
                        <span className="text-slate-500">{set.entryCount || 0} entries</span>
                        <button
                          onClick={() => {
                            resetExpenseForm(set.id);
                            setIsExpenseModalOpen(true);
                          }}
                          className="font-bold text-indigo-600 hover:text-indigo-700"
                        >
                          + Add Entry
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Expenses List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                Recent Expenses
              </h2>
              <button
                onClick={() => setActiveSubTab('expenses')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                View all expenses <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {expenses.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No expenses logged yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {expenses.slice(0, 7).map(e => {
                  const setName = expenseSets.find(s => s.id === e.expenseSetId)?.name;
                  return (
                    <div key={e.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl text-xs ${e.isRotation ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-700'}`}>
                          {e.isRotation ? <RefreshCw className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                            {e.description}
                            {e.isRotation && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-indigo-100 text-indigo-700">
                                Rotation
                              </span>
                            )}
                            {setName && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-600">
                                {setName}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-450 flex items-center gap-2 mt-0.5">
                            <span>{e.date}</span>
                            <span>•</span>
                            <span>{e.category}</span>
                            <span>•</span>
                            <span>{e.paymentMethod}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className={`text-sm font-black ${e.isRotation ? 'text-indigo-600' : 'text-slate-900'}`}>
                            <div>{formatMoney(e.amount)}</div>
                            {e.currency && e.currency !== viewCurrency && (
                              <div className="text-[10px] font-normal text-slate-400">
                                orig: {getCurrencySymbol(e.currency)} {e.originalAmount || e.amount}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEditExpense(e)}
                          className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                          title="Edit Expense"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. ANALYTICS & FINANCIAL INTELLIGENCE TAB (NEW) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'analytics' && (() => {
        const ad = getFilteredAnalyticsData();
        const maxDaily = Math.max(...ad.dailyPoints.map(p => convertBaseToTarget(p.amountBase)), 1);
        const avgDaily = convertBaseToTarget(ad.dailyAverageBase);

        // Donut calculations
        const radius = 60;
        const circumference = 2 * Math.PI * radius;
        let cumulative = 0;

        return (
          <div className="space-y-6">
            {/* Header & Timeframe Filter */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Financial Analytics & Cashflow Insights
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-currency intelligence, category distributions, trip burn rates, and companion treats in <strong className="text-indigo-600 font-bold">{viewCurrency}</strong>
                </p>
              </div>

              {/* Timeframe pill selector */}
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold shrink-0">
                {[
                  { id: '7d', label: '7 Days' },
                  { id: 'month', label: 'This Month' },
                  { id: '30d', label: '30 Days' },
                  { id: '90d', label: '90 Days' },
                  { id: 'all', label: 'All Time' }
                ].map(tf => (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => setAnalyticsTimeframe(tf.id as any)}
                    className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                      analyticsTimeframe === tf.id
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Net Outflow */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Net Spend</span>
                <div className="text-lg font-black text-slate-900 truncate">
                  {formatMoney(ad.totalNetSpendBase)}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Excl. rotations</div>
              </div>

              {/* Daily Burn Rate */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Daily Burn</span>
                <div className="text-lg font-black text-indigo-600 truncate">
                  {formatMoney(ad.dailyAverageBase)}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Average/day</div>
              </div>

              {/* Peak Expense */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Peak Single</span>
                <div className="text-lg font-black text-rose-600 truncate" title={ad.peakExpense?.description}>
                  {ad.peakExpense ? formatMoney(ad.peakExpense.amount) : '—'}
                </div>
                <div className="text-[10px] text-slate-400 font-medium truncate">
                  {ad.peakExpense ? ad.peakExpense.description : 'None'}
                </div>
              </div>

              {/* Pending Receivables */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Receivables</span>
                <div className="text-lg font-black text-emerald-600 truncate">
                  {formatMoney(overview?.totalLentBalance || 0)}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Owed to you</div>
              </div>

              {/* Generosity / Treated Gifts */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Treated / Gifts</span>
                <div className="text-lg font-black text-amber-600 truncate">
                  {formatMoney(ad.totalSponsoredBase)}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">No return needed</div>
              </div>

              {/* Dummy Rotation Transfers */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rotations</span>
                <div className="text-lg font-black text-slate-600 truncate">
                  {formatMoney(ad.totalRotationsBase)}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Bank contra</div>
              </div>
            </div>

            {/* Daily Spending Velocity Histogram (SVG) */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <LineChart className="w-4 h-4 text-indigo-600" />
                    Daily Outflow Timeline
                  </h3>
                  <p className="text-[11px] text-slate-500">Day-by-day expenditure pattern across the timeframe</p>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-500 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 inline-block"></span>
                    Daily Spend
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 border-t-2 border-dashed border-rose-500 inline-block"></span>
                    Avg: {formatMoney(ad.dailyAverageBase)}/day
                  </span>
                </div>
              </div>

              {/* SVG Histogram */}
              <div className="w-full overflow-x-auto no-scrollbar">
                <div className="min-w-[500px]">
                  <svg viewBox="0 0 540 160" className="w-full h-44 select-none">
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#4f46e5" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal grid lines */}
                    <line x1="30" y1="20" x2="520" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="30" y1="70" x2="520" y2="70" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="30" y1="120" x2="520" y2="120" stroke="#e2e8f0" strokeWidth="1" />

                    {/* Average dashed guideline */}
                    {maxDaily > 0 && avgDaily > 0 && (
                      <line
                        x1="30"
                        y1={Math.max(25, 120 - (avgDaily / maxDaily) * 100)}
                        x2="520"
                        y2={Math.max(25, 120 - (avgDaily / maxDaily) * 100)}
                        stroke="#f43f5e"
                        strokeDasharray="4 4"
                        strokeWidth="1.5"
                      />
                    )}

                    {/* Bars */}
                    {ad.dailyPoints.map((pt, idx) => {
                      const val = convertBaseToTarget(pt.amountBase);
                      const barH = maxDaily > 0 ? (val / maxDaily) * 95 : 0;
                      const step = 480 / ad.dailyPoints.length;
                      const barW = Math.max(10, Math.min(26, step - 6));
                      const x = 38 + idx * step;
                      const y = 120 - barH;

                      return (
                        <g key={pt.date} className="group cursor-pointer">
                          <title>{`${pt.date}: ${formatMoney(pt.amountBase)}`}</title>
                          {/* Background hover hit target */}
                          <rect
                            x={x - 2}
                            y="15"
                            width={barW + 4}
                            height="110"
                            fill="transparent"
                            className="hover:fill-slate-50 transition"
                          />
                          {/* Visible Bar */}
                          <rect
                            x={x}
                            y={y}
                            width={barW}
                            height={Math.max(barH, val > 0 ? 3 : 0)}
                            rx="3"
                            fill={val > 0 ? "url(#barGrad)" : "#e2e8f0"}
                            className="transition-all duration-300"
                          />
                          {/* Amount on top if non-zero */}
                          {val > 0 && (
                            <text
                              x={x + barW / 2}
                              y={Math.max(15, y - 4)}
                              textAnchor="middle"
                              className="text-[8px] fill-indigo-700 font-black opacity-0 group-hover:opacity-100 transition"
                            >
                              {Math.round(val)}
                            </text>
                          )}
                          {/* Date Label */}
                          <text
                            x={x + barW / 2}
                            y="136"
                            textAnchor="middle"
                            className="text-[9px] fill-slate-400 font-bold"
                          >
                            {pt.label.split(' ')[0]}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>

            {/* Row 2: Category Donut & Payment Channels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Category Spending Donut */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-600" />
                    Category Outflow Share
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold">{ad.categoryBreakdown.length} categories</span>
                </div>

                {ad.categoryBreakdown.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No expenses logged in this timeframe.
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* SVG Circular Ring */}
                    <div className="shrink-0 relative w-44 h-44 flex items-center justify-center">
                      <svg viewBox="0 0 160 160" className="w-44 h-44 -rotate-90">
                        {/* Background ring */}
                        <circle cx="80" cy="80" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="20" />
                        {ad.categoryBreakdown.map((cat) => {
                          const strokeLen = (cat.percentage / 100) * circumference;
                          const offset = -cumulative;
                          cumulative += strokeLen;
                          return (
                            <circle
                              key={cat.name}
                              cx="80"
                              cy="80"
                              r={radius}
                              fill="transparent"
                              stroke={cat.color || '#6366f1'}
                              strokeWidth="20"
                              strokeDasharray={`${strokeLen} ${circumference}`}
                              strokeDashoffset={offset}
                              className="transition-all duration-500"
                            >
                              <title>{`${cat.name}: ${formatMoney(cat.totalBase)} (${cat.percentage.toFixed(1)}%)`}</title>
                            </circle>
                          );
                        })}
                      </svg>
                      {/* Center Info */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</span>
                        <span className="text-xs font-black text-slate-900 px-2 truncate max-w-[120px]">
                          {formatMoney(ad.totalNetSpendBase)}
                        </span>
                      </div>
                    </div>

                    {/* Category Legend & List */}
                    <div className="flex-1 w-full space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                      {ad.categoryBreakdown.map(cat => (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 truncate">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#6366f1' }} />
                              <span className="font-bold text-slate-800 truncate">{cat.name}</span>
                            </span>
                            <div className="text-right shrink-0">
                              <strong className="text-slate-900 font-black">{formatMoney(cat.totalBase)}</strong>
                              <span className="text-[10px] text-slate-400 ml-1.5 font-semibold">({cat.percentage.toFixed(0)}%)</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${cat.percentage}%`, backgroundColor: cat.color || '#6366f1' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Methods Breakdown */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    Payment Channel Distribution
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold">{ad.paymentBreakdown.length} channels</span>
                </div>

                {/* Segmented multi-color bar */}
                <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100">
                  {ad.paymentBreakdown.map((pm, i) => {
                    const colors = ['bg-indigo-600', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-600', 'bg-cyan-500'];
                    return (
                      <div
                        key={pm.method}
                        className={`${colors[i % colors.length]} h-full transition-all`}
                        style={{ width: `${pm.percentage}%` }}
                        title={`${pm.method}: ${formatMoney(pm.totalBase)} (${pm.percentage.toFixed(1)}%)`}
                      />
                    );
                  })}
                </div>

                {/* Grid of payment cards */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {ad.paymentBreakdown.map((pm, i) => {
                    const colors = ['text-indigo-600', 'text-emerald-600', 'text-amber-600', 'text-purple-600', 'text-cyan-600'];
                    const bgColors = ['bg-indigo-50', 'bg-emerald-50', 'bg-amber-50', 'bg-purple-50', 'bg-cyan-50'];
                    return (
                      <div key={pm.method} className={`p-3 rounded-2xl border border-slate-100 ${bgColors[i % bgColors.length]} space-y-1`}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">{pm.method}</span>
                          <span className={`text-[10px] font-black ${colors[i % colors.length]}`}>
                            {pm.percentage.toFixed(0)}%
                          </span>
                        </div>
                        <div className="text-sm font-black text-slate-900">
                          {formatMoney(pm.totalBase)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 3: Expense Sets Comparison & Companion Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Expense Sets / Trips Comparison */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Trip & Set Burn Rates
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('sets')}
                    className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    View All Sets
                  </button>
                </div>

                {ad.setComparison.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No active expense sets with spending yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ad.setComparison.map(s => {
                      const pct = s.budgetBase > 0 ? Math.min(100, Math.round((s.spentBase / s.budgetBase) * 100)) : null;
                      return (
                        <div key={s.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="font-bold text-slate-900 truncate">
                              {s.name}
                              <span className="ml-2 text-[10px] font-semibold text-slate-400">({s.entriesCount} entries)</span>
                            </div>
                            <div className="font-black text-slate-900">
                              {formatMoney(s.spentBase)}
                            </div>
                          </div>
                          {s.budgetBase > 0 && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500">
                                <span>Budget: {formatMoney(s.budgetBase)}</span>
                                <span className={pct! >= 100 ? 'text-rose-600 font-bold' : 'text-slate-600 font-bold'}>{pct}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full ${pct! >= 100 ? 'bg-rose-500' : pct! >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Companion Outing & Generosity Matrix */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Companion Outings & Generosity Matrix
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('people')}
                    className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    View People
                  </button>
                </div>

                {ad.companionMatrix.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No companions recorded in split or sponsored expenses yet.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto no-scrollbar">
                    {ad.companionMatrix.map(cp => (
                      <div key={cp.name} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0 text-xs">
                            {cp.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="font-bold text-slate-900 truncate">{cp.name}</div>
                            <div className="text-[10px] text-slate-400">{cp.outingCount} shared outings</div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-0.5">
                          <div className="font-black text-slate-900">
                            Total: {formatMoney(cp.totalOutingBase)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Split: <strong className="text-slate-700">{formatMoney(cp.splitBase)}</strong>
                            {cp.sponsoredBase > 0 && (
                              <span className="ml-1 text-amber-600 font-bold">
                                • Gift: {formatMoney(cp.sponsoredBase)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. EXPENSES TAB */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'expenses' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-bold text-slate-500 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Filters:
              </span>

              {/* Set selector */}
              <select
                value={filterSetId}
                onChange={e => setFilterSetId(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/50"
              >
                <option value="all">All Sets & Standalone</option>
                <option value="standalone">Standalone only (no set)</option>
                {expenseSets.map(s => (
                  <option key={s.id} value={s.id}>Set: {s.name}</option>
                ))}
              </select>

              {/* Category selector */}
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/50"
              >
                <option value="all">All Categories</option>
                {effectiveCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setCategoryForm({ id: '', name: '', color: '#6366f1' });
                  setIsCategoryModalOpen(true);
                }}
                className="px-2 py-1.5 border border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                title="Manage Categories"
              >
                <Plus className="w-3 h-3" /> Category
              </button>

              {/* Rotation toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideRotations}
                  onChange={e => setHideRotations(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span className="text-slate-600">Hide Rotations</span>
              </label>
            </div>

            <div className="text-xs font-bold text-slate-600">
              {filteredExpenses.length} entries • Total: {formatMoney(filteredExpenses.reduce((sum, e) => sum + e.amount, 0))}
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {filteredExpenses.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-12">No expenses matching your filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Set / Bucket</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExpenses.map(e => {
                      const setName = expenseSets.find(s => s.id === e.expenseSetId)?.name;
                      return (
                        <tr key={e.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{e.date}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {e.description}
                            {e.isRotation && (
                              <span className="ml-2 text-[9px] px-1.5 py-0.2 rounded font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Rotation
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{e.category}</td>
                          <td className="py-3 px-4 text-slate-500">{setName || '—'}</td>
                          <td className="py-3 px-4 text-slate-600">{e.paymentMethod}</td>
                          <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                            <div>{formatMoney(e.amount)}</div>
                            {e.currency && e.currency !== viewCurrency && (
                              <div className="text-[10px] font-normal text-slate-400">
                                orig: {getCurrencySymbol(e.currency)} {e.originalAmount || e.amount}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditExpense(e)}
                                className="text-slate-400 hover:text-indigo-600 p-1 rounded transition cursor-pointer"
                                title="Edit Expense"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(e.id)}
                                className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                                title="Delete Expense"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. EXPENSE SETS TAB */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'sets' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-900">All Trip & Activity Expense Sets</h2>
            <button
              onClick={() => {
                setSetForm({ id: '', name: '', category: 'Outing / Trip', budget: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', notes: '' });
                setIsSetModalOpen(true);
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Create New Set
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expenseSets.map(set => {
              const spent = set.totalSpent || 0;
              const budget = set.budget || 0;
              const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : null;

              return (
                <div key={set.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{set.name}</h3>
                        <span className="text-xs text-slate-500 font-semibold">{set.category}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        set.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {set.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{set.startDate} {set.endDate ? `to ${set.endDate}` : ''}</span>
                    </div>

                    {set.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {set.notes}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Total Spent:</span>
                        <span className="font-black text-slate-900 text-sm">{formatMoney(spent)}</span>
                      </div>
                      {budget > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>Budget: {formatMoney(budget)}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full ${pct! >= 100 ? 'bg-rose-500' : pct! >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setViewSetEntriesTarget(set)}
                      className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View {set.entryCount || 0} Entries
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          resetExpenseForm(set.id);
                          setIsExpenseModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition"
                      >
                        + Add Entry
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditSet(set)}
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded transition cursor-pointer"
                        title="Edit Expense Set"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSet(set.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                        title="Delete Expense Set"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. LENDS TAB (Money Given to Others) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'lends' && (
        <div className="space-y-4">
          {/* Top Counterparties Exposure */}
          {consolidatedLends.length > 0 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-slate-900 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  Counterparty Lending Exposure
                </span>
                <span className="text-slate-500 font-semibold">Total to collect: {formatMoney(consolidatedLends.reduce((s, g) => s + g.remaining, 0))}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {consolidatedLends.slice(0, 3).map(g => (
                  <div key={g.groupKey} className="p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{g.personName}</div>
                      <div className="text-[10px] text-slate-400">{g.setName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-700">{formatMoney(g.remaining)}</div>
                      {g.totalSponsored > 0 && (
                        <div className="text-[9px] text-amber-600 font-semibold">Treated: {formatMoney(g.totalSponsored)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Lends Tracker (Money Given Out)</h2>
              <p className="text-[11px] text-slate-500">Keep track of who took money, trip splits, and consolidated settlements</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* View Switcher: Consolidated vs Individual */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold border border-slate-200">
                <button
                  type="button"
                  onClick={() => setLendsViewMode('consolidated')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    lendsViewMode === 'consolidated'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Consolidated by Trip / Person
                </button>
                <button
                  type="button"
                  onClick={() => setLendsViewMode('individual')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    lendsViewMode === 'individual'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  All Individual Entries ({lends.length})
                </button>
              </div>

              <button
                onClick={() => {
                  setLendForm({
                    id: '',
                    personName: '',
                    contact: '',
                    amount: '',
                    currency: settings.defaultCurrency || 'NPR',
                    lentDate: new Date().toISOString().slice(0, 10),
                    expectedReturnDate: '',
                    isRotation: false,
                    notes: ''
                  });
                  setIsLendModalOpen(true);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Log Money Lent
              </button>
            </div>
          </div>

          {/* Consolidated View */}
          {lendsViewMode === 'consolidated' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {consolidatedLends.length === 0 ? (
                <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
                  No active lends registered.
                </div>
              ) : (
                consolidatedLends.map(grp => {
                  return (
                    <div key={grp.groupKey} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                              <User className="w-4 h-4 text-emerald-600" />
                              {grp.personName}
                            </div>
                            {grp.contact && (
                              <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" /> {grp.contact}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              grp.allComplete ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {grp.allComplete ? 'All Settled' : 'Active'}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500">
                              {grp.items.length} {grp.items.length === 1 ? 'entry' : 'entries'}
                            </span>
                          </div>
                        </div>

                        {/* Expense Set / Trip Badge */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                            grp.expenseSetId
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            <Layers className="w-3 h-3" />
                            {grp.setName}
                          </span>
                          {grp.totalSponsored > 0 && (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200">
                              <Gift className="w-3 h-3 text-amber-600" />
                              Sponsored: {formatMoney(grp.totalSponsored)}
                            </span>
                          )}
                        </div>

                        {/* Amounts Display */}
                        <div className="pt-1 flex justify-between items-baseline">
                          <div>
                            <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Remaining Balance</span>
                            <div className="text-xl font-black text-emerald-600">
                              {formatMoney(grp.remaining)}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Total Lent</span>
                            <div className="text-xs font-bold text-slate-700">
                              {formatMoney(grp.totalAmount)}
                            </div>
                            {grp.totalRepaid > 0 && (
                              <div className="text-[10px] text-slate-400">
                                Repaid: {formatMoney(grp.totalRepaid)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* View Breakdown as Popup Modal Button */}
                        <button
                          type="button"
                          onClick={() => setViewConsolidatedBreakdownTarget(grp)}
                          className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl text-xs font-bold text-indigo-700 flex items-center justify-between transition cursor-pointer active:scale-[0.99]"
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                            View Breakdown ({grp.items.length} {grp.items.length === 1 ? 'entry' : 'entries'}{grp.totalSponsored > 0 ? ` • ${grp.sponsoredItems.length} sponsored` : ''})
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      </div>

                      {!grp.allComplete && (
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const firstUnpaid = grp.items.find(it => {
                                  const rep = (it.repayments || []).reduce((s, r) => s + r.amount, 0);
                                  return it.amount > rep;
                                }) || grp.items[0];
                                const rem = firstUnpaid ? Math.max(0, firstUnpaid.amount - (firstUnpaid.repayments || []).reduce((s, r) => s + r.amount, 0)) : grp.remaining;
                                if (firstUnpaid) {
                                  setRepayTarget({ type: 'lend', item: firstUnpaid });
                                  setRepayAmount(rem > 0 ? rem.toString() : grp.remaining.toString());
                                }
                              }}
                              className="flex-1 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              Record Repayment
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenConsolidatedReminder(grp)}
                              className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition flex items-center gap-1 active:scale-[0.98] cursor-pointer"
                              title="Send settlement breakdown & email reminder"
                            >
                              <Mail className="w-3 h-3 text-indigo-600" />
                              Settlement Reminder
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Individual Entries View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lends.length === 0 ? (
                <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
                  No active lends registered.
                </div>
              ) : (
                lends.map(item => {
                  const totalRepaid = (item.repayments || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
                  const remaining = Math.max(0, item.amount - totalRepaid);
                  const isComplete = item.status === 'returned';

                  return (
                    <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                              <User className="w-4 h-4 text-emerald-600" />
                              {item.personName}
                            </div>
                            {item.contact && (
                              <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" /> {item.contact}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isComplete ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {item.status.replace('_', ' ')}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEditLend(item)}
                              className="text-slate-400 hover:text-emerald-600 p-1 rounded cursor-pointer transition"
                              title="Edit Lend Record"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLend(item.id)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer transition"
                              title="Delete Lend Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="pt-2 flex justify-between items-baseline">
                          <div>
                            <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Remaining</span>
                            <div className="text-xl font-black text-emerald-600">
                              {formatMoney(remaining)}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Initial</span>
                            <div className="text-xs font-bold text-slate-700">
                              {formatMoney(item.amount)}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-slate-500 space-y-1 pt-1">
                          <div>Lent on: <span className="font-semibold text-slate-700">{item.lentDate}</span></div>
                          {item.expectedReturnDate && (
                            <div className="flex items-center gap-2">
                              <span>Return: <span className="font-semibold text-slate-700">{item.expectedReturnDate}</span></span>
                              {!isComplete && getDaysRemainingBadge(item.expectedReturnDate)}
                            </div>
                          )}
                          {item.isRotation && (
                            <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 mt-1">
                              Short-term Rotation / Temp Lend
                            </span>
                          )}
                          {item.notes && <p className="text-[11px] text-slate-600 italic mt-1">{item.notes}</p>}
                        </div>
                      </div>

                      {!isComplete && (
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          {/* Reminder Controls */}
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={(e) => handleToggleReminder(item, e)}
                              className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                                item.reminderSent
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                              title="Toggle reminder checkmark"
                            >
                              <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition ${
                                item.reminderSent ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                              }`}>
                                {item.reminderSent && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </span>
                              {item.reminderSent ? 'Reminder Sent' : 'Mark Reminded'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSendReminderPrompt(item)}
                              className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition flex items-center gap-1 shadow-xs"
                              title="Open WhatsApp or copy polite reminder text"
                            >
                              <Send className="w-3 h-3" />
                              Send Reminder
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              setRepayTarget({ type: 'lend', item });
                              setRepayAmount(remaining.toString());
                            }}
                            className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                          >
                            <Check className="w-3.5 h-3.5" /> Record Repayment
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. BORROWS TAB (Money Taken from Others) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'borrows' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Borrows Tracker (Money Taken from Others)</h2>
              <p className="text-[11px] text-slate-500">Track liabilities, who you borrowed from, and return deadlines</p>
            </div>
            <button
              onClick={() => {
                setBorrowForm({
                  id: '',
                  personName: '',
                  contact: '',
                  amount: '',
                  currency: settings.defaultCurrency || 'NPR',
                  borrowedDate: new Date().toISOString().slice(0, 10),
                  expectedReturnDate: '',
                  isRotation: false,
                  notes: ''
                });
                setIsBorrowModalOpen(true);
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Log Money Borrowed
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {borrows.length === 0 ? (
              <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
                No active borrowings recorded.
              </div>
            ) : (
              borrows.map(item => {
                const totalRepaid = (item.repayments || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
                const remaining = Math.max(0, item.amount - totalRepaid);
                const isComplete = item.status === 'repaid';

                return (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                            <User className="w-4 h-4 text-amber-600" />
                            {item.personName}
                          </div>
                          {item.contact && (
                            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {item.contact}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isComplete ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {item.status.replace('_', ' ')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleEditBorrow(item)}
                            className="text-slate-400 hover:text-amber-600 p-1 rounded cursor-pointer transition"
                            title="Edit Borrow Record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBorrow(item.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer transition"
                            title="Delete Borrow Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-between items-baseline">
                        <div>
                          <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Remaining Debt</span>
                          <div className="text-xl font-black text-amber-600">
                            {formatMoney(remaining)}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Borrowed</span>
                          <div className="text-xs font-bold text-slate-700">
                            {formatMoney(item.amount)}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 space-y-1 pt-1">
                        <div>Taken on: <span className="font-semibold text-slate-700">{item.borrowedDate}</span></div>
                        {item.expectedReturnDate && (
                          <div className="flex items-center gap-2">
                            <span>Deadline: <span className="font-semibold text-slate-700">{item.expectedReturnDate}</span></span>
                            {!isComplete && getDaysRemainingBadge(item.expectedReturnDate)}
                          </div>
                        )}
                        {item.isRotation && (
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 mt-1">
                            Short-term Rotation / Temp Borrow
                          </span>
                        )}
                        {item.notes && <p className="text-[11px] text-slate-600 italic mt-1">{item.notes}</p>}
                      </div>
                    </div>

                    {!isComplete && (
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <button
                          onClick={() => {
                            setRepayTarget({ type: 'borrow', item });
                            setRepayAmount(remaining.toString());
                          }}
                          className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" /> Record Payment Made
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 6. PEOPLE & EXPENSE GROUPS TAB */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'people' && (
        <div className="space-y-5">
          {/* Top Sub-Navigation Toggle: People Directory vs Expense Groups */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200/80 rounded-xl">
              <button
                type="button"
                onClick={() => setPeopleViewMode('people')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  peopleViewMode === 'people'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                People & Companions ({sanitizedPeople.length})
              </button>
              <button
                type="button"
                onClick={() => setPeopleViewMode('groups')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  peopleViewMode === 'groups'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Expense Groups ({groups.length})
              </button>
            </div>

            {peopleViewMode === 'people' ? (
              <div className="flex items-center gap-2">
                {/* List / Grid View Mode Toggle */}
                <div className="flex items-center p-1 bg-slate-100 border border-slate-200/80 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setPeopleDisplayMode('list')}
                    className={`p-1.5 px-2.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition ${
                      peopleDisplayMode === 'list'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="List View of Profiles"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeopleDisplayMode('grid')}
                    className={`p-1.5 px-2.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition ${
                      peopleDisplayMode === 'grid'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Grid View of Profiles"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Grid</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPersonForm({ id: '', name: '', contact: '', email: '', isDefault: false, notes: '' });
                    setIsPersonModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Person
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setGroupForm({ id: '', name: '', description: '', members: [], newMemberInput: '' });
                  setIsGroupModalOpen(true);
                }}
                className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 active:scale-[0.98] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create Group
              </button>
            )}
          </div>

          {peopleViewMode === 'people' ? (
            <>
              {/* Directory Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">Total Receivables (Others Owe You)</span>
                  <div className="text-xl font-black text-emerald-600">
                    {formatMoney(sanitizedPeople.reduce((sum, p) => sum + (p.netReceivable || 0), 0))}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">Total Payables (You Owe Others)</span>
                  <div className="text-xl font-black text-amber-600">
                    {formatMoney(sanitizedPeople.reduce((sum, p) => sum + (p.netPayable || 0), 0))}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">Net Ledger Position</span>
                  {(() => {
                    const net = sanitizedPeople.reduce((sum, p) => sum + (p.netBalance || 0), 0);
                    return (
                      <div className={`text-xl font-black ${net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {net >= 0 ? `+ ${formatMoney(net)}` : `- ${formatMoney(Math.abs(net))}`}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {sanitizedPeople.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500 space-y-2">
                  <p>No companions or people added yet.</p>
                  <p className="text-[11px] text-slate-400">
                    When you split an expense (e.g. outing with friends) or someone pays for you, individual companions are automatically added here.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonForm({ id: '', name: '', contact: '', email: '', isDefault: false, notes: '' });
                      setIsPersonModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                  >
                    Add First Companion
                  </button>
                </div>
              ) : peopleDisplayMode === 'list' ? (
                /* ── LIST VIEW OF PROFILES ── */
                <div className="space-y-2.5">
                  {sanitizedPeople.map(p => {
                    const balance = p.netBalance || 0;
                    const normName = p.name.toLowerCase();
                    const pLends = lends.filter(l => (l.personName || '').toLowerCase() === normName);
                    const pBorrows = borrows.filter(b => (b.personName || '').toLowerCase() === normName);
                    const pSplits = expenses.filter(e => {
                      if (e.splits && e.splits.length > 0) {
                        return e.splits.some(s => (s.personName || '').trim().toLowerCase() === normName && !s.isSponsored);
                      }
                      return (e.splitPersonName || '').toLowerCase() === normName;
                    });
                    const pPaidForMe = expenses.filter(e => (e.paidByPersonName || '').toLowerCase() === normName);
                    const pSponsored = expenses.flatMap(exp => {
                      return (exp.splits || []).filter(s =>
                        (s.personName || '').trim().toLowerCase() === normName && s.isSponsored
                      ).map(s => ({ ...s, date: exp.date, description: exp.description }));
                    });
                    const totalSponsored = pSponsored.reduce((acc, s) => acc + (s.amount || 0), 0);
                    const relatedTxsCount = pLends.length + pBorrows.length + pSplits.length + pPaidForMe.length + pSponsored.length;

                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPersonLedger(p)}
                        className="bg-white hover:bg-indigo-50/20 border border-slate-200 hover:border-indigo-300 rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group active:scale-[0.99]"
                        title="Click to view all transactions with this person"
                      >
                        {/* Profile Details */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                            {p.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-900 text-sm truncate">{p.name}</h3>
                              {p.isDefault && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
                              {p.contact && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" /> {p.contact}
                                </span>
                              )}
                              {p.email ? (
                                <span className="flex items-center gap-1 text-indigo-600 font-medium">
                                  <Mail className="w-3 h-3" /> {p.email}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPersonForm({ id: p.id, name: p.name, contact: p.contact || '', email: '', isDefault: Boolean(p.isDefault), notes: p.notes || '' });
                                    setIsPersonModalOpen(true);
                                  }}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Plus className="w-2.5 h-2.5" /> Add Email
                                </button>
                              )}
                              <span className="text-slate-300 hidden sm:inline">•</span>
                              <span className="text-slate-500">{relatedTxsCount} transaction{relatedTxsCount === 1 ? '' : 's'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Badges, Net Balance & Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          {totalSponsored > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                              <Gift className="w-3 h-3 text-purple-600" />
                              {formatMoney(totalSponsored)} treated
                            </span>
                          )}

                          {/* Balance Display */}
                          <div className="text-right">
                            <div className={`text-sm font-black ${
                              balance > 0 ? 'text-emerald-700' : balance < 0 ? 'text-rose-600' : 'text-slate-600'
                            }`}>
                              {balance > 0 ? `+ ${formatMoney(balance)}` : balance < 0 ? `- ${formatMoney(Math.abs(balance))}` : formatMoney(0)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold">
                              {balance > 0 ? 'Owes you' : balance < 0 ? 'You owe' : 'All Settled'}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {balance > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPersonReminder(p);
                                }}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                                title="Send settlement breakdown & reminder email"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPersonForm({
                                  id: p.id,
                                  name: p.name,
                                  contact: p.contact || '',
                                  email: p.email || '',
                                  isDefault: Boolean(p.isDefault),
                                  notes: p.notes || ''
                                });
                                setIsPersonModalOpen(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Edit Person"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePerson(p.id, p.name);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Delete Person"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="p-1 text-slate-300 group-hover:text-indigo-500 transition-colors">
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ── GRID VIEW OF PROFILES ── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sanitizedPeople.map(p => {
                    const balance = p.netBalance || 0;
                    const normName = p.name.toLowerCase();
                    const pLends = lends.filter(l => (l.personName || '').toLowerCase() === normName);
                    const pBorrows = borrows.filter(b => (b.personName || '').toLowerCase() === normName);
                    const pSplits = expenses.filter(e => {
                      if (e.splits && e.splits.length > 0) {
                        return e.splits.some(s => (s.personName || '').trim().toLowerCase() === normName && !s.isSponsored);
                      }
                      return (e.splitPersonName || '').toLowerCase() === normName;
                    });
                    const pPaidForMe = expenses.filter(e => (e.paidByPersonName || '').toLowerCase() === normName);
                    const pSponsored = expenses.flatMap(exp => {
                      return (exp.splits || []).filter(s =>
                        (s.personName || '').trim().toLowerCase() === normName && s.isSponsored
                      ).map(s => ({ ...s, date: exp.date, description: exp.description }));
                    });
                    const totalSponsored = pSponsored.reduce((acc, s) => acc + (s.amount || 0), 0);
                    const relatedTxsCount = pLends.length + pBorrows.length + pSplits.length + pPaidForMe.length + pSponsored.length;

                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPersonLedger(p)}
                        className="bg-white hover:bg-indigo-50/10 border border-slate-200 hover:border-indigo-300 rounded-2xl p-5 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-4 group active:scale-[0.99]"
                        title="Click to view all transactions with this person"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                                {p.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                                  {p.name}
                                  {p.isDefault && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-indigo-100 text-indigo-700 border border-indigo-200">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                                  {p.contact && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-3 h-3 text-slate-400" /> {p.contact}
                                    </span>
                                  )}
                                  {p.email && (
                                    <span className="flex items-center gap-1 text-indigo-600 font-medium">
                                      <Mail className="w-3 h-3" /> {p.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              {balance > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPersonReminder(p)}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                                  title="Send settlement breakdown & reminder email"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setPersonForm({
                                    id: p.id,
                                    name: p.name,
                                    contact: p.contact || '',
                                    email: p.email || '',
                                    isDefault: Boolean(p.isDefault),
                                    notes: p.notes || ''
                                  });
                                  setIsPersonModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"
                                title="Edit Person"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePerson(p.id, p.name)}
                                className="p-1 text-slate-400 hover:text-red-500 rounded transition cursor-pointer"
                                title="Delete Person"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Balance Box */}
                          <div className={`p-3 rounded-xl border ${
                            balance > 0
                              ? 'bg-emerald-50/70 border-emerald-200'
                              : balance < 0
                              ? 'bg-amber-50/70 border-amber-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}>
                            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                              {balance > 0 ? 'Owes You (Receivable)' : balance < 0 ? 'You Owe (Payable)' : 'Current Balance'}
                            </div>
                            <div className={`text-lg font-black ${
                              balance > 0 ? 'text-emerald-700' : balance < 0 ? 'text-amber-700' : 'text-slate-700'
                            }`}>
                              {balance > 0
                                ? formatMoney(balance)
                                : balance < 0
                                ? formatMoney(Math.abs(balance))
                                : `${formatMoney(0)} (All Settled)`}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {relatedTxsCount} transactions recorded
                            </div>
                          </div>

                          {totalSponsored > 0 && (
                            <div className="text-[10px] text-indigo-700 bg-indigo-50/80 border border-indigo-200/60 rounded-xl px-2.5 py-1.5 flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1">
                                <Gift className="w-3.5 h-3.5 text-indigo-600" />
                                Treats / Sponsored by You:
                              </span>
                              <span className="font-black text-indigo-900">{formatMoney(totalSponsored)}</span>
                            </div>
                          )}
                        </div>

                        <div className="w-full py-1.5 px-3 bg-slate-50 group-hover:bg-indigo-50 border border-slate-200 group-hover:border-indigo-200 rounded-xl text-xs font-bold text-slate-700 group-hover:text-indigo-700 flex items-center justify-between transition">
                          <span>View all {relatedTxsCount} transactions</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* ── EXPENSE GROUPS SECTION ── */
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between text-xs text-slate-600">
                <div>
                  <span className="font-bold text-slate-900">Expense Groups</span> let you manage recurring travel squads, roommates, and outing friends.
                  When you split a bill, choosing a group automatically adds all members so you can easily include/exclude or sponsor individuals.
                </div>
              </div>

              {groups.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-500 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">No Expense Groups Created Yet</h3>
                  <p className="max-w-md mx-auto text-slate-500 text-[11px]">
                    Create groups for your trips, outings, roommates, or office lunch squads to split expenses in seconds.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupForm({ id: '', name: '', description: '', members: [], newMemberInput: '' });
                      setIsGroupModalOpen(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    + Create Your First Group
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groups.map(group => (
                    <div
                      key={group.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                              <Users className="w-4 h-4 text-indigo-600" />
                              {group.name}
                            </h3>
                            {group.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5">{group.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setGroupForm({
                                  id: group.id,
                                  name: group.name,
                                  description: group.description || '',
                                  members: group.members || [],
                                  newMemberInput: ''
                                });
                                setIsGroupModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"
                              title="Edit Group"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(group.id, group.name)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded transition cursor-pointer"
                              title="Delete Group"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Members Pills */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Members ({group.members?.length || 0})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(group.members || []).map((m, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Group Stats */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-slate-450 uppercase font-bold">Total Spent</span>
                            <div className="font-black text-slate-800">
                              {formatMoney(group.totalSpent || 0)}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-450 uppercase font-bold">Expenses</span>
                            <div className="font-bold text-slate-700">
                              {group.expenseCount || 0} logged
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quick Action: Log Group Expense */}
                      <button
                        type="button"
                        onClick={() => openExpenseWithGroup(group)}
                        className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        ⚡ Log Group Expense
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 7. CATEGORIES MANAGEMENT TAB */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'categories' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                Expense Categories Management
              </h2>
              <p className="text-[11px] text-slate-500">
                Organize, edit, or customize spending categories across your expenses, trips, and automated SMS backlog
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCategoryForm({ id: '', name: '', color: '#6366f1' });
                setIsCategoryModalOpen(true);
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Add New Category
            </button>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map(c => (
              <div
                key={c.id || c.name}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 hover:border-slate-300 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: c.color || '#6366f1' }}
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs truncate">
                      {c.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {c.usageCount !== undefined ? `${c.usageCount} expense(s)` : 'Active category'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryForm({ id: c.id, name: c.name, color: c.color || '#6366f1' });
                      setIsCategoryModalOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-600 rounded transition"
                    title="Edit Category"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(c.id, c.name)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded transition"
                    title="Delete Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 8. SETTINGS & SYSTEM DEFAULTS TAB */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-600" />
              Finance System Defaults & Currencies
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Set your primary base currency, multi-currency conversion rates, default companion partner, and transaction presets.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            {/* Card 1: Multi-Currency Support & Exchange Rates */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Multi-Currency & Base System Currency
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pay in INR, NPR, USD, or EUR. All monthly analytics, budgets, and overview cards normalize to your base currency.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsForm(prev => ({
                      ...prev,
                      exchangeRates: {
                        NPR: 1.0,
                        INR: 1.6, // Standard Nepal-India currency peg
                        USD: 134.5,
                        EUR: 142.0
                      }
                    }));
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                >
                  Reset Indo-Nepal Peg (1.60)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Primary Base Currency</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CURRENCIES.map(curr => (
                    <button
                      key={curr.code}
                      type="button"
                      onClick={() => setSettingsForm(prev => ({ ...prev, defaultCurrency: curr.code as any }))}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                        settingsForm.defaultCurrency === curr.code
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs">{curr.code}</div>
                        <div className="text-[10px] text-slate-400">{curr.symbol}</div>
                      </div>
                      {settingsForm.defaultCurrency === curr.code && (
                        <Check className="w-4 h-4 text-indigo-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exchange Rates Grid */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <span className="text-xs font-bold text-slate-700 block">
                  Exchange Rates (Relative to NPR):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span>1 INR (₹) =</span>
                      <span className="text-slate-400 font-normal">NPR</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={settingsForm.exchangeRates?.INR ?? 1.6}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setSettingsForm(prev => ({
                          ...prev,
                          exchangeRates: { ...prev.exchangeRates, INR: val }
                        }));
                      }}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-bold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400">Fixed peg: 1 INR = 1.60 NPR</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span>1 USD ($) =</span>
                      <span className="text-slate-400 font-normal">NPR</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={settingsForm.exchangeRates?.USD ?? 134.5}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setSettingsForm(prev => ({
                          ...prev,
                          exchangeRates: { ...prev.exchangeRates, USD: val }
                        }));
                      }}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-bold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400">Approx. 134 - 135 NPR</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span>1 EUR (€) =</span>
                      <span className="text-slate-400 font-normal">NPR</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={settingsForm.exchangeRates?.EUR ?? 142.0}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setSettingsForm(prev => ({
                          ...prev,
                          exchangeRates: { ...prev.exchangeRates, EUR: val }
                        }));
                      }}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-bold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400">Approx. 142 - 145 NPR</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Default Companion & Split Preferences */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Default Companion & Split Preferences
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Set who and which friend group is automatically pre-selected when creating new shared expenses.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Split Behavior</label>
                  <select
                    value={settingsForm.defaultSplitMode || 'none'}
                    onChange={e => setSettingsForm(prev => ({ ...prev, defaultSplitMode: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="none">Only Me (Personal expense by default)</option>
                    <option value="50_50">50 / 50 Equal Split with Companion</option>
                    <option value="group">Split with Group / Friends</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Initial split mode opened in the new expense wizard.
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Companion Partner</label>
                  <select
                    value={settingsForm.defaultCompanion || ''}
                    onChange={e => setSettingsForm(prev => ({ ...prev, defaultCompanion: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">None (Choose per expense)</option>
                    {people.map(p => (
                      <option key={p.id} value={p.name}>
                        {p.name} {p.isDefault ? '(Default user)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Pre-populates companion when logging split expenses.
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Expense Group</label>
                  <select
                    value={settingsForm.defaultExpenseGroup || ''}
                    onChange={e => setSettingsForm(prev => ({ ...prev, defaultExpenseGroup: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">None (Choose per expense)</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.members?.length || 0} members)
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Pre-populates group & members in new expense wizard.
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Quick Defaults for Logging */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  Transaction & Date Presets
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Save time when logging daily transactions with smart presets.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Payment Method</label>
                  <select
                    value={settingsForm.defaultPaymentMethod || 'Bank / Card'}
                    onChange={e => setSettingsForm(prev => ({ ...prev, defaultPaymentMethod: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Category</label>
                  <select
                    value={settingsForm.defaultCategory || effectiveCategories[0] || 'Food & Dining'}
                    onChange={e => setSettingsForm(prev => ({ ...prev, defaultCategory: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {effectiveCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Date Pre-fill</label>
                  <select
                    value={settingsForm.defaultDateOption || 'today'}
                    onChange={e => setSettingsForm(prev => ({ ...prev, defaultDateOption: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="today">Today's Date</option>
                    <option value="yesterday">Yesterday's Date</option>
                    <option value="custom">Fixed / Custom Date</option>
                  </select>
                  {settingsForm.defaultDateOption === 'custom' && (
                    <div className="mt-2">
                      <label className="block font-semibold text-slate-600 text-[10px] mb-1">Custom Pre-fill Date</label>
                      <input
                        type="date"
                        required
                        value={settingsForm.customDefaultDate || ''}
                        onChange={e => setSettingsForm(prev => ({ ...prev, customDefaultDate: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Save Settings Action Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition disabled:opacity-60 cursor-pointer"
              >
                {isSavingSettings ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Saving Defaults...</span>
                  </>
                ) : settingsSavedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Defaults Saved!</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save System Defaults</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD / EDIT EXPENSE GROUP */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 flex-shrink-0 bg-slate-50/50">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                {groupForm.id ? 'Edit Expense Group' : 'Create Expense Group'}
              </h3>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Group Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Weekend Outing, Pokhara Roadtrip, Roommates"
                    value={groupForm.name}
                    onChange={e => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Friends on college tour or room groceries"
                    value={groupForm.description}
                    onChange={e => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Group Members Selection */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="block font-bold text-slate-700">
                    Group Members ({groupForm.members.length})
                  </label>

                  {/* Add New Member Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type person's name..."
                      value={groupForm.newMemberInput}
                      onChange={e => setGroupForm(prev => ({ ...prev, newMemberInput: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = groupForm.newMemberInput.trim();
                          if (val && !groupForm.members.includes(val)) {
                            setGroupForm(prev => ({
                              ...prev,
                              members: [...prev.members, val],
                              newMemberInput: ''
                            }));
                          }
                        }
                      }}
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = groupForm.newMemberInput.trim();
                        if (val && !groupForm.members.includes(val)) {
                          setGroupForm(prev => ({
                            ...prev,
                            members: [...prev.members, val],
                            newMemberInput: ''
                          }));
                        }
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>

                  {/* Quick toggle from existing registered people */}
                  {people.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Or click to add registered people:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {people.map(p => {
                          const isSelected = groupForm.members.includes(p.name);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setGroupForm(prev => ({
                                    ...prev,
                                    members: prev.members.filter(m => m !== p.name)
                                  }));
                                } else {
                                  setGroupForm(prev => ({
                                    ...prev,
                                    members: [...prev.members, p.name]
                                  }));
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span>{p.name}</span>
                              {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 text-slate-400" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Selected Members Chips */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Active Group Roster:</span>
                    {groupForm.members.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No members selected yet. Add at least 1 person.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {groupForm.members.map((m, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-white border border-slate-300 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                          >
                            {m}
                            <button
                              type="button"
                              onClick={() => setGroupForm(prev => ({ ...prev, members: prev.members.filter(name => name !== m) }))}
                              className="text-slate-400 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={groupForm.members.length === 0 || isSavingGroup}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingGroup ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Group...
                    </>
                  ) : (
                    'Save Group'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD / EDIT EXPENSE (RESPONSIVE, BOUNDED & SCROLLABLE WIZARD) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isExpenseModalOpen && (() => {
        const amountNum = parseFloat(expenseForm.amount) || 0;
        const selectedCurrency = expenseForm.currency || settings.defaultCurrency || 'NPR';
        const { baseAmount: totalBaseAmount, rate: exchangeRate } = convertToBase(amountNum, selectedCurrency);
        const currSymbol = getCurrencySymbol(selectedCurrency);
        const isForeignCurrency = selectedCurrency !== settings.defaultCurrency;

        // Multi-split calculations
        const activeParticipants = expenseForm.participants.filter(p => p.included && p.name.trim());
        let computedPreviewMyExpense = totalBaseAmount;
        let computedPreviewReceivable = 0;

        if (expenseForm.splitOption === 'split' && activeParticipants.length > 0) {
          if (expenseForm.splitMode === '50_50') {
            const first = activeParticipants[0];
            const halfOriginal = parseFloat((amountNum / 2).toFixed(2));
            const { baseAmount: halfBase } = convertToBase(halfOriginal, selectedCurrency);
            if (first.isSponsored) {
              computedPreviewMyExpense = totalBaseAmount;
              computedPreviewReceivable = 0;
            } else {
              computedPreviewReceivable = halfBase;
              computedPreviewMyExpense = parseFloat((totalBaseAmount - halfBase).toFixed(2));
            }
          } else if (expenseForm.splitMode === 'equal') {
            const totalPeople = 1 + activeParticipants.length;
            const shareOriginal = parseFloat((amountNum / totalPeople).toFixed(2));
            const { baseAmount: shareBase } = convertToBase(shareOriginal, selectedCurrency);
            const nonSpCount = activeParticipants.filter(p => !p.isSponsored).length;
            const spCount = activeParticipants.filter(p => p.isSponsored).length;
            computedPreviewReceivable = nonSpCount * shareBase;
            computedPreviewMyExpense = (1 + spCount) * shareBase;
          } else if (expenseForm.splitMode === '100_them') {
            const shareOriginal = parseFloat((amountNum / activeParticipants.length).toFixed(2));
            const { baseAmount: shareBase } = convertToBase(shareOriginal, selectedCurrency);
            const nonSpCount = activeParticipants.filter(p => !p.isSponsored).length;
            const spCount = activeParticipants.filter(p => p.isSponsored).length;
            computedPreviewReceivable = nonSpCount * shareBase;
            computedPreviewMyExpense = spCount * shareBase;
          } else if (expenseForm.splitMode === 'custom') {
            const nonSpCustomSum = activeParticipants
              .filter(p => !p.isSponsored)
              .reduce((sum, p) => sum + (parseFloat(p.customAmount) || 0), 0);
            const spCustomSum = activeParticipants
              .filter(p => p.isSponsored)
              .reduce((sum, p) => sum + (parseFloat(p.customAmount) || 0), 0);
            const myCustomShareNum = parseFloat(expenseForm.customMyShare) || Math.max(0, amountNum - nonSpCustomSum - spCustomSum);

            const { baseAmount: recBase } = convertToBase(nonSpCustomSum, selectedCurrency);
            const { baseAmount: myBase } = convertToBase(myCustomShareNum + spCustomSum, selectedCurrency);
            computedPreviewReceivable = recBase;
            computedPreviewMyExpense = myBase;
          }
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
              {/* Header: Fixed */}
              <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 flex-shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      {expenseForm.id ? 'Edit Expense' : 'Log New Expense'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Multi-currency entries with smart group & companion split support
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body: Scrollable */}
              <form onSubmit={handleSaveExpense} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                  {/* Amount & Currency Selector */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-slate-800">
                        Amount Paid ({currSymbol})
                      </label>
                      {/* Currency Selector Buttons */}
                      <div className="flex rounded-lg p-0.5 bg-slate-100 border border-slate-200 text-[11px]">
                        {CURRENCIES.map(c => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => setExpenseForm(prev => ({ ...prev, currency: c.code }))}
                            className={`px-2 py-0.5 rounded-md font-bold transition ${
                              selectedCurrency === c.code
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {c.code}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-lg">
                        {currSymbol}
                      </span>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="0.00"
                        value={expenseForm.amount}
                        onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Live Currency Conversion Pill */}
                    {isForeignCurrency && amountNum > 0 && (
                      <div className="p-2 bg-indigo-50/80 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 flex items-center justify-between">
                        <span>Converted to Base ({settings.defaultCurrency}):</span>
                        <span className="font-bold">
                          ≈ {getCurrencySymbol(settings.defaultCurrency)} {totalBaseAmount.toLocaleString()} {settings.defaultCurrency} (@ 1 {selectedCurrency} = {exchangeRate} {settings.defaultCurrency})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Description / Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Lunch at Cafe, Fuel, Grocery store, Outing tickets"
                      value={expenseForm.description}
                      onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Category & Expense Set */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-slate-700">Category</label>
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryForm({ id: '', name: '', color: '#6366f1' });
                            setIsCategoryModalOpen(true);
                          }}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" /> New
                        </button>
                      </div>
                      <select
                        value={expenseForm.category}
                        onChange={e => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        {effectiveCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Expense Set / Trip</label>
                      <select
                        value={expenseForm.expenseSetId}
                        onChange={e => setExpenseForm(prev => ({ ...prev, expenseSetId: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="">None (Standalone)</option>
                        {expenseSets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Payment Method & Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                      <select
                        value={expenseForm.paymentMethod}
                        onChange={e => setExpenseForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-slate-700">Date</label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setExpenseForm(prev => ({ ...prev, date: new Date().toISOString().slice(0, 10) }))}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                          >
                            Today
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const y = new Date();
                              y.setDate(y.getDate() - 1);
                              setExpenseForm(prev => ({ ...prev, date: y.toISOString().slice(0, 10) }));
                            }}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                          >
                            Yesterday
                          </button>
                          {settings.customDefaultDate && (
                            <button
                              type="button"
                              onClick={() => setExpenseForm(prev => ({ ...prev, date: settings.customDefaultDate! }))}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                              title={`Set to configured default date: ${settings.customDefaultDate}`}
                            >
                              Default ({settings.customDefaultDate})
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="date"
                        required
                        value={expenseForm.date}
                        onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* ───────────────────────────────────────────────────────────── */}
                  {/* SPLIT WITH FRIENDS, GROUPS & SPONSOR SECTION */}
                  {/* ───────────────────────────────────────────────────────────── */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
                    <div className="font-bold text-slate-800 flex items-center justify-between flex-wrap gap-2">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-indigo-600" />
                        Split with Friends / Group
                      </span>
                      <div className="flex rounded-lg p-0.5 bg-slate-200/70 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setExpenseForm(prev => ({ ...prev, splitOption: 'none' }))}
                          className={`px-2 py-0.5 rounded font-bold transition ${
                            expenseForm.splitOption === 'none' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                          }`}
                        >
                          Only Me
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            let initParts = expenseForm.participants;
                            if (initParts.length === 0) {
                              const defP = settings.defaultCompanion || people.find(p => p.isDefault)?.name || (people[0]?.name || '');
                              if (defP) {
                                initParts = [{ name: defP, included: true, isSponsored: false, customAmount: '' }];
                              }
                            }
                            setExpenseForm(prev => ({
                              ...prev,
                              splitOption: 'split',
                              participants: initParts
                            }));
                          }}
                          className={`px-2 py-0.5 rounded font-bold transition ${
                            expenseForm.splitOption === 'split' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
                          }`}
                        >
                          Split with Friends / Group
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const defP = settings.defaultCompanion || people.find(p => p.isDefault)?.name || (people[0]?.name || '');
                            setExpenseForm(prev => ({
                              ...prev,
                              splitOption: 'paid_by_other',
                              paidByPersonName: prev.paidByPersonName || defP
                            }));
                          }}
                          className={`px-2 py-0.5 rounded font-bold transition ${
                            expenseForm.splitOption === 'paid_by_other' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-600'
                          }`}
                        >
                          Paid for Me
                        </button>
                      </div>
                    </div>

                    {/* Active Split Details */}
                    {expenseForm.splitOption === 'split' && (
                      <div className="space-y-3 pt-1 border-t border-slate-200/80">
                        {/* Expense Group Dropdown & Selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Expense Group (Optional)
                            </label>
                            <select
                              value={expenseForm.groupId}
                              onChange={e => {
                                const gId = e.target.value;
                                if (!gId) {
                                  setExpenseForm(prev => ({ ...prev, groupId: '' }));
                                } else {
                                  const matched = groups.find(g => g.id === gId);
                                  if (matched) {
                                    const newParts = matched.members.map(m => ({
                                      name: m,
                                      included: true,
                                      isSponsored: false,
                                      customAmount: ''
                                    }));
                                    setExpenseForm(prev => ({
                                      ...prev,
                                      groupId: gId,
                                      participants: newParts
                                    }));
                                  }
                                }
                              }}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                            >
                              <option value="">None (Custom Friends)</option>
                              {groups.map(g => (
                                <option key={g.id} value={g.id}>
                                  Group: {g.name} ({g.members?.length || 0} members)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Split Ratio / Mode
                            </label>
                            <div className="grid grid-cols-3 gap-1">
                              {[
                                { key: 'equal', label: 'Equal Split' },
                                { key: 'custom', label: 'Custom Shares' },
                                { key: '100_them', label: '100% Them' }
                              ].map(m => (
                                <button
                                  key={m.key}
                                  type="button"
                                  onClick={() => setExpenseForm(prev => ({ ...prev, splitMode: m.key as any }))}
                                  className={`py-1.5 px-1.5 rounded-lg font-bold border transition text-[10px] text-center ${
                                    expenseForm.splitMode === m.key
                                      ? 'bg-indigo-600 text-white border-indigo-600'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Participants Checklist */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700">
                              Participants & Sponsoring ({activeParticipants.length} active of {expenseForm.participants.length}):
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Deselect to exclude; click Gift to sponsor/treat
                            </span>
                          </div>

                          {/* Participants List */}
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {expenseForm.participants.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic bg-white p-2.5 rounded-xl border border-slate-200">
                                No companions added yet. Add friends below or choose a group above.
                              </p>
                            ) : (
                              expenseForm.participants.map((p, idx) => (
                                <div
                                  key={idx}
                                  className={`p-2.5 rounded-xl border transition flex items-center justify-between gap-2 ${
                                    !p.included
                                      ? 'bg-slate-100/60 border-slate-200 opacity-60'
                                      : p.isSponsored
                                      ? 'bg-purple-50/70 border-purple-200'
                                      : 'bg-white border-slate-200'
                                  }`}
                                >
                                  {/* Left: Included checkbox & Name */}
                                  <div className="flex items-center gap-2 min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpenseForm(prev => ({
                                          ...prev,
                                          participants: prev.participants.map((item, i) =>
                                            i === idx ? { ...item, included: !item.included } : item
                                          )
                                        }));
                                      }}
                                      className="text-slate-500 hover:text-indigo-600"
                                      title={p.included ? 'Exclude from this bill' : 'Include in this bill'}
                                    >
                                      {p.included ? (
                                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                                      ) : (
                                        <Square className="w-4 h-4 text-slate-300" />
                                      )}
                                    </button>
                                    <div className="min-w-0">
                                      <span className={`font-bold text-xs truncate block ${p.included ? 'text-slate-900' : 'line-through text-slate-400'}`}>
                                        {p.name}
                                      </span>
                                      {!p.included && (
                                        <span className="text-[9px] text-slate-400">Excluded (₹0)</span>
                                      )}
                                      {p.included && p.isSponsored && (
                                        <span className="text-[9px] font-bold text-purple-700 flex items-center gap-0.5">
                                          <Gift className="w-2.5 h-2.5" /> Sponsored by You
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right: Sponsor Toggle, Custom Input & Delete */}
                                  {p.included && (
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {/* Sponsor / Treat Toggle Button */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setExpenseForm(prev => ({
                                            ...prev,
                                            participants: prev.participants.map((item, i) =>
                                              i === idx ? { ...item, isSponsored: !item.isSponsored } : item
                                            )
                                          }));
                                        }}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition ${
                                          p.isSponsored
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-purple-50 hover:text-purple-700'
                                        }`}
                                        title={p.isSponsored ? 'Cancel sponsor (friend owes their share)' : 'Sponsor this friend (you treat them, 0 debt created)'}
                                      >
                                        <Gift className="w-3 h-3" />
                                        {p.isSponsored ? 'Treated' : 'Sponsor'}
                                      </button>

                                      {/* Custom Amount Input */}
                                      {expenseForm.splitMode === 'custom' && (
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] font-bold text-slate-400">{currSymbol}</span>
                                          <input
                                            type="number"
                                            step="any"
                                            placeholder="0.00"
                                            value={p.customAmount}
                                            onChange={e => {
                                              const val = e.target.value;
                                              setExpenseForm(prev => ({
                                                ...prev,
                                                participants: prev.participants.map((item, i) =>
                                                  i === idx ? { ...item, customAmount: val } : item
                                                )
                                              }));
                                            }}
                                            className="w-16 px-1.5 py-1 border border-slate-200 rounded-lg text-right font-bold text-xs"
                                          />
                                        </div>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setExpenseForm(prev => ({
                                            ...prev,
                                            participants: prev.participants.filter((_, i) => i !== idx)
                                          }));
                                        }}
                                        className="text-slate-300 hover:text-red-500 p-0.5"
                                        title="Remove from list"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          {/* Quick Add Companion Row */}
                          <div className="flex gap-1.5 pt-1">
                            <select
                              value=""
                              onChange={e => {
                                const val = e.target.value;
                                if (val && !expenseForm.participants.some(p => p.name.toLowerCase() === val.toLowerCase())) {
                                  setExpenseForm(prev => ({
                                    ...prev,
                                    participants: [...prev.participants, { name: val, included: true, isSponsored: false, customAmount: '' }]
                                  }));
                                }
                              }}
                              className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white text-xs"
                            >
                              <option value="">+ Pick from registered people...</option>
                              {people
                                .filter(p => !expenseForm.participants.some(item => item.name.toLowerCase() === p.name.toLowerCase()))
                                .map(p => (
                                  <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                            </select>

                            <input
                              type="text"
                              placeholder="Or type new name"
                              value={expenseForm.newParticipantInput}
                              onChange={e => setExpenseForm(prev => ({ ...prev, newParticipantInput: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const name = expenseForm.newParticipantInput.trim();
                                  if (name && !expenseForm.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
                                    setExpenseForm(prev => ({
                                      ...prev,
                                      participants: [...prev.participants, { name, included: true, isSponsored: false, customAmount: '' }],
                                      newParticipantInput: ''
                                    }));
                                  }
                                }
                              }}
                              className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const name = expenseForm.newParticipantInput.trim();
                                if (name && !expenseForm.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
                                  setExpenseForm(prev => ({
                                    ...prev,
                                    participants: [...prev.participants, { name, included: true, isSponsored: false, customAmount: '' }],
                                    newParticipantInput: ''
                                  }));
                                }
                              }}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {/* Custom Mode Balance Bar */}
                        {expenseForm.splitMode === 'custom' && (
                          <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-700">Your Share ({currSymbol}):</span>
                              <input
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={expenseForm.customMyShare}
                                onChange={e => setExpenseForm(prev => ({ ...prev, customMyShare: e.target.value }))}
                                className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-right font-bold text-xs"
                              />
                            </div>
                            {(() => {
                              const activeSum = activeParticipants.reduce((sum, p) => sum + (parseFloat(p.customAmount) || 0), 0);
                              const myShare = parseFloat(expenseForm.customMyShare) || 0;
                              const diff = parseFloat((amountNum - (activeSum + myShare)).toFixed(2));
                              return (
                                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                                  <span>Allocated: {currSymbol} {(activeSum + myShare).toFixed(2)} of {currSymbol} {amountNum.toFixed(2)}</span>
                                  {Math.abs(diff) > 0.01 ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpenseForm(prev => ({
                                          ...prev,
                                          customMyShare: Math.max(0, (amountNum - activeSum)).toFixed(2)
                                        }));
                                      }}
                                      className="text-amber-700 font-bold hover:underline"
                                    >
                                      Balance {currSymbol} {diff.toFixed(2)} to Me
                                    </button>
                                  ) : (
                                    <span className="text-emerald-700 font-bold">✓ Perfectly Balanced</span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Live Calculated Ledger Breakdown */}
                        {amountNum > 0 && activeParticipants.length > 0 && (
                          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-950 space-y-1">
                            <div className="font-bold flex items-center justify-between border-b border-indigo-100 pb-1">
                              <span>Ledger Summary:</span>
                              <span>Total Bill: {currSymbol} {amountNum.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                              <span>Your Net Out-of-Pocket Expense:</span>
                              <span className="font-black text-indigo-900">
                                {currSymbol} {computedPreviewMyExpense.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between font-semibold text-emerald-800">
                              <span>Total Auto-Lent to Friends (Receivable):</span>
                              <span className="font-black">
                                + {currSymbol} {computedPreviewReceivable.toLocaleString()}
                              </span>
                            </div>
                            {activeParticipants.some(p => p.isSponsored) && (
                              <div className="text-[10px] text-purple-700 font-medium pt-0.5">
                                🎁 Sponsoring {activeParticipants.filter(p => p.isSponsored).map(p => p.name).join(', ')} (no debt recorded for them).
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Paid By Someone Else */}
                    {expenseForm.splitOption === 'paid_by_other' && (
                      <div className="space-y-2 pt-1 border-t border-slate-200/60">
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">Who paid for you?</label>
                          <div className="flex gap-2">
                            <select
                              value={expenseForm.paidByPersonName}
                              onChange={e => setExpenseForm(prev => ({ ...prev, paidByPersonName: e.target.value }))}
                              className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                            >
                              <option value="">Select person...</option>
                              {people.map(p => (
                                <option key={p.id} value={p.name}>
                                  {p.name} {p.isDefault ? '(Default)' : ''}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Or type name"
                              value={expenseForm.paidByPersonName}
                              onChange={e => setExpenseForm(prev => ({ ...prev, paidByPersonName: e.target.value }))}
                              className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                            />
                          </div>
                        </div>
                        {amountNum > 0 && expenseForm.paidByPersonName && (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                            Logs {currSymbol} {amountNum.toLocaleString()} as your expense, and creates {currSymbol} {amountNum.toLocaleString()} debt payable to {expenseForm.paidByPersonName}.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rotation check */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={expenseForm.isRotation}
                        onChange={e => setExpenseForm(prev => ({ ...prev, isRotation: e.target.checked }))}
                        className="rounded text-indigo-600 focus:ring-0"
                      />
                      <span className="font-bold text-slate-800">Rotation / Dummy Transaction</span>
                    </label>
                    {expenseForm.isRotation && (
                      <input
                        type="text"
                        placeholder="Note: e.g. Took cash from X, paid via bank"
                        value={expenseForm.rotationNote}
                        onChange={e => setExpenseForm(prev => ({ ...prev, rotationNote: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                      />
                    )}
                  </div>
                </div>

                {/* Footer: Fixed & Sticky */}
                <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50 flex items-center justify-between gap-2 flex-shrink-0">
                  <div className="text-[11px] text-slate-500 font-bold truncate">
                    {amountNum > 0 ? (
                      <span>Net Out-of-Pocket: <span className="text-slate-900 font-black">{currSymbol} {computedPreviewMyExpense.toLocaleString()}</span></span>
                    ) : (
                      <span>Enter expense amount</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsExpenseModalOpen(false)}
                      className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingExpense}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {isSavingExpense ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving Expense...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          {expenseForm.id ? 'Update Expense' : 'Save Expense'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CREATE EXPENSE SET */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isSetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 flex-shrink-0 bg-slate-50/50">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                {setForm.id ? 'Edit Expense Set / Trip Bucket' : 'Create Expense Set / Trip Bucket'}
              </h3>
              <button onClick={() => setIsSetModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSet} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Set Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Trip to Pokhara, Weekend Outing Oct 25"
                    value={setForm.name}
                    onChange={e => setSetForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Travel, Entertainment, Outing"
                      value={setForm.category}
                      onChange={e => setSetForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Budget (Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g. 15000"
                      value={setForm.budget}
                      onChange={e => setSetForm(prev => ({ ...prev, budget: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-700">Start Date</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSetForm(prev => ({ ...prev, startDate: new Date().toISOString().slice(0, 10) }))}
                          className="text-[9px] font-bold px-1 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                        >
                          Today
                        </button>
                        {settings.customDefaultDate && (
                          <button
                            type="button"
                            onClick={() => setSetForm(prev => ({ ...prev, startDate: settings.customDefaultDate! }))}
                            className="text-[9px] font-bold px-1 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                            title={`Set default date: ${settings.customDefaultDate}`}
                          >
                            Default
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="date"
                      required
                      value={setForm.startDate}
                      onChange={e => setSetForm(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={setForm.endDate}
                      onChange={e => setSetForm(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Notes / Objectives</label>
                  <textarea
                    rows={2}
                    placeholder="Notes about this trip or budget goals..."
                    value={setForm.notes}
                    onChange={e => setSetForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSetModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSet}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSavingSet ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {setForm.id ? 'Updating Set...' : 'Creating Set...'}
                    </>
                  ) : (
                    setForm.id ? 'Update Set' : 'Create Set'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: LOG MONEY LENT */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isLendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 flex-shrink-0 bg-slate-50/50">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                {lendForm.id ? 'Edit Money Given (Lend)' : 'Log Money Given (Lend)'}
              </h3>
              <button onClick={() => setIsLendModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLend} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Borrower Person (Who took?)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setPersonForm({ id: '', name: '', contact: '', email: '', isDefault: false, notes: '' });
                        setIsPersonModalOpen(true);
                      }}
                      className="text-[10px] text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> New Person
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={people.some(p => p.name.toLowerCase() === lendForm.personName.toLowerCase()) ? people.find(p => p.name.toLowerCase() === lendForm.personName.toLowerCase())?.name : ''}
                      onChange={e => {
                        const val = e.target.value;
                        const matched = people.find(p => p.name === val);
                        setLendForm(prev => ({
                          ...prev,
                          personName: val,
                          contact: matched?.contact || prev.contact
                        }));
                      }}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="">Select registered person...</option>
                      {people.map(p => (
                        <option key={p.id} value={p.name}>
                          {p.name} {p.isDefault ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      placeholder="Or type name"
                      value={lendForm.personName}
                      onChange={e => setLendForm(prev => ({ ...prev, personName: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Currency selector */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Currency</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {CURRENCIES.map(c => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setLendForm(prev => ({ ...prev, currency: c.code }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                          lendForm.currency === c.code
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {c.code} ({c.symbol})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Amount ({getCurrencySymbol(lendForm.currency)})
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      value={lendForm.amount}
                      onChange={e => setLendForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                    {lendForm.currency !== (settings.defaultCurrency || 'NPR') && lendForm.amount && !isNaN(parseFloat(lendForm.amount)) && (
                      <p className="text-[10px] text-emerald-700 font-semibold mt-1">
                        ≈ {getCurrencySymbol(settings.defaultCurrency)} {convertToBase(parseFloat(lendForm.amount), lendForm.currency).baseAmount.toLocaleString()} in {settings.defaultCurrency || 'NPR'}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-700">Lent Date</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setLendForm(prev => ({ ...prev, lentDate: new Date().toISOString().slice(0, 10) }))}
                          className="text-[9px] font-bold px-1 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                        >
                          Today
                        </button>
                        {settings.customDefaultDate && (
                          <button
                            type="button"
                            onClick={() => setLendForm(prev => ({ ...prev, lentDate: settings.customDefaultDate! }))}
                            className="text-[9px] font-bold px-1 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                            title={`Set default date: ${settings.customDefaultDate}`}
                          >
                            Default
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="date"
                      required
                      value={lendForm.lentDate}
                      onChange={e => setLendForm(prev => ({ ...prev, lentDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expected Return Date</label>
                  <input
                    type="date"
                    value={lendForm.expectedReturnDate}
                    onChange={e => setLendForm(prev => ({ ...prev, expectedReturnDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="checkbox"
                    checked={lendForm.isRotation}
                    onChange={e => setLendForm(prev => ({ ...prev, isRotation: e.target.checked }))}
                    className="rounded text-emerald-600 focus:ring-0"
                  />
                  <span className="font-bold text-slate-700">Temporary rotation lend (few hours to 1 day)</span>
                </label>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Notes</label>
                  <input
                    type="text"
                    placeholder="Purpose or conditions..."
                    value={lendForm.notes}
                    onChange={e => setLendForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsLendModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingLend}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSavingLend ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {lendForm.id ? 'Updating Record...' : 'Saving Record...'}
                    </>
                  ) : (
                    lendForm.id ? 'Update Lend Record' : 'Save Lend Record'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: LOG MONEY BORROWED */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isBorrowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 flex-shrink-0 bg-slate-50/50">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-amber-600" />
                {borrowForm.id ? 'Edit Money Taken (Borrow)' : 'Log Money Taken (Borrow)'}
              </h3>
              <button onClick={() => setIsBorrowModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBorrow} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Lender Person (Who gave?)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setPersonForm({ id: '', name: '', contact: '', email: '', isDefault: false, notes: '' });
                        setIsPersonModalOpen(true);
                      }}
                      className="text-[10px] text-amber-600 hover:text-amber-800 font-bold flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> New Person
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={people.some(p => p.name.toLowerCase() === borrowForm.personName.toLowerCase()) ? people.find(p => p.name.toLowerCase() === borrowForm.personName.toLowerCase())?.name : ''}
                      onChange={e => {
                        const val = e.target.value;
                        const matched = people.find(p => p.name === val);
                        setBorrowForm(prev => ({
                          ...prev,
                          personName: val,
                          contact: matched?.contact || prev.contact
                        }));
                      }}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    >
                      <option value="">Select registered person...</option>
                      {people.map(p => (
                        <option key={p.id} value={p.name}>
                          {p.name} {p.isDefault ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      placeholder="Or type name"
                      value={borrowForm.personName}
                      onChange={e => setBorrowForm(prev => ({ ...prev, personName: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Currency selector */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Currency</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {CURRENCIES.map(c => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setBorrowForm(prev => ({ ...prev, currency: c.code }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                          borrowForm.currency === c.code
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {c.code} ({c.symbol})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Amount ({getCurrencySymbol(borrowForm.currency)})
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      value={borrowForm.amount}
                      onChange={e => setBorrowForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                    />
                    {borrowForm.currency !== (settings.defaultCurrency || 'NPR') && borrowForm.amount && !isNaN(parseFloat(borrowForm.amount)) && (
                      <p className="text-[10px] text-amber-700 font-semibold mt-1">
                        ≈ {getCurrencySymbol(settings.defaultCurrency)} {convertToBase(parseFloat(borrowForm.amount), borrowForm.currency).baseAmount.toLocaleString()} in {settings.defaultCurrency || 'NPR'}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-700">Borrowed Date</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setBorrowForm(prev => ({ ...prev, borrowedDate: new Date().toISOString().slice(0, 10) }))}
                          className="text-[9px] font-bold px-1 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                        >
                          Today
                        </button>
                        {settings.customDefaultDate && (
                          <button
                            type="button"
                            onClick={() => setBorrowForm(prev => ({ ...prev, borrowedDate: settings.customDefaultDate! }))}
                            className="text-[9px] font-bold px-1 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                            title={`Set default date: ${settings.customDefaultDate}`}
                          >
                            Default
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="date"
                      required
                      value={borrowForm.borrowedDate}
                      onChange={e => setBorrowForm(prev => ({ ...prev, borrowedDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expected Return Date</label>
                  <input
                    type="date"
                    value={borrowForm.expectedReturnDate}
                    onChange={e => setBorrowForm(prev => ({ ...prev, expectedReturnDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="checkbox"
                    checked={borrowForm.isRotation}
                    onChange={e => setBorrowForm(prev => ({ ...prev, isRotation: e.target.checked }))}
                    className="rounded text-amber-600 focus:ring-0"
                  />
                  <span className="font-bold text-slate-700">Temporary rotation borrow (few hours to 1 day)</span>
                </label>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Notes</label>
                  <input
                    type="text"
                    placeholder="Notes..."
                    value={borrowForm.notes}
                    onChange={e => setBorrowForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsBorrowModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBorrow}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md shadow-amber-600/20 transition flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSavingBorrow ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {borrowForm.id ? 'Updating Record...' : 'Saving Record...'}
                    </>
                  ) : (
                    borrowForm.id ? 'Update Borrow Record' : 'Save Borrow Record'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: RECORD REPAYMENT */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {repayTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 flex-shrink-0 bg-slate-50/50">
              <h3 className="font-black text-slate-900 text-base">
                {repayTarget.type === 'lend' ? 'Record Money Returned' : 'Record Payment Made'}
              </h3>
              <button onClick={() => setRepayTarget(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordRepayment} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 text-xs">
                <p className="text-slate-600">
                  {repayTarget.type === 'lend'
                    ? `Enter the amount returned by ${repayTarget.item.personName}:`
                    : `Enter the amount paid back to ${repayTarget.item.personName}:`}
                </p>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Repayment Amount ({getCurrencySymbol(repayTarget.item.currency)})
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={repayAmount}
                    onChange={e => setRepayAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Paid via eSewa, cash handed over"
                    value={repayNotes}
                    onChange={e => setRepayNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setRepayTarget(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRepay}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSavingRepay ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    'Confirm Repayment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD / EDIT PERSON */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isPersonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 flex-shrink-0 bg-slate-50/50">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                {personForm.id ? 'Edit Companion' : 'Add Person / Companion'}
              </h3>
              <button onClick={() => setIsPersonModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePerson} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ram, Alex, Roommate"
                    value={personForm.name}
                    onChange={e => setPersonForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact (Phone / UPI ID)</label>
                  <input
                    type="text"
                    placeholder="e.g. 9800000000 or ram@upi"
                    value={personForm.contact}
                    onChange={e => setPersonForm(prev => ({ ...prev, contact: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address (for Settlement Reminders)</label>
                  <input
                    type="email"
                    placeholder="e.g. sahil@gmail.com"
                    value={personForm.email}
                    onChange={e => setPersonForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Used to send formal settlement breakdown & trip reminder emails</p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="checkbox"
                    checked={personForm.isDefault}
                    onChange={e => setPersonForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-slate-800">Set as default companion</span>
                    <p className="text-[10px] text-slate-500">Auto-selects this person when splitting new expenses or bank SMS.</p>
                  </div>
                </label>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Notes / Relation</label>
                  <input
                    type="text"
                    placeholder="e.g. Roommate, Colleague at Work, Trip buddy"
                    value={personForm.notes}
                    onChange={e => setPersonForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPersonModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPerson}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSavingPerson ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Person...
                    </>
                  ) : (
                    'Save Person'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: RECONCILE / SPLIT BANK SMS BACKLOG */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {reconcileTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 flex-shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Reconcile Bank SMS</h3>
                  <p className="text-[10px] text-slate-500">Log this bank transaction or split with a friend</p>
                </div>
              </div>
              <button onClick={() => setReconcileTarget(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReconcileBacklog} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 text-xs">
                {/* SMS Details Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        reconcileTarget.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {reconcileTarget.type}
                      </span>
                      <span className="font-bold text-slate-800">{reconcileTarget.bank || 'City Union Bank'}</span>
                    </div>
                    <div className="text-base font-black text-slate-900">
                      {formatMoney(reconcileTarget.amount)}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>Date: <span className="font-semibold text-slate-700">{reconcileTarget.date}</span></span>
                    {reconcileTarget.account && <span>A/C: <span className="font-semibold text-slate-700">{reconcileTarget.account}</span></span>}
                    {reconcileTarget.upiRef && <span className="font-mono text-[10px]">UPI Ref: {reconcileTarget.upiRef}</span>}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expense Description</label>
                  <input
                    type="text"
                    required
                    value={reconcileForm.description}
                    onChange={e => setReconcileForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={reconcileForm.category}
                      onChange={e => setReconcileForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                    >
                      {effectiveCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Expense Set / Trip</label>
                    <select
                      value={reconcileForm.expenseSetId}
                      onChange={e => setReconcileForm(prev => ({ ...prev, expenseSetId: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                    >
                      <option value="">None (Standalone)</option>
                      {expenseSets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Split Mode Selector */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Who was this expense for?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
                    {[
                      { key: 'none', label: '100% Mine' },
                      { key: '50_50', label: '50/50 Split' },
                      { key: '100_them', label: '100% Friend' },
                      { key: 'custom', label: 'Custom' }
                    ].map(m => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setReconcileForm(prev => ({ ...prev, splitMode: m.key as any }))}
                        className={`py-1.5 px-2 rounded-xl font-bold border transition text-[11px] ${
                          reconcileForm.splitMode === m.key
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Split companion and fields */}
                {reconcileForm.splitMode !== 'none' && (
                  <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2.5">
                    <div>
                      <label className="block font-bold text-indigo-950 mb-1">Companion / Friend</label>
                      <div className="flex gap-2">
                        <select
                          value={reconcileForm.splitPersonName}
                          onChange={e => setReconcileForm(prev => ({ ...prev, splitPersonName: e.target.value }))}
                          className="flex-1 px-2.5 py-1.5 border border-indigo-200 rounded-lg bg-white"
                        >
                          <option value="">Select companion...</option>
                          {people.map(p => (
                            <option key={p.id} value={p.name}>
                              {p.name} {p.isDefault ? '(Default)' : ''}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Or new name"
                          value={reconcileForm.splitPersonName}
                          onChange={e => setReconcileForm(prev => ({ ...prev, splitPersonName: e.target.value }))}
                          className="flex-1 px-2.5 py-1.5 border border-indigo-200 rounded-lg bg-white"
                        />
                      </div>
                    </div>

                    {reconcileForm.splitMode === 'custom' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Your Share ({viewCurrency})</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={reconcileForm.customMyAmount}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setReconcileForm(prev => ({
                                ...prev,
                                customMyAmount: e.target.value,
                                customTheirAmount: Math.max(0, reconcileTarget.amount - val).toFixed(2)
                              }));
                            }}
                            className="w-full px-2.5 py-1.5 border border-indigo-200 rounded-lg bg-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Friend's Share ({viewCurrency})</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={reconcileForm.customTheirAmount}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setReconcileForm(prev => ({
                                ...prev,
                                customTheirAmount: e.target.value,
                                customMyAmount: Math.max(0, reconcileTarget.amount - val).toFixed(2)
                              }));
                            }}
                            className="w-full px-2.5 py-1.5 border border-indigo-200 rounded-lg bg-white font-bold"
                          />
                        </div>
                      </div>
                    )}

                    {/* Live impact breakdown */}
                    <div className="p-2 bg-white border border-indigo-200 rounded-lg text-[11px] space-y-0.5">
                      <div className="flex justify-between text-slate-700">
                        <span>Your personal expense:</span>
                        <span className="font-black">
                          {reconcileForm.splitMode === '100_them'
                            ? formatMoney(0)
                            : reconcileForm.splitMode === '50_50'
                            ? formatMoney(reconcileTarget.amount / 2)
                            : formatMoney(parseFloat(reconcileForm.customMyAmount) || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>Added to {reconcileForm.splitPersonName || 'Friend'}'s ledger (Lend):</span>
                        <span className="font-black">
                          {reconcileForm.splitMode === '100_them'
                            ? formatMoney(reconcileTarget.amount)
                            : reconcileForm.splitMode === '50_50'
                            ? formatMoney(reconcileTarget.amount / 2)
                            : formatMoney(parseFloat(reconcileForm.customTheirAmount) || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50 flex items-center justify-between gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleIgnoreBacklog(reconcileTarget.id)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition flex items-center gap-1.5"
                  title="Mark as cash rotation / pass-through and ignore"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Rotated Money (Pass)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReconcileTarget(null)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingReconcile}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isSavingReconcile ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Reconciling...
                      </>
                    ) : (
                      'Save & Reconcile'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD / EDIT CATEGORY */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 flex-shrink-0 bg-slate-50/50">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                {categoryForm.id ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Subscriptions, Gym & Fitness, Tech Gadgets"
                    value={categoryForm.name}
                    onChange={e => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Color Accent</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      '#6366f1', '#10b981', '#f59e0b', '#ef4444',
                      '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6',
                      '#3b82f6', '#f97316', '#64748b'
                    ].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCategoryForm(prev => ({ ...prev, color }))}
                        className={`w-6 h-6 rounded-full transition transform ${
                          categoryForm.color === color ? 'scale-125 ring-2 ring-offset-2 ring-indigo-500' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <input
                      type="color"
                      value={categoryForm.color}
                      onChange={e => setCategoryForm(prev => ({ ...prev, color: e.target.value }))}
                      className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                      title="Custom Color"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSavingCategory ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Category...
                    </>
                  ) : (
                    'Save Category'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: COMPREHENSIVE PERSON LEDGER DETAILS */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {selectedPersonLedger && (() => {
        const p = selectedPersonLedger;
        const normName = p.name.toLowerCase();
        const pLends = lends.filter(l => l.personName.toLowerCase() === normName);
        const pBorrows = borrows.filter(b => b.personName.toLowerCase() === normName);
        const pSplits = expenses.flatMap(e => {
          if (e.splits && e.splits.length > 0) {
            return e.splits
              .filter(s => (s.personName || '').trim().toLowerCase() === normName && !s.isSponsored)
              .map(s => ({
                id: `${e.id}-${s.personName}`,
                description: e.description,
                date: e.date,
                category: e.category,
                amount: e.amount,
                splitAmount: s.amount
              }));
          } else if ((e.splitPersonName || '').toLowerCase() === normName) {
            return [{
              id: e.id,
              description: e.description,
              date: e.date,
              category: e.category,
              amount: e.amount,
              splitAmount: e.splitAmount || 0
            }];
          }
          return [];
        });
        const pPaidForMe = expenses.filter(e => (e.paidByPersonName || '').toLowerCase() === normName);

        // Find all sponsored items for this person (absorbed by user as treat/gift, 0 debt to return)
        const pSponsored = expenses.flatMap(e => {
          const matchingSplits = (e.splits || []).filter(s =>
            (s.personName || '').trim().toLowerCase() === normName && s.isSponsored
          );
          return matchingSplits.map(s => ({
            expenseId: e.id,
            expenseDescription: e.description,
            date: e.date,
            category: e.category,
            amount: s.amount,
            currency: e.currency,
            originalAmount: s.originalAmount
          }));
        });
        const totalSponsored = pSponsored.reduce((sum, item) => sum + (item.amount || 0), 0);

        const totalLent = pLends.reduce((s, l) => s + (l.amount || 0), 0);
        const totalLentRepaid = pLends.reduce((s, l) => s + (l.repayments || []).reduce((rSum, r) => rSum + (r.amount || 0), 0), 0);
        const outstandingLent = Math.max(0, totalLent - totalLentRepaid);

        const totalBorrowed = pBorrows.reduce((s, b) => s + (b.amount || 0), 0);
        const totalBorrowedRepaid = pBorrows.reduce((s, b) => s + (b.repayments || []).reduce((rSum, r) => rSum + (r.amount || 0), 0), 0);
        const outstandingBorrowed = Math.max(0, totalBorrowed - totalBorrowedRepaid);

        const totalSplitForThem = pSplits.reduce((s, e) => s + (e.splitAmount || 0), 0);
        const totalPaidByThem = pPaidForMe.reduce((s, e) => s + (e.amount || 0), 0);

        const netLedger = (outstandingLent + totalSplitForThem) - (outstandingBorrowed + totalPaidByThem);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 flex-shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                      {p.name}
                      {p.isDefault && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-indigo-100 text-indigo-700">
                          Default
                        </span>
                      )}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
                      {p.contact && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> {p.contact}
                        </p>
                      )}
                      {p.email && (
                        <p className="text-[11px] text-indigo-600 flex items-center gap-1 font-medium">
                          <Mail className="w-3 h-3" /> {p.email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {netLedger > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenPersonReminder(p)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                      title="Send email settlement breakdown to this person"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Send Reminder</span>
                    </button>
                  )}
                  <button onClick={() => setSelectedPersonLedger(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                {/* Ledger Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                    <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Owed To You</div>
                    <div className="text-base font-black text-emerald-700 mt-0.5">
                      {formatMoney(outstandingLent + totalSplitForThem)}
                    </div>
                    <div className="text-[9px] text-emerald-600 mt-0.5">
                      Lent: {formatMoney(outstandingLent)} • Splits: {formatMoney(totalSplitForThem)}
                    </div>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                    <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">You Owe</div>
                    <div className="text-base font-black text-amber-700 mt-0.5">
                      {formatMoney(outstandingBorrowed + totalPaidByThem)}
                    </div>
                    <div className="text-[9px] text-amber-600 mt-0.5">
                      Borrow: {formatMoney(outstandingBorrowed)} • Paid: {formatMoney(totalPaidByThem)}
                    </div>
                  </div>

                  <div className={`border rounded-xl p-3 ${
                    netLedger > 0 ? 'bg-emerald-100/50 border-emerald-300' : netLedger < 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Net Position</div>
                    <div className={`text-base font-black mt-0.5 ${
                      netLedger > 0 ? 'text-emerald-700' : netLedger < 0 ? 'text-rose-600' : 'text-slate-700'
                    }`}>
                      {netLedger > 0 ? `+ ${formatMoney(netLedger)}` : netLedger < 0 ? `- ${formatMoney(Math.abs(netLedger))}` : formatMoney(0)}
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">
                      {netLedger > 0 ? `${p.name} owes you` : netLedger < 0 ? `You owe ${p.name}` : 'Settled'}
                    </div>
                  </div>

                  <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3">
                    <div className="text-[10px] font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1">
                      <Gift className="w-3 h-3 text-purple-600" />
                      Sponsored / Treats
                    </div>
                    <div className="text-base font-black text-purple-700 mt-0.5">
                      {formatMoney(totalSponsored)}
                    </div>
                    <div className="text-[9px] text-purple-600 mt-0.5">
                      Treated by you • No return needed
                    </div>
                  </div>
                </div>

                {/* Sponsored / Treats Given Section */}
                {pSponsored.length > 0 && (
                  <div className="p-3 bg-purple-50/60 border border-purple-200/80 rounded-xl space-y-2">
                    <div className="font-bold text-purple-950 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-purple-600" />
                        Sponsored & Treats Given (Not a Debt • You Paid)
                      </span>
                      <span className="text-[11px] font-black text-purple-700">
                        Total: {formatMoney(totalSponsored)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {pSponsored.map((sp, idx) => (
                        <div key={idx} className="p-2.5 bg-white border border-purple-100 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                              <Gift className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <div className="font-bold text-slate-800">{sp.expenseDescription}</div>
                              <div className="text-[10px] text-slate-500">Date: {sp.date} • {sp.category}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-purple-800">
                              {formatMoney(sp.amount)}
                            </div>
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              Gift / Treat
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transactions List */}
                <div className="space-y-2">
                  <div className="font-bold text-slate-700 text-xs">Lend & Borrow Ledger Entries</div>

                  {pLends.length === 0 && pBorrows.length === 0 && pSplits.length === 0 && pPaidForMe.length === 0 ? (
                    <p className="text-slate-400 text-center py-6">No transaction history recorded with {p.name} yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {/* Lends */}
                      {pLends.map(l => (
                        <div key={l.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <div className="font-bold text-slate-800">Lent to {p.name}</div>
                              <div className="text-[10px] text-slate-400">Date: {l.lentDate} • Status: {l.status}</div>
                              {l.notes && <div className="text-[10px] text-slate-500 italic mt-0.5">{l.notes}</div>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-emerald-700">{formatMoney(l.amount)}</div>
                            {l.repayments?.length > 0 && (
                              <div className="text-[10px] text-slate-500">
                                Returned: {formatMoney(l.repayments.reduce((s, r) => s + r.amount, 0))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Borrows */}
                      {pBorrows.map(b => (
                        <div key={b.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <div className="font-bold text-slate-800">Borrowed from {p.name}</div>
                              <div className="text-[10px] text-slate-400">Date: {b.borrowedDate} • Status: {b.status}</div>
                              {b.notes && <div className="text-[10px] text-slate-500 italic mt-0.5">{b.notes}</div>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-amber-700">{formatMoney(b.amount)}</div>
                            {b.repayments?.length > 0 && (
                              <div className="text-[10px] text-slate-500">
                                Repaid: {formatMoney(b.repayments.reduce((s, r) => s + r.amount, 0))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Splits */}
                      {pSplits.map(e => (
                        <div key={e.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                              <Users className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <div className="font-bold text-slate-800">Split Outing: {e.description}</div>
                              <div className="text-[10px] text-slate-400">Date: {e.date} • Category: {e.category}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-emerald-700">+ {formatMoney(e.splitAmount || 0)}</div>
                            <div className="text-[10px] text-slate-400">Total Bill: {formatMoney(e.amount)}</div>
                          </div>
                        </div>
                      ))}

                      {/* Paid by them */}
                      {pPaidForMe.map(e => (
                        <div key={e.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                              <CreditCard className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <div className="font-bold text-slate-800">{p.name} paid for: {e.description}</div>
                              <div className="text-[10px] text-slate-400">Date: {e.date} • Category: {e.category}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-rose-600">- {formatMoney(e.amount)}</div>
                            <div className="text-[10px] text-slate-400">You owe {p.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50 flex items-center justify-between gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleSettlePerson(p)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    netLedger !== 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 active:scale-[0.98]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  disabled={netLedger === 0}
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark Debt as Settled
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPersonLedger(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: SETTLEMENT REMINDER & EMAIL BREAKDOWN */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {emailReminderTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 flex-shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Send Settlement Breakdown</h3>
                  <p className="text-[11px] text-slate-500">
                    {emailReminderTarget.setName || 'Recent Expenses'} • For <span className="font-bold text-slate-800">{emailReminderTarget.personName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEmailReminderTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Summary Badges */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Amount to Settle</div>
                  <div className="text-lg font-black text-emerald-800">
                    {formatMoney(emailReminderTarget.totalReceivable)}
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">
                    {emailReminderTarget.items.length} payable expense{emailReminderTarget.items.length === 1 ? '' : 's'}
                  </div>
                </div>

                <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl">
                  <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                    <Gift className="w-3 h-3 text-purple-600" />
                    Treated / Sponsored
                  </div>
                  <div className="text-lg font-black text-purple-800">
                    {formatMoney(emailReminderTarget.totalSponsored)}
                  </div>
                  <div className="text-[10px] text-purple-600 mt-0.5">
                    {emailReminderTarget.sponsoredItems.length} gift treat{emailReminderTarget.sponsoredItems.length === 1 ? '' : 's'} (No return)
                  </div>
                </div>
              </div>

              {/* Email Address Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder={`e.g. ${emailReminderTarget.personName.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`}
                  value={emailReminderTarget.email}
                  onChange={e => setEmailReminderTarget(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  A settlement receipt with itemized breakdown and payment summary will be sent directly to this email.
                </p>
              </div>

              {/* Personal Note */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Personal Note / Payment Note (Optional)</label>
                <textarea
                  rows={2}
                  placeholder={`Hi ${emailReminderTarget.personName}, let's settle our shared expenses whenever convenient!`}
                  value={emailReminderTarget.customMessage}
                  onChange={e => setEmailReminderTarget(prev => prev ? ({ ...prev, customMessage: e.target.value }) : null)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs resize-none"
                />
              </div>

              {/* Items to Settle */}
              {emailReminderTarget.items.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-700 text-[11px] flex items-center justify-between">
                    <span>Payable Items</span>
                    <span className="text-slate-400 font-normal">Total: {formatMoney(emailReminderTarget.totalReceivable)}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-36 overflow-y-auto">
                    {emailReminderTarget.items.map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between text-[11px]">
                        <div>
                          <div className="font-semibold text-slate-800">{item.description}</div>
                          <div className="text-[10px] text-slate-400">{item.date}</div>
                        </div>
                        <div className="font-bold text-emerald-700">{formatMoney(item.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sponsored Treats */}
              {emailReminderTarget.sponsoredItems.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-purple-800 text-[11px] flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Gift className="w-3 h-3 text-purple-600" />
                      Treated / Sponsored (Included in summary as gift)
                    </span>
                    <span className="text-purple-600 font-normal">{formatMoney(emailReminderTarget.totalSponsored)}</span>
                  </div>
                  <div className="bg-purple-50/50 border border-purple-200 rounded-xl divide-y divide-purple-100 max-h-28 overflow-y-auto">
                    {emailReminderTarget.sponsoredItems.map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between text-[11px]">
                        <div>
                          <div className="font-semibold text-slate-800">{item.description}</div>
                          <div className="text-[10px] text-purple-500">{item.date} • Sponsored treat</div>
                        </div>
                        <div className="font-bold text-purple-700 line-through">{formatMoney(item.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50 flex items-center justify-between gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  const text = generateReminderText(emailReminderTarget);
                  navigator.clipboard.writeText(text);
                  setNotiBannerMsg('Copied settlement summary to clipboard!');
                  setTimeout(() => setNotiBannerMsg(null), 3000);
                }}
                className="px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 text-xs transition"
                title="Copy text summary for WhatsApp or message"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Copy Text</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEmailReminderTarget(null)}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 text-xs"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSendEmailReminder}
                  disabled={isSendingEmailReminder || !emailReminderTarget.email}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    isSendingEmailReminder || !emailReminderTarget.email
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 active:scale-[0.98]'
                  }`}
                >
                  {isSendingEmailReminder ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* POPUP MODAL: EXPENSE SET ENTRIES */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {viewSetEntriesTarget && (() => {
        const setExp = expenses.filter(e => e.expenseSetId === viewSetEntriesTarget.id);
        const spentBase = setExp.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const budgetBase = Number(viewSetEntriesTarget.budget) || 0;
        const pct = budgetBase > 0 ? Math.min(100, Math.round((spentBase / budgetBase) * 100)) : null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
            <div className="bg-white border border-slate-200/90 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
                    <Layers className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">
                      {viewSetEntriesTarget.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                      <span className="font-semibold text-indigo-700">{viewSetEntriesTarget.category}</span>
                      <span>•</span>
                      <span>{viewSetEntriesTarget.startDate}{viewSetEntriesTarget.endDate ? ` to ${viewSetEntriesTarget.endDate}` : ''}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const targetSetId = viewSetEntriesTarget.id;
                      setViewSetEntriesTarget(null);
                      resetExpenseForm(targetSetId);
                      setIsExpenseModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Entry</span>
                  </button>
                  <button
                    onClick={() => setViewSetEntriesTarget(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Budget vs Spent Banner */}
              <div className="p-4 bg-slate-50/50 border-b border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Spent</span>
                    <div className="text-xl font-black text-slate-900">
                      {formatMoney(spentBase)}
                    </div>
                  </div>
                  {budgetBase > 0 && (
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Budget: {formatMoney(budgetBase)}</span>
                      <div className={`text-sm font-black ${pct! >= 100 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {pct}% utilized
                      </div>
                    </div>
                  )}
                </div>
                {pct !== null && (
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Scrollable list of entries */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
                {setExp.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No expense entries logged under this set yet.
                  </div>
                ) : (
                  setExp.map(entry => (
                    <div key={entry.id} className="p-3 bg-white border border-slate-200/90 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-300 transition">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs truncate">{entry.description}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {entry.category}
                          </span>
                          {entry.paymentMethod && (
                            <span className="text-[10px] font-semibold text-slate-400">
                              • {entry.paymentMethod}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{entry.date} {entry.time || ''}</span>
                          {entry.splits && entry.splits.length > 0 && (
                            <span className="truncate max-w-[240px]">
                              • Split: {entry.splits.map(s => `${(s as any).personName || (s as any).name || ''}${s.isSponsored ? ' (sponsored)' : ''}`).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="font-black text-slate-900 text-sm">
                            {formatMoney(entry.amount)}
                          </div>
                          {entry.currency && entry.currency !== viewCurrency && (
                            <div className="text-[10px] text-slate-400">
                              orig: {getCurrencySymbol(entry.currency)} {entry.originalAmount || entry.amount}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setViewSetEntriesTarget(null);
                              handleEditExpense(entry);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            title="Edit expense"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(entry.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            title="Delete expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  {setExp.length} {setExp.length === 1 ? 'entry' : 'entries'} in total
                </span>
                <button
                  type="button"
                  onClick={() => setViewSetEntriesTarget(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* POPUP MODAL: CONSOLIDATED LENDS BREAKDOWN */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {viewConsolidatedBreakdownTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200/90 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl shadow-xs">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {viewConsolidatedBreakdownTarget.personName}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {viewConsolidatedBreakdownTarget.setName} • {viewConsolidatedBreakdownTarget.items.length} payable {viewConsolidatedBreakdownTarget.items.length === 1 ? 'entry' : 'entries'}
                    {viewConsolidatedBreakdownTarget.totalSponsored > 0 && ` • ${viewConsolidatedBreakdownTarget.sponsoredItems.length} treated gifts`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewConsolidatedBreakdownTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Outstanding Balance Banner */}
            <div className="p-4 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Outstanding Balance</span>
                <div className="text-2xl font-black text-emerald-700">
                  {formatMoney(viewConsolidatedBreakdownTarget.remaining)}
                </div>
              </div>
              <div className="text-right text-xs">
                <span className="text-slate-500 font-medium">Total Lent: </span>
                <span className="font-bold text-slate-800">{formatMoney(viewConsolidatedBreakdownTarget.totalAmount)}</span>
                {viewConsolidatedBreakdownTarget.totalRepaid > 0 && (
                  <div className="text-slate-500">
                    Repaid: <span className="font-bold text-emerald-600">{formatMoney(viewConsolidatedBreakdownTarget.totalRepaid)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable list of entries */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Payable entries */}
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-indigo-500" />
                  Shared Entries to Settle ({viewConsolidatedBreakdownTarget.items.length})
                </span>
                {viewConsolidatedBreakdownTarget.items.map((subItem: any) => {
                  const subRepaid = (subItem.repayments || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
                  const subRemaining = Math.max(0, subItem.amount - subRepaid);
                  return (
                    <div key={subItem.id} className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs">
                          {subItem.notes || `Lend on ${subItem.lentDate}`}
                        </span>
                        <span className="font-black text-emerald-700 text-xs">
                          {formatMoney(subItem.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Date: {subItem.lentDate}</span>
                        <span>Remaining: <strong className="text-slate-700">{formatMoney(subRemaining)}</strong></span>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/50">
                        <button
                          type="button"
                          onClick={() => {
                            setRepayTarget({ type: 'lend', item: subItem });
                            setRepayAmount(subRemaining.toString());
                          }}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                        >
                          Record Repayment
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setViewConsolidatedBreakdownTarget(null);
                            handleEditLend(subItem);
                          }}
                          className="text-slate-400 hover:text-emerald-600 p-1 cursor-pointer transition"
                          title="Edit entry"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleDeleteLend(subItem.id);
                            setViewConsolidatedBreakdownTarget(null);
                          }}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer transition"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sponsored items */}
              {viewConsolidatedBreakdownTarget.sponsoredItems && viewConsolidatedBreakdownTarget.sponsoredItems.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-amber-600" />
                    Treated & Sponsored Gifts ({viewConsolidatedBreakdownTarget.sponsoredItems.length})
                  </span>
                  {viewConsolidatedBreakdownTarget.sponsoredItems.map((sp: any) => (
                    <div key={sp.id} className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-2xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-800">{sp.description}</div>
                        <div className="text-[10px] text-slate-500">{sp.date} • Covered as treat</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-amber-700">{formatMoney(sp.amount)}</div>
                        <span className="text-[9px] font-semibold text-amber-600">No repayment needed</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = generateReminderText(viewConsolidatedBreakdownTarget);
                  navigator.clipboard.writeText(text);
                  setNotiBannerMsg('Copied settlement summary to clipboard!');
                  setTimeout(() => setNotiBannerMsg(null), 3000);
                }}
                className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer"
                title="Copy settlement text for WhatsApp"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Text</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = viewConsolidatedBreakdownTarget;
                    setViewConsolidatedBreakdownTarget(null);
                    handleOpenConsolidatedReminder(target);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Settlement Email
                </button>
                <button
                  type="button"
                  onClick={() => setViewConsolidatedBreakdownTarget(null)}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
