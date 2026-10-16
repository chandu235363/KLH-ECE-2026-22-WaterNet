/**
 * WaterNet Sensor Simulator (Node.js).
 *
 * Polls the backend for the list of pipelines, then generates and posts
 * a realistic reading for each one on an interval. Data is drawn from
 * each pipeline's baseline mean and standard deviation.
 * Occasionally injects an anomaly (burst / pressure drop / blockage)
 * to demonstrate live leak detection and alerts.
 */

const API_BASE = process.env.API_BASE || "http://localhost:8000";
const INTERVAL_SECONDS = parseFloat(process.env.SIM_INTERVAL_SECONDS || "5");
const ANOMALY_CHANCE = parseFloat(process.env.SIM_ANOMALY_CHANCE || "0.05");

// Box-Muller transform for gaussian random distribution
function randomGauss(mean = 0, stdev = 1) {
  let u = 1 - Math.random();
  let v = Math.random();
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}

async function fetchPipelines() {
  const res = await fetch(`${API_BASE}/pipelines`);
  if (!res.ok) {
    throw new Error(`Failed to fetch pipelines: ${res.statusText}`);
  }
  return res.json();
}

function nextReading(pipeline) {
  let flow = randomGauss(pipeline.baseline_flow_mean, pipeline.baseline_flow_std);
  let pressure = randomGauss(pipeline.baseline_pressure_mean, pipeline.baseline_pressure_std);

  if (Math.random() < ANOMALY_CHANCE) {
    if (Math.random() < 0.5) {
      // Possible leak or burst: flow spike + pressure drop
      flow *= 1.5 + Math.random() * 0.5;
      pressure *= 0.5 + Math.random() * 0.2;
    } else {
      // Possible blockage: flow drop
      flow *= 0.3 + Math.random() * 0.2;
    }
  }

  return {
    pipeline_id: pipeline.id,
    flow: Math.max(flow, 0.0),
    pressure: Math.max(pressure, 0.0),
    source: "live",
  };
}

async function tick() {
  try {
    const pipelines = await fetchPipelines();
    if (!pipelines || pipelines.length === 0) {
      console.log("No pipelines found yet - has seed.js run?");
      return;
    }

    for (const p of pipelines) {
      const payload = nextReading(p);
      const res = await fetch(`${API_BASE}/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error(`Telemetry ingest failed for pipeline ${p.name}: ${res.statusText}`);
        continue;
      }

      const result = await res.json();
      if (result.alert) {
        console.log(`[ALERT TRIGGERED] ${result.alert.message}`);
      }
    }
  } catch (err) {
    console.error("Simulator tick error:", err.message);
  }
}

function run() {
  console.log(`WaterNet Simulator active. Posting to ${API_BASE} every ${INTERVAL_SECONDS}s`);
  tick();
  setInterval(tick, INTERVAL_SECONDS * 1000);
}

run();
