import React, { useState, useEffect } from 'react';
import {
  Wallet, Plus, Calendar, ArrowUpRight, ArrowDownLeft,
  RefreshCw, Clock, AlertTriangle, Filter,
  Trash2, X, DollarSign, Layers, ChevronRight,
  TrendingDown, TrendingUp, User, Phone, Check, CreditCard
} from 'lucide-react';

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
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: string;
  time?: string;
  paymentMethod: string;
  isRotation: boolean;
  rotationNote?: string | null;
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
  personName: string;
  contact?: string;
  amount: number;
  lentDate: string;
  expectedReturnDate: string;
  isRotation: boolean;
  status: 'active' | 'partially_returned' | 'returned' | 'forgiven';
  notes?: string;
  repayments: RepaymentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface BorrowItem {
  id: string;
  personName: string;
  contact?: string;
  amount: number;
  borrowedDate: string;
  expectedReturnDate: string;
  isRotation: boolean;
  status: 'active' | 'partially_repaid' | 'repaid';
  notes?: string;
  repayments: RepaymentRecord[];
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

const PAYMENT_METHODS = ['Bank / Card', 'Cash', 'eSewa', 'Khalti', 'Other'];

export const Finance: React.FC<FinanceProps> = ({ authToken }) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'expenses' | 'sets' | 'lends' | 'borrows' | 'rotations'>('overview');
  const [loading, setLoading] = useState(true);

  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [expenseSets, setExpenseSets] = useState<ExpenseSet[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [lends, setLends] = useState<LendItem[]>([]);
  const [borrows, setBorrows] = useState<BorrowItem[]>([]);

  // Filter states for expenses
  const [filterSetId, setFilterSetId] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [hideRotations, setHideRotations] = useState<boolean>(true);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSetModalOpen, setIsSetModalOpen] = useState(false);
  const [isLendModalOpen, setIsLendModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [repayTarget, setRepayTarget] = useState<{ type: 'lend' | 'borrow'; item: LendItem | BorrowItem } | null>(null);

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    id: '',
    amount: '',
    description: '',
    category: EXPENSE_CATEGORIES[0],
    expenseSetId: '',
    paymentMethod: PAYMENT_METHODS[0],
    isRotation: false,
    rotationNote: '',
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5)
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
    personName: '',
    contact: '',
    amount: '',
    lentDate: new Date().toISOString().slice(0, 10),
    expectedReturnDate: '',
    isRotation: false,
    notes: ''
  });

  const [borrowForm, setBorrowForm] = useState({
    personName: '',
    contact: '',
    amount: '',
    borrowedDate: new Date().toISOString().slice(0, 10),
    expectedReturnDate: '',
    isRotation: false,
    notes: ''
  });

  const [repayAmount, setRepayAmount] = useState('');
  const [repayNotes, setRepayNotes] = useState('');

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'X-Session-Token': authToken, 'Authorization': `Bearer ${authToken}` } : {})
  };

  const fetchAllData = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const [ovRes, setsRes, expRes, lendsRes, borrowsRes] = await Promise.all([
        fetch('/api/finance/overview', { headers: authHeaders }),
        fetch('/api/finance/expense-sets', { headers: authHeaders }),
        fetch('/api/finance/expenses', { headers: authHeaders }),
        fetch('/api/finance/lends', { headers: authHeaders }),
        fetch('/api/finance/borrows', { headers: authHeaders })
      ]);

      if (ovRes.ok) setOverview(await ovRes.json());
      if (setsRes.ok) setExpenseSets(await setsRes.json());
      if (expRes.ok) setExpenses(await expRes.json());
      if (lendsRes.ok) setLends(await lendsRes.json());
      if (borrowsRes.ok) setBorrows(await borrowsRes.json());
    } catch (err) {
      console.error('Error fetching finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [authToken]);

  // Handle Save Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const payload = {
      amount: amountNum,
      description: expenseForm.description.trim() || 'Expense',
      category: expenseForm.category,
      expenseSetId: expenseForm.expenseSetId ? expenseForm.expenseSetId : null,
      paymentMethod: expenseForm.paymentMethod,
      isRotation: expenseForm.isRotation,
      rotationNote: expenseForm.rotationNote.trim() || null,
      date: expenseForm.date,
      time: expenseForm.time
    };

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
        setExpenseForm({
          id: '',
          amount: '',
          description: '',
          category: EXPENSE_CATEGORIES[0],
          expenseSetId: '',
          paymentMethod: PAYMENT_METHODS[0],
          isRotation: false,
          rotationNote: '',
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toTimeString().slice(0, 5)
        });
        fetchAllData();
      }
    } catch (err) {
      console.error('Save expense error:', err);
    }
  };

  // Handle Delete Expense
  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      const res = await fetch(`/api/finance/expenses/${id}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok) fetchAllData();
    } catch (err) {
      console.error('Delete expense error:', err);
    }
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

    const payload = {
      personName: lendForm.personName.trim(),
      contact: lendForm.contact.trim(),
      amount: amountNum,
      lentDate: lendForm.lentDate,
      expectedReturnDate: lendForm.expectedReturnDate,
      isRotation: lendForm.isRotation,
      notes: lendForm.notes.trim()
    };

    try {
      const res = await fetch('/api/finance/lends', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsLendModalOpen(false);
        setLendForm({ personName: '', contact: '', amount: '', lentDate: new Date().toISOString().slice(0, 10), expectedReturnDate: '', isRotation: false, notes: '' });
        fetchAllData();
      }
    } catch (err) {
      console.error('Save lend error:', err);
    }
  };

  // Handle Save Borrow
  const handleSaveBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(borrowForm.amount);
    if (!borrowForm.personName.trim() || isNaN(amountNum) || amountNum <= 0) return;

    const payload = {
      personName: borrowForm.personName.trim(),
      contact: borrowForm.contact.trim(),
      amount: amountNum,
      borrowedDate: borrowForm.borrowedDate,
      expectedReturnDate: borrowForm.expectedReturnDate,
      isRotation: borrowForm.isRotation,
      notes: borrowForm.notes.trim()
    };

    try {
      const res = await fetch('/api/finance/borrows', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsBorrowModalOpen(false);
        setBorrowForm({ personName: '', contact: '', amount: '', borrowedDate: new Date().toISOString().slice(0, 10), expectedReturnDate: '', isRotation: false, notes: '' });
        fetchAllData();
      }
    } catch (err) {
      console.error('Save borrow error:', err);
    }
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
    }
  };

  // Filtered expenses
  const filteredExpenses = expenses.filter(e => {
    if (hideRotations && e.isRotation) return false;
    if (activeSubTab === 'rotations' && !e.isRotation) return false;
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

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setExpenseForm({
                id: '',
                amount: '',
                description: '',
                category: EXPENSE_CATEGORIES[0],
                expenseSetId: '',
                paymentMethod: PAYMENT_METHODS[0],
                isRotation: false,
                rotationNote: '',
                date: new Date().toISOString().slice(0, 10),
                time: new Date().toTimeString().slice(0, 5)
              });
              setIsExpenseModalOpen(true);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/10 transition"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>

          <button
            onClick={() => {
              setSetForm({ id: '', name: '', category: 'Outing / Trip', budget: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', notes: '' });
              setIsSetModalOpen(true);
            }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
          >
            <Layers className="w-4 h-4" />
            New Expense Set
          </button>

          <button
            onClick={fetchAllData}
            title="Refresh Data"
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-200 pb-2">
        {[
          { key: 'overview', label: 'Overview', icon: TrendingUp },
          { key: 'expenses', label: 'Expenses', icon: CreditCard, count: expenses.length },
          { key: 'sets', label: 'Expense Sets', icon: Layers, count: expenseSets.length },
          { key: 'lends', label: 'Lends (Money Given)', icon: ArrowUpRight, count: lends.filter(l => l.status !== 'returned').length },
          { key: 'borrows', label: 'Borrows (Money Taken)', icon: ArrowDownLeft, count: borrows.filter(b => b.status !== 'repaid').length },
          { key: 'rotations', label: 'Rotations & Exchanges', icon: RefreshCw, count: expenses.filter(e => e.isRotation).length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  isActive ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab.count}
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
                Rs. {(overview?.totalSpentThisMonth || 0).toLocaleString()}
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
                Rs. {(overview?.totalLentBalance || 0).toLocaleString()}
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
                Rs. {(overview?.totalBorrowedBalance || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">
                {borrows.filter(b => b.status !== 'repaid').length} active borrowings
              </div>
            </div>

            {/* Rotations / Dummy Exchanges */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Rotations & Exchanges</span>
                <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <RefreshCw className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-800">
                Rs. {(overview?.totalRotationsThisMonth || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">
                Pass-through / cash exchanges
              </div>
            </div>
          </div>

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
                          <span className="font-bold text-slate-900">Rs. {spent.toLocaleString()}</span>
                        </div>
                        {budget > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-slate-500">
                              <span>Budget: Rs. {budget.toLocaleString()}</span>
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
                            setExpenseForm(prev => ({ ...prev, expenseSetId: set.id }));
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

                      <div className="text-right">
                        <div className={`text-sm font-black ${e.isRotation ? 'text-indigo-600' : 'text-slate-900'}`}>
                          Rs. {e.amount.toLocaleString()}
                        </div>
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
      {/* 2. EXPENSES TAB */}
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
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

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
              {filteredExpenses.length} entries • Total: Rs. {filteredExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
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
                            Rs. {e.amount.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteExpense(e.id)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded transition"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
                        <span className="font-black text-slate-900 text-sm">Rs. {spent.toLocaleString()}</span>
                      </div>
                      {budget > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>Budget: Rs. {budget.toLocaleString()}</span>
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
                      onClick={() => {
                        setFilterSetId(set.id);
                        setActiveSubTab('expenses');
                      }}
                      className="font-bold text-slate-600 hover:text-slate-900"
                    >
                      View {set.entryCount || 0} Entries
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setExpenseForm(prev => ({ ...prev, expenseSetId: set.id }));
                          setIsExpenseModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition"
                      >
                        + Add Entry
                      </button>
                      <button
                        onClick={() => handleDeleteSet(set.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded"
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
      {/* 4. LENDS TAB (Money Given to Others) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'lends' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Lends Tracker (Money Given Out)</h2>
              <p className="text-[11px] text-slate-500">Keep track of who took money, when they return, and reminders</p>
            </div>
            <button
              onClick={() => setIsLendModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Log Money Lent
            </button>
          </div>

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
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isComplete ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="pt-2 flex justify-between items-baseline">
                        <div>
                          <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Remaining</span>
                          <div className="text-xl font-black text-emerald-600">
                            Rs. {remaining.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Initial</span>
                          <div className="text-xs font-bold text-slate-700">
                            Rs. {item.amount.toLocaleString()}
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
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <button
                          onClick={() => {
                            setRepayTarget({ type: 'lend', item });
                            setRepayAmount(remaining.toString());
                          }}
                          className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
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
              onClick={() => setIsBorrowModalOpen(true)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
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
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isComplete ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="pt-2 flex justify-between items-baseline">
                        <div>
                          <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Remaining Debt</span>
                          <div className="text-xl font-black text-amber-600">
                            Rs. {remaining.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Borrowed</span>
                          <div className="text-xs font-bold text-slate-700">
                            Rs. {item.amount.toLocaleString()}
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
      {/* 6. ROTATIONS & CASH EXCHANGES TAB */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'rotations' && (
        <div className="space-y-4">
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-5 space-y-1.5">
            <h2 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-600" />
              About Rotations & Dummy Transactions
            </h2>
            <p className="text-xs text-indigo-800/80 leading-relaxed">
              Rotations track pass-through transactions, cash exchanges (e.g. gave cash, received bank transfer), and short-term temporary lends/borrows (under 24 hours).
              They are explicitly segregated from your true spending analytics so your monthly expense calculations remain 100% accurate.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {expenses.filter(e => e.isRotation).length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-10">No rotation transactions recorded yet.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Rotation Notes</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.filter(e => e.isRotation).map(e => (
                    <tr key={e.id}>
                      <td className="py-3 px-4 font-mono text-slate-600">{e.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{e.description}</td>
                      <td className="py-3 px-4 text-slate-600">{e.paymentMethod}</td>
                      <td className="py-3 px-4 text-slate-500 italic">{e.rotationNote || 'Cash exchange / pass-through'}</td>
                      <td className="py-3 px-4 text-right font-black text-indigo-600">Rs. {e.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD / EDIT EXPENSE */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                {expenseForm.id ? 'Edit Expense' : 'Log New Expense'}
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount (Rs. / NPR)</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lunch at Cafe, Fuel, Grocery store"
                  value={expenseForm.description}
                  onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={e => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
                  <label className="block font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={expenseForm.date}
                    onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
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

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CREATE EXPENSE SET */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isSetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Create Expense Set / Trip Bucket
              </h3>
              <button onClick={() => setIsSetModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSet} className="space-y-3 text-xs">
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
                  <label className="block font-bold text-slate-700 mb-1">Start Date</label>
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

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSetModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20"
                >
                  Create Set
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                Log Money Given (Lend)
              </h3>
              <button onClick={() => setIsLendModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLend} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Borrower Name (Who took?)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh, Alex"
                  value={lendForm.personName}
                  onChange={e => setLendForm(prev => ({ ...prev, personName: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount (Rs.)</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={lendForm.amount}
                    onChange={e => setLendForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact (Phone/Email)</label>
                  <input
                    type="text"
                    placeholder="Optional phone number"
                    value={lendForm.contact}
                    onChange={e => setLendForm(prev => ({ ...prev, contact: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lent Date</label>
                  <input
                    type="date"
                    required
                    value={lendForm.lentDate}
                    onChange={e => setLendForm(prev => ({ ...prev, lentDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
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

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLendModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20"
                >
                  Save Lend Record
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-amber-600" />
                Log Money Taken (Borrow)
              </h3>
              <button onClick={() => setIsBorrowModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBorrow} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Lender Name (Who gave?)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shyam, Boss, Uncle"
                  value={borrowForm.personName}
                  onChange={e => setBorrowForm(prev => ({ ...prev, personName: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount (Rs.)</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={borrowForm.amount}
                    onChange={e => setBorrowForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact (Phone/Email)</label>
                  <input
                    type="text"
                    placeholder="Optional phone number"
                    value={borrowForm.contact}
                    onChange={e => setBorrowForm(prev => ({ ...prev, contact: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Borrowed Date</label>
                  <input
                    type="date"
                    required
                    value={borrowForm.borrowedDate}
                    onChange={e => setBorrowForm(prev => ({ ...prev, borrowedDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
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

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBorrowModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md shadow-amber-600/20"
                >
                  Save Borrow Record
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">
                {repayTarget.type === 'lend' ? 'Record Money Returned' : 'Record Payment Made'}
              </h3>
              <button onClick={() => setRepayTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordRepayment} className="space-y-3 text-xs">
              <p className="text-slate-600">
                {repayTarget.type === 'lend'
                  ? `Enter the amount returned by ${repayTarget.item.personName}:`
                  : `Enter the amount paid back to ${repayTarget.item.personName}:`}
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Repayment Amount (Rs.)</label>
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

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRepayTarget(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20"
                >
                  Confirm Repayment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
