import { useState } from 'react';
import Icon from './Icon.jsx';

export default function SettleUpModal({ members, suggestedPayments, currentUserId, onClose, onSettle }) {
  const firstSuggestion = suggestedPayments.find(
    (p) => p.fromUserId === currentUserId || p.toUserId === currentUserId
  ) || suggestedPayments[0];

  const [fromUserId, setFromUserId] = useState(firstSuggestion?.fromUserId ?? members[0]?.id);
  const [toUserId, setToUserId] = useState(firstSuggestion?.toUserId ?? members[1]?.id);
  const [amount, setAmount] = useState(firstSuggestion ? (firstSuggestion.amountCents / 100).toFixed(2) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const amountCents = Math.round(parseFloat(amount || '0') * 100);
    if (!amountCents || amountCents <= 0) return setError('Enter an amount greater than zero.');
    if (fromUserId === toUserId) return setError('Pick two different people.');

    setBusy(true);
    try {
      await onSettle({ fromUserId, toUserId, amountCents });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settle up</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        {error && <div className="error-banner">{error}</div>}

        {suggestedPayments.length > 0 && (
          <div className="field">
            <label>Suggested</label>
            {suggestedPayments.map((p, i) => (
              <button
                key={i}
                type="button"
                className="btn btn-secondary"
                style={{ marginBottom: 8, justifyContent: 'flex-start', fontWeight: 500 }}
                onClick={() => {
                  setFromUserId(p.fromUserId);
                  setToUserId(p.toUserId);
                  setAmount((p.amountCents / 100).toFixed(2));
                }}
              >
                {p.fromName} pays {p.toName} <span className="amount" style={{ marginLeft: 'auto' }}>${(p.amountCents / 100).toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="from">From</label>
            <select id="from" value={fromUserId} onChange={(e) => setFromUserId(Number(e.target.value))}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="to">To</label>
            <select id="to" value={toUserId} onChange={(e) => setToUserId(Number(e.target.value))}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="settle-amount">Amount ($)</label>
            <input id="settle-amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : 'Record payment'}
          </button>
        </form>
      </div>
    </div>
  );
}
