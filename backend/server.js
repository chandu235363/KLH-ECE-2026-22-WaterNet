require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { initDb } = require("./db");
const { setupWebSocket } = require("./websocket");

const { router: authRouter } = require("./routes/auth");
const pipelinesRouter = require("./routes/pipelines");
const telemetryRouter = require("./routes/telemetry");
const alertsRouter = require("./routes/alerts");

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS for frontend dashboard
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "WaterNet Express API" });
});

// Mount modular API routes
app.use("/auth", authRouter);
app.use("/pipelines", pipelinesRouter);
app.use("/telemetry", telemetryRouter);
app.use("/alerts", alertsRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled API Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Create HTTP server & attach WebSocket
const server = http.createServer(app);
setupWebSocket(server);

// Initialize DB schema then start listening
async function startServer() {
  try {
    console.log("Checking and initializing PostgreSQL database schema...");
    await initDb();
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`WaterNet backend running on http://0.0.0.0:${PORT}`);
      console.log(`WebSocket live feed available at ws://0.0.0.0:${PORT}/ws`);
    });
  } catch (err) {
    console.error("Fatal error during server startup:", err);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server };
