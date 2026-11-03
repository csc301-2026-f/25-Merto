// Evaluate the actual repository wording rules on the message-only v3 labels.
// No conversation history is invented; ignored_opt_out is outside these six labels.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DEFAULT_RULES, type FlagType } from '../src/evaluation/rules.ts';
const dataPath=fileURLToPath(new URL('../test/fixtures/signals-v3-natural/test.json',import.meta.url));
const data=JSON.parse(readFileSync(dataPath,'utf8'));
const mapping: Record<string,Record<string,FlagType>>={
 ai:{claims_booking:'appointment_certainty',guarantees_availability:'unsupported_availability',quotes_price:'unsupported_price',off_tone:'tone'},
 buyer:{asks_for_person:'missed_escalation',asks_about_price:'missed_price_handoff'},
};
const result:any={meta:{scope:'Current repository DEFAULT_RULES wording checks only; no history-dependent final flags.',
 test_sha256:createHash('sha256').update(readFileSync(dataPath)).digest('hex'),
 rules_sha256:createHash('sha256').update(readFileSync(fileURLToPath(new URL('../src/evaluation/rules.ts',import.meta.url)))).digest('hex')},by_side:{}};
for(const side of ['ai','buyer']){
 const predictions=data[side+'_messages'].map((row:any)=>({id:row.id,predicted:Object.fromEntries(Object.entries(mapping[side]).map(([signal,flag])=>{
  const rule=DEFAULT_RULES[flag];
  return [signal,!!rule.pattern?.test(row.text)&&(!rule.requires||rule.requires.test(row.text))&&!rule.unless?.test(row.text)];
 }))}));
 result.by_side[side]={signals:Object.keys(mapping[side]),predictions};
}
writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log('Wrote deterministic wording predictions for 960 frozen test messages.');
