import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { connectToMongo, verifySession, extractToken } from './db';

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

export interface ExpenseItem {
  id: string;
  expenseSetId?: string | null;
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  time?: string;
  paymentMethod: string; // 'Cash' | 'Bank / Card' | 'eSewa' | 'Khalti' | 'Other'
  isRotation: boolean; // Dummy transaction / cash exchange / temporary pass-through
  rotationNote?: string | null;
  splitPersonName?: string | null;
  splitAmount?: number | null;
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
  isDefault?: boolean;
  notes?: string;
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
  personName: string;
  contact?: string;
  amount: number;
  lentDate: string;
  expectedReturnDate: string;
  isRotation: boolean; // Short-term temporary lend (<24h)
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
  isRotation: boolean; // Short-term temporary borrow (<24h)
  status: 'active' | 'partially_repaid' | 'repaid';
  notes?: string;
  repayments: RepaymentRecord[];
  createdAt: string;
  updatedAt: string;
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
        const splitPersonName = body.splitWith?.personName?.trim() || body.splitPersonName?.trim() || null;
        const splitAmount = body.splitWith?.amount ? Number(body.splitWith.amount) : body.splitAmount ? Number(body.splitAmount) : null;
        const paidByPersonName = body.paidBy?.personName?.trim() || body.paidByPersonName?.trim() || null;

        if (isNaN(amount) || (amount <= 0 && (!splitPersonName || !splitAmount || splitAmount <= 0))) {
          return { status: 400, jsonBody: { error: 'Valid positive expense amount is required.' } };
        }
        const now = new Date().toISOString();

        let newExpense: ExpenseItem | null = null;
        if (amount > 0) {
          newExpense = {
            id: body.id || crypto.randomUUID(),
            expenseSetId: body.expenseSetId || null,
            amount,
            currency: body.currency || 'NPR',
            category: body.category || 'General',
            description: (body.description || '').trim() || 'Expense',
            date: body.date || now.slice(0, 10),
            time: body.time || now.slice(11, 16),
            paymentMethod: body.paymentMethod || 'Bank / Card',
            isRotation: Boolean(body.isRotation),
            rotationNote: body.rotationNote || null,
            splitPersonName,
            splitAmount,
            paidByPersonName,
            tags: Array.isArray(body.tags) ? body.tags : [],
            receiptUrl: body.receiptUrl || null,
            createdAt: now,
            updatedAt: now
          };
          await expensesCol.insertOne(newExpense);
        }

        // If split with someone -> auto-create Lend record & ensure person exists
        let autoLend: LendItem | null = null;
        if (splitPersonName && splitAmount && splitAmount > 0) {
          const pExists = await peopleCol.findOne({ name: { $regex: new RegExp(`^${splitPersonName}$`, 'i') } });
          if (!pExists) {
            await peopleCol.insertOne({ id: crypto.randomUUID(), name: splitPersonName, contact: '', isDefault: false, createdAt: now, updatedAt: now });
          }
          autoLend = {
            id: crypto.randomUUID(),
            personName: splitPersonName,
            contact: '',
            amount: splitAmount,
            lentDate: body.date || now.slice(0, 10),
            expectedReturnDate: body.expectedReturnDate || '',
            isRotation: false,
            status: 'active',
            notes: `Split from: ${(body.description || 'Expense')} (Total: ${amount + splitAmount})`,
            repayments: [],
            createdAt: now,
            updatedAt: now
          };
          await lendsCol.insertOne(autoLend);
        }

        // If paid by someone else on user's behalf -> auto-create Borrow record & ensure person exists
        if (paidByPersonName) {
          const pExists = await peopleCol.findOne({ name: { $regex: new RegExp(`^${paidByPersonName}$`, 'i') } });
          if (!pExists) {
            await peopleCol.insertOne({ id: crypto.randomUUID(), name: paidByPersonName, contact: '', isDefault: false, createdAt: now, updatedAt: now });
          }
          const autoBorrow: BorrowItem = {
            id: crypto.randomUUID(),
            personName: paidByPersonName,
            contact: '',
            amount,
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
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: updated };
      }

