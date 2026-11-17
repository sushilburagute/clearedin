import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const gates = JSON.parse(await readFile('docs/release/gates.json', 'utf8'));
assert.equal(gates.schemaVersion, 1);
assert(Array.isArray(gates.gates) && gates.gates.length > 0);
const ids = new Set();
let open = 0;
for (const gate of gates.gates) {
  assert(!ids.has(gate.id) && gate.id, 'Duplicate or missing gate ID');
  ids.add(gate.id);
  assert(
    ['passed', 'failed', 'pending', 'not_applicable'].includes(gate.status),
  );
  assert(
    gate.ownerRole && gate.reason,
    'Gate requires accountable role and reason',
  );
  for (const file of gate.evidence) await access(file);
  if (gate.status === 'passed')
    assert(
      gate.ownerName && gate.evidence.length,
      'Passed gate requires named acceptance and evidence',
    );
  if (gate.status === 'pending' || gate.status === 'failed') {
    ++open;
    console.log(`${gate.id}: ${gate.status} — ${gate.reason}`);
  }
}
console.log(
  `${open} unresolved release gates. Development checks do not authorize publication.`,
);
process.exitCode = open ? 2 : 0;
