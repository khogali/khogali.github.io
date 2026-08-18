import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db';
import { sendConversion } from '../lib/capi';

/**
 * POSTBACK RECEIVER.  Give this URL to your affiliate network:
 *
 *   https://yourdomain.com/api/pb?subid={subid}&payout={payout}&txn={transaction_id}&k=SECRET
 *
 * 1. records the conversion
 * 2. fires it to Meta's Conversions API so the algorithm learns from real revenue
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = { ...(req.query as Record<string, string>), ...(req.body ?? {}) };

  // Shared secret — without it anyone can forge conversions and poison your data.
  if (process.env.POSTBACK_SECRET && q.k !== process.env.POSTBACK_SECRET) {
    return res.status(403).send('forbidden');
  }

  const clickId = q.subid || q.sub1 || q.cid;
  const payout = parseFloat(q.payout ?? q.amount ?? '0') || 0;
  const txn = q.txn || q.transaction_id || null;

  const { data: conv, error } = await db
    .from('conversions')
    .insert({
      click_id:       clickId || null,
      network:        q.network || process.env.NETWORK_NAME || 'unknown',
      offer_id:       q.offer || null,
      payout,
      currency:       q.currency || 'USD',
      status:         q.status || 'approved',
      network_txn_id: txn,
      raw:            q,
    })
    .select('conversion_id')
    .single();

  // Duplicate postback (network retry) — already counted, acknowledge and stop.
  if (error?.code === '23505') return res.status(200).send('OK duplicate');
  if (error) { console.error('conversion insert failed', error); return res.status(200).send('OK'); }

  // Fire to Meta. Look up the original click for attribution signals.
  if (clickId) {
    const { data: click } = await db
      .from('clicks')
      .select('fbclid, ts, ip, user_agent')
      .eq('click_id', clickId)
      .single();

    if (click?.fbclid) {
      try {
        const capi = await sendConversion({
          fbclid:    click.fbclid,
          clickTs:   click.ts,
          ip:        click.ip,
          userAgent: click.user_agent,
          value:     payout,
          currency:  q.currency || 'USD',
          eventId:   conv.conversion_id,
        });
        await db.from('conversions')
          .update({ capi_sent: true, capi_sent_ts: new Date().toISOString(), capi_response: capi })
          .eq('conversion_id', conv.conversion_id);
      } catch (e: any) {
        await db.from('conversions')
          .update({ capi_response: { error: String(e) } })
          .eq('conversion_id', conv.conversion_id);
      }
    }
  }

  // Always 200 — networks disable postbacks that return errors.
  res.status(200).send('OK');
}
