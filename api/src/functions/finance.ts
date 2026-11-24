import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { connectToMongo, verifySession, extractToken } from './db';
import { OWNER_EMAIL, createEmailTransporter, sendSafeMail } from './emailService';

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
  createdAt: string;
  updatedAt: string;
}

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
  members: string[];
  defaultSplitMode?: 'equal' | 'custom';
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
  date: string; // YYYY-MM-DD
  time?: string;
  paymentMethod: string; // 'Cash' | 'Bank / Card' | 'eSewa' | 'Khalti' | 'Other'
  isRotation: boolean; // Dummy transaction / cash exchange / temporary pass-through
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

export interface Person {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  isDefault?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceCategory {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
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
  date: string; // YYYY-MM-DD
  account?: string;
  counterpartyAccount?: string;
  upiRef?: string;
  status: 'pending' | 'reconciled' | 'rotated_ignored';
  reconciledExpenseId?: string;
  reconciledLendId?: string;
  splitPersonName?: string;
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
  isRotation: boolean; // Short-term temporary lend (<24h)
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
  isRotation: boolean; // Short-term temporary borrow (<24h)
  status: 'active' | 'partially_repaid' | 'repaid';
  notes?: string;
  repayments: RepaymentRecord[];
  createdAt: string;
  updatedAt: string;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function migratePeopleAndCategories(db: any) {
  const peopleCol = db.collection('finance_people');
  const lendsCol = db.collection('finance_lends');
  const borrowsCol = db.collection('finance_borrows');
  const expensesCol = db.collection('finance_expenses');
  const backlogCol = db.collection('finance_bank_backlog');
  const categoriesCol = db.collection('finance_categories');
  const setsCol = db.collection('finance_expense_sets');

  const now = new Date().toISOString();

  // 1. Clean up any existing duplicate categories in database
  try {
    const allExistingCats = await categoriesCol.find({}).toArray();
    const seenCatMap = new Map<string, any>();
    const dupCatIds: any[] = [];
    for (const cat of allExistingCats) {
      const norm = (cat.name || '').trim().toLowerCase();
      if (!norm) {
        dupCatIds.push(cat._id);
        continue;
      }
      if (seenCatMap.has(norm)) {
        const prev = seenCatMap.get(norm);
        if (!prev.isSystem && cat.isSystem) {
          dupCatIds.push(prev._id);
          seenCatMap.set(norm, cat);
        } else {
          dupCatIds.push(cat._id);
        }
      } else {
        seenCatMap.set(norm, cat);
      }
    }
    if (dupCatIds.length > 0) {
      await categoriesCol.deleteMany({ _id: { $in: dupCatIds } });
    }
  } catch (err) {
    console.error('Error cleaning duplicate categories:', err);
  }

  // 2. Clean up any existing duplicate or corrupted composite people in database
  try {
    const allExistingPeople = await peopleCol.find({}).toArray();
    const seenPeopleMap = new Map<string, any>();
    const dupPeopleIds: any[] = [];
    const individualNamesToEnsure = new Set<string>();

    for (const p of allExistingPeople) {
      const rawName = (p.name || '').trim();
      const lower = rawName.toLowerCase();
      // Detect corrupted names like "(+Nitesh, Sahil, Richa sponsored) Nitesh, Sahil"
      if (!rawName || lower.includes('sponsored') || rawName.includes('(') || rawName.includes(')') || rawName.includes('+') || rawName.includes(',')) {
        dupPeopleIds.push(p._id);
        // Extract any individual names from comma-separated parts
        const stripped = rawName.replace(/\([^)]*\)/g, '').replace(/\+/g, '');
        const parts = stripped.split(',').map((s: string) => s.trim()).filter((s: string) => s && !s.toLowerCase().includes('sponsored'));
        for (const part of parts) {
          if (part.length > 1 && !part.includes('(') && !part.includes(')')) {
            individualNamesToEnsure.add(part);
          }
        }
        continue;
      }
      if (seenPeopleMap.has(lower)) {
        const prev = seenPeopleMap.get(lower);
        if ((!prev.contact && p.contact) || (!prev.email && p.email) || (!prev.isDefault && p.isDefault)) {
          dupPeopleIds.push(prev._id);
          seenPeopleMap.set(lower, p);
        } else {
          dupPeopleIds.push(p._id);
        }
      } else {
        seenPeopleMap.set(lower, p);
      }
    }
    if (dupPeopleIds.length > 0) {
      await peopleCol.deleteMany({ _id: { $in: dupPeopleIds } });
    }

    // Ensure extracted individual people exist with clean profile
    for (const cleanName of individualNamesToEnsure) {
      const lower = cleanName.toLowerCase();
      if (!seenPeopleMap.has(lower)) {
        const newPerson: Person = {
          id: crypto.randomUUID(),
          name: cleanName,
          contact: '',
          isDefault: false,
          notes: 'Auto-extracted companion',
          createdAt: now,
          updatedAt: now
        };
        await peopleCol.insertOne(newPerson);
        seenPeopleMap.set(lower, newPerson);
      }
    }
  } catch (err) {
    console.error('Error cleaning duplicate/corrupted people:', err);
  }

  // 3. Unify and migrate all people across the whole finance system
  const lendNames: string[] = await lendsCol.distinct('personName');
  const borrowNames: string[] = await borrowsCol.distinct('personName');
  const splitNames: string[] = await expensesCol.distinct('splitPersonName');
  const splitItemNames: string[] = await expensesCol.distinct('splits.personName');
  const paidByNames: string[] = await expensesCol.distinct('paidByPersonName');
  const backlogSplitNames: string[] = await backlogCol.distinct('splitPersonName');

  const peopleNameMap = new Map<string, string>();
  for (const n of [...lendNames, ...borrowNames, ...splitNames, ...splitItemNames, ...paidByNames, ...backlogSplitNames]) {
    const raw = (n || '').trim();
    if (!raw) continue;
    // Strip parenthetical notes like (sponsored)
    const stripped = raw.replace(/\([^)]*\)/g, '').replace(/\+/g, '');
    // Split by comma in case multiple names were stored in splitPersonName
    const tokens = stripped.split(',').map((s: string) => s.trim()).filter((s: string) => s && !s.toLowerCase().includes('sponsored'));
    for (const singleName of tokens) {
      const lower = singleName.toLowerCase();
      if (singleName.length > 1 && !singleName.includes('(') && !singleName.includes(')') && !peopleNameMap.has(lower)) {
        peopleNameMap.set(lower, singleName);
      }
    }
  }

  const freshPeople = await peopleCol.find({}).toArray();
  const existingNamesSet = new Set(freshPeople.map((p: any) => (p.name || '').trim().toLowerCase()));

  for (const [lowerName, originalName] of peopleNameMap.entries()) {
    if (!existingNamesSet.has(lowerName)) {
      const newPerson: Person = {
        id: crypto.randomUUID(),
        name: originalName,
        contact: '',
        isDefault: false,
        notes: 'Auto-migrated companion',
        createdAt: now,
        updatedAt: now
      };
      await peopleCol.insertOne(newPerson);
      existingNamesSet.add(lowerName);
    }
  }

  // 4. Seed / Migrate Categories
  const DEFAULT_CATEGORIES = [
    'Food & Dining', 'Transport & Fuel', 'Groceries', 'Entertainment & Outing',
    'Shopping', 'Health & Medical', 'Bills & Utilities', 'Work & Tools',
    'Education', 'Travel & Stay', 'Miscellaneous'
  ];

  const expenseCategories: string[] = await expensesCol.distinct('category');
  const setCategories: string[] = await setsCol.distinct('category');

  const categoryMap = new Map<string, string>();
  for (const c of [...DEFAULT_CATEGORIES, ...expenseCategories, ...setCategories]) {
    const trimmed = (c || '').trim();
    if (trimmed && !categoryMap.has(trimmed.toLowerCase())) {
      categoryMap.set(trimmed.toLowerCase(), trimmed);
    }
  }

  const freshCats = await categoriesCol.find({}).toArray();
  const existingCatNames = new Set(freshCats.map((c: any) => c.name.trim().toLowerCase()));

