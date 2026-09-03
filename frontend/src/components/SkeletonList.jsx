export default function SkeletonList({ rows = 3 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton-tile" key={i}>
          <div className="skeleton skeleton-badge" />
          <div className="skeleton-lines">
            <div className="skeleton skeleton-line" style={{ width: '55%' }} />
            <div className="skeleton skeleton-line" style={{ width: '35%' }} />
          </div>
        </div>
      ))}
    </>
  );
}
