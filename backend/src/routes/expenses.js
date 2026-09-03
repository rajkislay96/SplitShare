const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

async function assertMember(groupId, userId) {
  const result = await db.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  return result.rows.length > 0;
}

async function groupMemberIds(groupId) {
  const result = await db.query('SELECT user_id FROM group_members WHERE group_id = $1', [groupId]);
  return result.rows.map((r) => r.user_id);
}

/** Splits amountCents equally, giving any leftover cents to the first few people. */
function splitEqually(amountCents, userIds) {
  const base = Math.floor(amountCents / userIds.length);
  let remainder = amountCents - base * userIds.length;
  return userIds.map((userId) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return { userId, owedCents: base + extra };
  });
}

const baseExpenseSchema = z.object({
  description: z.string().trim().min(1, 'Describe the expense.').max(200),
  amountCents: z.number().int().positive('Amount must be greater than zero.'),
  paidBy: z.number().int(),
  notes: z.string().trim().max(500).optional(),
});

const expenseSchema = z.discriminatedUnion('splitType', [
  baseExpenseSchema.extend({
    splitType: z.literal('equal'),
    participantIds: z.array(z.number().int()).min(1, 'Pick who this is split between.'),
  }),
  baseExpenseSchema.extend({
    splitType: z.literal('exact'),
    splits: z.array(z.object({ userId: z.number().int(), owedCents: z.number().int().min(0) })).min(1),
  }),
  baseExpenseSchema.extend({
    splitType: z.literal('percentage'),
    splits: z.array(z.object({ userId: z.number().int(), percent: z.number().min(0).max(100) })).min(1),
  }),
]);

router.post('/groups/:groupId/expenses', async (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!(await assertMember(groupId, req.userId))) {
    return res.status(403).json({ error: "You're not a member of this group." });
  }

  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  const memberIds = new Set(await groupMemberIds(groupId));
  if (!memberIds.has(data.paidBy)) {
    return res.status(400).json({ error: 'The payer must be a member of this group.' });
  }

  let splits;
  if (data.splitType === 'equal') {
    for (const id of data.participantIds) {
      if (!memberIds.has(id)) {
        return res.status(400).json({ error: 'All participants must be members of this group.' });
      }
    }
    splits = splitEqually(data.amountCents, data.participantIds);
  } else if (data.splitType === 'exact') {
    for (const s of data.splits) {
      if (!memberIds.has(s.userId)) {
        return res.status(400).json({ error: 'All participants must be members of this group.' });
      }
    }
    const total = data.splits.reduce((sum, s) => sum + s.owedCents, 0);
    if (total !== data.amountCents) {
      return res.status(400).json({
        error: `The split amounts (${(total / 100).toFixed(2)}) must add up to the total (${(data.amountCents / 100).toFixed(2)}).`,
      });
    }
    splits = data.splits.map((s) => ({ userId: s.userId, owedCents: s.owedCents }));
  } else {
    for (const s of data.splits) {
      if (!memberIds.has(s.userId)) {
        return res.status(400).json({ error: 'All participants must be members of this group.' });
      }
    }
    const totalPercent = data.splits.reduce((sum, s) => sum + s.percent, 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      return res.status(400).json({ error: `Percentages must add up to 100 (currently ${totalPercent}).` });
    }
    // Convert percentages to cents, giving leftover cents to the largest shares.
    const raw = data.splits.map((s) => ({ userId: s.userId, exact: (data.amountCents * s.percent) / 100 }));
    const floored = raw.map((r) => ({ userId: r.userId, owedCents: Math.floor(r.exact), frac: r.exact - Math.floor(r.exact) }));
    let remainder = data.amountCents - floored.reduce((sum, f) => sum + f.owedCents, 0);
    floored.sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < floored.length && remainder > 0; i += 1) {
      floored[i].owedCents += 1;
      remainder -= 1;
    }
    splits = floored.map(({ userId, owedCents }) => ({ userId, owedCents }));
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const expenseResult = await client.query(
      `INSERT INTO expenses (group_id, description, amount_cents, paid_by, split_type, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [groupId, data.description, data.amountCents, data.paidBy, data.splitType, req.userId, data.notes || null]
    );
    const expense = expenseResult.rows[0];

    for (const split of splits) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, owed_cents) VALUES ($1, $2, $3)',
        [expense.id, split.userId, split.owedCents]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...expense, splits });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.get('/groups/:groupId/expenses', async (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!(await assertMember(groupId, req.userId))) {
    return res.status(403).json({ error: "You're not a member of this group." });
  }

  const expensesResult = await db.query(
    `SELECT e.*, u.name AS paid_by_name
     FROM expenses e JOIN users u ON u.id = e.paid_by
     WHERE e.group_id = $1 ORDER BY e.created_at DESC`,
    [groupId]
  );
  const expenses = expensesResult.rows;
  if (expenses.length === 0) return res.json([]);

  const splitsResult = await db.query(
    `SELECT es.expense_id, es.user_id, es.owed_cents, u.name
     FROM expense_splits es JOIN users u ON u.id = es.user_id
     WHERE es.expense_id = ANY($1::int[])`,
    [expenses.map((e) => e.id)]
  );
  const splitsByExpense = {};
  for (const row of splitsResult.rows) {
    if (!splitsByExpense[row.expense_id]) splitsByExpense[row.expense_id] = [];
    splitsByExpense[row.expense_id].push({ userId: row.user_id, name: row.name, owedCents: row.owed_cents });
  }

  res.json(expenses.map((e) => ({ ...e, splits: splitsByExpense[e.id] || [] })));
});

router.delete('/expenses/:id', async (req, res) => {
  const expenseId = Number(req.params.id);
  const result = await db.query('SELECT group_id, created_by FROM expenses WHERE id = $1', [expenseId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found.' });

  const { group_id: groupId } = result.rows[0];
  if (!(await assertMember(groupId, req.userId))) {
    return res.status(403).json({ error: "You're not a member of this group." });
  }

  await db.query('DELETE FROM expenses WHERE id = $1', [expenseId]);
  res.status(204).send();
});

module.exports = router;
