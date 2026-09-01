import crypto from 'crypto';

export type CapiResult =
  | { skipped: string }
  | { ok: boolean; status: number; body: unknown };

/**
 * Meta Conversions API bridge.
 *
 * WHY THIS EXISTS: affiliate conversions fire on the advertiser's site,
 * so Meta's pixel never sees them. Without this, Meta optimises toward
 * link clicks — a proxy — while you pay for conversions. This points
 * Meta's own optimiser at real revenue.
 */
export async function sendConversion(opts: {
  fbclid?: string | null;
  clickTs: string;        // ISO timestamp of the original click
  ip?: string | null;
  userAgent?: string | null;
  value: number;
  currency?: string;
  eventId: string;        // conversion_id — dedupes against any browser pixel
  eventName?: string;     // 'Purchase' | 'Lead' | 'CompleteRegistration'
}): Promise<CapiResult> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) return { skipped: 'META_PIXEL_ID/META_CAPI_TOKEN not set' };

  // fbc must be rebuilt in Meta's exact format or attribution silently fails.
  // Ceiling: the "1" is the subdomain index and assumes the landing page is on
  // the apex (yourdomain.com). On www. or any subdomain it must be 2, and a
  // wrong index fails silently — Meta accepts the event and attributes nothing.
  const fbc = opts.fbclid
    ? `fb.1.${new Date(opts.clickTs).getTime()}.${opts.fbclid}`
    : undefined;

  const user_data = {
    ...(fbc ? { fbc } : {}),
    ...(opts.ip ? { client_ip_address: opts.ip } : {}),
    ...(opts.userAgent ? { client_user_agent: opts.userAgent } : {}),
  };

  // Meta rejects an event with an empty user_data. Without fbc the match is
  // weaker, but ip + user_agent still attributes a useful share of conversions,
  // so send it rather than dropping the signal entirely.
  if (Object.keys(user_data).length === 0) {
    return { skipped: 'no fbclid, ip or user_agent to match on' };
  }

  const payload = {
    data: [{
      event_name: opts.eventName ?? 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: opts.eventId,
      action_source: 'website',
      user_data,
      custom_data: {
        value: opts.value,
        currency: opts.currency ?? 'USD',
      },
    }],
    ...(process.env.META_TEST_EVENT_CODE
      ? { test_event_code: process.env.META_TEST_EVENT_CODE }
      : {}),
    // In the body, not the query string — query strings land in access logs.
    access_token: token,
  };

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pixelId}/events`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }
  );

  const body = await res.json().catch(() => ({ parse_error: true }));
  // A 400 from Meta is still a delivery failure. Report it so the caller does
  // not record the event as sent and quietly stop feeding the optimiser.
  return { ok: res.ok, status: res.status, body };
}

export const sha256 = (s: string) =>
  crypto.createHash('sha256').update(s.trim().toLowerCase()).digest('hex');
