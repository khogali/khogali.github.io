import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db';
import { resolveOffer, offerUrlWithSubId } from '../lib/offers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * CLICK OUT.  The landing page CTA points here.
 * Records that the visitor engaged, then forwards to the affiliate offer
 * with click_id as the sub-ID so the network can post it back.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = req.query as Record<string, string>;
  const cid = q.cid || (req.cookies?.cid ?? '');

  // The click-out write also returns fbclid, so forwarding it costs no extra
  // round trip. UUID-gated because click_id is a uuid column and a junk cid
  // would error the query rather than just miss.
  let fbclid: string | null = null;
  if (UUID.test(cid)) {
    const { data, error } = await db.from('clicks')
      .update({ clicked_out: true, clicked_out_ts: new Date().toISOString() })
      .eq('click_id', cid)
      .select('fbclid')
      .maybeSingle();
    if (error) console.error('clickout failed', error);
    fbclid = data?.fbclid ?? null;
  }

  // Which offer depends on which burner domain this request came in on.
  const offer = resolveOffer(req.headers.host as string | undefined);
  if (!offer) return res.status(500).send('no offer configured for this host');

  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, offerUrlWithSubId(offer.url, cid, { fbclid }));
}
