/**
 * Multi-source autocomplete expansion. Free, no API keys, no quotas.
 *
 * Three sources, three different signals:
 *   google  — general search demand
 *   youtube — how people phrase problems (content angles)
 *   amazon  — pure purchase intent (someone typing here is shopping)
 */

export type Source = 'google' | 'youtube' | 'amazon';

export interface Keyword {
  keyword: string;
  sources: Source[];
}

const SUGGEST = 'https://suggestqueries.google.com/complete/search';
const AMAZON  = 'https://completion.amazon.com/api/2017/suggestions';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';

async function googleLike(query: string, ds: '' | 'yt'): Promise<string[]> {
  const url = `${SUGGEST}?client=firefox&hl=en&gl=us${ds ? `&ds=${ds}` : ''}&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.[1]) ? data[1] : [];
  } catch { return []; }
}

export const google  = (q: string) => googleLike(q, '');
export const youtube = (q: string) => googleLike(q, 'yt');

/** Amazon US marketplace. mid is the US marketplace id. */
export async function amazon(query: string): Promise<string[]> {
  const url = `${AMAZON}?mid=ATVPDKIKX0DER&alias=aps&limit=11&prefix=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.suggestions ?? [])
      .filter((s: any) => s?.type === 'KEYWORD' && s?.value)
      .map((s: any) => String(s.value));
  } catch { return []; }
}

/** Buyer-intent prefixes — where affiliate money is. */
const PREFIXES = [
  'best', 'top', 'cheapest', 'affordable', 'review of',
  'how to choose', 'is', 'are', 'why', 'what is the best',
];

/** Suffixes that surface comparison and decision-stage queries. */
const SUFFIXES = [
  'review', 'reviews', 'vs', 'alternative', 'worth it',
  'for beginners', 'reddit', 'price', 'discount code',
];

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

/**
 * Amazon-specific modifiers. Shoppers type differently than searchers —
 * they qualify by audience, quantity, material and price rather than
 * asking questions.
 */
const AMAZON_MODS = [
  'for men', 'for women', 'for kids', 'for adults', 'for travel',
  'for side sleepers', 'set', 'pack', 'with', 'cheap', 'best',
  'memory foam', 'cooling', 'adjustable', 'large', 'small',
];

export interface ExpandOptions {
  sources?: Source[];
  alphabetSoup?: boolean;
  concurrency?: number;
  delayMs?: number;
}

/**
 * Expand one seed across every enabled source.
 * Keywords found in more than one source keep all of them — that overlap
 * is itself a signal, and the scorer uses it.
 */
export async function expand(seed: string, opts: ExpandOptions = {}): Promise<Keyword[]> {
  const {
    sources = ['google', 'youtube', 'amazon'],
    alphabetSoup = true,
    concurrency = 5,
    delayMs = 120,
  } = opts;

  const queries: string[] = [seed];
  for (const p of PREFIXES) queries.push(`${p} ${seed}`);
  for (const s of SUFFIXES) queries.push(`${seed} ${s}`);
  if (alphabetSoup) for (const l of ALPHABET) queries.push(`${seed} ${l}`);

  // Amazon gets its own query set: shopping modifiers plus alphabet soup,
  // which is how sellers actually mine that box.
  const amazonQueries: string[] = [seed];
  for (const m of AMAZON_MODS) amazonQueries.push(`${seed} ${m}`);
  for (const p of ['best', 'cheap', 'top rated']) amazonQueries.push(`${p} ${seed}`);
  if (alphabetSoup) for (const l of ALPHABET) amazonQueries.push(`${seed} ${l}`);

  const fetchers: Record<Source, (q: string) => Promise<string[]>> = { google, youtube, amazon };
  const merged = new Map<string, Set<Source>>();

  for (const src of sources) {
    const qs = src === 'amazon' ? amazonQueries : queries;

    for (let i = 0; i < qs.length; i += concurrency) {
      const batch = qs.slice(i, i + concurrency);
      const results = await Promise.all(batch.map(q => fetchers[src](q)));
      for (const kw of results.flat()) {
        const k = kw.toLowerCase().trim();
        if (!k) continue;
        if (!merged.has(k)) merged.set(k, new Set());
        merged.get(k)!.add(src);
      }
      if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return [...merged.entries()]
    .map(([keyword, s]) => ({ keyword, sources: [...s] }))
    .sort((a, b) => a.keyword.localeCompare(b.keyword));
}
