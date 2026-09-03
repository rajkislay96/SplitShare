import { useState, useMemo } from 'react';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';

export default function AddExpenseModal({ members, currentUserId, onClose, onCreate }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [splitType, setSplitType] = useState('equal');
  const [participantIds, setParticipantIds] = useState(members.map((m) => m.id));
  const [exactAmounts, setExactAmounts] = useState({});
  const [percentages, setPercentages] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const amountCents = Math.round(parseFloat(amount || '0') * 100);

  const exactTotal = useMemo(
    () => Object.values(exactAmounts).reduce((sum, v) => sum + (parseFloat(v || '0') * 100 || 0), 0),
    [exactAmounts]
  );
  const percentTotal = useMemo(
    () => Object.values(percentages).reduce((sum, v) => sum + (parseFloat(v || '0') || 0), 0),
    [percentages]
  );

  function toggleParticipant(id) {
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!description.trim()) return setError('Give this expense a description.');
    if (!amountCents || amountCents <= 0) return setError('Enter an amount greater than zero.');

    let payload = {
      description: description.trim(),
      amountCents,
      paidBy,
      splitType,
    };

    if (splitType === 'equal') {
      if (participantIds.length === 0) return setError('Pick at least one person to split with.');
      payload.participantIds = participantIds;
    } else if (splitType === 'exact') {
      const splits = members
        .filter((m) => (parseFloat(exactAmounts[m.id]) || 0) > 0)
        .map((m) => ({ userId: m.id, owedCents: Math.round(parseFloat(exactAmounts[m.id]) * 100) }));
      if (splits.length === 0) return setError('Enter at least one amount.');
      if (Math.round(exactTotal) !== amountCents) {
        return setError(`Splits add up to $${(exactTotal / 100).toFixed(2)}, but the total is $${(amountCents / 100).toFixed(2)}.`);
      }
      payload.splits = splits;
    } else {
      const splits = members
        .filter((m) => (parseFloat(percentages[m.id]) || 0) > 0)
        .map((m) => ({ userId: m.id, percent: parseFloat(percentages[m.id]) }));
      if (splits.length === 0) return setError('Enter at least one percentage.');
      if (Math.abs(percentTotal - 100) > 0.01) {
        return setError(`Percentages add up to ${percentTotal}%, they need to total 100%.`);
      }
      payload.splits = splits;
    }

    setBusy(true);
    try {
      await onCreate(payload);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add expense</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="desc">Description</label>
            <input id="desc" placeholder="Dinner, gas, tickets…" value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="amount">Amount ($)</label>
            <input id="amount" type="number" step="0.01" min="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="paidBy">Paid by</label>
            <select id="paidBy" value={paidBy} onChange={(e) => setPaidBy(Number(e.target.value))}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.id === currentUserId ? `${m.name} (you)` : m.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Split</label>
            <div className="tabs">
              <button type="button" className={splitType === 'equal' ? 'active' : ''} onClick={() => setSplitType('equal')}>Equally</button>
              <button type="button" className={splitType === 'exact' ? 'active' : ''} onClick={() => setSplitType('exact')}>Exact amounts</button>
              <button type="button" className={splitType === 'percentage' ? 'active' : ''} onClick={() => setSplitType('percentage')}>Percentages</button>
            </div>

            {splitType === 'equal' && members.map((m) => (
              <div key={m.id} className="participant-row">
                <button
                  type="button"
                  className={`split-toggle ${participantIds.includes(m.id) ? 'checked' : ''}`}
                  onClick={() => toggleParticipant(m.id)}
                  aria-label={`Include ${m.name}`}
                />
                <Avatar name={m.name} color={m.avatar_color} size={30} />
                <div className="name">{m.name}</div>
                {participantIds.includes(m.id) && amountCents > 0 && (
                  <div className="amount" style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                    ${(amountCents / participantIds.length / 100).toFixed(2)}
                  </div>
                )}
              </div>
            ))}

            {splitType === 'exact' && members.map((m) => (
              <div key={m.id} className="participant-row">
                <Avatar name={m.name} color={m.avatar_color} size={30} />
                <div className="name">{m.name}</div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={exactAmounts[m.id] || ''}
                  onChange={(e) => setExactAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                />
              </div>
            ))}

            {splitType === 'percentage' && members.map((m) => (
              <div key={m.id} className="participant-row">
                <Avatar name={m.name} color={m.avatar_color} size={30} />
                <div className="name">{m.name}</div>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={percentages[m.id] || ''}
                  onChange={(e) => setPercentages((prev) => ({ ...prev, [m.id]: e.target.value }))}
                />
              </div>
            ))}

            {splitType === 'exact' && (
              <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 8 }}>
                Total entered: ${(exactTotal / 100).toFixed(2)} of ${(amountCents / 100).toFixed(2)}
              </p>
            )}
            {splitType === 'percentage' && (
              <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 8 }}>
                Total entered: {percentTotal}% of 100%
              </p>
            )}
          </div>

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : 'Save expense'}
          </button>
        </form>
      </div>
    </div>
  );
}
