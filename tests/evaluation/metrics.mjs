/** Metrics consume independently labelled outcomes. They do not create labels. */
export function proportion(successes, total) {
  if (!total)
    return {
      value: null,
      numerator: successes,
      denominator: 0,
      interval95: null,
    };
  const value = successes / total;
  const z = 1.959963984540054;
  const divisor = 1 + (z * z) / total;
  const center = (value + (z * z) / (2 * total)) / divisor;
  const margin =
    (z *
      Math.sqrt(
        (value * (1 - value)) / total + (z * z) / (4 * total * total),
      )) /
    divisor;
  return {
    value,
    numerator: successes,
    denominator: total,
    interval95: [Math.max(0, center - margin), Math.min(1, center + margin)],
  };
}

export function evaluate(rows, categories) {
  let predictedHides = 0,
    correctHides = 0,
    expectedVisible = 0,
    falseHides = 0,
    abstained = 0;
  const perCategory = Object.fromEntries(
    categories.map((id) => [id, { positives: 0, truePositives: 0 }]),
  );
  const latency = [];
  let cost = 0,
    knownCosts = 0,
    attempts = 0;
  for (const row of rows) {
    if (!row.expectedHidden) ++expectedVisible;
    if (row.actualHidden) {
      ++predictedHides;
      if (row.expectedHidden) ++correctHides;
      else ++falseHides;
    }
    if (row.abstained) ++abstained;
    for (const id of categories)
      if (row.labels.includes(id)) {
        ++perCategory[id].positives;
        if (row.predictions.includes(id)) ++perCategory[id].truePositives;
      }
    latency.push(row.latencyMs);
    attempts += row.attempts;
    if (row.costUsd !== null) {
      cost += row.costUsd;
      ++knownCosts;
    }
  }
  latency.sort((a, b) => a - b);
  return {
    samples: rows.length,
    hidePrecision: proportion(correctHides, predictedHides),
    falseHideRate: proportion(falseHides, expectedVisible),
    abstention: proportion(abstained, rows.length),
    coverage: proportion(rows.length - abstained, rows.length),
    categoryRecall: Object.fromEntries(
      Object.entries(perCategory).map(([id, counts]) => [
        id,
        proportion(counts.truePositives, counts.positives),
      ]),
    ),
    latencyP95Ms: latency.length
      ? latency[Math.ceil(latency.length * 0.95) - 1]
      : null,
    attempts,
    costUsdPer100Attempts:
      attempts && knownCosts === rows.length ? (cost * 100) / attempts : null,
  };
}

export function validateEvaluation(data, categories) {
  const issues = [];
  if (data?.schemaVersion !== 1 || !Array.isArray(data.rows))
    throw new Error('Expected versioned evaluation input with rows');
  for (const field of [
    'provider',
    'model',
    'promptVersion',
    'taxonomyVersion',
    'thresholdVersion',
    'sourceCommit',
    'runDate',
    'browser',
    'hardware',
  ])
    if (typeof data[field] !== 'string' || !data[field].trim())
      issues.push(`Missing metadata: ${field}`);
  if (
    !Array.isArray(data.annotators) ||
    data.annotators.length !== 2 ||
    new Set(data.annotators).size !== 2 ||
    data.annotators.some((value) => typeof value !== 'string' || !value.trim())
  )
    issues.push('Two distinct independent annotator identifiers are required');
  const ids = new Set();
  const groups = new Map();
  for (const row of data.rows) {
    if (!row || typeof row !== 'object')
      throw new Error('Invalid evaluation row');
    if (typeof row.id !== 'string' || !row.id || ids.has(row.id))
      issues.push('Missing or duplicate example ID');
    ids.add(row.id);
    if (
      !['development', 'test'].includes(row.split) ||
      typeof row.templateGroup !== 'string' ||
      !row.templateGroup
    )
      issues.push('Each row requires a split and template/source group');
    const split = groups.get(row.templateGroup);
    if (split && split !== row.split)
      issues.push(`Template/source leakage: ${row.templateGroup}`);
    groups.set(row.templateGroup, row.split);
    if (typeof row.adjudicated !== 'boolean' || !row.adjudicated)
      issues.push('Unadjudicated example');
    for (const field of ['labels', 'predictions'])
      if (
        !Array.isArray(row[field]) ||
        new Set(row[field]).size !== row[field].length ||
        row[field].some((id) => !categories.includes(id))
      )
        issues.push(`Invalid ${field}`);
    for (const field of ['expectedHidden', 'actualHidden', 'abstained'])
      if (typeof row[field] !== 'boolean') issues.push(`Invalid ${field}`);
    if (
      !Number.isFinite(row.latencyMs) ||
      row.latencyMs < 0 ||
      !Number.isSafeInteger(row.attempts) ||
      row.attempts < 0 ||
      (row.costUsd !== null &&
        (!Number.isFinite(row.costUsd) || row.costUsd < 0))
    )
      issues.push('Invalid usage or latency');
    if (row.abstained && (row.actualHidden || row.predictions?.length))
      issues.push('Abstention must not carry remote labels or hide a post');
  }
  return [...new Set(issues)];
}

export function qualityGates(data, report, categories) {
  const failures = [];
  if (data.rows.length < 500 || report.samples < 200)
    failures.push('Need at least 500 total examples and 200 held-out examples');
  if (report.hidePrecision.value === null || report.hidePrecision.value < 0.95)
    failures.push('Hide precision below 95% or undefined');
  if (report.falseHideRate.value === null || report.falseHideRate.value > 0.02)
    failures.push('False-hide rate above 2% or undefined');
  for (const id of categories) {
    const recall = report.categoryRecall[id];
    if (recall.denominator < 30 || recall.value === null || recall.value < 0.8)
      failures.push(`Insufficient positives or recall below 80%: ${id}`);
  }
  return failures;
}
