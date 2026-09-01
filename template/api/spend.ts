import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { db, missingConfig } from '../lib/db.js';

const enc = new TextEncoder();

function secretMatches(given: string | undefined, expected: string): boolean {
  const a = enc.encode(given ?? '');
  const b = enc.encode(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const GRAPH = 'https://graph.facebook.com/v21.0';

type Row = {
  date_start: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  account_currency?: string;
};

/**
 * SPEND INGEST.  Pulls Meta ad-level daily spend into `spend_daily`.
 *
 *   GET /api/spend?days=3&k=CRON_SECRET
 *
 * Without this, `ad_performance.spend` stays 0, so ROI, CPA and profit cannot be
 * computed and every ad sits at WAIT forever — the decision layer goes quiet
 * rather than wrong, but it also never becomes useful.
 *
 * Re-pulls a trailing window rather than just yesterday because Meta restates
 * recent days as attribution settles. The upsert is idempotent on
 * (day, source, ad_id), so re-running only corrects numbers.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = req.query as Record<string, string>;

  const configError = missingConfig();
  if (configError) {
    console.error(configError);
    return res.status(503).send('not configured');
  }

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; `?k=` is for manual
  // runs. Fail closed on an unset secret, same as /api/pb — a forgotten env var
  // must not turn this into an open endpoint that lets anyone rewrite your spend
  // numbers and, through them, every CUT/SCALE verdict.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET is not set — refusing spend pulls');
    return res.status(503).send('not configured');
  }
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!secretMatches(q.k ?? bearer, secret)) return res.status(403).send('forbidden');

  const token = process.env.META_ADS_TOKEN;
  const account = process.env.META_AD_ACCOUNT_ID;
  if (!token || !account) {
    console.error('META_ADS_TOKEN or META_AD_ACCOUNT_ID is not set');
    return res.status(503).send('not configured');
  }

  const days = Math.min(Math.max(parseInt(q.days ?? '3', 10) || 3, 1), 30);

  // Meta reports date_start in the AD ACCOUNT's timezone, which is exactly what
  // spend_daily.day must hold — the same zone report_tz() shifts clicks and
  // conversions into. Do not convert these dates; converting is what puts spend
  // and revenue on different rows.
  const params = new URLSearchParams({
    level: 'ad',
    time_increment: '1',
    date_preset: 'maximum',
    limit: '500',
    fields: 'date_start,campaign_id,adset_id,ad_id,spend,impressions,inline_link_clicks,account_currency',
    access_token: token,
  });
  params.set('time_range', JSON.stringify({
    since: isoDaysAgo(days),
    until: isoDaysAgo(0),
  }));
  params.delete('date_preset');

  const acct = account.startsWith('act_') ? account : `act_${account}`;
  let url: string | null = `${GRAPH}/${acct}/insights?${params}`;

  const rows: Row[] = [];
  let pages = 0;
  try {
    while (url && pages < 20) {
      const r = await fetch(url);
      const j = await r.json() as { data?: Row[]; paging?: { next?: string }; error?: { message?: string } };
      if (!r.ok || j.error) {
        console.error('meta insights failed', j.error);
        return res.status(502).json({ error: j.error?.message ?? `HTTP ${r.status}` });
      }
      rows.push(...(j.data ?? []));
      url = j.paging?.next ?? null;
      pages++;
    }
  } catch (e) {
    console.error('meta insights fetch threw', e);
    return res.status(502).json({ error: String(e) });
  }

  // A non-USD account would silently corrupt profit: ad_performance computes
  // revenue - spend with no FX anywhere, and ClickBank always pays USD.
  const foreign = rows.find(r => r.account_currency && r.account_currency !== 'USD');
  if (foreign) {
    console.error('ad account currency is not USD', foreign.account_currency);
    return res.status(409).json({
      error: `ad account currency is ${foreign.account_currency}, expected USD`,
    });
  }

  const upserts = rows
    .filter(r => r.ad_id && r.date_start)
    .map(r => ({
      day:         r.date_start,
      source:      'meta',
      campaign_id: r.campaign_id ?? null,
      adset_id:    r.adset_id ?? null,
      ad_id:       r.ad_id!,
      spend:       Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      // inline_link_clicks, NOT `clicks`. Meta's `clicks` counts every
      // interaction — likes, comments, photo expands — so platform_clicks would
      // tower over tracked_clicks and read as catastrophic tracking loss when
      // nothing is broken. Link clicks are the number comparable to a hit on
      // /api/c, which is what ad_performance sets them beside.
      clicks:      Number(r.inline_link_clicks ?? 0),
      currency:    'USD',
      pulled_at:   new Date().toISOString(),
    }));

  if (upserts.length === 0) {
    return res.status(200).json({ ok: true, days, rows: 0, note: 'no spend in window' });
  }

  const { error } = await db()
    .from('spend_daily')
    .upsert(upserts, { onConflict: 'day,source,ad_id' });

  if (error) {
    console.error('spend upsert failed', error);
    return res.status(500).json({ error: error.message });
  }

  const total = upserts.reduce((s, r) => s + r.spend, 0);
  return res.status(200).json({
    ok: true,
    days,
    rows: upserts.length,
    spend: Math.round(total * 100) / 100,
  });
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
