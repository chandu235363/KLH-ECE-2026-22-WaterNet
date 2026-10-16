/**
 * Leak detection rules.
 *
 * Thresholds are expressed in standard deviations away from each pipeline's
 * baseline mean, rather than hardcoded absolute numbers. The baseline
 * mean/std for every pipeline is computed once from the historical dataset
 * (see seed.js) and stored on the Pipeline row, so a "leak" here
 * means "statistically unusual for THIS pipeline", not an arbitrary global
 * cutoff.
 */

const PRESSURE_DROP_Z = -2.5; // pressure this far below baseline mean => leak
const FLOW_SPIKE_Z = 2.5;     // flow this far above baseline mean => possible burst/leak
const FLOW_DROP_Z = -2.5;     // flow this far below baseline mean => possible blockage/closed valve
const CRITICAL_Z = 3.5;       // beyond this, mark severity as critical instead of warning

function zScore(value, mean, std) {
  if (!std || std <= 0) return 0.0;
  return (value - mean) / std;
}

function evaluateReading(pipeline, flow, pressure) {
  const pressureZ = zScore(
    pressure,
    pipeline.baseline_pressure_mean,
    pipeline.baseline_pressure_std
  );
  const flowZ = zScore(
    flow,
    pipeline.baseline_flow_mean,
    pipeline.baseline_flow_std
  );

  const severityFor = (z) => (Math.abs(z) >= CRITICAL_Z ? "critical" : "warning");

  if (pressureZ <= PRESSURE_DROP_Z) {
    return {
      alert_type: "pressure_drop",
      severity: severityFor(pressureZ),
      message: `Pressure ${pressure.toFixed(1)} psi is ${Math.abs(pressureZ).toFixed(1)} std below baseline (${pipeline.baseline_pressure_mean.toFixed(1)} psi) on '${pipeline.name}' - possible leak.`,
    };
  }

  if (flowZ >= FLOW_SPIKE_Z) {
    return {
      alert_type: "flow_spike",
      severity: severityFor(flowZ),
      message: `Flow ${flow.toFixed(1)} L/min is ${flowZ.toFixed(1)} std above baseline (${pipeline.baseline_flow_mean.toFixed(1)} L/min) on '${pipeline.name}' - possible burst.`,
    };
  }

  if (flowZ <= FLOW_DROP_Z) {
    return {
      alert_type: "flow_drop",
      severity: severityFor(flowZ),
      message: `Flow ${flow.toFixed(1)} L/min is ${Math.abs(flowZ).toFixed(1)} std below baseline (${pipeline.baseline_flow_mean.toFixed(1)} L/min) on '${pipeline.name}' - possible blockage.`,
    };
  }

  return null;
}

module.exports = {
  zScore,
  evaluateReading,
};
