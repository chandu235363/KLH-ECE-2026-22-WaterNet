const express = require("express");
const { query } = require("../db");

const router = express.Router();

// GET /pipelines: List all pipelines + baseline stats
router.get("/", async (req, res) => {
  try {
    const result = await query(
      "SELECT id, name, location, baseline_flow_mean, baseline_flow_std, baseline_pressure_mean, baseline_pressure_std FROM pipelines ORDER BY id ASC"
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("Error fetching pipelines:", err);
    return res.status(500).json({ error: "Failed to fetch pipelines" });
  }
});

// POST /pipelines: Create a new pipeline
router.post("/", async (req, res) => {
  const { name, location } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Pipeline name is required" });
  }

  try {
    const existing = await query("SELECT id FROM pipelines WHERE name = $1", [name.trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Pipeline with this name already exists" });
    }

    const result = await query(
      "INSERT INTO pipelines (name, location) VALUES ($1, $2) RETURNING *",
      [name.trim(), location ? location.trim() : null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating pipeline:", err);
    return res.status(500).json({ error: "Failed to create pipeline" });
  }
});

// GET /pipelines/:id/readings: Recent readings for one pipeline
router.get("/:id/readings", async (req, res) => {
  const pipelineId = parseInt(req.params.id, 10);
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);

  if (isNaN(pipelineId)) {
    return res.status(400).json({ error: "Invalid pipeline ID" });
  }

  try {
    const pipelineCheck = await query("SELECT id FROM pipelines WHERE id = $1", [pipelineId]);
    if (pipelineCheck.rows.length === 0) {
      return res.status(404).json({ error: "Pipeline not found" });
    }

    // Fetch newest readings first up to limit, then reverse so they are ordered chronologically for frontend charts
    const result = await query(
      `SELECT id, pipeline_id, timestamp, flow, pressure, source 
       FROM readings 
       WHERE pipeline_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [pipelineId, limit]
    );

    const chronological = result.rows.reverse();
    return res.json(chronological);
  } catch (err) {
    console.error("Error fetching pipeline readings:", err);
    return res.status(500).json({ error: "Failed to fetch readings" });
  }
});

module.exports = router;
