/**
 * SERP difficulty via a pluggable adapter.
 *
 * WHY PLUGGABLE: search engines block datacenter IPs. Scraping works from a
 * residential connection and fails from cloud infrastructure. Rather than
 * pretend otherwise, the provider is swappable — run the Playwright adapter
 * locally, or drop in a paid SERP API later without touching the scoring code.
 */

export interface SerpResult {
  url: string;
  title: string;
  domain: string;
}

export interface SerpProvider {
  name: string;
  fetch(keyword: string): Promise<SerpResult[]>;
}

/** Sites that own a SERP outright. If these hold the top spots, walk away. */
const AUTHORITY = [
  'wikipedia.org', 'amazon.com', 'youtube.com', 'reddit.com', 'nytimes.com',
  'wirecutter.com', 'forbes.com', 'cnet.com', 'techradar.com', 'tomsguide.com',
  'consumerreports.org', 'healthline.com', 'webmd.com', 'mayoclinic.org',
  'walmart.com', 'target.com', 'bestbuy.com', 'homedepot.com',
];

/** Weak results — their presence means the SERP is beatable. */
const WEAK = ['reddit.com', 'quora.com', 'pinterest.com', 'facebook.com'];

/**
 * Difficulty 0-100 from SERP composition.
 * Not a vendor's black-box number — just "who am I actually competing with".
 */
export function difficultyFrom(results: SerpResult[]): { difficulty: number; notes: string[] } {
  if (!results.length) return { difficulty: 50, notes: ['no SERP data — assumed median'] };

  const top10 = results.slice(0, 10);
  const notes: string[] = [];

  const authorityHits = top10.filter(r => AUTHORITY.some(a => r.domain.endsWith(a))).length;
  const weakHits      = top10.filter(r => WEAK.some(w => r.domain.endsWith(w))).length;

  let d = 30;
  d += authorityHits * 7;
  notes.push(`${authorityHits}/10 authority sites`);

  if (weakHits >= 2) {
    d -= weakHits * 6;
    notes.push(`${weakHits} forum/social results — SERP is soft`);
  }

  // A SERP full of distinct domains is more contestable than one brand cluster.
  const unique = new Set(top10.map(r => r.domain)).size;
  if (unique <= 6) { d += 8; notes.push('domain concentration — few players own it'); }

  return { difficulty: Math.max(0, Math.min(100, Math.round(d))), notes };
}

/**
 * Playwright adapter. Run this LOCALLY — it will fail from cloud infrastructure.
 * Requires: npm i playwright
 */
export function playwrightProvider(engine: 'duckduckgo' | 'bing' = 'duckduckgo'): SerpProvider {
  return {
    name: `playwright:${engine}`,
    async fetch(keyword: string): Promise<SerpResult[]> {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        });
        const url = engine === 'duckduckgo'
          ? `https://duckduckgo.com/?q=${encodeURIComponent(keyword)}`
          : `https://www.bing.com/search?q=${encodeURIComponent(keyword)}`;
        const sel = engine === 'duckduckgo'
          ? '[data-testid="result-title-a"]'
          : '#b_results .b_algo h2 a';

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        const raw = await page.$$eval(sel, els =>
          els.slice(0, 10).map(e => ({ url: (e as HTMLAnchorElement).href, title: e.textContent ?? '' }))
        );
        return raw.map(r => ({
          ...r,
          domain: (() => { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
        }));
      } finally {
        await browser.close();
      }
    },
  };
}
