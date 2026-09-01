export type Offer = { name: string; url: string };

/**
 * Resolve which offer a request belongs to, by the hostname it arrived on.
 *
 * One deploy, many burner domains: each offer gets a throwaway domain so a
 * flagged one takes nothing else with it. Vercel allows 50 domains per project
 * even on Hobby, so this needs one project, not one per offer.
 *
 * OFFERS is a JSON map, host -> { name, url }:
 *   {"derila-sleep.com": {"name":"derila","url":"https://hop.../?aff_sub1={subid}"}}
 *
 * Falls back to the single-offer OFFER_URL / OFFER_NAME pair, so an existing
 * one-domain deploy keeps working untouched.
 */
export function resolveOffer(host: string | undefined, env: NodeJS.ProcessEnv = process.env): Offer | null {
  // Strip the port, lowercase, drop a leading www. Vercel passes the request
  // host through unchanged, so it can carry any of the three.
  const h = (host ?? '').split(':')[0].trim().toLowerCase().replace(/^www\./, '');

  if (env.OFFERS && h) {
    let map: Record<string, Offer>;
    try {
      map = JSON.parse(env.OFFERS);
    } catch {
      // A malformed OFFERS must not take the funnel down. Fall through to the
      // single-offer vars and let the error surface in the logs.
      console.error('OFFERS is not valid JSON, falling back to OFFER_URL');
      map = {};
    }
    const hit = map[h];
    if (hit?.url) return { name: hit.name || h, url: hit.url };
  }

  if (env.OFFER_URL) return { name: env.OFFER_NAME || 'default', url: env.OFFER_URL };
  return null;
}

/** Put the click_id where the network expects it. */
export function offerUrlWithSubId(url: string, clickId: string): string {
  const id = encodeURIComponent(clickId);
  return url.includes('{subid}')
    ? url.replace(/\{subid\}/g, id)
    : `${url}${url.includes('?') ? '&' : '?'}subid=${id}`;
}
