import { useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import PipelinePanel from "./components/PipelinePanel";
import AlertsFeed from "./components/AlertsFeed";
import AuthModal from "./components/AuthModal";
import {
  getPipelines,
  getReadings,
  getAlerts,
  resolveAlert,
  connectLiveFeed,
  getMe,
  removeAuthToken,
} from "./api";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [pipelines, setPipelines] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [live, setLive] = useState(false);
  const wsRef = useRef(null);

  // Check authentication session on mount
  useEffect(() => {
    getMe()
      .then((user) => {
        if (user) setCurrentUser(user);
      })
      .catch(() => {})
      .finally(() => setAuthChecking(false));
  }, []);

  // Initial load once authenticated: pipelines + open first one + current alerts
  useEffect(() => {
    if (!currentUser) return;

    getPipelines()
      .then((ps) => {
        setPipelines(ps);
        if (ps.length > 0) setSelectedId(ps[0].id);
      })
      .catch(() => {});

    getAlerts(false).then(setAlerts).catch(() => {});
  }, [currentUser]);

  // Load readings whenever selected pipeline changes
  useEffect(() => {
    if (!currentUser || selectedId == null) return;
    getReadings(selectedId, 200).then(setReadings).catch(() => {});
  }, [currentUser, selectedId]);

  // Live updates over WebSocket: append matching readings, prepend new alerts
  useEffect(() => {
    if (!currentUser) return;

    const ws = connectLiveFeed((msg) => {
      if (msg.type !== "reading") return;
      if (msg.reading && msg.reading.pipeline_id === selectedId) {
        setReadings((prev) => [...prev.slice(-199), msg.reading]);
      }
      if (msg.alert) {
        setAlerts((prev) => [msg.alert, ...prev]);
      }
    });

    ws.onopen = () => setLive(true);
    ws.onclose = () => setLive(false);
    wsRef.current = ws;

    return () => ws.close();
  }, [currentUser, selectedId]);

  async function handleResolve(alertId) {
    await resolveAlert(alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }

  function handleLogout() {
    removeAuthToken();
    setCurrentUser(null);
    setPipelines([]);
    setReadings([]);
    setAlerts([]);
    setSelectedId(null);
  }

  const selectedPipeline = pipelines.find((p) => p.id === selectedId) || null;

  if (authChecking) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading WaterNet...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthModal onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-brand">
          <span className="brand-icon">💧</span>
          <h1>WaterNet — pipeline telemetry</h1>
        </div>

        <div className="topbar-right">
          <div className="conn-status">
            <span className={`dot ${live ? "live" : ""}`} />
            {live ? "Live feed connected" : "Connecting…"}
          </div>

          <div className="user-profile">
            <span className="user-icon">👤</span>
            <div className="user-info">
              <span className="user-name">{currentUser.name}</span>
              <span className="user-id">@{currentUser.userid}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Sign Out">
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <Sidebar pipelines={pipelines} selectedId={selectedId} onSelect={setSelectedId} />

      <div className="main">
        <PipelinePanel pipeline={selectedPipeline} readings={readings} />
      </div>

      <AlertsFeed alerts={alerts} onResolve={handleResolve} />
    </div>
  );
}
