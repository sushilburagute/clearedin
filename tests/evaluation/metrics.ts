import {
  CATEGORY_IDS,
  type CategoryId,
} from '../../packages/contracts/src/index';
export interface Observation {
  expectedHidden: boolean;
  hidden: boolean;
  expectedLabels: readonly CategoryId[];
  predictedLabels: readonly CategoryId[];
  clear: boolean;
  abstained: boolean;
  latencyMs: number;
  attempts: number;
  // Aggregate across retries; null means unknown, never zero.
  cost: number | null;
}
export function proportion(numerator: number, denominator: number) {
  if (!denominator)
    return { numerator, denominator, value: null, interval95: null };
  const p = numerator / denominator;
  const z = 1.96;
  const scale = 1 + (z * z) / denominator;
  const center = (p + (z * z) / (2 * denominator)) / scale;
  const half =
    (z *
      Math.sqrt(
        (p * (1 - p)) / denominator + (z * z) / (4 * denominator ** 2),
      )) /
    scale;
  return {
    numerator,
    denominator,
    value: p,
    interval95: [Math.max(0, center - half), Math.min(1, center + half)],
  };
}
export function summarize(rows: readonly Observation[]) {
  for (const row of rows) {
    if (
      !Number.isFinite(row.latencyMs) ||
      row.latencyMs < 0 ||
      !Number.isSafeInteger(row.attempts) ||
      row.attempts < 0 ||
      (row.cost !== null && (!Number.isFinite(row.cost) || row.cost < 0))
    )
      throw new Error('Invalid measurement');
  }
  const count = (predicate: (row: Observation) => boolean) =>
    rows.filter(predicate).length;
  const hidden = count((row) => row.hidden);
  const precision = proportion(
    count((row) => row.hidden && row.expectedHidden),
    hidden,
  );
  const falseHides = proportion(
    count((row) => row.hidden && !row.expectedHidden),
    count((row) => !row.expectedHidden),
  );
  const recall = Object.fromEntries(
    CATEGORY_IDS.map((id) => [
      id,
      proportion(
        count(
          (row) =>
            row.clear &&
            row.expectedLabels.includes(id) &&
            row.predictedLabels.includes(id),
        ),
        count((row) => row.clear && row.expectedLabels.includes(id)),
      ),
    ]),
  );
  const latencies = rows.map((row) => row.latencyMs).sort((a, b) => a - b);
  const attempts = rows.reduce((sum, row) => sum + row.attempts, 0);
  const cost = rows.some((row) => row.cost === null)
    ? null
    : rows.reduce((sum, row) => sum + (row.cost ?? 0), 0);
  return {
    samples: rows.length,
    precision,
    falseHides,
    recall,
    abstention: proportion(
      count((row) => row.abstained),
      rows.length,
    ),
    coverage: proportion(
      count((row) => !row.abstained),
      rows.length,
    ),
    p95LatencyMs: latencies[Math.ceil(latencies.length * 0.95) - 1] ?? null,
    attempts,
    costPer100Attempts:
      cost === null || !attempts ? null : (cost / attempts) * 100,
  };
}
// Point estimates alone cannot establish a release gate. Caller selects enabled
// categories; lack of observations never passes. Human-reviewed live provenance
// and a frozen development calibration are separately mandatory.
export function assessQuality(
  report: ReturnType<typeof summarize>,
  enabled: readonly CategoryId[],
  provenance: 'synthetic' | 'adjudicated-live',
) {
  if (provenance !== 'adjudicated-live') return 'pending' as const;
  if (
    !report.precision.interval95 ||
    !report.falseHides.interval95 ||
    enabled.some((id) => !report.recall[id]?.interval95)
  )
    return 'pending' as const;
  return report.precision.interval95[0]! >= 0.95 &&
    report.falseHides.interval95[1]! <= 0.02 &&
    enabled.every((id) => report.recall[id]!.interval95![0]! >= 0.8)
    ? ('passed' as const)
    : ('failed' as const);
}
