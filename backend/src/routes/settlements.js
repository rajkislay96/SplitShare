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

const settleSchema = z.object({
  fromUserId: z.number().int(),
  toUserId: z.number().int(),
  amountCents: z.number().int().positive('Amount must be greater than zero.'),
  note: z.string().trim().max(300).optional(),
});

router.post('/groups/:groupId/settlements', async (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!(await assertMember(groupId, req.userId))) {
    return res.status(403).json({ error: "You're not a member of this group." });
  }
  const parsed = settleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { fromUserId, toUserId, amountCents, note } = parsed.data;

  if (fromUserId === toUserId) {
    return res.status(400).json({ error: 'Pick two different people.' });
  }
  if (!(await assertMember(groupId, fromUserId)) || !(await assertMember(groupId, toUserId))) {
    return res.status(400).json({ error: 'Both people must be members of this group.' });
  }

  const result = await db.query(
    `INSERT INTO settlements (group_id, from_user, to_user, amount_cents, note)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [groupId, fromUserId, toUserId, amountCents, note || null]
  );
  res.status(201).json(result.rows[0]);
});

router.get('/groups/:groupId/settlements', async (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!(await assertMember(groupId, req.userId))) {
    return res.status(403).json({ error: "You're not a member of this group." });
  }
  const result = await db.query(
    `SELECT s.*, fu.name AS from_name, tu.name AS to_name
     FROM settlements s
     JOIN users fu ON fu.id = s.from_user
     JOIN users tu ON tu.id = s.to_user
     WHERE s.group_id = $1 ORDER BY s.created_at DESC`,
    [groupId]
  );
  res.json(result.rows);
});

module.exports = router;
