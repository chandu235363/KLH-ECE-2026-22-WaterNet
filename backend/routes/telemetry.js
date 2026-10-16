const express = require("express");
const { query } = require("../db");
const { evaluateReading } = require("../leakDetection");
const { broadcast } = require("../websocket");

const router = express.Router();

// POST /telemetry: Ingest a reading, evaluate leak detection, store in PostgreSQL, broadcast live
router.post("/", async (req, res) => {
  const { pipeline_id, flow, pressure, source = "live" } = req.body;

  if (pipeline_id === undefined || flow === undefined || pressure === undefined) {
    return res.status(400).json({ error: "pipeline_id, flow, and pressure are required" });
  }

  const pid = parseInt(pipeline_id, 10);
  const flowVal = parseFloat(flow);
  const pressureVal = parseFloat(pressure);

  if (isNaN(pid) || isNaN(flowVal) || isNaN(pressureVal)) {
    return res.status(400).json({ error: "Invalid numeric values for pipeline_id, flow, or pressure" });
  }

  try {
    // 1. Fetch pipeline details for baseline calibration
    const pipelineRes = await query("SELECT * FROM pipelines WHERE id = $1", [pid]);
    if (pipelineRes.rows.length === 0) {
      return res.status(404).json({ error: "Pipeline not found" });
    }
    const pipeline = pipelineRes.rows[0];

    // 2. Store reading in PostgreSQL readings table
    const readingRes = await query(
      `INSERT INTO readings (pipeline_id, flow, pressure, source) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, pipeline_id, timestamp, flow, pressure, source`,
      [pid, flowVal, pressureVal, source]
    );
    const reading = readingRes.rows[0];

    // 3. Evaluate leak detection rules against pipeline baseline stats
    let alert = null;
    const verdict = evaluateReading(pipeline, flowVal, pressureVal);
    if (verdict) {
      const alertRes = await query(
        `INSERT INTO alerts (pipeline_id, alert_type, severity, message, resolved) 
         VALUES ($1, $2, $3, $4, FALSE) 
         RETURNING id, pipeline_id, timestamp, alert_type, severity, message, resolved`,
        [pid, verdict.alert_type, verdict.severity, verdict.message]
      );
      alert = alertRes.rows[0];
    }

    // 4. Push live update to any connected WebSocket dashboards
    broadcast({
      type: "reading",
      reading,
      alert,
    });

    return res.json({
      reading,
      alert,
    });
  } catch (err) {
    console.error("Error ingesting telemetry:", err);
    return res.status(500).json({ error: "Failed to ingest telemetry" });
  }
});

module.exports = router;
