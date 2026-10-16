import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function PipelinePanel({ pipeline, readings }) {
  if (!pipeline) {
    return <div className="empty-state">Select a pipeline to view telemetry.</div>;
  }

  const latest = readings[readings.length - 1];
  const chartData = readings.map((r) => ({
    time: formatTime(r.timestamp),
    flow: r.flow,
    pressure: r.pressure,
  }));

  return (
    <div>
      <div className="readout-row">
        <div className="readout">
          <div className="readout-label">Flow</div>
          <div className="readout-value mono">
            {latest ? latest.flow.toFixed(1) : "—"}
            <span className="readout-unit">L/min</span>
          </div>
        </div>
        <div className="readout">
          <div className="readout-label">Pressure</div>
          <div className="readout-value mono">
            {latest ? latest.pressure.toFixed(1) : "—"}
            <span className="readout-unit">psi</span>
          </div>
        </div>
        <div className="readout">
          <div className="readout-label">Baseline flow</div>
          <div className="readout-value mono">
            {pipeline.baseline_flow_mean.toFixed(0)}
            <span className="readout-unit">± {pipeline.baseline_flow_std.toFixed(0)}</span>
          </div>
        </div>
        <div className="readout">
          <div className="readout-label">Baseline pressure</div>
          <div className="readout-value mono">
            {pipeline.baseline_pressure_mean.toFixed(0)}
            <span className="readout-unit">± {pipeline.baseline_pressure_std.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <p className="panel-title">Flow &amp; pressure — last {readings.length} readings</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="#24343d" strokeDasharray="3 3" />
            <XAxis dataKey="time" stroke="#5c7078" fontSize={11} />
            <YAxis yAxisId="flow" stroke="#3fa796" fontSize={11} width={40} />
            <YAxis yAxisId="pressure" orientation="right" stroke="#e3a83b" fontSize={11} width={40} />
            <Tooltip
              contentStyle={{ background: "#1c2f39", border: "1px solid #24343d", fontSize: 12 }}
              labelStyle={{ color: "#8fa3ad" }}
            />
            <Line yAxisId="flow" type="monotone" dataKey="flow" stroke="#3fa796" dot={false} strokeWidth={1.5} name="Flow (L/min)" />
            <Line yAxisId="pressure" type="monotone" dataKey="pressure" stroke="#e3a83b" dot={false} strokeWidth={1.5} name="Pressure (psi)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
