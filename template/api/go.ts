import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db';
import { resolveOffer, offerUrlWithSubId } from '../lib/offers';

/**
 * CLICK OUT.  The landing page CTA points here.
 * Records that the visitor engaged, then forwards to the affiliate offer
 * with click_id as the sub-ID so the network can post it back.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = req.query as Record<string, string>;
  const cid = q.cid || (req.cookies?.cid ?? '');

  if (cid && cid !== 'untracked') {
    await db.from('clicks')
      .update({ clicked_out: true, clicked_out_ts: new Date().toISOString() })
      .eq('click_id', cid)
      .then(({ error }) => error && console.error('clickout failed', error));
  }

  // Which offer depends on which burner domain this request came in on.
  const offer = resolveOffer(req.headers.host as string | undefined);
  if (!offer) return res.status(500).send('no offer configured for this host');

  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, offerUrlWithSubId(offer.url, cid));
}
