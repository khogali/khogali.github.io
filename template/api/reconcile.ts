import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { db, missingConfig } from '../lib/db.js';

const enc = new TextEncoder();

function secretMatches(given: string | undefined, expected: string): boolean {
  const a = enc.encode(given ?? '');
  const b = enc.encode(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const CB = 'https://api.clickbank.com/rest/1.3/orders2/list';
const NETWORK = 'clickbank';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LineItem = { itemNo?: string; productTitle?: string; accountAmount?: string | number; quantity?: string | number };
type Order = {
  receipt?: string;
  transactionType?: string;
  transactionTime?: string;
  totalOrderAmount?: string | number;
  vendor?: string;
  affiliate?: string;
  role?: string;
  trackingId?: string;
  currency?: string;
  lineItemData?: LineItem | LineItem[];
  affiliateTrackingParams?: Record<string, string>;
  affSub1?: string;
};

// The only order fields that may be persisted. Everything else on an order is
// the customer's name, email and address — none of it is needed to attribute a
// sale to an ad, and none of it belongs in this database.
const KEEP = ['receipt', 'transactionType', 'transactionTime', 'totalOrderAmount',
              'vendor', 'affiliate', 'trackingId', 'currency'] as const;
const KEEP_ITEM = ['itemNo', 'productTitle', 'accountAmount', 'quantity'] as const;

function stripCustomer(o: Order) {
  const out: Record<string, unknown> = { source: 'reconcile' };
  for (const k of KEEP) if (o[k] != null) out[k] = o[k];
  out.lineItemData = arr(o.lineItemData).map(li => {
    const r: Record<string, unknown> = {};
    for (const k of KEEP_ITEM) if (li[k] != null) r[k] = li[k];
    return r;
  });
  return out;
}

// ClickBank's JSON is converted from XML: a single element arrives as an
// object, several as an array, none as nothing at all.
function arr<T>(v: T | T[] | undefined | null): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

function affSub1(o: Order): string | null {
  return (o.affiliateTrackingParams?.affSub1 ?? o.affSub1 ?? '').trim() || null;
}

function payoutOf(o: Order): number {
  // role=AFFILIATE, so accountAmount is the affiliate's share of each line —
  // the same number the postback receives as {affiliate_earnings}.
  return Math.round(arr(o.lineItemData).reduce((s, li) => s + (Number(li.accountAmount) || 0), 0) * 100) / 100;
}

async function fetchOrders(key: string, type: string, since: string, until: string): Promise<Order[]> {
  const out: Order[] = [];
  // 100 rows per page; 206 means another page exists, 200 means this was the last.
  for (let page = 1; page <= 20; page++) {
    const params = new URLSearchParams({ startDate: since, endDate: until, type, role: 'AFFILIATE' });
    const r = await fetch(`${CB}?${params}`, {
      headers: { Authorization: key, Accept: 'application/json', Page: String(page) },
    });
    if (r.status === 204) break;
    if (!r.ok && r.status !== 206) throw new Error(`clickbank ${type} HTTP ${r.status}`);
    const text = await r.text();
    if (!text.trim()) break;
    out.push(...arr<Order>(JSON.parse(text)?.orderData));
    if (r.status !== 206) break;
  }
  return out;
}

/**
 * RECONCILIATION.  Reads ClickBank's own ledger and corrects `conversions`.
 *
 *   GET /api/reconcile?days=7&k=CRON_SECRET
 *
 * Two things the postback can never tell us:
 *
 *  1. Refunds and chargebacks. ClickBank's affiliate postback has no reversal
 *     event, so without this `conversions.status` never becomes `reversed`,
 *     `ad_performance` keeps counting refunded revenue, and on a 60-day-guarantee
 *     product the ROI the optimiser acts on drifts upward from the first refund.
 *  2. Sales whose postback never arrived (network hiccup, our cold start, a
 *     deploy mid-request). Those are real commission with no row.
 *
 * Refunds share the original sale's receipt, so a RFND/CGBK receipt matches
 * `network_txn_id` directly. Missed sales are inserted with the sub-ID
 * ClickBank kept, resolved to a click when it is one of ours. Nothing here
 * fires Meta CAPI — ClickBank's own integration owns Purchase.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = req.query as Record<string, string>;

  const configError = missingConfig();
  if (configError) {
    console.error(configError);
    return res.status(503).send('not configured');
  }

  // Same gate as /api/spend: fail closed on an unset secret. An open endpoint
  // here could mark every sale reversed and CUT every winning ad.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET is not set — refusing reconciliation');
    return res.status(503).send('not configured');
  }
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!secretMatches(q.k ?? bearer, secret)) return res.status(403).send('forbidden');

  const key = process.env.CLICKBANK_API_KEY;
  if (!key) {
    console.error('CLICKBANK_API_KEY is not set');
    return res.status(503).send('not configured');
  }

  // Trailing window on the *transaction* date, so a refund issued today on a
  // sale from six weeks ago is still caught by a 7-day pull.
  const days = Math.min(Math.max(parseInt(q.days ?? '7', 10) || 7, 1), 90);
  const since = isoDaysAgo(days);
  const until = isoDaysAgo(0);

  let refunds: Order[], chargebacks: Order[], sales: Order[];
  try {
    [refunds, chargebacks, sales] = await Promise.all([
      fetchOrders(key, 'RFND', since, until),
      fetchOrders(key, 'CGBK', since, until),
      fetchOrders(key, 'SALE', since, until),
    ]);
  } catch (e) {
    console.error('clickbank orders2 failed', e);
    return res.status(502).json({ error: String(e) });
  }

  // --- 1. reversals --------------------------------------------------------
  const reversalReceipts = [...new Set(
    [...refunds, ...chargebacks].map(o => (o.receipt ?? '').trim()).filter(Boolean),
  )];
  let reversed: string[] = [];
  if (reversalReceipts.length > 0) {
    const { data, error } = await db()
      .from('conversions')
      .update({ status: 'reversed' })
      .eq('network', NETWORK)
      .in('network_txn_id', reversalReceipts)
      .neq('status', 'reversed')
      .select('network_txn_id');
    if (error) {
      console.error('reversal update failed', error);
      return res.status(500).json({ error: error.message });
    }
    reversed = (data ?? []).map(r => r.network_txn_id as string);
  }

  // --- 2. sales the postback missed ----------------------------------------
  const saleByReceipt = new Map<string, Order>();
  for (const o of sales) {
    const r = (o.receipt ?? '').trim();
    if (r) saleByReceipt.set(r, o);
  }
  let inserted: string[] = [];
  if (saleByReceipt.size > 0) {
    const { data: known, error } = await db()
      .from('conversions')
      .select('network_txn_id')
      .eq('network', NETWORK)
      .in('network_txn_id', [...saleByReceipt.keys()]);
    if (error) {
      console.error('known-receipt lookup failed', error);
      return res.status(500).json({ error: error.message });
    }
    const knownSet = new Set((known ?? []).map(r => r.network_txn_id as string));
    const missing = [...saleByReceipt.entries()].filter(([r]) => !knownSet.has(r));

    for (const [receipt, o] of missing) {
      const subId = affSub1(o);
      let clickId: string | null = null;
      if (subId && UUID.test(subId)) {
        const { data } = await db().from('clicks').select('click_id').eq('click_id', subId).maybeSingle();
        clickId = data?.click_id ?? null;
      }
      const { error: insErr } = await db().from('conversions').insert({
        click_id:       clickId,
        sub_id:         subId,
        network:        NETWORK,
        offer_id:       o.vendor ?? null,
        payout:         payoutOf(o),
        currency:       'USD',            // accountAmount is always USD, like {affiliate_earnings}
        status:         'approved',
        network_txn_id: receipt,
        raw:            stripCustomer(o),
        ts:             o.transactionTime ?? new Date().toISOString(),
      });
      // 23505: a postback landed between our lookup and this insert. Fine.
      if (insErr && insErr.code !== '23505') console.error('missed-sale insert failed', receipt, insErr);
      else if (!insErr) inserted.push(receipt);
    }
  }

  return res.status(200).json({
    ok: true,
    days,
    refunds: refunds.length,
    chargebacks: chargebacks.length,
    reversed: reversed.length,
    // Reversal receipts we hold no row for: refunds of rebills we never
    // recorded, or sales that predate the tracker. Listed, not acted on.
    unmatched_reversals: reversalReceipts.filter(r => !reversed.includes(r)),
    sales: sales.length,
    missed_inserted: inserted,
  });
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
