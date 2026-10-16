# WaterNet — Municipal Pipeline Telemetry & Leak Detection

A full-stack PERN application (**React + Node.js + Express.js + PostgreSQL**) for monitoring simulated water pipeline telemetry, detecting leaks against statistical baselines, storing authentication & telemetry data in PostgreSQL, and streaming live updates over WebSockets.

---

## Tech Stack (PERN)

- **Frontend**: React (Vite) + Recharts operations dashboard with authentication & live telemetry visualization.
- **Backend**: Node.js + Express.js REST API with WebSocket streaming (`ws`).
- **Database**: PostgreSQL storing:
  - **Authentication details**: `users` table (`userid`, `name`, `pwd` hashed with bcrypt).
  - **Telemetry data**: `readings` table (`pipeline_id`, `timestamp`, `flow`, `pressure`, `source`).
  - **Pipelines & Baselines**: `pipelines` table with calibrated mean and standard deviation baselines.
  - **Leak Alerts**: `alerts` table storing detected anomalies (`pressure_drop`, `flow_spike`, `flow_drop`).
- **Telemetry Ingestion & Leak Detection**: Z-score statistical evaluation against per-pipeline calibrated baselines.
- **Sensor Simulator**: Node.js telemetry generator with live anomalies.

---

## Architecture

```
Historical Dataset (CSV) ──> seed.js ──> PostgreSQL (pipelines, baseline calibration)
                                                 ▲
                                                 │
Sensor Simulator (Node.js) ─────────> Express.js API (POST /telemetry)
                                                 │
                                                 ├──> PostgreSQL (readings, alerts)
                                                 │
                                                 ├──> Leak Detection (Z-score anomaly engine)
                                                 │
                                                 └──> WebSocket (/ws) ──> React Dashboard
                                                                               │
Operator Auth (userid, name, pwd) ──> Express.js Auth (/auth/*) ──────> PostgreSQL (users)
```

---

## PostgreSQL Database Schema

Credentials and database connection details are stored in environment variables (`DATABASE_URL` or `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, `PGDATABASE`).

### 1. `users` Table
Stores operator authentication credentials:
- `id`: `SERIAL PRIMARY KEY`
- `userid`: `VARCHAR(100) UNIQUE NOT NULL`
- `name`: `VARCHAR(255) NOT NULL`
- `pwd`: `VARCHAR(255) NOT NULL` (Bcrypt hashed password — plaintext is never stored)
- `created_at`: `TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`

### 2. `pipelines` Table
- `id`: `SERIAL PRIMARY KEY`
- `name`: `VARCHAR(255) UNIQUE NOT NULL`
- `location`: `VARCHAR(255)`
- `baseline_flow_mean`: `DOUBLE PRECISION`
- `baseline_flow_std`: `DOUBLE PRECISION`
- `baseline_pressure_mean`: `DOUBLE PRECISION`
- `baseline_pressure_std`: `DOUBLE PRECISION`

### 3. `readings` Table (Telemetry)
- `id`: `SERIAL PRIMARY KEY`
- `pipeline_id`: `INTEGER REFERENCES pipelines(id) ON DELETE CASCADE`
- `timestamp`: `TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`
- `flow`: `DOUBLE PRECISION NOT NULL` (L/min)
- `pressure`: `DOUBLE PRECISION NOT NULL` (psi)
- `source`: `VARCHAR(50) DEFAULT 'live'`

### 4. `alerts` Table
- `id`: `SERIAL PRIMARY KEY`
- `pipeline_id`: `INTEGER REFERENCES pipelines(id) ON DELETE CASCADE`
- `timestamp`: `TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`
- `alert_type`: `VARCHAR(100) NOT NULL` (`pressure_drop`, `flow_spike`, `flow_drop`)
- `severity`: `VARCHAR(50) DEFAULT 'warning'` (`warning`, `critical`)
- `message`: `TEXT NOT NULL`
- `resolved`: `BOOLEAN DEFAULT FALSE`

---

## API Reference

### Authentication (`/auth`)
| Method | Path              | Description |
|--------|-------------------|-------------|
| POST   | `/auth/register`  | Register user (`userid`, `name`, `pwd`); hashes password and saves to PostgreSQL |
| POST   | `/auth/login`     | Authenticate operator (`userid`, `pwd`); verifies against PostgreSQL table only |
| GET    | `/auth/me`        | Fetch authenticated user profile using Bearer JWT token |

### Pipelines & Telemetry (`/pipelines`, `/telemetry`)
| Method | Path                       | Description |
|--------|----------------------------|-------------|
| GET    | `/pipelines`               | List all pipelines with calibrated baseline stats |
| POST   | `/pipelines`               | Create a new pipeline |
| GET    | `/pipelines/{id}/readings` | Chronological reading history for selected pipeline |
| POST   | `/telemetry`               | Ingest reading, run leak detection, save to DB, broadcast |

### Alerts & Live Stream (`/alerts`, `/ws`)
| Method | Path                   | Description |
|--------|------------------------|-------------|
| GET    | `/alerts?resolved=false`| List active/resolved alerts |
| PATCH  | `/alerts/{id}/resolve` | Mark an alert resolved in PostgreSQL |
| WS     | `/ws`                  | Real-time WebSocket feed for live readings and alerts |

---

## Local Setup & Run Instructions (Step-by-Step)

### Prerequisites
- Node.js (v18+ or v20+)
- PostgreSQL (running locally or in Docker)

---

### Step 1: Start PostgreSQL & Create Database
Ensure your PostgreSQL server is running and create the `waternet` database.

On Windows (Command Prompt / PowerShell):
```powershell
createdb -U postgres waternet
```
*(Or via psql / pgAdmin: `CREATE DATABASE waternet;`)*

Set your PostgreSQL connection string in `backend/.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/waternet
PORT=8000
JWT_SECRET=waternet-super-secret-key-pbl-2026
```

---

### Step 2: Set Up and Start the Node.js / Express Backend

Open a terminal in the `backend/` directory:
```bash
cd backend
npm install
npm run seed       # Initializes PostgreSQL tables, creates default demo user & seeds dataset
npm start          # Starts Express API and WebSocket server on http://localhost:8000
```
> **Default Demo Operator Account**:
> - **User ID (`userid`)**: `admin`
> - **Password (`pwd`)**: `password123`

---

### Step 3: Start the Sensor Simulator (in a new terminal)

In a separate terminal, run the Node.js simulator to feed live telemetry data:
```bash
cd backend
npm run sim
```
This continuously posts flow & pressure sensor readings to `/telemetry`, occasionally injecting anomalies to demonstrate real-time leak detection.

---

### Step 4: Set Up and Start the React Frontend (in a new terminal)

In another terminal, start the React dashboard:
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173** in your browser.

- Sign in using the demo account (`admin` / `password123`) or click **"Create Account"** to register a new operator (`userid`, `name`, `pwd`).
- Once logged in, view live telemetry graphs, pipeline statuses, and real-time leak alerts!

---

## Running with Docker Compose (Alternative)

To run the entire PERN stack with a single command:
```bash
docker compose up --build
```
This starts:
1. PostgreSQL container on port `5432`
2. Node.js Express backend with automatic seeding on port `8000`
3. Node.js simulator streaming telemetry
4. React frontend dashboard on `http://localhost:5173`
