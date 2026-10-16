/**
 * WaterNet Node.js / Express Dataset Seeder & Baseline Calibrator.
 *
 * Loads pipelines into PostgreSQL, computes statistical baseline means/stds
 * from the historical dataset (data/historical_readings.csv), inserts
 * historical readings, and creates an initial demo operator account.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool, query, initDb } = require("./db");

const DATA_DIR = path.join(__dirname, "data");
const CSV_PATH = path.join(DATA_DIR, "historical_readings.csv");

const PIPELINES = [
  { name: "Main St Trunk Line", location: "Downtown" },
  { name: "Elm Ave Distribution", location: "West Side" },
  { name: "Riverside Pump Loop", location: "Riverside" },
  { name: "Harbor District Feed", location: "Harbor District" },
];

function calcStats(numbers) {
  if (numbers.length === 0) return { mean: 0, std: 1 };
  const sum = numbers.reduce((a, b) => a + b, 0);
  const mean = sum / numbers.length;
  const variance = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numbers.length;
  const std = Math.sqrt(variance);
  return { mean, std: std || 1.0 };
}

function generateSyntheticDataset(days = 14, intervalMinutes = 15) {
  console.log("Generating synthetic historical readings dataset...");
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const steps = Math.floor((days * 24 * 60) / intervalMinutes);
  const lines = ["pipeline_name,timestamp,flow,pressure"];

  for (const p of PIPELINES) {
    const baseFlow = 180 + Math.random() * 140; // 180-320 L/min
    const basePressure = 55 + Math.random() * 20; // 55-75 psi

    // 1-2 leak windows
    const leakWindows = [];
    const numLeaks = 1 + Math.floor(Math.random() * 2);
    for (let l = 0; l < numLeaks; l++) {
      const lStart = Math.floor(steps * 0.2 + Math.random() * (steps * 0.6));
      const lLen = 8 + Math.floor(Math.random() * 16);
      leakWindows.push({ start: lStart, end: lStart + lLen });
    }

    for (let i = 0; i < steps; i++) {
      const t = new Date(start.getTime() + i * intervalMinutes * 60 * 1000);
      const hour = t.getUTCHours();
      const cycle =
        1.0 +
        0.25 *
          (Math.exp(-Math.pow(hour - 8, 2) / 8) +
            Math.exp(-Math.pow(hour - 19, 2) / 8));

      let flow = baseFlow * cycle + (Math.random() - 0.5) * (baseFlow * 0.06);
      let pressure = basePressure + (Math.random() - 0.5) * (basePressure * 0.04);

      const inLeak = leakWindows.some((w) => i >= w.start && i < w.end);
      if (inLeak) {
        flow *= 1.4 + Math.random() * 0.5; // flow spike
        pressure *= 0.55 + Math.random() * 0.2; // pressure drop
      }

      lines.push(`${p.name},${t.toISOString()},${flow.toFixed(2)},${pressure.toFixed(2)}`);
    }
  }

  fs.writeFileSync(CSV_PATH, lines.join("\n"), "utf-8");
  console.log(`Wrote ${lines.length - 1} synthetic historical rows to ${CSV_PATH}`);
}

async function seedDefaultUser() {
  const existing = await query("SELECT id FROM users LIMIT 1");
  if (existing.rows.length === 0) {
    const defaultUserid = "admin";
    const defaultName = "WaterNet Operator";
    const defaultPwd = "password123";
    const hashedPassword = await bcrypt.hash(defaultPwd, 10);

    await query(
      "INSERT INTO users (userid, name, pwd) VALUES ($1, $2, $3)",
      [defaultUserid, defaultName, hashedPassword]
    );
    console.log(`  Created default demo user: userid="${defaultUserid}", pwd="${defaultPwd}"`);
  }
}

async function loadDataset() {
  await initDb();
  await seedDefaultUser();

  if (!fs.existsSync(CSV_PATH)) {
    generateSyntheticDataset();
  }

  const rawCsv = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = rawCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(",").map((h) => h.trim());

  const nameIdx = header.indexOf("pipeline_name");
  const tsIdx = header.indexOf("timestamp");
  const flowIdx = header.indexOf("flow");
  const pressIdx = header.indexOf("pressure");

  const byPipeline = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 4) continue;
    const pName = parts[nameIdx].trim();
    if (!byPipeline[pName]) byPipeline[pName] = [];
    byPipeline[pName].push({
      timestamp: parts[tsIdx].trim(),
      flow: parseFloat(parts[flowIdx]),
      pressure: parseFloat(pressIdx !== -1 ? parts[pressIdx] : 0),
    });
  }

  for (const [name, rows] of Object.entries(byPipeline)) {
    const flows = rows.map((r) => r.flow);
    const pressures = rows.map((r) => r.pressure);

    const flowStats = calcStats(flows);
    const pressStats = calcStats(pressures);

    const meta = PIPELINES.find((p) => p.name === name) || { location: null };

    // Upsert pipeline
    let pResult = await query("SELECT id FROM pipelines WHERE name = $1", [name]);
    let pipelineId;

    if (pResult.rows.length === 0) {
      const insertRes = await query(
        `INSERT INTO pipelines (name, location, baseline_flow_mean, baseline_flow_std, baseline_pressure_mean, baseline_pressure_std)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [name, meta.location, flowStats.mean, flowStats.std, pressStats.mean, pressStats.std]
      );
      pipelineId = insertRes.rows[0].id;
    } else {
      pipelineId = pResult.rows[0].id;
      await query(
        `UPDATE pipelines 
         SET baseline_flow_mean = $1, baseline_flow_std = $2, baseline_pressure_mean = $3, baseline_pressure_std = $4
         WHERE id = $5`,
        [flowStats.mean, flowStats.std, pressStats.mean, pressStats.std, pipelineId]
      );
    }

    // Check if historical readings exist
    const countRes = await query(
      "SELECT COUNT(*) AS count FROM readings WHERE pipeline_id = $1 AND source = 'historical'",
      [pipelineId]
    );

    const existingCount = parseInt(countRes.rows[0].count, 10);
    if (existingCount > 0) {
      console.log(`  ${name}: baseline updated (${flowStats.mean.toFixed(1)} L/min, ${pressStats.mean.toFixed(1)} psi), ${existingCount} historical readings already present.`);
      continue;
    }

    // Bulk insert historical readings in chunks of 500
    const chunkSize = 500;
    for (let c = 0; c < rows.length; c += chunkSize) {
      const chunk = rows.slice(c, c + chunkSize);
      const values = [];
      const placeholders = [];

      chunk.forEach((r, idx) => {
        const offset = idx * 5;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
        values.push(pipelineId, r.timestamp, r.flow, r.pressure, "historical");
      });

      await query(
        `INSERT INTO readings (pipeline_id, timestamp, flow, pressure, source) VALUES ${placeholders.join(",")}`,
        values
      );
    }

    console.log(`  ${name}: calibrated baseline (flow: ${flowStats.mean.toFixed(1)}±${flowStats.std.toFixed(1)} L/min, pressure: ${pressStats.mean.toFixed(1)}±${pressStats.std.toFixed(1)} psi), loaded ${rows.length} readings.`);
  }

  console.log("Database seeding & baseline calibration completed successfully.");
}

if (require.main === module) {
  loadDataset()
    .then(() => pool.end())
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}

module.exports = { loadDataset };