      if (method === 'DELETE' && resourceId) {
        await expensesCol.deleteOne({ id: resourceId });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, id: resourceId } };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. LENDS (Money Given): /api/finance/lends
    // ─────────────────────────────────────────────────────────────────────────
    if (resource === 'lends') {
      if (method === 'GET') {
        const items = await lendsCol.find({}).sort({ lentDate: -1, createdAt: -1 }).toArray();
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: items };
      }

      if (method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
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
        const newLend: LendItem = {
          id: body.id || crypto.randomUUID(),
          personName: body.personName.trim(),
          contact: body.contact || '',
          amount,
          lentDate: body.lentDate || now.slice(0, 10),
          expectedReturnDate: body.expectedReturnDate || '',
          isRotation: Boolean(body.isRotation),
          status: 'active',
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
        if (body.lentDate !== undefined) updates.lentDate = body.lentDate;
        if (body.expectedReturnDate !== undefined) updates.expectedReturnDate = body.expectedReturnDate;
        if (body.isRotation !== undefined) updates.isRotation = Boolean(body.isRotation);
        if (body.status !== undefined) updates.status = body.status;
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
        const newBorrow: BorrowItem = {
          id: body.id || crypto.randomUUID(),
          personName: body.personName.trim(),
          contact: body.contact || '',
          amount,
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
        const people = await peopleCol.find({}).sort({ isDefault: -1, name: 1 }).toArray();
        const lends = await lendsCol.find({}).toArray();
        const borrows = await borrowsCol.find({}).toArray();

        const enriched = people.map(p => {
          const personLends = lends.filter(l => (l.personName || '').trim().toLowerCase() === p.name.trim().toLowerCase());
          const totalLent = personLends.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
          const lendRepayments = personLends.reduce((sum, l) => {
            return sum + (l.repayments || []).reduce((rSum: number, r: any) => rSum + (Number(r.amount) || 0), 0);
          }, 0);
          const netReceivable = Math.max(0, totalLent - lendRepayments);

          const personBorrows = borrows.filter(b => (b.personName || '').trim().toLowerCase() === p.name.trim().toLowerCase());
          const totalBorrowed = personBorrows.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
          const borrowRepayments = personBorrows.reduce((sum, b) => {
            return sum + (b.repayments || []).reduce((rSum: number, r: any) => rSum + (Number(r.amount) || 0), 0);
          }, 0);
          const netPayable = Math.max(0, totalBorrowed - borrowRepayments);

          return {
            ...p,
            netReceivable,
            netPayable,
            netBalance: netReceivable - netPayable, // > 0: Ram owes me, < 0: I owe Ram
            activeLendsCount: personLends.filter(l => l.status === 'active' || l.status === 'partially_returned').length,
            activeBorrowsCount: personBorrows.filter(b => b.status === 'active' || b.status === 'partially_repaid').length
          };
        });
        return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: enriched };
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
          contact: body.contact || '',
          isDefault: Boolean(body.isDefault),
          notes: body.notes || '',
          createdAt: now,
          updatedAt: now
        };
        await peopleCol.insertOne(newPerson);
        return { status: 201, headers: { 'Content-Type': 'application/json' }, jsonBody: newPerson };
      }

      if (method === 'PUT' && resourceId) {
        const body: any = await request.json().catch(() => ({}));
        if (body.isDefault) {
          await peopleCol.updateMany({ id: { $ne: resourceId } }, { $set: { isDefault: false } });
        }
        const updates: any = { updatedAt: new Date().toISOString() };
        if (body.name !== undefined) updates.name = body.name.trim();
        if (body.contact !== undefined) updates.contact = body.contact;
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
