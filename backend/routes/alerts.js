const express = require("express");
const { query } = require("../db");

const router = express.Router();

// GET /alerts: List alerts, optionally filtered by resolved status
router.get("/", async (req, res) => {
  const { resolved, limit = 100 } = req.query;
  const limitVal = Math.min(parseInt(limit, 10) || 100, 500);

  try {
    let sql = "SELECT id, pipeline_id, timestamp, alert_type, severity, message, resolved FROM alerts";
    const params = [];

    if (resolved !== undefined) {
      const isResolved = resolved === "true" || resolved === true || resolved === "1";
      params.push(isResolved);
      sql += ` WHERE resolved = $${params.length}`;
    }

    params.push(limitVal);
    sql += ` ORDER BY timestamp DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (err) {
    console.error("Error fetching alerts:", err);
    return res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// PATCH /alerts/:id/resolve: Mark an alert resolved in PostgreSQL
router.patch("/:id/resolve", async (req, res) => {
  const alertId = parseInt(req.params.id, 10);
  if (isNaN(alertId)) {
    return res.status(400).json({ error: "Invalid alert ID" });
  }

  try {
    const result = await query(
      "UPDATE alerts SET resolved = TRUE WHERE id = $1 RETURNING *",
      [alertId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Alert not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Error resolving alert:", err);
    return res.status(500).json({ error: "Failed to resolve alert" });
  }
});

module.exports = router;
