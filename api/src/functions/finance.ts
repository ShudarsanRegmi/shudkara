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
          overdueCount: overdueLends.length + overdueBorrows.length
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
        if (isNaN(amount) || amount <= 0) {
          return { status: 400, jsonBody: { error: 'Valid positive expense amount is required.' } };
        }
        const now = new Date().toISOString();
        const newExpense: ExpenseItem = {
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
          tags: Array.isArray(body.tags) ? body.tags : [],
          receiptUrl: body.receiptUrl || null,
          createdAt: now,
          updatedAt: now
        };
        await expensesCol.insertOne(newExpense);
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