  for (const [lowerCat, originalCat] of categoryMap.entries()) {
    if (!existingCatNames.has(lowerCat)) {
      await categoriesCol.insertOne({
        id: crypto.randomUUID(),
        name: originalCat,
        color: '#4f46e5',
        icon: 'tag',
        isSystem: DEFAULT_CATEGORIES.some(dc => dc.toLowerCase() === lowerCat),
        createdAt: now,
        updatedAt: now
      });
      existingCatNames.add(lowerCat);
    }
  }

  // Backfill links between split lends and expenses
  await backfillLendsAssociation(db);
}

async function backfillLendsAssociation(db: any) {
  try {
    const lendsCol = db.collection('finance_lends');
    const expensesCol = db.collection('finance_expenses');
    const unlinkedLends = await lendsCol.find({
      $or: [
        { sourceExpenseId: { $exists: false } },
        { sourceExpenseId: null },
        { expenseSetId: { $exists: false } }
      ],
      notes: { $regex: /^Split from:/i }
    }).toArray();

    for (const lend of unlinkedLends) {
      const match = (lend.notes || '').match(/^Split from:\s*([^(]+?)(?:\s*\([^)]*\))?$/);
      const desc = match ? match[1].trim() : (lend.notes || '').replace(/^Split from:\s*/i, '').trim();
      if (desc) {
        const exp = await expensesCol.findOne({
          description: { $regex: new RegExp(`^${escapeRegex(desc)}$`, 'i') }
        });
        if (exp) {
          await lendsCol.updateOne(
            { _id: lend._id },
            {
              $set: {
                sourceExpenseId: exp.id,
                expenseSetId: exp.expenseSetId || null,
                groupId: exp.groupId || null
              }
            }
          );
        }
      }
    }
  } catch (err) {
    console.error('Backfill lends warning:', err);
  }
}

