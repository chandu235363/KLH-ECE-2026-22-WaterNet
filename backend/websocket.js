const { WebSocketServer, WebSocket } = require("ws");

let wss = null;

function setupWebSocket(server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    // Keep connection alive and detect disconnects
    ws.on("message", () => {});
    ws.on("error", (err) => console.error("WebSocket client error:", err.message));
  });

  return wss;
}

function broadcast(data) {
  if (!wss) return;
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

module.exports = {
  setupWebSocket,
  broadcast,
};
