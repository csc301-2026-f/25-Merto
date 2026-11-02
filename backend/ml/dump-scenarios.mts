// Dumps every timeline event of the labelled scenario deals so the Python model can
// predict signals for them. Usage: tsx dump-scenarios.ts <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as repo from '../src/evaluation/repository.ts';
import { sandboxDatabase } from '../src/sandbox-db.ts';

const labels = JSON.parse(readFileSync(
  new URL('../test/fixtures/scenario-labels.json', import.meta.url), 'utf8'));
const db = await sandboxDatabase();
try {
  const events = [];
  for (const { deal_id: dealId } of labels.deals) {
    const conversation = await repo.loadConversation(db, dealId);
    for (const e of conversation.events) {
      events.push({ id: e.id, dealId, actorType: e.actorType, direction: e.direction, body: e.body });
    }
  }
  writeFileSync(process.argv[2], JSON.stringify(events, null, 2));
  console.log(`wrote ${events.length} events`);
} finally {
  await db.close();
}
