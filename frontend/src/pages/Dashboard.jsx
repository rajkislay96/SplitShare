import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import CreateGroupModal from '../components/CreateGroupModal.jsx';
import Avatar from '../components/Avatar.jsx';
import SkeletonList from '../components/SkeletonList.jsx';

export default function Dashboard() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState('');

  async function loadGroups() {
    const data = await api.listGroups(token);
    setGroups(data);
  }

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(payload) {
    const result = await api.createGroup(token, payload);
    setShowCreate(false);
    if (result.notFoundEmails.length > 0) {
      setNotice(`No SplitShare account found for: ${result.notFoundEmails.join(', ')}. Ask them to sign up, then add them from the group.`);
    }
    await loadGroups();
    navigate(`/groups/${result.group.id}`);
  }

  return (
    <>
      <div className="top-bar">
        <h1>Your groups</h1>
        <button className="icon-btn" onClick={logout} aria-label="Log out" title={user?.email}>
          <Avatar name={user?.name || ''} color={user?.avatarColor} size={30} />
        </button>
      </div>
      <div className="screen">
        {notice && <div className="error-banner" style={{ background: '#FBF3DC', color: '#8A6D1D', border: '1px solid #F0DFAE' }}>{notice}</div>}

        {groups === null && <SkeletonList rows={3} />}

        {groups && groups.length === 0 && (
          <div className="empty-state">
            <span className="emoji">🧾</span>
            <p>No groups yet. Start one with a friend or your roommates.</p>
          </div>
        )}

        {groups && groups.length > 0 && groups.map((g) => (
          <button key={g.id} className="group-tile" onClick={() => navigate(`/groups/${g.id}`)}>
            <div className="emoji-badge">{g.emoji}</div>
            <div className="info">
              <div className="name">{g.name}</div>
              <div className="meta">{g.member_count} {g.member_count === 1 ? 'person' : 'people'}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="fab">
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New group</button>
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </>
  );
}
