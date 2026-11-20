import { readFile, stat, writeFile } from 'node:fs/promises';
import { REMOTE_CATEGORY_IDS } from '../packages/contracts/src/primitives.ts';
import {
  evaluate,
  validateEvaluation,
  qualityGates,
  metadataFields,
} from '../tests/evaluation/metrics.mjs';

const [input, output] = process.argv.slice(2);
async function sameFile(input, output) {
  const source = await stat(input, { bigint: true });
  try {
    const destination = await stat(output, { bigint: true });
    return source.dev === destination.dev && source.ino === destination.ino;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

if (!input || !output) {
  console.error(
    'Usage: pnpm evaluate <independently-labelled-input.json> <report.json>. No evaluation corpus or live accuracy is fabricated.',
  );
  process.exitCode = 2;
} else if (await sameFile(input, output)) {
  console.error(
    'Choose a separate output file to preserve the evaluation input.',
  );
  process.exitCode = 1;
} else {
  const data = JSON.parse(await readFile(input, 'utf8'));
  const issues = validateEvaluation(data, REMOTE_CATEGORY_IDS);
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  } else {
    const report = evaluate(
      data.rows.filter((row) => row.split === 'test'),
      REMOTE_CATEGORY_IDS,
    );
    const failures = qualityGates(data, report, REMOTE_CATEGORY_IDS);
    const metadata = Object.fromEntries(
      ['schemaVersion', ...metadataFields, 'annotators'].map((key) => [
        key,
        data[key],
      ]),
    );
    await writeFile(
      output,
      JSON.stringify(
        {
          metadata,
          report,
          failures,
          status: failures.length ? 'failed' : 'passed-numeric-gates-only',
          note: 'Annotation independence and provenance require separate human review. Numerical success is not release approval.',
        },
        null,
        2,
      ) + '\n',
    );
    process.exitCode = failures.length ? 2 : 0;
    console.log(
      `Held-out evaluation written; ${failures.length} unmet numerical gates.`,
    );
  }
}
