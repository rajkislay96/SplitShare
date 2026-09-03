const db = require('../db');

/**
 * Computes each member's net balance in a group, in cents.
 * Positive balance  => the group owes this person money (they're owed).
 * Negative balance  => this person owes the group money.
 *
 * balance[u] = (paid by u on expenses)
 *            - (u's share of expenses)
 *            + (settlements u paid to others)
 *            - (settlements others paid to u)
 */
async function getGroupBalances(groupId) {
  const membersResult = await db.query(
    `SELECT u.id, u.name, u.email, u.avatar_color
     FROM group_members gm JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY u.name ASC`,
    [groupId]
  );
  const members = membersResult.rows;
  const balance = Object.fromEntries(members.map((m) => [m.id, 0]));

  const paidResult = await db.query(
    `SELECT paid_by AS user_id, COALESCE(SUM(amount_cents), 0) AS total
     FROM expenses WHERE group_id = $1 GROUP BY paid_by`,
    [groupId]
  );
  for (const row of paidResult.rows) {
    balance[row.user_id] = (balance[row.user_id] || 0) + Number(row.total);
  }

  const owedResult = await db.query(
    `SELECT es.user_id AS user_id, COALESCE(SUM(es.owed_cents), 0) AS total
     FROM expense_splits es
     JOIN expenses e ON e.id = es.expense_id
     WHERE e.group_id = $1
     GROUP BY es.user_id`,
    [groupId]
  );
  for (const row of owedResult.rows) {
    balance[row.user_id] = (balance[row.user_id] || 0) - Number(row.total);
  }

  const settleFromResult = await db.query(
    `SELECT from_user AS user_id, COALESCE(SUM(amount_cents), 0) AS total
     FROM settlements WHERE group_id = $1 GROUP BY from_user`,
    [groupId]
  );
  for (const row of settleFromResult.rows) {
    balance[row.user_id] = (balance[row.user_id] || 0) + Number(row.total);
  }

  const settleToResult = await db.query(
    `SELECT to_user AS user_id, COALESCE(SUM(amount_cents), 0) AS total
     FROM settlements WHERE group_id = $1 GROUP BY to_user`,
    [groupId]
  );
  for (const row of settleToResult.rows) {
    balance[row.user_id] = (balance[row.user_id] || 0) - Number(row.total);
  }

  return members.map((m) => ({
    userId: m.id,
    name: m.name,
    email: m.email,
    avatarColor: m.avatar_color,
    balanceCents: balance[m.id] || 0,
  }));
}

/**
 * Greedy debt simplification: repeatedly matches the biggest debtor with the
 * biggest creditor until all balances are settled. Minimizes the number of
 * suggested payments (not necessarily unique, but always correct and small).
 */
function simplifyDebts(balances) {
  const creditors = balances
    .filter((b) => b.balanceCents > 0)
    .map((b) => ({ ...b, remaining: b.balanceCents }))
    .sort((a, b) => b.remaining - a.remaining);
  const debtors = balances
    .filter((b) => b.balanceCents < 0)
    .map((b) => ({ ...b, remaining: -b.balanceCents }))
    .sort((a, b) => b.remaining - a.remaining);

  const transactions = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.remaining, creditor.remaining);

    if (amount > 0) {
      transactions.push({
        fromUserId: debtor.userId,
        fromName: debtor.name,
        toUserId: creditor.userId,
        toName: creditor.name,
        amountCents: amount,
      });
    }

    debtor.remaining -= amount;
    creditor.remaining -= amount;

    if (debtor.remaining === 0) i += 1;
    if (creditor.remaining === 0) j += 1;
  }

  return transactions;
}

module.exports = { getGroupBalances, simplifyDebts };
