const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getGroupBalances, simplifyDebts } = require('../utils/balances');

const router = express.Router();
router.use(requireAuth);

async function assertMember(groupId, userId) {
  const result = await db.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  return result.rows.length > 0;
}

const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Give the group a name.').max(80),
  emoji: z.string().trim().max(8).optional(),
  memberEmails: z.array(z.string().trim().toLowerCase().email()).optional().default([]),
});

router.post('/', async (req, res) => {
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, emoji, memberEmails } = parsed.data;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const groupResult = await client.query(
      `INSERT INTO groups_table (name, emoji, created_by) VALUES ($1, $2, $3) RETURNING id, name, emoji, created_at`,
      [name, emoji || '💰', req.userId]
    );
    const group = groupResult.rows[0];

    await client.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [group.id, req.userId]
    );

    const notFound = [];
    for (const email of memberEmails) {
      const userResult = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (userResult.rows.length === 0) {
        notFound.push(email);
        continue;
      }
      await client.query(
        `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [group.id, userResult.rows[0].id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ group, notFoundEmails: notFound });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT g.id, g.name, g.emoji, g.created_at,
            (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS member_count
     FROM groups_table g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1
     ORDER BY g.created_at DESC`,
    [req.userId]
  );
  res.json(result.rows);
});

router.get('/:id', async (req, res) => {
  const groupId = Number(req.params.id);
  if (!(await assertMember(groupId, req.userId))) {
    return res.status(403).json({ error: "You're not a member of this group." });
  }

  const groupResult = await db.query('SELECT * FROM groups_table WHERE id = $1', [groupId]);
  if (groupResult.rows.length === 0) return res.status(404).json({ error: 'Group not found.' });

  const membersResult = await db.query(
    `SELECT u.id, u.name, u.email, u.avatar_color
     FROM group_members gm JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1 ORDER BY u.name ASC`,
    [groupId]
  );

  res.json({ ...groupResult.rows[0], members: membersResult.rows });
});

const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email.'),
});

router.post('/:id/members', async (req, res) => {
  const groupId = Number(req.params.id);
  if (!(await assertMember(groupId, req.userId))) {
    return res.status(403).json({ error: "You're not a member of this group." });
  }
  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const userResult = await db.query('SELECT id, name, email, avatar_color FROM users WHERE email = $1', [
    parsed.data.email,
  ]);
  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'No SplitShare account uses that email yet.' });
  }
  const user = userResult.rows[0];

  await db.query(
    'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [groupId, user.id]
  );

  res.status(201).json(user);
});

router.get('/:id/balances', async (req, res) => {
  const groupId = Number(req.params.id);
  if (!(await assertMember(groupId, req.userId))) {
    return res.status(403).json({ error: "You're not a member of this group." });
  }

  const balances = await getGroupBalances(groupId);
  const suggestedPayments = simplifyDebts(balances);
  res.json({ balances, suggestedPayments });
});

module.exports = router;
