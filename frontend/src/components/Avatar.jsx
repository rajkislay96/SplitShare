import { initials } from '../format.js';

export default function Avatar({ name, color, size = 38 }) {
  return (
    <div
      className="avatar"
      style={{ background: color || '#2B6E5E', width: size, height: size, fontSize: size * 0.37 }}
    >
      {initials(name || '?')}
    </div>
  );
}
