const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

export function getAuthToken() {
  return localStorage.getItem("waternet_token");
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem("waternet_token", token);
  } else {
    localStorage.removeItem("waternet_token");
  }
}

export function removeAuthToken() {
  localStorage.removeItem("waternet_token");
}

function getHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (err.name === "TypeError" || (err.message && err.message.toLowerCase().includes("fetch"))) {
      throw new Error(
        `Cannot connect to WaterNet backend server at ${API_BASE}. Please ensure the Node.js backend is running and PostgreSQL is started.`
      );
    }
    throw err;
  }
}

// Authentication APIs
export async function login(userid, pwd) {
  const res = await apiFetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userid, pwd }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  setAuthToken(data.token);
  return data;
}

export async function register(userid, name, pwd) {
  const res = await apiFetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userid, name, pwd }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  setAuthToken(data.token);
  return data;
}

export async function getMe() {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await apiFetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      removeAuthToken();
      return null;
    }
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}

// Pipeline & Telemetry APIs
export async function getPipelines() {
  const r = await apiFetch(`${API_BASE}/pipelines`, { headers: getHeaders() });
  if (!r.ok) throw new Error("Failed to load pipelines");
  return r.json();
}

export async function getReadings(pipelineId, limit = 200) {
  const r = await apiFetch(`${API_BASE}/pipelines/${pipelineId}/readings?limit=${limit}`, {
    headers: getHeaders(),
  });
  if (!r.ok) throw new Error("Failed to load readings");
  return r.json();
}

export async function getAlerts(resolved = null) {
  const q = resolved === null ? "" : `?resolved=${resolved}`;
  const r = await apiFetch(`${API_BASE}/alerts${q}`, { headers: getHeaders() });
  if (!r.ok) throw new Error("Failed to load alerts");
  return r.json();
}

export async function resolveAlert(alertId) {
  const r = await apiFetch(`${API_BASE}/alerts/${alertId}/resolve`, {
    method: "PATCH",
    headers: getHeaders(),
  });
  if (!r.ok) throw new Error("Failed to resolve alert");
  return r.json();
}

export function connectLiveFeed(onMessage) {
  const ws = new WebSocket(`${WS_BASE}/ws`);
  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // ignore malformed frames
    }
  };
  return ws;
}
