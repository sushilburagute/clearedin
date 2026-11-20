import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { link, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  evaluate,
  proportion,
  validateEvaluation,
  qualityGates,
} from '../../tests/evaluation/metrics.mjs';

const row = {
  id: 'a',
  templateGroup: 'one',
  split: 'test',
  adjudicated: true,
  labels: ['job_posting'],
  predictions: ['job_posting'],
  expectedHidden: true,
  actualHidden: true,
  abstained: false,
  latencyMs: 10,
  attempts: 1,
  costUsd: 0.01,
};
const metadata = {
  schemaVersion: 1,
  provider: 'synthetic',
  model: 'synthetic',
  promptVersion: '1',
  taxonomyVersion: '1',
  thresholdVersion: '1',
  sourceCommit: 'fixture',
  runDate: '2026-11-17',
  browser: 'none',
  hardware: 'fixture',
  annotators: ['fixture-a', 'fixture-b'],
};
test('undefined precision and recall cannot pass with no hides or positives', () => {
  const data = { ...metadata, rows: [] };
  const report = evaluate([], ['job_posting']);
  assert.equal(report.hidePrecision.value, null);
  assert(qualityGates(data, report, ['job_posting']).length >= 4);
  assert.equal(proportion(0, 0).interval95, null);
});
test('metric denominators distinguish hide precision from false-hide rate', () => {
  const report = evaluate(
    [
      row,
      { ...row, expectedHidden: false, labels: [] },
      {
        ...row,
        expectedHidden: false,
        actualHidden: false,
        labels: [],
        predictions: [],
        abstained: true,
      },
    ],
    ['job_posting'],
  );
  assert.equal(report.hidePrecision.value, 0.5);
  assert.equal(report.falseHideRate.value, 0.5);
  assert.equal(report.categoryRecall.job_posting.value, 1);
  assert.equal(report.abstention.value, 1 / 3);
  assert.equal(report.costUsdPer100Attempts, 1);
  assert(report.hidePrecision.interval95[0] < 0.5);
  assert(report.hidePrecision.interval95[1] > 0.5);
});
test('source/template leakage, duplicate IDs, invalid labels, and missing annotators are rejected', () => {
  assert.deepEqual(
    validateEvaluation({ ...metadata, rows: [row] }, ['job_posting']),
    [],
  );
  const issues = validateEvaluation(
    {
      ...metadata,
      annotators: ['same', 'same'],
      rows: [row, { ...row, split: 'development', labels: ['invented'] }],
    },
    ['job_posting'],
  );
  assert(issues.some((issue) => issue.includes('leakage')));
  assert(issues.some((issue) => issue.includes('duplicate')));
  assert(issues.some((issue) => issue.includes('annotator')));
  assert(issues.some((issue) => issue.includes('labels')));
});
test('unknown cost stays unknown and abstentions cannot hide', () => {
  assert.equal(
    evaluate([{ ...row, costUsd: null }], ['job_posting'])
      .costUsdPer100Attempts,
    null,
  );
  assert(
    validateEvaluation({ ...metadata, rows: [{ ...row, abstained: true }] }, [
      'job_posting',
    ]).some((issue) => issue.includes('Abstention')),
  );
});

test('padding cannot create a second annotator, example, or source group', () => {
  const issues = validateEvaluation(
    {
      ...metadata,
      annotators: ['reader', 'reader '],
      rows: [
        row,
        { ...row, id: ' a ', templateGroup: 'one ', split: 'development' },
        null,
      ],
    },
    ['job_posting'],
  );
  for (const message of [
    'annotator',
    'duplicate',
    'leakage',
    'Invalid evaluation row',
  ])
    assert(issues.some((issue) => issue.includes(message)));
});

test('an all-test dataset cannot pass the calibration split requirement', () => {
  const data = { ...metadata, rows: [row] };
  const report = evaluate(data.rows, ['job_posting']);
  assert(
    qualityGates(data, report, ['job_posting']).some((issue) =>
      issue.includes('development split'),
    ),
  );
});

test('the CLI preserves input files and includes only declared report metadata', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'clearedin-evaluation-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'input.json');
  const alias = join(directory, 'alias.json');
  const output = join(directory, 'report.json');
  const source = JSON.stringify({
    ...metadata,
    privateNotes: 'exclude',
    rows: [row],
  });
  await writeFile(input, source);
  await link(input, alias);
  const run = (destination) =>
    spawnSync(process.execPath, ['scripts/evaluate.mjs', input, destination], {
      encoding: 'utf8',
    });
  assert.equal(run(alias).status, 1);
  assert.equal(await readFile(input, 'utf8'), source);
  const result = run(output);
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(
    JSON.parse(await readFile(output, 'utf8')).metadata,
    metadata,
  );
});
