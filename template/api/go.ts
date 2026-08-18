import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db';

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

  const base = process.env.OFFER_URL;
  if (!base) return res.status(500).send('OFFER_URL not configured');

  // {subid} placeholder in OFFER_URL gets the click_id.
  const dest = base.includes('{subid}')
    ? base.replace('{subid}', encodeURIComponent(cid))
    : `${base}${base.includes('?') ? '&' : '?'}subid=${encodeURIComponent(cid)}`;

  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, dest);
}
