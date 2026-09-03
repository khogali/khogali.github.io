#!/usr/bin/env node
/**
 * Usage:
 *   npx tsx src/cli.ts "ergonomic pillow"
 *   npx tsx src/cli.ts "ergonomic pillow" --serp        # local only
 *   npx tsx src/cli.ts "ergonomic pillow" --top 40 --json
 */
import { expand } from './autocomplete';
import { rank } from './score';
import { playwrightProvider, difficultyFrom } from './serp';

async function main() {
  const args = process.argv.slice(2);
  const seed = args.find(a => !a.startsWith('--'));
  if (!seed) { console.error('usage: cli "seed keyword" [--serp] [--top N] [--json]'); process.exit(1); }

  const useSerp = args.includes('--serp');
  const asJson  = args.includes('--json');
  const topN    = parseInt(args[args.indexOf('--top') + 1] ?? '30', 10) || 30;

  console.error(`expanding "${seed}" ...`);
  const keywords = await expand(seed);
  console.error(`found ${keywords.length} keywords`);

  let difficulties: Map<string, number> | undefined;
  if (useSerp) {
    // Only the top candidates — SERP calls are the slow, blockable part.
    const shortlist = rank(keywords).slice(0, 10);
    difficulties = new Map();
    const provider = playwrightProvider('duckduckgo');
    for (const c of shortlist) {
      try {
        const results = await provider.fetch(c.keyword);
        const { difficulty } = difficultyFrom(results);
        difficulties.set(c.keyword, difficulty);
        console.error(`  serp ${c.keyword} → ${difficulty}`);
      } catch (e: any) {
        console.error(`  serp FAILED ${c.keyword} (${e.message.slice(0, 60)})`);
      }
    }
  }

  const ranked = rank(keywords, difficulties).slice(0, topN);

  if (asJson) { console.log(JSON.stringify(ranked, null, 2)); return; }

  console.log(`\n${'SCORE'.padEnd(6)}${'INTENT'.padEnd(15)}KEYWORD`);
  console.log('-'.repeat(78));
  for (const r of ranked) {
    const d = r.difficulty !== undefined ? ` [KD ${r.difficulty}]` : '';
    console.log(`${String(r.score).padEnd(6)}${r.intent.padEnd(15)}${r.keyword}${d}`);
  }
  console.log(`\ntop reasons: ${ranked[0]?.reasons.join(', ') ?? '—'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
