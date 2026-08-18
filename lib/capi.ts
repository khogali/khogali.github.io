import crypto from 'crypto';

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
}) {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) return { skipped: 'META_PIXEL_ID/META_CAPI_TOKEN not set' };

  // fbc must be rebuilt in Meta's exact format or attribution silently fails.
  const fbc = opts.fbclid
    ? `fb.1.${new Date(opts.clickTs).getTime()}.${opts.fbclid}`
    : undefined;

  const payload = {
    data: [{
      event_name: opts.eventName ?? 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: opts.eventId,
      action_source: 'website',
      user_data: {
        ...(fbc ? { fbc } : {}),
        ...(opts.ip ? { client_ip_address: opts.ip } : {}),
        ...(opts.userAgent ? { client_user_agent: opts.userAgent } : {}),
      },
      custom_data: {
        value: opts.value,
        currency: opts.currency ?? 'USD',
      },
    }],
    ...(process.env.META_TEST_EVENT_CODE
      ? { test_event_code: process.env.META_TEST_EVENT_CODE }
      : {}),
  };

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }
  );
  return await res.json();
}

export const sha256 = (s: string) =>
  crypto.createHash('sha256').update(s.trim().toLowerCase()).digest('hex');