export async function financeHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const token = extractToken(request);

  // Require valid session for finance data security
  const isValid = await verifySession(token);
  if (!isValid) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: { error: 'Unauthorized. Please sign in to access Finance records.' }
    };
  }

  try {
    const db = await connectToMongo();
    const setsCol = db.collection('finance_expense_sets');
    const expensesCol = db.collection('finance_expenses');
    const lendsCol = db.collection('finance_lends');
    const borrowsCol = db.collection('finance_borrows');
    const peopleCol = db.collection('finance_people');
    const backlogCol = db.collection('finance_bank_backlog');
    const categoriesCol = db.collection('finance_categories');
    const groupsCol = db.collection('finance_groups');
    const settingsCol = db.collection('finance_settings');

    const url = new URL(request.url);
    const pathParts = url.pathname.replace(/^\/api\/finance\/?/, '').split('/').filter(Boolean);
    const resource = pathParts[0] || 'overview';
    const resourceId = pathParts[1] || null;
    const subAction = pathParts[2] || null;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. OVERVIEW: GET /api/finance/overview
    // ─────────────────────────────────────────────────────────────────────────
    if (method === 'GET' && resource === 'overview') {
      const now = new Date();
      const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // All expenses for current month
      const allExpenses = await expensesCol.find({}).toArray();
      const monthExpenses = allExpenses.filter(e => (e.date || '').startsWith(currentMonthPrefix));

      const totalSpentThisMonth = monthExpenses
        .filter(e => !e.isRotation)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      const totalRotationsThisMonth = monthExpenses
        .filter(e => e.isRotation)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      // Active lends
      const allLends = await lendsCol.find({}).toArray();
      const activeLends = allLends.filter(l => l.status === 'active' || l.status === 'partially_returned');
      const totalLentBalance = activeLends.reduce((sum, l) => {
        const paid = (l.repayments || []).reduce((pSum: number, r: any) => pSum + (Number(r.amount) || 0), 0);
        return sum + Math.max(0, (Number(l.amount) || 0) - paid);
      }, 0);

      // Active borrows
      const allBorrows = await borrowsCol.find({}).toArray();
      const activeBorrows = allBorrows.filter(b => b.status === 'active' || b.status === 'partially_repaid');
      const totalBorrowedBalance = activeBorrows.reduce((sum, b) => {
        const paid = (b.repayments || []).reduce((pSum: number, r: any) => pSum + (Number(r.amount) || 0), 0);
        return sum + Math.max(0, (Number(b.amount) || 0) - paid);
      }, 0);

      // Active expense sets with calculated spent totals
      const activeSets = await setsCol.find({ status: 'active' }).toArray();
      const setsWithTotals = activeSets.map(s => {
        const setExpenses = allExpenses.filter(e => e.expenseSetId === s.id);
        const spent = setExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        return {
          ...s,
          spent,
          entryCount: setExpenses.length
        };
      });

      // Overdue items
      const todayStr = now.toISOString().slice(0, 10);
      const overdueLends = activeLends.filter(l => l.expectedReturnDate && l.expectedReturnDate < todayStr);
      const overdueBorrows = activeBorrows.filter(b => b.expectedReturnDate && b.expectedReturnDate < todayStr);

      // Recent 10 expenses
      const recentExpenses = allExpenses
        .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')))
        .slice(0, 10);

      // Pending Bank Backlog
      const pendingBacklog = await backlogCol.find({ status: 'pending' }).sort({ date: -1, createdAt: -1 }).toArray();
      const allPeople = await peopleCol.find({}).toArray();

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          totalSpentThisMonth,
          totalRotationsThisMonth,
          totalLentBalance,
          totalBorrowedBalance,
          activeSets: setsWithTotals,
          recentExpenses,
          overdueCount: overdueLends.length + overdueBorrows.length,
          pendingBacklogCount: pendingBacklog.length,
          pendingBacklog: pendingBacklog.slice(0, 5),
          activePeopleCount: allPeople.length
        }
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. EXPENSE SETS: /api/finance/expense-sets
    // ─────────────────────────────────────────────────────────────────────────
    if (resource === 'expense-sets') {
      if (method === 'GET') {
        const sets = await setsCol.find({}).sort({ createdAt: -1 }).toArray();
        const expenses = await expensesCol.find({}).toArray();
        const enriched = sets.map(s => {
          const matched = expenses.filter(e => e.expenseSetId === s.id);
          const totalSpent = matched.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
          return {
            ...s,
            totalSpent,
            entryCount: matched.length
          };
        });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: enriched };
      }

      if (method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        if (!body.name || !body.name.trim()) {
          return { status: 400, jsonBody: { error: 'Expense Set name is required.' } };
        }
        const now = new Date().toISOString();
        const newSet: ExpenseSet = {
          id: body.id || crypto.randomUUID(),
          name: body.name.trim(),
          category: body.category || 'General',
          budget: body.budget ? Number(body.budget) : null,
          currency: body.currency || 'NPR',
          startDate: body.startDate || now.slice(0, 10),
          endDate: body.endDate || null,
          status: body.status || 'active',
          notes: body.notes || '',
          createdAt: now,
          updatedAt: now
        };
        await setsCol.insertOne(newSet);
        return { status: 201, headers: { 'Content-Type': 'application/json' }, jsonBody: newSet };
      }

      if (method === 'PUT' && resourceId) {
        const body: any = await request.json().catch(() => ({}));
        const now = new Date().toISOString();
        const updates: any = { updatedAt: now };
        if (body.name !== undefined) updates.name = body.name.trim();
        if (body.category !== undefined) updates.category = body.category;
        if (body.budget !== undefined) updates.budget = body.budget ? Number(body.budget) : null;
        if (body.startDate !== undefined) updates.startDate = body.startDate;
        if (body.endDate !== undefined) updates.endDate = body.endDate;
        if (body.status !== undefined) updates.status = body.status;
        if (body.notes !== undefined) updates.notes = body.notes;

        await setsCol.updateOne({ id: resourceId }, { $set: updates });
        const updated = await setsCol.findOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: updated };
      }

      if (method === 'DELETE' && resourceId) {
        await setsCol.deleteOne({ id: resourceId });
        // Optionally unbind expenses
        await expensesCol.updateMany({ expenseSetId: resourceId }, { $set: { expenseSetId: null } });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, id: resourceId } };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. EXPENSES: /api/finance/expenses
    // ─────────────────────────────────────────────────────────────────────────
    if (resource === 'expenses') {
      if (method === 'GET') {
        const setId = url.searchParams.get('setId');
        const query: any = {};
        if (setId === 'standalone') {
          query.$or = [{ expenseSetId: null }, { expenseSetId: '' }];
        } else if (setId) {
          query.expenseSetId = setId;
        }

        const items = await expensesCol.find(query).sort({ date: -1, createdAt: -1 }).toArray();
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: items };
      }

      if (method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const amount = Number(body.amount);
        const totalAmount = body.totalAmount !== undefined ? Number(body.totalAmount) : amount;
        const currency = body.currency || 'NPR';
        const originalAmount = body.originalAmount !== undefined ? Number(body.originalAmount) : amount;
        const exchangeRate = body.exchangeRate !== undefined ? Number(body.exchangeRate) : 1;
        const groupId = body.groupId || null;

        // Multi-split support:
        const splits: SplitParticipant[] = Array.isArray(body.splits) ? body.splits : [];

        // Single split / legacy support:
        const legacySplitPerson = body.splitWith?.personName?.trim() || body.splitPersonName?.trim() || null;
        const legacySplitAmount = body.splitWith?.amount ? Number(body.splitWith.amount) : body.splitAmount ? Number(body.splitAmount) : null;
        const paidByPersonName = body.paidBy?.personName?.trim() || body.paidByPersonName?.trim() || null;

        if (isNaN(amount) || (amount <= 0 && totalAmount <= 0 && splits.length === 0 && (!legacySplitPerson || !legacySplitAmount || legacySplitAmount <= 0))) {
          return { status: 400, jsonBody: { error: 'Valid positive expense amount is required.' } };
        }
        const now = new Date().toISOString();

        // Calculate summary for backward compatibility
        let finalSplitSummary = legacySplitPerson;
        let finalSplitAmount = legacySplitAmount;

        if (splits.length > 0) {
          const nonSponsored = splits.filter(s => !s.isSponsored && Number(s.amount) > 0);
          const sponsored = splits.filter(s => s.isSponsored && Number(s.amount) > 0);
          const nonSpNames = nonSponsored.map(s => s.personName.trim()).join(', ');
          const spNames = sponsored.length > 0 ? ` (+${sponsored.map(s => s.personName.trim()).join(', ')} sponsored)` : '';
          finalSplitSummary = `${nonSpNames}${spNames}`.trim() || null;
          finalSplitAmount = nonSponsored.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
        }

        let newExpense: ExpenseItem | null = null;
        if (amount > 0 || totalAmount > 0) {
          newExpense = {
            id: body.id || crypto.randomUUID(),
            expenseSetId: body.expenseSetId || null,
            groupId,
            amount: amount >= 0 ? amount : 0,
            totalAmount,
            currency,
            originalAmount,
            exchangeRate,
            category: body.category || 'General',
            description: (body.description || '').trim() || 'Expense',
            date: body.date || now.slice(0, 10),
            time: body.time || now.slice(11, 16),
            paymentMethod: body.paymentMethod || 'Bank / Card',
            isRotation: Boolean(body.isRotation),
            rotationNote: body.rotationNote || null,
            splitPersonName: finalSplitSummary,
            splitAmount: finalSplitAmount,
            splits: splits.length > 0 ? splits : undefined,
            paidByPersonName,
            tags: Array.isArray(body.tags) ? body.tags : [],
            receiptUrl: body.receiptUrl || null,
            createdAt: now,
            updatedAt: now
          };
          await expensesCol.insertOne(newExpense);
        }

        // Auto-create Lend records for participants
        if (splits.length > 0) {
          for (const s of splits) {
            const sAmount = Number(s.amount);
            if (!s.isSponsored && sAmount > 0) {
              const pName = s.personName.trim();
              const pExists = await peopleCol.findOne({ name: { $regex: new RegExp(`^${escapeRegex(pName)}$`, 'i') } });
              if (!pExists) {
                await peopleCol.insertOne({ id: crypto.randomUUID(), name: pName, contact: '', isDefault: false, notes: 'Added via split expense', createdAt: now, updatedAt: now });
              }
              const autoLend: LendItem = {
                id: crypto.randomUUID(),
                sourceExpenseId: newExpense?.id || null,
                expenseSetId: newExpense?.expenseSetId || null,
                groupId: newExpense?.groupId || null,
                personName: pName,
                contact: '',
                amount: sAmount,
                currency,
                originalAmount: s.originalAmount !== undefined ? Number(s.originalAmount) : sAmount,
                lentDate: body.date || now.slice(0, 10),
                expectedReturnDate: body.expectedReturnDate || '',
                isRotation: false,
                status: 'active',
                notes: `Split from: ${(body.description || 'Expense')} (${pName}'s share of ${currency} ${sAmount})`,
                repayments: [],
                createdAt: now,
                updatedAt: now
              };
              await lendsCol.insertOne(autoLend);
            }
          }
        } else if (legacySplitPerson && legacySplitAmount && legacySplitAmount > 0) {
          const pExists = await peopleCol.findOne({ name: { $regex: new RegExp(`^${escapeRegex(legacySplitPerson)}$`, 'i') } });
          if (!pExists) {
            await peopleCol.insertOne({ id: crypto.randomUUID(), name: legacySplitPerson, contact: '', isDefault: false, createdAt: now, updatedAt: now });
          }
          const autoLend: LendItem = {
            id: crypto.randomUUID(),
            sourceExpenseId: newExpense?.id || null,
            expenseSetId: newExpense?.expenseSetId || null,
            groupId: newExpense?.groupId || null,
            personName: legacySplitPerson,
            contact: '',
            amount: legacySplitAmount,
            currency,
            originalAmount: legacySplitAmount,
            lentDate: body.date || now.slice(0, 10),
            expectedReturnDate: body.expectedReturnDate || '',
            isRotation: false,
            status: 'active',
            notes: `Split from: ${(body.description || 'Expense')} (Total: ${amount + legacySplitAmount})`,
            repayments: [],
            createdAt: now,
            updatedAt: now
          };
          await lendsCol.insertOne(autoLend);
        }

        // If paid by someone else on user's behalf -> auto-create Borrow record & ensure person exists
        if (paidByPersonName) {
          const pExists = await peopleCol.findOne({ name: { $regex: new RegExp(`^${escapeRegex(paidByPersonName)}$`, 'i') } });
          if (!pExists) {
            await peopleCol.insertOne({ id: crypto.randomUUID(), name: paidByPersonName, contact: '', isDefault: false, createdAt: now, updatedAt: now });
          }
          const autoBorrow: BorrowItem = {
            id: crypto.randomUUID(),
            sourceExpenseId: newExpense?.id || null,
            expenseSetId: newExpense?.expenseSetId || null,
            groupId: newExpense?.groupId || null,
            personName: paidByPersonName,
            contact: '',
            amount,
            currency,
            originalAmount,
            borrowedDate: newExpense?.date || now.slice(0, 10),
            expectedReturnDate: '',
            isRotation: false,
            status: 'active',
            notes: `Paid on my behalf: ${newExpense?.description || body.description || 'Expense'}`,
            repayments: [],
            createdAt: now,
            updatedAt: now
          };
          await borrowsCol.insertOne(autoBorrow);
        }

        return { status: 201, headers: { 'Content-Type': 'application/json' }, jsonBody: newExpense };
      }

      if (method === 'PUT' && resourceId) {
        const body: any = await request.json().catch(() => ({}));
        const now = new Date().toISOString();
        const updates: any = { updatedAt: now };
        if (body.amount !== undefined) updates.amount = Number(body.amount);
        if (body.totalAmount !== undefined) updates.totalAmount = Number(body.totalAmount);
        if (body.currency !== undefined) updates.currency = body.currency;
        if (body.originalAmount !== undefined) updates.originalAmount = Number(body.originalAmount);
        if (body.exchangeRate !== undefined) updates.exchangeRate = Number(body.exchangeRate);
        if (body.groupId !== undefined) updates.groupId = body.groupId || null;
        if (body.splits !== undefined) updates.splits = body.splits;
        if (body.category !== undefined) updates.category = body.category;
        if (body.description !== undefined) updates.description = body.description;
        if (body.date !== undefined) updates.date = body.date;
        if (body.time !== undefined) updates.time = body.time;
        if (body.paymentMethod !== undefined) updates.paymentMethod = body.paymentMethod;
        if (body.expenseSetId !== undefined) updates.expenseSetId = body.expenseSetId || null;
        if (body.isRotation !== undefined) updates.isRotation = Boolean(body.isRotation);
        if (body.rotationNote !== undefined) updates.rotationNote = body.rotationNote;
        if (body.tags !== undefined) updates.tags = body.tags;

        await expensesCol.updateOne({ id: resourceId }, { $set: updates });
        const updated = await expensesCol.findOne({ id: resourceId });

        // If splits are provided on update, re-sync auto-created lends
        if (body.splits !== undefined) {
          await lendsCol.deleteMany({ sourceExpenseId: resourceId });
          const newSplits: SplitParticipant[] = body.splits || [];
          for (const s of newSplits) {
            const sAmount = Number(s.amount);
            if (!s.isSponsored && sAmount > 0) {
              const pName = s.personName.trim();
              const pExists = await peopleCol.findOne({ name: { $regex: new RegExp(`^${escapeRegex(pName)}$`, 'i') } });
              if (!pExists) {
                await peopleCol.insertOne({ id: crypto.randomUUID(), name: pName, contact: '', isDefault: false, notes: 'Added via split expense', createdAt: now, updatedAt: now });
              }
              const autoLend: LendItem = {
                id: crypto.randomUUID(),
                sourceExpenseId: resourceId,
                expenseSetId: body.expenseSetId !== undefined ? (body.expenseSetId || null) : (updated?.expenseSetId || null),
                groupId: body.groupId !== undefined ? (body.groupId || null) : (updated?.groupId || null),
                personName: pName,
                contact: '',
                amount: sAmount,
                currency: body.currency || updated?.currency || 'NPR',
                originalAmount: s.originalAmount !== undefined ? Number(s.originalAmount) : sAmount,
                lentDate: body.date || updated?.date || now.slice(0, 10),
                expectedReturnDate: body.expectedReturnDate || '',
                isRotation: false,
                status: 'active',
                notes: `Split from: ${(body.description || updated?.description || 'Expense')} (${pName}'s share)`,
                repayments: [],
                createdAt: now,
                updatedAt: now
              };
              await lendsCol.insertOne(autoLend);
            }
          }
        } else if (body.expenseSetId !== undefined) {
          // If expenseSetId changed, sync existing child lends
          await lendsCol.updateMany(
            { sourceExpenseId: resourceId },
            { $set: { expenseSetId: body.expenseSetId || null } }
          );
        }

        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: updated };
      }

      if (method === 'DELETE' && resourceId) {
        const expenseToDelete = await expensesCol.findOne({ id: resourceId });

        // 1. Cascading delete of lends and borrows created by this root expense
        await lendsCol.deleteMany({ sourceExpenseId: resourceId });
        await borrowsCol.deleteMany({ sourceExpenseId: resourceId });

        // 2. Fallback cleanup for legacy lends without sourceExpenseId
        if (expenseToDelete) {
          const descRegex = new RegExp(`^Split from:\\s*${escapeRegex(expenseToDelete.description)}`, 'i');
          await lendsCol.deleteMany({
            sourceExpenseId: { $in: [null, undefined] },
            notes: { $regex: descRegex }
          });
          const borrowDescRegex = new RegExp(`Paid by.*for\\s*${escapeRegex(expenseToDelete.description)}`, 'i');
          await borrowsCol.deleteMany({
            sourceExpenseId: { $in: [null, undefined] },
            notes: { $regex: borrowDescRegex }
          });
        }

        // 3. Reset any backlog references
        await backlogCol.updateMany(
          { reconciledExpenseId: resourceId },
          { $set: { status: 'pending', reconciledExpenseId: null, reconciledLendId: null } }
        );

        await expensesCol.deleteOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, id: resourceId } };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. LENDS (Money Given): /api/finance/lends
    // ─────────────────────────────────────────────────────────────────────────
    if (resource === 'lends') {
      if (method === 'GET') {
        await backfillLendsAssociation(db);
        const items = await lendsCol.find({}).sort({ lentDate: -1, createdAt: -1 }).toArray();
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: items };
      }

      if (method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        // Check if this is a reminder toggle sub-action
        if (resourceId && subAction === 'remind') {
          const lend = await lendsCol.findOne({ id: resourceId });
          if (!lend) return { status: 404, jsonBody: { error: 'Lend record not found.' } };
          const reminderSent = body.reminderSent !== undefined ? Boolean(body.reminderSent) : !lend.reminderSent;
          await lendsCol.updateOne(
            { id: resourceId },
            { $set: { reminderSent, reminderSentAt: reminderSent ? new Date().toISOString() : null, updatedAt: new Date().toISOString() } }
          );
          const updated = await lendsCol.findOne({ id: resourceId });
          return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: updated };
        }

        // Check if this is a repayment sub-action
        if (resourceId && subAction === 'repay') {
          const lend = await lendsCol.findOne({ id: resourceId });
          if (!lend) return { status: 404, jsonBody: { error: 'Lend record not found.' } };
          const repayAmount = Number(body.amount);
          if (isNaN(repayAmount) || repayAmount <= 0) {
            return { status: 400, jsonBody: { error: 'Valid repayment amount is required.' } };
          }
          const repayment: RepaymentRecord = {
            id: crypto.randomUUID(),
            amount: repayAmount,
            date: body.date || new Date().toISOString().slice(0, 10),
            notes: body.notes || ''
          };
          const updatedRepayments = [...(lend.repayments || []), repayment];
          const totalPaid = updatedRepayments.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
          const newStatus = totalPaid >= lend.amount ? 'returned' : 'partially_returned';

          await lendsCol.updateOne(
            { id: resourceId },
            { $set: { repayments: updatedRepayments, status: newStatus, updatedAt: new Date().toISOString() } }
          );
          const updated = await lendsCol.findOne({ id: resourceId });
          return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: updated };
        }

        const amount = Number(body.amount);
        if (!body.personName || !body.personName.trim() || isNaN(amount) || amount <= 0) {
          return { status: 400, jsonBody: { error: 'Person name and valid amount are required.' } };
        }
        const now = new Date().toISOString();
        const pName = body.personName.trim();
        let contact = (body.contact || '').trim();
        const existingPerson = await peopleCol.findOne({ name: { $regex: new RegExp(`^${escapeRegex(pName)}$`, 'i') } });
        if (!contact && existingPerson?.contact) {
          contact = existingPerson.contact;
        } else if (!existingPerson) {
          await peopleCol.insertOne({
            id: crypto.randomUUID(),
            name: pName,
            contact,
            isDefault: false,
            createdAt: now,
            updatedAt: now
          });
        }

        const currency = body.currency || 'NPR';
        const originalAmount = body.originalAmount !== undefined ? Number(body.originalAmount) : amount;

        const newLend: LendItem = {
          id: body.id || crypto.randomUUID(),
          personName: pName,
          contact,
          amount,
          currency,
          originalAmount,
          lentDate: body.lentDate || now.slice(0, 10),
          expectedReturnDate: body.expectedReturnDate || '',
          isRotation: Boolean(body.isRotation),
          status: 'active',
          reminderSent: false,
          notes: body.notes || '',
          repayments: [],
          createdAt: now,
          updatedAt: now
        };
        await lendsCol.insertOne(newLend);
        return { status: 201, headers: { 'Content-Type': 'application/json' }, jsonBody: newLend };
      }

      if (method === 'PUT' && resourceId) {
        const body: any = await request.json().catch(() => ({}));
        const now = new Date().toISOString();
        const updates: any = { updatedAt: now };
        if (body.personName !== undefined) updates.personName = body.personName.trim();
        if (body.contact !== undefined) updates.contact = body.contact;
        if (body.amount !== undefined) updates.amount = Number(body.amount);
        if (body.currency !== undefined) updates.currency = body.currency;
        if (body.originalAmount !== undefined) updates.originalAmount = Number(body.originalAmount);
        if (body.lentDate !== undefined) updates.lentDate = body.lentDate;
        if (body.expectedReturnDate !== undefined) updates.expectedReturnDate = body.expectedReturnDate;
        if (body.isRotation !== undefined) updates.isRotation = Boolean(body.isRotation);
        if (body.status !== undefined) updates.status = body.status;
        if (body.reminderSent !== undefined) updates.reminderSent = Boolean(body.reminderSent);
        if (body.reminderSentAt !== undefined) updates.reminderSentAt = body.reminderSentAt;
        if (body.notes !== undefined) updates.notes = body.notes;

        await lendsCol.updateOne({ id: resourceId }, { $set: updates });
        const updated = await lendsCol.findOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: updated };
      }

      if (method === 'DELETE' && resourceId) {
        await lendsCol.deleteOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, id: resourceId } };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. BORROWS (Money Taken): /api/finance/borrows
    // ─────────────────────────────────────────────────────────────────────────
    if (resource === 'borrows') {
      if (method === 'GET') {
        const items = await borrowsCol.find({}).sort({ borrowedDate: -1, createdAt: -1 }).toArray();
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: items };
      }

      if (method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        // Check if this is a repayment sub-action
        if (resourceId && subAction === 'repay') {
          const borrow = await borrowsCol.findOne({ id: resourceId });
          if (!borrow) return { status: 404, jsonBody: { error: 'Borrow record not found.' } };
          const repayAmount = Number(body.amount);
          if (isNaN(repayAmount) || repayAmount <= 0) {
            return { status: 400, jsonBody: { error: 'Valid repayment amount is required.' } };
          }
          const repayment: RepaymentRecord = {
            id: crypto.randomUUID(),
            amount: repayAmount,
            date: body.date || new Date().toISOString().slice(0, 10),
            notes: body.notes || ''
          };
          const updatedRepayments = [...(borrow.repayments || []), repayment];
          const totalPaid = updatedRepayments.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
          const newStatus = totalPaid >= borrow.amount ? 'repaid' : 'partially_repaid';

          await borrowsCol.updateOne(
            { id: resourceId },
            { $set: { repayments: updatedRepayments, status: newStatus, updatedAt: new Date().toISOString() } }
          );
          const updated = await borrowsCol.findOne({ id: resourceId });
          return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: updated };
        }

        const amount = Number(body.amount);
        if (!body.personName || !body.personName.trim() || isNaN(amount) || amount <= 0) {
          return { status: 400, jsonBody: { error: 'Lender name and valid amount are required.' } };
        }
        const now = new Date().toISOString();
        const pName = body.personName.trim();
        let contact = (body.contact || '').trim();
        const existingPerson = await peopleCol.findOne({ name: { $regex: new RegExp(`^${escapeRegex(pName)}$`, 'i') } });
        if (!contact && existingPerson?.contact) {
          contact = existingPerson.contact;
        } else if (!existingPerson) {
          await peopleCol.insertOne({
            id: crypto.randomUUID(),
            name: pName,
            contact,
            isDefault: false,
            createdAt: now,
            updatedAt: now
          });
        }

        const currency = body.currency || 'NPR';
        const originalAmount = body.originalAmount !== undefined ? Number(body.originalAmount) : amount;

        const newBorrow: BorrowItem = {
          id: body.id || crypto.randomUUID(),
          personName: pName,
          contact,
          amount,
          currency,
          originalAmount,
          borrowedDate: body.borrowedDate || now.slice(0, 10),
          expectedReturnDate: body.expectedReturnDate || '',
          isRotation: Boolean(body.isRotation),
          status: 'active',
          notes: body.notes || '',
          repayments: [],
          createdAt: now,
          updatedAt: now
        };
        await borrowsCol.insertOne(newBorrow);
        return { status: 201, headers: { 'Content-Type': 'application/json' }, jsonBody: newBorrow };
      }

      if (method === 'PUT' && resourceId) {
        const body: any = await request.json().catch(() => ({}));
        const now = new Date().toISOString();
        const updates: any = { updatedAt: now };
        if (body.personName !== undefined) updates.personName = body.personName.trim();
        if (body.contact !== undefined) updates.contact = body.contact;
        if (body.amount !== undefined) updates.amount = Number(body.amount);
        if (body.currency !== undefined) updates.currency = body.currency;
        if (body.originalAmount !== undefined) updates.originalAmount = Number(body.originalAmount);
        if (body.borrowedDate !== undefined) updates.borrowedDate = body.borrowedDate;
        if (body.expectedReturnDate !== undefined) updates.expectedReturnDate = body.expectedReturnDate;
        if (body.isRotation !== undefined) updates.isRotation = Boolean(body.isRotation);
        if (body.status !== undefined) updates.status = body.status;
        if (body.notes !== undefined) updates.notes = body.notes;

        await borrowsCol.updateOne({ id: resourceId }, { $set: updates });
        const updated = await borrowsCol.findOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: updated };
      }

      if (method === 'DELETE' && resourceId) {
        await borrowsCol.deleteOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, id: resourceId } };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. PEOPLE & LEDGERS: /api/finance/people
    // ─────────────────────────────────────────────────────────────────────────
    if (resource === 'people') {
      if (method === 'GET') {
        // Run migration to guarantee all names across lends, borrows, and shared expenses are synced as users
        await migratePeopleAndCategories(db);

        const people = await peopleCol.find({
          name: { $not: { $regex: /sponsored|\(|\)|\+|,/i } }
        }).sort({ isDefault: -1, name: 1 }).toArray();
        const lends = await lendsCol.find({}).toArray();
        const borrows = await borrowsCol.find({}).toArray();
        const expenses = await expensesCol.find({}).toArray();

        const enriched = people.map((p: any) => {
          const personLends = lends.filter(l => (l.personName || '').trim().toLowerCase() === (p.name || '').trim().toLowerCase());
          const totalLent = personLends.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
          const lendRepayments = personLends.reduce((sum, l) => {
            return sum + (l.repayments || []).reduce((rSum: number, r: any) => rSum + (Number(r.amount) || 0), 0);
          }, 0);
          const netReceivable = Math.max(0, totalLent - lendRepayments);

          const personBorrows = borrows.filter(b => (b.personName || '').trim().toLowerCase() === (p.name || '').trim().toLowerCase());
          const totalBorrowed = personBorrows.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
          const borrowRepayments = personBorrows.reduce((sum, b) => {
            return sum + (b.repayments || []).reduce((rSum: number, r: any) => rSum + (Number(r.amount) || 0), 0);
          }, 0);
          const netPayable = Math.max(0, totalBorrowed - borrowRepayments);

          const sharedExpensesCount = expenses.filter(e =>
            (e.splitPersonName || '').trim().toLowerCase() === (p.name || '').trim().toLowerCase() ||
            (e.paidByPersonName || '').trim().toLowerCase() === (p.name || '').trim().toLowerCase()
          ).length;

          return {
            ...p,
            netReceivable,
            netPayable,
            netBalance: netReceivable - netPayable, // > 0: Person owes me, < 0: I owe Person
            activeLendsCount: personLends.filter(l => l.status === 'active' || l.status === 'partially_returned').length,
            activeBorrowsCount: personBorrows.filter(b => b.status === 'active' || b.status === 'partially_repaid').length,
            sharedExpensesCount
          };
        });

        const uniquePeopleMap = new Map<string, any>();
        for (const p of enriched as any[]) {
          const raw = (p.name || '').trim();
          const norm = raw.toLowerCase();
          if (norm && !norm.includes('sponsored') && !raw.includes('(') && !raw.includes(')') && !raw.includes('+') && !raw.includes(',') && !uniquePeopleMap.has(norm)) {
            uniquePeopleMap.set(norm, p);
          }
        }
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: Array.from(uniquePeopleMap.values()) };
      }

      if (method === 'POST') {
        // Settle action: /api/finance/people/:id/settle
        if (resourceId && subAction === 'settle') {
          const person = await peopleCol.findOne({ id: resourceId });
          if (!person) return { status: 404, jsonBody: { error: 'Person not found.' } };
          const body: any = await request.json().catch(() => ({}));
          const settleDate = body.date || new Date().toISOString().slice(0, 10);
          const settleNotes = body.notes || 'Full settlement';

          // Close all open lends for this person
          const openLends = await lendsCol.find({
            personName: { $regex: new RegExp(`^${person.name.trim()}$`, 'i') },
            status: { $in: ['active', 'partially_returned'] }
          }).toArray();

          for (const l of openLends) {
            const paid = (l.repayments || []).reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
            const remaining = Math.max(0, l.amount - paid);
            if (remaining > 0) {
              const rep: RepaymentRecord = { id: crypto.randomUUID(), amount: remaining, date: settleDate, notes: settleNotes };
              await lendsCol.updateOne(
                { id: l.id },
                { $push: { repayments: rep } as any, $set: { status: 'returned', updatedAt: new Date().toISOString() } }
              );
            }
          }

          // Close all open borrows from this person
          const openBorrows = await borrowsCol.find({
            personName: { $regex: new RegExp(`^${person.name.trim()}$`, 'i') },
            status: { $in: ['active', 'partially_repaid'] }
          }).toArray();

          for (const b of openBorrows) {
            const paid = (b.repayments || []).reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
            const remaining = Math.max(0, b.amount - paid);
            if (remaining > 0) {
              const rep: RepaymentRecord = { id: crypto.randomUUID(), amount: remaining, date: settleDate, notes: settleNotes };
              await borrowsCol.updateOne(
                { id: b.id },
                { $push: { repayments: rep } as any, $set: { status: 'repaid', updatedAt: new Date().toISOString() } }
              );
            }
          }

          return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, settledPerson: person.name } };
        }

        const body: any = await request.json().catch(() => ({}));
        if (!body.name || !body.name.trim()) {
          return { status: 400, jsonBody: { error: 'Person name is required.' } };
        }
        const name = body.name.trim();
        const existing = await peopleCol.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existing) {
          return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: existing };
        }

        if (body.isDefault) {
          await peopleCol.updateMany({}, { $set: { isDefault: false } });
        }

        const now = new Date().toISOString();
        const newPerson: Person = {
          id: body.id || crypto.randomUUID(),
          name,
          contact: body.contact ? body.contact.trim() : '',
          email: body.email ? body.email.trim() : '',
          isDefault: Boolean(body.isDefault),
          notes: body.notes ? body.notes.trim() : '',
          createdAt: now,
          updatedAt: now
        };
        await peopleCol.insertOne(newPerson);
        return { status: 201, headers: { 'Content-Type': 'application/json' }, jsonBody: newPerson };
      }

      if (method === 'PUT' && resourceId) {
        const body: any = await request.json().catch(() => ({}));
        const existing = await peopleCol.findOne({ id: resourceId });
        if (!existing) return { status: 404, jsonBody: { error: 'Person not found.' } };

        if (body.isDefault) {
          await peopleCol.updateMany({ id: { $ne: resourceId } }, { $set: { isDefault: false } });
        }
        const updates: any = { updatedAt: new Date().toISOString() };
        if (body.name !== undefined && body.name.trim() !== existing.name) {
          const newName = body.name.trim();
          if (!newName) return { status: 400, jsonBody: { error: 'Person name cannot be empty.' } };
          const dup = await peopleCol.findOne({ id: { $ne: resourceId }, name: { $regex: new RegExp(`^${newName}$`, 'i') } });
          if (dup) return { status: 409, jsonBody: { error: 'Another person with this name already exists.' } };
          updates.name = newName;

          // Cascade update across entire finance system
          const oldName = existing.name;
          await lendsCol.updateMany(
            { personName: { $regex: new RegExp(`^${oldName}$`, 'i') } },
            { $set: { personName: newName } }
          );
          await borrowsCol.updateMany(
            { personName: { $regex: new RegExp(`^${oldName}$`, 'i') } },
            { $set: { personName: newName } }
          );
          await expensesCol.updateMany(
            { splitPersonName: { $regex: new RegExp(`^${oldName}$`, 'i') } },
            { $set: { splitPersonName: newName } }
          );
          await expensesCol.updateMany(
            { paidByPersonName: { $regex: new RegExp(`^${oldName}$`, 'i') } },
            { $set: { paidByPersonName: newName } }
          );
          await backlogCol.updateMany(
            { splitPersonName: { $regex: new RegExp(`^${oldName}$`, 'i') } },
            { $set: { splitPersonName: newName } }
          );
        }
        if (body.contact !== undefined) updates.contact = body.contact;
        if (body.email !== undefined) updates.email = body.email ? body.email.trim() : '';
        if (body.isDefault !== undefined) updates.isDefault = Boolean(body.isDefault);
        if (body.notes !== undefined) updates.notes = body.notes;

        await peopleCol.updateOne({ id: resourceId }, { $set: updates });
        const updated = await peopleCol.findOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: updated };
      }

      if (method === 'DELETE' && resourceId) {
        await peopleCol.deleteOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, id: resourceId } };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6b. CATEGORIES MANAGEMENT: /api/finance/categories
    // ─────────────────────────────────────────────────────────────────────────
    if (resource === 'categories') {
      if (method === 'GET') {
        await migratePeopleAndCategories(db);
        const categories = await categoriesCol.find({}).sort({ name: 1 }).toArray();
        const expenses = await expensesCol.find({}).toArray();
        const uniqueCatMap = new Map<string, any>();
        for (const c of categories) {
          const norm = (c.name || '').trim().toLowerCase();
          if (norm && !uniqueCatMap.has(norm)) {
            const count = expenses.filter((e: any) => (e.category || '').trim().toLowerCase() === norm).length;
            uniqueCatMap.set(norm, {
              ...c,
              name: c.name.trim(),
              usageCount: count
            });
          }
        }
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: Array.from(uniqueCatMap.values()) };
      }

      if (method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        if (!body.name || !body.name.trim()) {
          return { status: 400, jsonBody: { error: 'Category name is required.' } };
        }
        const name = body.name.trim();
        const existing = await categoriesCol.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existing) {
          return { status: 409, jsonBody: { error: 'Category with this name already exists.' } };
        }
        const now = new Date().toISOString();
        const newCat: FinanceCategory = {
          id: crypto.randomUUID(),
          name,
          color: body.color || '#4f46e5',
          icon: body.icon || 'tag',
          isSystem: false,
          createdAt: now,
          updatedAt: now
        };
        await categoriesCol.insertOne(newCat);
        return { status: 201, headers: { 'Content-Type': 'application/json' }, jsonBody: newCat };
      }

      if (method === 'PUT' && resourceId) {
        const body: any = await request.json().catch(() => ({}));
        const existing = await categoriesCol.findOne({ id: resourceId });
        if (!existing) return { status: 404, jsonBody: { error: 'Category not found.' } };

        const updates: any = { updatedAt: new Date().toISOString() };
        if (body.name && body.name.trim() !== existing.name) {
          const newName = body.name.trim();
          const dup = await categoriesCol.findOne({ id: { $ne: resourceId }, name: { $regex: new RegExp(`^${newName}$`, 'i') } });
          if (dup) return { status: 409, jsonBody: { error: 'Another category with this name already exists.' } };
          updates.name = newName;

          // Cascade update to expenses & sets
          await expensesCol.updateMany({ category: existing.name }, { $set: { category: newName } });
          await setsCol.updateMany({ category: existing.name }, { $set: { category: newName } });
        }
        if (body.color !== undefined) updates.color = body.color;
        if (body.icon !== undefined) updates.icon = body.icon;

        await categoriesCol.updateOne({ id: resourceId }, { $set: updates });
        const updated = await categoriesCol.findOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: updated };
      }

      if (method === 'DELETE' && resourceId) {
        const existing = await categoriesCol.findOne({ id: resourceId });
        if (!existing) return { status: 404, jsonBody: { error: 'Category not found.' } };
        await categoriesCol.deleteOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, id: resourceId } };
      }
    }

    // Explicit migration endpoint: /api/finance/migrate
    if (resource === 'migrate' && method === 'POST') {
      await migratePeopleAndCategories(db);
      return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, message: 'Finance migration completed successfully.' } };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. BANK SMS BACKLOG (Inbox / Pending Queue): /api/finance/backlog
    // ─────────────────────────────────────────────────────────────────────────
    if (resource === 'backlog') {
      if (method === 'GET') {
        const statusFilter = url.searchParams.get('status') || 'pending';
        const query: any = {};
        if (statusFilter !== 'all') {
          query.status = statusFilter;
        }
        const items = await backlogCol.find(query).sort({ date: -1, createdAt: -1 }).toArray();
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: items };
      }

      if (method === 'POST') {
        // Reconcile: /api/finance/backlog/:id/reconcile
        if (resourceId && subAction === 'reconcile') {
          const item = await backlogCol.findOne({ id: resourceId });
          if (!item) return { status: 404, jsonBody: { error: 'Backlog transaction not found.' } };
          const body: any = await request.json().catch(() => ({}));
          const now = new Date().toISOString();

          // My share expense
          const myAmount = Number(body.myAmount !== undefined ? body.myAmount : body.amount !== undefined ? body.amount : item.amount);
          let createdExpense: any = null;
          if (myAmount > 0) {
            createdExpense = {
              id: crypto.randomUUID(),
              expenseSetId: body.expenseSetId || null,
              amount: myAmount,
              currency: 'NPR',
              category: body.category || 'General',
              description: (body.description || '').trim() || `${item.bank} ${item.upiRef ? `UPI ${item.upiRef}` : 'Transaction'}`,
              date: item.date || now.slice(0, 10),
              time: now.slice(11, 16),
              paymentMethod: 'Bank / Card',
              isRotation: false,
              rotationNote: null,
              splitPersonName: body.splitPersonName || null,
              splitAmount: body.theirAmount ? Number(body.theirAmount) : null,
              tags: ['bank-sms', item.bank.toLowerCase()],
              createdAt: now,
              updatedAt: now
            };
            await expensesCol.insertOne(createdExpense);
          }

          // Split lend
          let createdLend: any = null;
          const theirAmount = Number(body.theirAmount);
          if (body.splitPersonName && theirAmount > 0) {
            const pName = body.splitPersonName.trim();
            const pExists = await peopleCol.findOne({ name: { $regex: new RegExp(`^${pName}$`, 'i') } });
            if (!pExists) {
              await peopleCol.insertOne({ id: crypto.randomUUID(), name: pName, contact: '', isDefault: false, createdAt: now, updatedAt: now });
            }
            createdLend = {
              id: crypto.randomUUID(),
              personName: pName,
              contact: '',
              amount: theirAmount,
              lentDate: item.date || now.slice(0, 10),
              expectedReturnDate: body.expectedReturnDate || '',
              isRotation: false,
              status: 'active',
              notes: `Split from: ${(body.description || 'Expense')} (${item.bank} Total: Rs. ${item.amount})`,
              repayments: [],
              createdAt: now,
              updatedAt: now
            };
            await lendsCol.insertOne(createdLend);
          }

          await backlogCol.updateOne(
            { id: resourceId },
            {
              $set: {
                status: 'reconciled',
                reconciledExpenseId: createdExpense?.id || null,
                reconciledLendId: createdLend?.id || null,
                splitPersonName: body.splitPersonName || null,
                updatedAt: now
              }
            }
          );

          return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, expense: createdExpense, lend: createdLend } };
        }

        // Ignore / Mark Rotated: /api/finance/backlog/:id/ignore
        if (resourceId && subAction === 'ignore') {
          const now = new Date().toISOString();
          await backlogCol.updateOne(
            { id: resourceId },
            { $set: { status: 'rotated_ignored', updatedAt: now } }
          );
          return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, ignored: true } };
        }

        // Insert incoming or deferred SMS
        const body: any = await request.json().catch(() => ({}));
        const upiRef = (body.upiRef || '').trim();
        if (upiRef) {
          const existing = await backlogCol.findOne({ upiRef });
          if (existing) {
            return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { existing: true, item: existing } };
          }
        }
        const now = new Date().toISOString();
        const newItem: BankBacklogItem = {
          id: body.id || crypto.randomUUID(),
          rawSms: body.rawSms || '',
          sender: body.sender || 'BANK',
          bank: body.bank || 'CUB',
          type: body.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
          amount: Number(body.amount) || 0,
          date: body.date || now.slice(0, 10),
          account: body.account || '',
          counterpartyAccount: body.counterpartyAccount || '',
          upiRef: upiRef || undefined,
          status: 'pending',
          createdAt: now,
          updatedAt: now
        };
        await backlogCol.insertOne(newItem);
        return { status: 201, headers: { 'Content-Type': 'application/json' }, jsonBody: newItem };
      }

      if (method === 'DELETE' && resourceId) {
        await backlogCol.deleteOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, id: resourceId } };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. EXPENSE GROUPS: /api/finance/groups
    // ─────────────────────────────────────────────────────────────────────────
    if (resource === 'groups') {
      if (method === 'GET') {
        const groups = await groupsCol.find({}).sort({ name: 1 }).toArray();
        const expenses = await expensesCol.find({}).toArray();
        const enriched = groups.map(g => {
          const groupExpenses = expenses.filter(e => e.groupId === g.id);
          const totalSpent = groupExpenses.reduce((sum, e) => sum + (Number(e.totalAmount || e.amount) || 0), 0);
          return {
            ...g,
            expenseCount: groupExpenses.length,
            totalSpent
          };
        });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: enriched };
      }

      if (method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        if (!body.name || !body.name.trim()) {
          return { status: 400, jsonBody: { error: 'Group name is required.' } };
        }
        const now = new Date().toISOString();
        const rawMembers = Array.isArray(body.members) ? body.members : [];
        const members: string[] = rawMembers.map((m: any) => typeof m === 'string' ? m.trim() : m?.name?.trim()).filter(Boolean);

        // Ensure each group member exists in finance_people
        for (const memberName of members) {
          const exists = await peopleCol.findOne({ name: { $regex: new RegExp(`^${escapeRegex(memberName)}$`, 'i') } });
          if (!exists) {
            await peopleCol.insertOne({
              id: crypto.randomUUID(),
              name: memberName,
              contact: '',
              isDefault: false,
              notes: `Added via Group "${body.name.trim()}"`,
              createdAt: now,
              updatedAt: now
            });
          }
        }

        const newGroup: ExpenseGroup = {
          id: body.id || crypto.randomUUID(),
          name: body.name.trim(),
          description: body.description || '',
          members,
          defaultSplitMode: body.defaultSplitMode || 'equal',
          createdAt: now,
          updatedAt: now
        };
        await groupsCol.insertOne(newGroup);
        return { status: 201, headers: { 'Content-Type': 'application/json' }, jsonBody: newGroup };
      }

      if (method === 'PUT' && resourceId) {
        const body: any = await request.json().catch(() => ({}));
        const now = new Date().toISOString();
        const updates: any = { updatedAt: now };
        if (body.name !== undefined) updates.name = body.name.trim();
        if (body.description !== undefined) updates.description = body.description;
        if (body.defaultSplitMode !== undefined) updates.defaultSplitMode = body.defaultSplitMode;
        if (body.members !== undefined && Array.isArray(body.members)) {
          const members: string[] = body.members.map((m: any) => typeof m === 'string' ? m.trim() : m?.name?.trim()).filter(Boolean);
          updates.members = members;
          for (const memberName of members) {
            const exists = await peopleCol.findOne({ name: { $regex: new RegExp(`^${escapeRegex(memberName)}$`, 'i') } });
            if (!exists) {
              await peopleCol.insertOne({
                id: crypto.randomUUID(),
                name: memberName,
                contact: '',
                isDefault: false,
                notes: 'Added via Group update',
                createdAt: now,
                updatedAt: now
              });
            }
          }
        }

        await groupsCol.updateOne({ id: resourceId }, { $set: updates });
        const updated = await groupsCol.findOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: updated };
      }

      if (method === 'DELETE' && resourceId) {
        await groupsCol.deleteOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, id: resourceId } };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. SETTINGS & DEFAULTS: /api/finance/settings
    // ─────────────────────────────────────────────────────────────────────────
    if (resource === 'settings') {
      const defaultSettings: FinanceSettings = {
        defaultCurrency: 'NPR',
        exchangeRates: {
          NPR: 1.0,
          INR: 1.6, // 1 INR = 1.6 NPR
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

      if (method === 'GET') {
        const saved = await settingsCol.findOne({ _id: 'global_finance_settings' as any });
        if (!saved) {
          return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: defaultSettings };
        }
        const { _id, ...settingsData } = saved;
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { ...defaultSettings, ...settingsData } };
      }

      if (method === 'POST' || method === 'PUT') {
        const body: any = await request.json().catch(() => ({}));
        const now = new Date().toISOString();
        const updated: FinanceSettings = {
          defaultCurrency: body.defaultCurrency || 'NPR',
          exchangeRates: {
            NPR: Number(body.exchangeRates?.NPR) || 1.0,
            INR: Number(body.exchangeRates?.INR) || 1.6,
            USD: Number(body.exchangeRates?.USD) || 134.5,
            EUR: Number(body.exchangeRates?.EUR) || 142.0
          },
          defaultPaymentMethod: body.defaultPaymentMethod || 'Bank / Card',
          defaultCompanion: body.defaultCompanion !== undefined ? body.defaultCompanion : '',
          defaultExpenseGroup: body.defaultExpenseGroup !== undefined ? body.defaultExpenseGroup : '',
          defaultCategory: body.defaultCategory || 'Food & Dining',
          defaultDateOption: body.defaultDateOption || 'today',
          customDefaultDate: body.customDefaultDate !== undefined ? body.customDefaultDate : '',
          defaultSplitMode: body.defaultSplitMode || 'none',
          updatedAt: now
        };
        await settingsCol.updateOne(
          { _id: 'global_finance_settings' as any },
          { $set: updated },
          { upsert: true }
        );
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: updated };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. SEND SETTLEMENT & REMINDER EMAIL: POST /api/finance/send-reminder-email
    // ─────────────────────────────────────────────────────────────────────────
    if (method === 'POST' && (resource === 'send-reminder-email' || resource === 'remind-email')) {
      const body: any = await request.json().catch(() => ({}));
      const {
        personName,
        email,
        setName,
        totalReceivable = 0,
        totalSponsored = 0,
        items = [],
        sponsoredItems = [],
        customMessage = '',
        lendIds = []
      } = body;

      if (!email || !email.includes('@')) {
        return { status: 400, jsonBody: { error: 'Valid recipient email address is required.' } };
      }

      if (!personName) {
        return { status: 400, jsonBody: { error: 'Person name is required.' } };
      }

      // Check if GMAIL_APP_PASSWORD is set
      if (!process.env.GMAIL_APP_PASSWORD) {
        return {
          status: 500,
          jsonBody: { error: 'Email service not configured on server (missing GMAIL_APP_PASSWORD).' }
        };
      }

      // If person has no email in database yet, save it
      try {
        await peopleCol.updateOne(
          { name: { $regex: new RegExp(`^${escapeRegex(personName.trim())}$`, 'i') }, $or: [{ email: '' }, { email: { $exists: false } }] },
          { $set: { email: email.trim(), updatedAt: new Date().toISOString() } }
        );
      } catch {}

      // Format clean responsive HTML email
      const safePerson = personName.trim();
      const safeSet = (setName || '').trim();
      const subject = safeSet
        ? `Expense & Settlement Summary: ${safeSet} • Shudkara`
        : `Payment Settlement Summary • Shudkara`;

      const itemsHtml = items.length > 0
        ? `
          <h4 style="margin: 20px 0 8px; font-size: 14px; font-weight: 700; color: #1e293b;">Shared Expenses / Balance to Settle</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left; color: #64748b;">
                <th style="padding: 8px 10px;">Date</th>
                <th style="padding: 8px 10px;">Description</th>
                <th style="padding: 8px 10px; text-align: right;">Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((it: any) => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 10px; color: #64748b; white-space: nowrap;">${it.date || '—'}</td>
                  <td style="padding: 8px 10px; color: #334155; font-weight: 500;">
                    ${it.description || it.notes || 'Trip split expense'}
                  </td>
                  <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #047857;">
                    Rs. ${Number(it.amount || 0).toLocaleString()}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
        : '';

      const sponsoredHtml = sponsoredItems.length > 0
        ? `
          <h4 style="margin: 20px 0 8px; font-size: 14px; font-weight: 700; color: #4338ca;">🎁 Sponsored / Covered by Shudarsan (Gifted • No return required)</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
            <thead>
              <tr style="background: #eef2ff; border-bottom: 2px solid #c7d2fe; text-align: left; color: #4338ca;">
                <th style="padding: 8px 10px;">Date</th>
                <th style="padding: 8px 10px;">Treated Item</th>
                <th style="padding: 8px 10px; text-align: right;">Covered Amount</th>
              </tr>
            </thead>
            <tbody>
              ${sponsoredItems.map((sp: any) => `
                <tr style="border-bottom: 1px solid #e0e7ff;">
                  <td style="padding: 8px 10px; color: #6366f1; white-space: nowrap;">${sp.date || '—'}</td>
                  <td style="padding: 8px 10px; color: #3730a3; font-weight: 500;">
                    ${sp.description || 'Sponsored treat'}
                  </td>
                  <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #4338ca;">
                    Rs. ${Number(sp.amount || 0).toLocaleString()}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
        : '';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px; margin: 0; color: #1e293b;">
          <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); padding: 24px 28px; color: #ffffff;">
              <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Shudkara Finance</h2>
              <p style="margin: 0; font-size: 13px; opacity: 0.9;">
                ${safeSet ? `Settlement details for ${safeSet}` : 'Expense & Settlement Reminder'}
              </p>
            </div>

            <!-- Body -->
            <div style="padding: 24px 28px;">
              <p style="font-size: 15px; margin: 0 0 16px; color: #0f172a;">
                Hi <strong>${safePerson}</strong>,
              </p>
              <p style="font-size: 13px; line-height: 1.5; color: #475569; margin: 0 0 20px;">
                ${customMessage || `Here is a consolidated breakdown of our shared expenses and settlement for <strong>${safeSet || 'our recent outings'}</strong>.`}
              </p>

              <!-- Net Summary Banner -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between;">
                <div>
                  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Remaining to Settle</div>
                  <div style="font-size: 24px; font-weight: 900; color: #047857; margin-top: 2px;">
                    Rs. ${Number(totalReceivable).toLocaleString()}
                  </div>
                </div>
                ${totalSponsored > 0 ? `
                  <div style="text-align: right;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6366f1; letter-spacing: 0.05em;">🎁 Sponsored / Gifted</div>
                    <div style="font-size: 18px; font-weight: 800; color: #4338ca; margin-top: 4px;">
                      Rs. ${Number(totalSponsored).toLocaleString()}
                    </div>
                  </div>
                ` : ''}
              </div>

              ${itemsHtml}
              ${sponsoredHtml}

              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; line-height: 1.5;">
                Whenever you get a moment, you can settle the remaining balance via your preferred payment app (eSewa / Khalti / Bank transfer). Thank you!
              </div>
            </div>

            <!-- Footer -->
            <div style="background: #f8fafc; padding: 14px 28px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
              Sent automatically from Shudkara Finance System
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        const mailResult = await sendSafeMail({
          from: `"Shudkara Finance" <${OWNER_EMAIL}>`,
          to: email.trim(),
          subject,
          html: htmlContent
        });

        // Mark associated lends as reminded
        const now = new Date().toISOString();
        if (Array.isArray(lendIds) && lendIds.length > 0) {
          await lendsCol.updateMany(
            { id: { $in: lendIds } },
            { $set: { reminderSent: true, reminderSentAt: now, updatedAt: now } }
          );
        } else if (safePerson) {
          const query: any = {
            personName: { $regex: new RegExp(`^${escapeRegex(safePerson)}$`, 'i') },
            status: { $in: ['active', 'partially_returned'] }
          };
          if (body.expenseSetId) query.expenseSetId = body.expenseSetId;
          await lendsCol.updateMany(query, { $set: { reminderSent: true, reminderSentAt: now, updatedAt: now } });
        }

        const message = mailResult.redirected
          ? `Settlement email safely intercepted in sandbox and redirected to owner (${OWNER_EMAIL}) instead of external recipient (${email.trim()}).`
          : `Settlement email successfully sent to ${email.trim()}`;

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { success: true, message, redirected: mailResult.redirected }
        };
      } catch (err: any) {
        context.error('Error sending reminder email:', err);
        return {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { error: 'Failed to send reminder email.', details: err.message }
        };
      }
    }

    return { status: 404, jsonBody: { error: `Resource '${resource}' not found.` } };
  } catch (err: any) {
    context.error('Finance handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('finance', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'finance/{*subpath}',
  handler: financeHandler
});
