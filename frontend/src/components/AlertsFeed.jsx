function formatTime(ts) {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AlertsFeed({ alerts, onResolve }) {
  return (
    <div className="alerts-col">
      <h2>Active alerts ({alerts.length})</h2>
      {alerts.length === 0 && <div className="empty-state">No active alerts.</div>}
      {alerts.map((a) => (
        <div key={a.id} className={`alert-item ${a.severity}`}>
          <span className="alert-type">{a.alert_type.replace("_", " ")}</span>
          <div className="alert-message">{a.message}</div>
          <div className="alert-time">{formatTime(a.timestamp)}</div>
          <button className="resolve-btn" onClick={() => onResolve(a.id)}>
            Mark resolved
          </button>
        </div>
      ))}
    </div>
  );
}
