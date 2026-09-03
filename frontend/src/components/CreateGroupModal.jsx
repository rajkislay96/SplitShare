import { useState } from 'react';

const EMOJI_OPTIONS = ['💰', '🏠', '✈️', '🍽️', '🎉', '🏔️', '🚗', '🎮'];

export default function CreateGroupModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💰');
  const [emails, setEmails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const memberEmails = emails
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await onCreate({ name, emoji, memberEmails });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New group</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Icon</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EMOJI_OPTIONS.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => setEmoji(e)}
                  style={{
                    fontSize: 22,
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    border: emoji === e ? '2px solid #2B6E5E' : '1px solid #E4DFD3',
                    background: '#fff',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="group-name">Group name</label>
            <input
              id="group-name"
              placeholder="e.g. Beach House 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="member-emails">Invite friends (optional)</label>
            <input
              id="member-emails"
              placeholder="friend@email.com, another@email.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? <span className="spinner" /> : 'Create group'}
          </button>
        </form>
      </div>
    </div>
  );
}
