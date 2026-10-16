require("dotenv").config();
const { Pool, Client } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || "postgres"}:${process.env.PGPASSWORD || "postgres"}@${process.env.PGHOST || "localhost"}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || "waternet"}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function ensureDatabaseExists() {
  const dbName = process.env.PGDATABASE || "waternet";
  const user = process.env.PGUSER || "postgres";
  const password = process.env.PGPASSWORD || "postgres";
  const host = process.env.PGHOST || "localhost";
  const port = process.env.PGPORT || 5432;

  let maintenanceUrl = `postgresql://${user}:${password}@${host}:${port}/postgres`;
  if (process.env.DATABASE_URL) {
    try {
      const parsed = new URL(process.env.DATABASE_URL);
      parsed.pathname = "/postgres";
      maintenanceUrl = parsed.toString();
    } catch {
      // Fallback to constructed maintenanceUrl
    }
  }

  const client = new Client({ connectionString: maintenanceUrl });
  try {
    await client.connect();
    const checkRes = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    if (checkRes.rows.length === 0) {
      console.log(`Database "${dbName}" does not exist yet. Creating it automatically...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created successfully.`);
    }
  } catch (err) {
    // If maintenance check fails, continue and let main pool try connecting
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

async function initDb() {
  await ensureDatabaseExists();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Users table for authentication (stores userid, name, hashed pwd)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        userid VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        pwd VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Pipelines table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pipelines (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        location VARCHAR(255),
        baseline_flow_mean DOUBLE PRECISION DEFAULT 0.0,
        baseline_flow_std DOUBLE PRECISION DEFAULT 1.0,
        baseline_pressure_mean DOUBLE PRECISION DEFAULT 0.0,
        baseline_pressure_std DOUBLE PRECISION DEFAULT 1.0
      );
    `);

    // 3. Telemetry readings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS readings (
        id SERIAL PRIMARY KEY,
        pipeline_id INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        flow DOUBLE PRECISION NOT NULL,
        pressure DOUBLE PRECISION NOT NULL,
        source VARCHAR(50) DEFAULT 'live'
      );
    `);

    // 4. Alerts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        pipeline_id INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        alert_type VARCHAR(100) NOT NULL,
        severity VARCHAR(50) DEFAULT 'warning',
        message TEXT NOT NULL,
        resolved BOOLEAN DEFAULT FALSE
      );
    `);

    // Useful indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_userid ON users (userid);
      CREATE INDEX IF NOT EXISTS idx_readings_pipeline_ts ON readings (pipeline_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_alerts_resolved_ts ON alerts (resolved, timestamp DESC);
    `);

    await client.query("COMMIT");
    console.log("PostgreSQL database schema initialized successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error initializing database schema:", err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  initDb,
};
