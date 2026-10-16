export default function Sidebar({ pipelines, selectedId, onSelect }) {
  return (
    <div className="sidebar">
      <div className="sidebar-label">Pipelines ({pipelines.length})</div>
      {pipelines.map((p) => (
        <div
          key={p.id}
          className={`pipeline-item ${p.id === selectedId ? "active" : ""}`}
          onClick={() => onSelect(p.id)}
        >
          <span className="pipeline-name">{p.name}</span>
          <span className="pipeline-location">{p.location || "Unassigned"}</span>
        </div>
      ))}
      {pipelines.length === 0 && (
        <div className="empty-state" style={{ padding: "0 16px" }}>
          No pipelines yet. Run seed_dataset.py on the backend.
        </div>
      )}
    </div>
  );
}
