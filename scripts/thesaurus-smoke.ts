/**
 * Smoke test des 6 APIs (hors Nest) : `npx tsx scripts/thesaurus-smoke.ts`
 * À lancer une fois depuis une machine avec accès Internet avant de brancher le service.
 */
import { createStrategies } from '../src/thesaurus/strategies/strategy.factory.js';
import { buildThesaurusConfig } from '../src/thesaurus/thesaurus.config.js';
import type { ThesaurusId } from '../src/thesaurus/thesaurus.schemas.js';

const SAMPLES: Record<ThesaurusId, string> = {
  UNESCO: 'biologie',
  EUROVOC: 'agriculture',
  RAMEAU: 'histoire',
  AGROVOC: 'riz',
  MESH: 'diabète',
  GETTY_AAT: 'pont',
};

const strategies = createStrategies(buildThesaurusConfig());

const results = await Promise.allSettled(
  strategies.map(async (s) => {
    const t0 = Date.now();
    const hits = await s.search(SAMPLES[s.id], 'exact');
    return { id: s.id, ms: Date.now() - t0, count: hits.length, first: hits[0]?.prefLabel ?? '—' };
  }),
);

results.forEach((r, i) => {
  const id = strategies[i]?.id;
  console.log(
    r.status === 'fulfilled'
      ? `✅ ${r.value.id.padEnd(10)} ${String(r.value.ms).padStart(5)} ms  ${r.value.count} résultat(s)  ex: ${r.value.first}`
      : `❌ ${String(id).padEnd(10)} ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
  );
});
