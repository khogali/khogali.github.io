import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { db } from '../lib/db';
import { sendConversion } from '../lib/capi';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const enc = new TextEncoder();

// Constant-time, and length-checked first because timingSafeEqual throws on a
// length mismatch. TextEncoder rather than Buffer: @types/node's Buffer does not
// satisfy the ArrayBufferView this expects under strict mode.
function secretMatches(given: string | undefined, expected: string): boolean {
  const a = enc.encode(given ?? '');
  const b = enc.encode(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * POSTBACK RECEIVER.  Give this URL to your affiliate network:
 *
 *   https://yourdomain.com/api/pb?subid={subid}&payout={payout}&txn={transaction_id}&k=SECRET
 *
 * 1. records the conversion
 * 2. fires it to Meta's Conversions API so the algorithm learns from real revenue
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = (typeof req.body === 'object' && req.body !== null) ? req.body : {};
  const q = { ...(req.query as Record<string, string>), ...body } as Record<string, string>;

  // Fail closed. An unset secret used to mean "skip the check", which turned a
  // forgotten env var into an open endpoint: anyone could forge conversions and
  // train Meta to buy their traffic with your budget.
  const secret = process.env.POSTBACK_SECRET;
  if (!secret) {
    console.error('POSTBACK_SECRET is not set — refusing postbacks');
    return res.status(503).send('not configured');
  }
  if (!secretMatches(q.k, secret)) return res.status(403).send('forbidden');

  const subId = (q.subid || q.sub1 || q.cid || '').trim();
  const payout = parseFloat(q.payout ?? q.amount ?? '0') || 0;
  const txn = q.txn || q.transaction_id || null;
  const currency = q.currency || 'USD';

  // Resolve the click BEFORE writing the row. conversions.click_id is a foreign
  // key to clicks, so a sub-ID that is not a live UUID fails the insert (22P02
  // or 23503) and the conversion is gone — while this endpoint still answers
  // 200, so the network never retries. The raw value goes to sub_id regardless.
  let click:
    | { click_id: string; fbclid: string | null; ts: string; ip: string | null; user_agent: string | null }
    | null = null;

  if (UUID.test(subId)) {
    const { data } = await db
      .from('clicks')
      .select('click_id, fbclid, ts, ip, user_agent')
      .eq('click_id', subId)
      .maybeSingle();
    click = data ?? null;
  }
  if (subId && !click) console.error('postback sub-ID matched no click', { subId });

  const { k: _secret, ...rawSafe } = q;   // never persist the shared secret

  const { data: conv, error } = await db
    .from('conversions')
    .insert({
      click_id:       click?.click_id ?? null,
      sub_id:         subId || null,
      network:        q.network || process.env.NETWORK_NAME || 'unknown',
      offer_id:       q.offer || null,
      payout,
      currency,
      status:         q.status || 'approved',
      network_txn_id: txn,
      raw:            rawSafe,
    })
    .select('conversion_id')
    .single();

  // Duplicate postback (network retry) — already counted, acknowledge and stop.
  if (error?.code === '23505') return res.status(200).send('OK duplicate');
  if (error) { console.error('conversion insert failed', error); return res.status(200).send('OK'); }

  // Fire to Meta using the original click's attribution signals.
  if (click) {
    try {
      const capi = await sendConversion({
        fbclid:    click.fbclid,
        clickTs:   click.ts,
        ip:        click.ip,
        userAgent: click.user_agent,
        value:     payout,
        currency,
        eventId:   conv.conversion_id,
      });
      await db.from('conversions')
        .update({
          // Only true when Meta actually accepted it. A 400 is a delivery
          // failure, and flagging it sent hides a dead optimiser feed.
          capi_sent:     'ok' in capi && capi.ok === true,
          capi_sent_ts:  new Date().toISOString(),
          capi_response: capi,
        })
        .eq('conversion_id', conv.conversion_id);
    } catch (e: any) {
      await db.from('conversions')
        .update({ capi_response: { error: String(e) } })
        .eq('conversion_id', conv.conversion_id);
    }
  }

  // Always 200 — networks disable postbacks that return errors.
  res.status(200).send('OK');
}
