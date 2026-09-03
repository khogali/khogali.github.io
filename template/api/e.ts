import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, missingConfig } from '../lib/db.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ENGAGEMENT BEACON.  The landing page fires this once, on pagehide, via
 * navigator.sendBeacon: furthest scroll reached (0–100) and seconds on page.
 * Answers "where do people stop reading" without any third-party analytics.
 * Last beacon wins; nothing here is trusted beyond the UUID gate and the ranges.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const configError = missingConfig();
  if (configError) {
    console.error(configError);
    return res.status(503).end();
  }

  let body: unknown = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(204).end(); }
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const cid = String(b.cid ?? '');
  const scroll = Number(b.s);
  const dwell = Number(b.t);

  const ok = UUID.test(cid)
    && Number.isInteger(scroll) && scroll >= 0 && scroll <= 100
    && Number.isInteger(dwell) && dwell >= 0 && dwell <= 3600;
  if (!ok) return res.status(204).end();

  const { error } = await db().from('clicks')
    .update({ scroll_pct: scroll, dwell_s: dwell })
    .eq('click_id', cid);
  if (error) console.error('beacon failed', error);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(204).end();
}
