import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db';

/**
 * CLICK IN.  Ad destination URL points here.
 *
 * Meta example:
 *   https://yourdomain.com/api/c?s=meta&lp=offer1
 *     &c={{campaign.id}}&as={{adset.id}}&ad={{ad.id}}&pl={{placement}}
 *
 * Logs the click, then redirects to the landing page carrying a click_id.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = req.query as Record<string, string>;

  const ip =
    (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim() || undefined;

  const lpSlug = q.lp || 'default';

  // Deterministic-ish variant split. Weights come from env so the optimiser
  // can shift traffic without a redeploy.
  const variants = (process.env.LP_VARIANTS || 'a').split(',');
  const variant = variants[Math.floor(Math.random() * variants.length)];

  const { data, error } = await db
    .from('clicks')
    .insert({
      source:      q.s   || 'unknown',
      campaign_id: q.c   || null,
      adset_id:    q.as  || null,
      ad_id:       q.ad  || null,
      creative_id: q.cr  || null,
      placement:   q.pl  || null,
      keyword:     q.kw  || null,
      fbclid:      q.fbclid || null,
      ttclid:      q.ttclid || null,
      gclid:       q.gclid  || null,
      lp_slug:     lpSlug,
      lp_variant:  variant,
      ip:          ip || null,
      user_agent:  (req.headers['user-agent'] as string) || null,
      country:     (req.headers['x-vercel-ip-country'] as string) || null,
      device:      /Mobi|Android|iPhone/i.test((req.headers['user-agent'] as string) || '')
                     ? 'mobile' : 'desktop',
      referrer:    (req.headers['referer'] as string) || null,
    })
    .select('click_id')
    .single();

  // Never block the funnel on a logging failure — you lose the click AND the money.
  if (error) console.error('click insert failed', error);

  const clickId = data?.click_id ?? 'untracked';
  res.setHeader('Set-Cookie', `cid=${clickId}; Path=/; Max-Age=2592000; SameSite=Lax`);
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, `/${lpSlug}/?v=${variant}&cid=${clickId}`);
}
