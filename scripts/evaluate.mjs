import { readFile, writeFile } from 'node:fs/promises';
import { REMOTE_CATEGORY_IDS } from '../packages/contracts/src/primitives.ts';
import {
  evaluate,
  validateEvaluation,
  qualityGates,
} from '../tests/evaluation/metrics.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error(
    'Usage: pnpm evaluate <independently-labelled-input.json> <report.json>. No evaluation corpus or live accuracy is fabricated.',
  );
  process.exitCode = 2;
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
      Object.entries(data).filter(([key]) => key !== 'rows'),
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
