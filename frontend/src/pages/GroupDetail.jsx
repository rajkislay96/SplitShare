import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import AddExpenseModal from '../components/AddExpenseModal.jsx';
import SettleUpModal from '../components/SettleUpModal.jsx';
import SkeletonList from '../components/SkeletonList.jsx';
import { formatMoney, formatDateChip, timeAgo } from '../format.js';

export default function GroupDetail() {
  const { id } = useParams();
  const groupId = Number(id);
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [balanceData, setBalanceData] = useState(null);
  const [tab, setTab] = useState('expenses');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [groupData, expenseData, balances] = await Promise.all([
        api.getGroup(token, groupId),
        api.listExpenses(token, groupId),
        api.getBalances(token, groupId),
      ]);
      setGroup(groupData);
      setExpenses(expenseData);
      setBalanceData(balances);
    } catch (err) {
      setError(err.message);
    }
  }, [token, groupId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddExpense(payload) {
    await api.createExpense(token, groupId, payload);
    setShowAddExpense(false);
    await load();
  }

  async function handleSettle(payload) {
    await api.createSettlement(token, groupId, payload);
    setShowSettle(false);
    await load();
  }

  async function handleAddMember(email) {
    await api.addMember(token, groupId, email);
    await load();
  }

  if (!group || !expenses || !balanceData) {
    return (
      <>
        <div className="top-bar">
          <button className="icon-btn" onClick={() => navigate('/')} aria-label="Back"><Icon name="back" /></button>
          <h1>Loading…</h1>
          <div style={{ width: 30 }} />
        </div>
        <div className="screen">
          {error ? <div className="error-banner">{error}</div> : <SkeletonList rows={4} />}
        </div>
      </>
    );
  }

  const myBalance = balanceData.balances.find((b) => b.userId === user.id);

  return (
    <>
      <div className="top-bar">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Back"><Icon name="back" /></button>
        <h1>{group.emoji} {group.name}</h1>
        <button className="icon-btn" onClick={() => {
          const email = prompt("Add a friend by their SplitShare email:");
          if (email) handleAddMember(email.trim()).catch((e) => alert(e.message));
        }} aria-label="Add member"><Icon name="plus" /></button>
      </div>

      <div className="screen">
        <div className={`summary-banner ${myBalance.balanceCents === 0 ? 'celebrate' : ''}`}>
          <div className="label">
            {myBalance.balanceCents === 0 ? "You're all settled up" : myBalance.balanceCents > 0 ? 'You are owed' : 'You owe'}
          </div>
          {myBalance.balanceCents === 0 && (
            <div className="confetti-wrap">
              <div className="emoji" style={{ fontSize: 28 }}>🎉</div>
              <span className="confetti-piece" style={{ '--i': 0 }} />
              <span className="confetti-piece" style={{ '--i': 1 }} />
              <span className="confetti-piece" style={{ '--i': 2 }} />
              <span className="confetti-piece" style={{ '--i': 3 }} />
              <span className="confetti-piece" style={{ '--i': 4 }} />
              <span className="confetti-piece" style={{ '--i': 5 }} />
            </div>
          )}
          {myBalance.balanceCents !== 0 && (
            <div className={`value amount ${myBalance.balanceCents > 0 ? 'tag-positive' : 'tag-negative'}`}>
              {formatMoney(myBalance.balanceCents)}
            </div>
          )}
        </div>

        <div className="tabs">
          <button className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}>Expenses</button>
          <button className={tab === 'balances' ? 'active' : ''} onClick={() => setTab('balances')}>Balances</button>
        </div>

        {tab === 'expenses' && (
          <>
            {expenses.length === 0 && (
              <div className="empty-state">
                <span className="emoji">🧾</span>
                <p>No expenses yet. Add the first one below.</p>
              </div>
            )}
            {expenses.map((exp) => {
              const dateChip = formatDateChip(exp.created_at);
              const mySplit = exp.splits.find((s) => s.userId === user.id);
              return (
                <div key={exp.id} className="ledger-row">
                  <div className="date-chip">{dateChip.month}<br />{dateChip.day}</div>
                  <div className="details">
                    <div className="desc">{exp.description}</div>
                    <div className="sub">{exp.paid_by_name} paid {formatMoney(exp.amount_cents)}</div>
                    <div className="sub" style={{ opacity: 0.7, fontSize: 12, marginTop: 1 }}>{timeAgo(exp.created_at)}</div>
                  </div>
                  <div className="amounts">
                    <div className="total amount">{formatMoney(exp.amount_cents)}</div>
                    {mySplit && (
                      <div className={`your-share amount ${exp.paid_by === user.id ? 'tag-positive' : 'tag-negative'}`}>
                        {exp.paid_by === user.id ? 'you lent ' : 'you owe '}
                        {formatMoney(exp.paid_by === user.id ? exp.amount_cents - mySplit.owedCents : mySplit.owedCents)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'balances' && (
          <>
            <div className="section-title">Who owes what</div>
            {balanceData.balances.map((b) => (
              <div key={b.userId} className="balance-row">
                <Avatar name={b.name} color={b.avatarColor} />
                <div className="name">{b.userId === user.id ? `${b.name} (you)` : b.name}</div>
                <div className={`amount ${b.balanceCents > 0 ? 'tag-positive' : b.balanceCents < 0 ? 'tag-negative' : ''}`}>
                  {b.balanceCents === 0 ? 'settled up' : formatMoney(b.balanceCents)}
                </div>
              </div>
            ))}

            {balanceData.suggestedPayments.length > 0 && (
              <>
                <div className="section-title">Suggested payments</div>
                {balanceData.suggestedPayments.map((p, i) => (
                  <div key={i} className="balance-row">
                    <div className="name">{p.fromName} → {p.toName}</div>
                    <div className="amount">{formatMoney(p.amountCents)}</div>
                  </div>
                ))}
                <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setShowSettle(true)}>
                  Settle up
                </button>
              </>
            )}
          </>
        )}
      </div>

      {tab === 'expenses' && (
        <div className="fab">
          <button className="btn btn-primary" onClick={() => setShowAddExpense(true)}>+ Add expense</button>
        </div>
      )}

      {showAddExpense && (
        <AddExpenseModal
          members={group.members}
          currentUserId={user.id}
          onClose={() => setShowAddExpense(false)}
          onCreate={handleAddExpense}
        />
      )}

      {showSettle && (
        <SettleUpModal
          members={group.members}
          suggestedPayments={balanceData.suggestedPayments}
          currentUserId={user.id}
          onClose={() => setShowSettle(false)}
          onSettle={handleSettle}
        />
      )}
    </>
  );
}
