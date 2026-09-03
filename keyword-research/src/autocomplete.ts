/**
 * Google Autocomplete expansion — free, no API key, no quota.
 * This is the layer that replaces most of what a paid keyword tool sells you.
 */

const SUGGEST = 'https://suggestqueries.google.com/complete/search';

export async function suggest(query: string, opts: { hl?: string; gl?: string } = {}): Promise<string[]> {
  const url = `${SUGGEST}?client=firefox&hl=${opts.hl ?? 'en'}&gl=${opts.gl ?? 'us'}&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const data = await res.json();          // ["query", [suggestions], ...]
    return Array.isArray(data?.[1]) ? data[1] : [];
  } catch {
    return [];
  }
}

/** Buyer-intent prefixes. These are where affiliate money is. */
const PREFIXES = [
  'best', 'top', 'cheapest', 'affordable', 'review of',
  'how to choose', 'is', 'are', 'why', 'what is the best',
];

/** Suffixes that surface comparison and decision-stage queries. */
const SUFFIXES = [
  'review', 'reviews', 'vs', 'alternative', 'worth it',
  'for beginners', 'reddit', 'price', 'near me', 'discount code',
];

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

export interface ExpandOptions {
  alphabetSoup?: boolean;   // seed + each letter — slow but exhaustive
  concurrency?: number;
  delayMs?: number;
}

/**
 * Expand one seed into a deduplicated keyword universe.
 * Typically returns 150-600 real queries people actually type.
 */
export async function expand(seed: string, opts: ExpandOptions = {}): Promise<string[]> {
  const { alphabetSoup = true, concurrency = 5, delayMs = 120 } = opts;

  const queries: string[] = [seed];
  for (const p of PREFIXES) queries.push(`${p} ${seed}`);
  for (const s of SUFFIXES) queries.push(`${seed} ${s}`);
  if (alphabetSoup) {
    for (const l of ALPHABET) queries.push(`${seed} ${l}`);
  }

  const found = new Set<string>();
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(q => suggest(q)));
    results.flat().forEach(r => found.add(r.toLowerCase().trim()));
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));   // be polite
  }

  return [...found].filter(Boolean).sort();
}
