import React, { useState, useEffect } from 'react';
import {
  Wallet, Plus, Calendar, ArrowUpRight, ArrowDownLeft,
  RefreshCw, Clock, AlertTriangle, Filter,
  Trash2, X, DollarSign, Layers, ChevronRight,
  TrendingDown, TrendingUp, User, Phone, Check, CreditCard,
  Users, CheckCircle2, Edit2
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
  splitPersonName?: string | null;
  splitAmount?: number | null;
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

export interface Person {
  id: string;
  name: string;
  contact?: string;
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

const PAYMENT_METHODS = ['Bank / Card', 'Cash', 'eSewa', 'Khalti', 'Other'];

export const Finance: React.FC<FinanceProps> = ({ authToken }) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'expenses' | 'sets' | 'lends' | 'borrows' | 'people'>('overview');
  const [loading, setLoading] = useState(true);

  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [expenseSets, setExpenseSets] = useState<ExpenseSet[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [lends, setLends] = useState<LendItem[]>([]);
  const [borrows, setBorrows] = useState<BorrowItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [backlog, setBacklog] = useState<BankBacklogItem[]>([]);

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
  const [reconcileTarget, setReconcileTarget] = useState<BankBacklogItem | null>(null);
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
    time: new Date().toTimeString().slice(0, 5),
    splitOption: 'none' as 'none' | 'split' | 'paid_by_other',
    splitPersonName: '',
    splitMode: '50_50' as '50_50' | '100_them' | 'custom',
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

  const [personForm, setPersonForm] = useState({
    id: '',
    name: '',
    contact: '',
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

  const fetchAllData = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const [ovRes, setsRes, expRes, lendsRes, borrowsRes, peopleRes, backlogRes] = await Promise.all([
        fetch('/api/finance/overview', { headers: authHeaders }),
        fetch('/api/finance/expense-sets', { headers: authHeaders }),
        fetch('/api/finance/expenses', { headers: authHeaders }),
        fetch('/api/finance/lends', { headers: authHeaders }),
        fetch('/api/finance/borrows', { headers: authHeaders }),
        fetch('/api/finance/people', { headers: authHeaders }),
        fetch('/api/finance/backlog?status=pending', { headers: authHeaders })
      ]);

      if (ovRes.ok) setOverview(await ovRes.json());
      if (setsRes.ok) setExpenseSets(await setsRes.json());
      if (expRes.ok) setExpenses(await expRes.json());
      if (lendsRes.ok) setLends(await lendsRes.json());
      if (borrowsRes.ok) setBorrows(await borrowsRes.json());
      if (peopleRes.ok) setPeople(await peopleRes.json());
      if (backlogRes.ok) setBacklog(await backlogRes.json());
    } catch (err) {
      console.error('Error fetching finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [authToken]);

  // Handle Save Expense (with Split and Paid-by support)
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    let finalAmount = amountNum;
    let splitPersonName: string | null = null;
    let splitAmount: number | null = null;
    let paidByPersonName: string | null = null;

    if (expenseForm.splitOption === 'split' && expenseForm.splitPersonName.trim()) {
      splitPersonName = expenseForm.splitPersonName.trim();
      if (expenseForm.splitMode === '50_50') {
        splitAmount = parseFloat((amountNum / 2).toFixed(2));
        finalAmount = parseFloat((amountNum - splitAmount).toFixed(2));
      } else if (expenseForm.splitMode === '100_them') {
        splitAmount = amountNum;
        finalAmount = 0;
      } else if (expenseForm.splitMode === 'custom') {
        const theirShare = parseFloat(expenseForm.customTheirShare) || 0;
        splitAmount = theirShare;
        finalAmount = Math.max(0, parseFloat((amountNum - theirShare).toFixed(2)));
      }
    } else if (expenseForm.splitOption === 'paid_by_other' && expenseForm.paidByPersonName.trim()) {
      paidByPersonName = expenseForm.paidByPersonName.trim();
    }

    const payload: any = {
      amount: finalAmount,
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
      paidByPersonName,
      expectedReturnDate: expenseForm.expectedReturnDate || undefined
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
          time: new Date().toTimeString().slice(0, 5),
          splitOption: 'none',
          splitPersonName: '',
          splitMode: '50_50',
          customMyShare: '',
          customTheirShare: '',
          paidByPersonName: '',
          expectedReturnDate: ''
        });
        fetchAllData();
      }
    } catch (err) {
      console.error('Save expense error:', err);
    }
  };

  // Handle Save Person
  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personForm.name.trim()) return;

    try {
      const res = await fetch(
        personForm.id ? `/api/finance/people/${personForm.id}` : '/api/finance/people',
        {
          method: personForm.id ? 'PUT' : 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            name: personForm.name.trim(),
            contact: personForm.contact.trim(),
            isDefault: personForm.isDefault,
            notes: personForm.notes.trim()
          })
        }
      );
      if (res.ok) {
        setIsPersonModalOpen(false);
        setPersonForm({ id: '', name: '', contact: '', isDefault: false, notes: '' });
        fetchAllData();
      }
    } catch (err) {
      console.error('Save person error:', err);
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
      ? `Mark ${person.name}'s balance of Rs. ${balance.toLocaleString()} as fully settled / received?`
      : balance < 0
      ? `Mark your debt of Rs. ${Math.abs(balance).toLocaleString()} to ${person.name} as fully paid / settled?`
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
              const defP = people.find(p => p.isDefault)?.name || (people[0]?.name || '');
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
                time: new Date().toTimeString().slice(0, 5),
                splitOption: 'none',
                splitPersonName: defP,
                splitMode: '50_50',
                customMyShare: '',
                customTheirShare: '',
                paidByPersonName: '',
                expectedReturnDate: ''
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
              setPersonForm({ id: '', name: '', contact: '', isDefault: false, notes: '' });
              setIsPersonModalOpen(true);
            }}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
          >
            <User className="w-4 h-4" />
            + Person
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
          { key: 'people', label: 'People & Ledgers', icon: Users, count: people.length }
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

            {/* People & Companions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>People & Ledgers</span>
                <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {people.length} <span className="text-xs font-normal text-slate-500">contacts</span>
              </div>
              <div className="text-[11px] text-slate-500 flex justify-between items-center">
                <span>Net: Rs. {people.reduce((s, p) => s + (p.netBalance || 0), 0).toLocaleString()}</span>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('people')}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  View Ledgers
                </button>
              </div>
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
                        Rs. {item.amount.toLocaleString()}
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
      {/* 6. PEOPLE & LEDGERS TAB */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'people' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                People & Companions Directory
              </h2>
              <p className="text-[11px] text-slate-500">
                Track shared outings, who paid for whom, and running balances with friends & companions
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPersonForm({ id: '', name: '', contact: '', isDefault: false, notes: '' });
                setIsPersonModalOpen(true);
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Add Person / Identifier
            </button>
          </div>

          {/* Directory Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
              <span className="text-[11px] font-semibold text-slate-500">Total Receivables (Others Owe You)</span>
              <div className="text-xl font-black text-emerald-600">
                Rs. {people.reduce((sum, p) => sum + (p.netReceivable || 0), 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
              <span className="text-[11px] font-semibold text-slate-500">Total Payables (You Owe Others)</span>
              <div className="text-xl font-black text-amber-600">
                Rs. {people.reduce((sum, p) => sum + (p.netPayable || 0), 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
              <span className="text-[11px] font-semibold text-slate-500">Net Ledger Position</span>
              {(() => {
                const net = people.reduce((sum, p) => sum + (p.netBalance || 0), 0);
                return (
                  <div className={`text-xl font-black ${net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {net >= 0 ? `+ Rs. ${net.toLocaleString()}` : `- Rs. ${Math.abs(net).toLocaleString()}`}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* People Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {people.length === 0 ? (
              <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500 space-y-2">
                <p>No companions or people added yet.</p>
                <p className="text-[11px] text-slate-400">
                  When you split an expense (e.g. outing with Ram) or someone pays for you, people are auto-created or can be added manually.
                </p>
                <button
                  type="button"
                  onClick={() => setIsPersonModalOpen(true)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition"
                >
                  Add First Companion
                </button>
              </div>
            ) : (
              people.map(p => {
                const balance = p.netBalance || 0;
                return (
                  <div
                    key={p.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                            {p.name}
                            {p.isDefault && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-indigo-100 text-indigo-700 border border-indigo-200">
                                Default
                              </span>
                            )}
                          </div>
                          {p.contact && (
                            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {p.contact}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPersonForm({
                                id: p.id,
                                name: p.name,
                                contact: p.contact || '',
                                isDefault: Boolean(p.isDefault),
                                notes: p.notes || ''
                              });
                              setIsPersonModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded transition"
                            title="Edit Person"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePerson(p.id, p.name)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded transition"
                            title="Delete Person"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Running Balance Box */}
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
                            ? `Rs. ${balance.toLocaleString()}`
                            : balance < 0
                            ? `Rs. ${Math.abs(balance).toLocaleString()}`
                            : 'Rs. 0 (All Settled)'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {p.activeLendsCount || 0} active lend(s) • {p.activeBorrowsCount || 0} active borrow(s)
                        </div>
                      </div>

                      {p.notes && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {p.notes}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleSettlePerson(p)}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          balance !== 0
                            ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                        disabled={balance === 0}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Settle Balance
                      </button>
                    </div>
                  </div>
                );
              })
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">
                      {expenseForm.category === 'Transport & Fuel' ? 'Travel / Transport Date' : 'Date'}
                    </label>
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

              {/* Split & Paid By Section */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    Split / Paid by Others
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
                        const defP = people.find(p => p.isDefault)?.name || (people[0]?.name || '');
                        setExpenseForm(prev => ({ ...prev, splitOption: 'split', splitPersonName: prev.splitPersonName || defP }));
                      }}
                      className={`px-2 py-0.5 rounded font-bold transition ${
                        expenseForm.splitOption === 'split' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Split with Friend
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const defP = people.find(p => p.isDefault)?.name || (people[0]?.name || '');
                        setExpenseForm(prev => ({ ...prev, splitOption: 'paid_by_other', paidByPersonName: prev.paidByPersonName || defP }));
                      }}
                      className={`px-2 py-0.5 rounded font-bold transition ${
                        expenseForm.splitOption === 'paid_by_other' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Paid for Me
                    </button>
                  </div>
                </div>

                {/* Split Details */}
                {expenseForm.splitOption === 'split' && (
                  <div className="space-y-2.5 pt-1 border-t border-slate-200/60">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Companion (Who to split with?)</label>
                      <div className="flex gap-2">
                        <select
                          value={expenseForm.splitPersonName}
                          onChange={e => setExpenseForm(prev => ({ ...prev, splitPersonName: e.target.value }))}
                          className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
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
                          placeholder="Or type new name"
                          value={expenseForm.splitPersonName}
                          onChange={e => setExpenseForm(prev => ({ ...prev, splitPersonName: e.target.value }))}
                          className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Split Ratio</label>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {[
                          { key: '50_50', label: '50 / 50 Equal' },
                          { key: '100_them', label: '100% For Them' },
                          { key: 'custom', label: 'Custom Amount' }
                        ].map(m => (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => setExpenseForm(prev => ({ ...prev, splitMode: m.key as any }))}
                            className={`py-1.5 px-2 rounded-lg font-bold border transition text-[11px] ${
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

                    {expenseForm.splitMode === 'custom' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Your Share (Rs.)</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={expenseForm.customMyShare}
                            onChange={e => {
                              const myVal = parseFloat(e.target.value) || 0;
                              const total = parseFloat(expenseForm.amount) || 0;
                              setExpenseForm(prev => ({
                                ...prev,
                                customMyShare: e.target.value,
                                customTheirShare: Math.max(0, total - myVal).toFixed(2)
                              }));
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Their Share (Rs.)</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={expenseForm.customTheirShare}
                            onChange={e => {
                              const theirVal = parseFloat(e.target.value) || 0;
                              const total = parseFloat(expenseForm.amount) || 0;
                              setExpenseForm(prev => ({
                                ...prev,
                                customTheirShare: e.target.value,
                                customMyShare: Math.max(0, total - theirVal).toFixed(2)
                              }));
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-bold"
                          />
                        </div>
                      </div>
                    )}

                    {/* Calculated live breakdown summary */}
                    {parseFloat(expenseForm.amount) > 0 && expenseForm.splitPersonName && (
                      <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-[11px] text-indigo-900 space-y-0.5">
                        <div className="font-bold">Ledger Impact:</div>
                        <div className="flex justify-between">
                          <span>Your personal expense:</span>
                          <span className="font-black">
                            Rs. {expenseForm.splitMode === '100_them'
                              ? '0'
                              : expenseForm.splitMode === '50_50'
                              ? (parseFloat(expenseForm.amount) / 2).toLocaleString()
                              : (parseFloat(expenseForm.customMyShare) || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-emerald-800">
                          <span>Auto-lent to {expenseForm.splitPersonName}:</span>
                          <span className="font-black">
                            Rs. {expenseForm.splitMode === '100_them'
                              ? parseFloat(expenseForm.amount).toLocaleString()
                              : expenseForm.splitMode === '50_50'
                              ? (parseFloat(expenseForm.amount) / 2).toLocaleString()
                              : (parseFloat(expenseForm.customTheirShare) || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Paid By Someone Else Details */}
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
                    {parseFloat(expenseForm.amount) > 0 && expenseForm.paidByPersonName && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                        Logs Rs. {parseFloat(expenseForm.amount).toLocaleString()} as your expense, and adds Rs. {parseFloat(expenseForm.amount).toLocaleString()} to your debt to {expenseForm.paidByPersonName}.
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

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD / EDIT PERSON */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isPersonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                {personForm.id ? 'Edit Companion' : 'Add Person / Companion'}
              </h3>
              <button onClick={() => setIsPersonModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePerson} className="space-y-3 text-xs">
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

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPersonModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20"
                >
                  Save Person
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Reconcile Bank SMS</h3>
                  <p className="text-[10px] text-slate-500">Log this bank transaction or split with a friend</p>
                </div>
              </div>
              <button onClick={() => setReconcileTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

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
                  Rs. {reconcileTarget.amount.toLocaleString()}
                </div>
              </div>
              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Date: <span className="font-semibold text-slate-700">{reconcileTarget.date}</span></span>
                {reconcileTarget.account && <span>A/C: <span className="font-semibold text-slate-700">{reconcileTarget.account}</span></span>}
                {reconcileTarget.upiRef && <span className="font-mono text-[10px]">UPI Ref: {reconcileTarget.upiRef}</span>}
              </div>
            </div>

            <form onSubmit={handleReconcileBacklog} className="space-y-3 text-xs">
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
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Your Share (Rs.)</label>
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
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Friend's Share (Rs.)</label>
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
                        Rs. {reconcileForm.splitMode === '100_them'
                          ? '0'
                          : reconcileForm.splitMode === '50_50'
                          ? (reconcileTarget.amount / 2).toLocaleString()
                          : (parseFloat(reconcileForm.customMyAmount) || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-700">
                      <span>Added to {reconcileForm.splitPersonName || 'Friend'}'s ledger (Lend):</span>
                      <span className="font-black">
                        Rs. {reconcileForm.splitMode === '100_them'
                          ? reconcileTarget.amount.toLocaleString()
                          : reconcileForm.splitMode === '50_50'
                          ? (reconcileTarget.amount / 2).toLocaleString()
                          : (parseFloat(reconcileForm.customTheirAmount) || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleIgnoreBacklog(reconcileTarget.id)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition flex items-center gap-1.5"
                  title="Mark as cash rotation / pass-through and ignore"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Rotated Money (Pass)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReconcileTarget(null)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20"
                  >
                    Save & Reconcile
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
