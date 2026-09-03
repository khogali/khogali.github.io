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
 * A key may also be a landing-page slug (no dot), which wins over the host:
 *   {"privacy": {"name":"pia","url":"https://.../?subid={subid}"}}
 *
 * Falls back to the single-offer OFFER_URL / OFFER_NAME pair, so an existing
 * one-domain deploy keeps working untouched.
 */
export function resolveOffer(
  host: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  lp?: string | null,
): Offer | null {
  // Strip the port, lowercase, drop a leading www. Vercel passes the request
  // host through unchanged, so it can carry any of the three.
  const h = (host ?? '').split(':')[0].trim().toLowerCase().replace(/^www\./, '');

  if (env.OFFERS && (h || lp)) {
    let map: Record<string, Offer>;
    try {
      map = JSON.parse(env.OFFERS);
    } catch {
      // A malformed OFFERS must not take the funnel down. Fall through to the
      // single-offer vars and let the error surface in the logs.
      console.error('OFFERS is not valid JSON, falling back to OFFER_URL');
      map = {};
    }
    // A landing-page slug can carry its own offer on a shared domain, so two
    // offers can run on one domain before a burner domain exists for the
    // second. Slugs never contain a dot and hosts always do, so the two key
    // spaces cannot collide. Slug wins over host: it is the more specific claim.
    const byLp = lp && !lp.includes('.') ? map[lp] : undefined;
    if (byLp?.url) return { name: byLp.name || lp!, url: byLp.url };
    const hit = map[h];
    if (hit?.url) return { name: hit.name || h, url: hit.url };
  }

  if (env.OFFER_URL) return { name: env.OFFER_NAME || 'default', url: env.OFFER_URL };
  return null;
}

/**
 * Put the click_id where the network expects it, and append any extra params.
 *
 * `extra` exists for fbclid. ClickBank's own Meta Conversions API integration
 * reads the Facebook click id off the hop, so it has to travel outbound with
 * the visitor. Without it ClickBank fires a Purchase that Meta cannot attribute,
 * and the optimiser learns nothing — silently, which is the expensive kind.
 */
export function offerUrlWithSubId(
  url: string,
  clickId: string,
  extra: Record<string, string | null | undefined> = {},
): string {
  const id = encodeURIComponent(clickId);
  let out = url.includes('{subid}')
    ? url.replace(/\{subid\}/g, id)
    : `${url}${url.includes('?') ? '&' : '?'}subid=${id}`;

  for (const [k, v] of Object.entries(extra)) {
    if (!v) continue;
    out += `${out.includes('?') ? '&' : '?'}${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
  }
  return out;
}
