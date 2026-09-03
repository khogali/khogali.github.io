/**
 * DataForSEO provider — real search volume and SERP data.
 *
 * ~$0.60 per 1,000 SERP queries. Same underlying data that powers Ahrefs and
 * Semrush, without the dashboard subscription. Works from any IP, including
 * cloud infrastructure, which plain scraping does not.
 *
 * Credentials come from env — never hardcode them:
 *   DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD
 */
import type { SerpProvider, SerpResult } from '../serp';

const BASE = 'https://api.dataforseo.com/v3';
const US = 2840;   // location_code for United States

function auth(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const pass  = process.env.DATAFORSEO_PASSWORD;
  if (!login || !pass) {
    throw new Error('Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in your environment.');
  }
  return 'Basic ' + Buffer.from(`${login}:${pass}`).toString('base64');
}

async function post(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { authorization: auth(), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DataForSEO ${path} → ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.status_code !== 20000) {
    throw new Error(`DataForSEO error ${json.status_code}: ${json.status_message}`);
  }
  return json;
}

export interface VolumeData {
  volume: number;
  cpc: number | null;
  competition: number | null;   // 0-1
}

/**
 * Real monthly search volume from Google Ads data.
 * Batches of 1,000 keywords per request — cheap and fast.
 */
export async function searchVolume(
  keywords: string[],
  locationCode = US,
): Promise<Map<string, VolumeData>> {
  const out = new Map<string, VolumeData>();

  // Google Ads rejects the WHOLE task if any keyword breaks its rules (over 80
  // chars, over 10 words, symbols). Filter first, and if a task still fails,
  // bisect so one bad keyword cannot zero out the other 499.
  const clean = keywords.filter(k => k.length <= 80 && k.split(/\s+/).length <= 10 && /^[a-z0-9' -]+$/i.test(k));
  const dropped = keywords.length - clean.length;
  if (dropped) console.error(`  dropped ${dropped} keyword(s) Google Ads would reject`);

  async function fetchBatch(batch: string[]): Promise<void> {
    if (batch.length === 0) return;
    const json = await post('/keywords_data/google_ads/search_volume/live', [{
      keywords: batch,
      location_code: locationCode,
      language_code: 'en',
    }]);
    const task = json.tasks?.[0];
    // The HTTP-level status can be 20000 while the task itself failed.
    if (task && task.status_code !== 20000) {
      if (batch.length === 1) {
        console.error(`  volume task failed for "${batch[0]}": ${task.status_code} ${task.status_message}`);
        return;
      }
      const mid = Math.ceil(batch.length / 2);
      await fetchBatch(batch.slice(0, mid));
      await fetchBatch(batch.slice(mid));
      return;
    }
    for (const r of task?.result ?? []) {
      if (!r?.keyword) continue;
      out.set(String(r.keyword).toLowerCase(), {
        volume: r.search_volume ?? 0,
        cpc: r.cpc ?? null,
        competition: r.competition_index != null ? r.competition_index / 100 : null,
      });
    }
  }

  for (let i = 0; i < clean.length; i += 1000) {
    await fetchBatch(clean.slice(i, i + 1000));
  }
  return out;
}

/** Live Google SERP — drop-in replacement for the local Playwright scraper. */
export function dataForSeoSerp(locationCode = US): SerpProvider {
  return {
    name: 'dataforseo:google',
    async fetch(keyword: string): Promise<SerpResult[]> {
      const json = await post('/serp/google/organic/live/regular', [{
        keyword,
        location_code: locationCode,
        language_code: 'en',
        depth: 10,
      }]);

      const items = json.tasks?.[0]?.result?.[0]?.items ?? [];
      return items
        .filter((i: any) => i.type === 'organic')
        .slice(0, 10)
        .map((i: any) => ({
          url: i.url ?? '',
          title: i.title ?? '',
          domain: String(i.domain ?? '').replace(/^www\./, ''),
        }));
    },
  };
}
