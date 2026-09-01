# adstack — affiliate media buying tracker

Self-hosted click tracking + Meta Conversions API bridge.
Replaces Voluum/RedTrack (~$99–500/mo) for a few dollars a month, and you own the data.

## Why this exists

Affiliate conversions fire on the *advertiser's* site. Meta's pixel never sees them,
so Meta optimises toward link clicks — a proxy — while you pay for conversions. This
tracker catches the network postback and feeds it back to Meta via the Conversions
API, pointing Meta's optimiser at real revenue.

That bridge is worth more than the cost saving.

## Flow

```
Meta ad  →  /api/c   →  /lp/<slug>  →  /api/go  →  affiliate offer
              │                                          │
           log click                                network converts
              │                                          │
              └──────────  /api/pb  ←────── postback ─────┘
                              │
                              └──→ Meta Conversions API
```

## Deploy

1. **Database** — run `supabase/schema.sql` in the Supabase SQL editor. It is
   re-runnable: safe on a fresh project and safe on top of an existing one.
2. **Host** — deploy this directory to Vercel. `api/` becomes serverless
   functions, everything else is served static, so the landing pages live at
   `/lp/<slug>`.
3. **Env** — set everything in `.env.example` in Vercel project settings.
   `POSTBACK_SECRET` is required; without it `/api/pb` answers 503.
4. **Domain** — one burner domain per offer. See below.
5. **Plan** — Vercel's Hobby plan *"restricts users to non-commercial, personal
   use only"* under its fair use guidelines. Running paid affiliate campaigns is
   commercial, so this needs Pro at $20/mo, or a host whose free tier permits
   commercial use. Budget for it: the infrastructure is not $1/mo.

## One burner domain per offer

Never point paid traffic at a domain you intend to keep. Meta domain flags are
slow to reverse and often permanent, and cold traffic to an advertorial funnel
for someone else's offer is the highest-risk configuration there is. Buy a
throwaway per offer and treat it as consumable.

This does **not** mean one deploy per offer. Vercel allows 50 domains per project
even on Hobby, so attach every burner to the same project and let the hostname
decide the offer:

```json
OFFERS={
  "derila-sleep.com":   {"name":"derila",  "url":"https://HOPLINK?aff_sub1={subid}"},
  "purisaki-trial.com": {"name":"purisaki","url":"https://HOPLINK?aff_sub1={subid}"}
}
```

`lib/offers.ts` resolves the host on both `/api/c` and `/api/go`, so a click is
stamped with the offer it will actually be sent to. It normalises case, strips
the port and a leading `www.`, and falls back to `OFFER_URL` / `OFFER_NAME` when
the host is unknown or `OFFERS` is malformed, because a bad env var must not take
the funnel down.

`clicks.offer` carries through to `ad_performance` and `ad_decisions`, so:

```sql
select offer, sum(spend), sum(revenue), sum(profit)
from ad_decisions group by offer;
```

Each burner domain also needs its own **Meta domain verification** before
ClickBank's Conversions API integration will accept events for it. Do that when
you buy the domain, not when the campaign is ready.

## Check before you deploy

```bash
npm install && npm run check
```

Typechecks the functions and asserts the things that cost money when they break:
the landing-page redirect is not an open redirect and points at a file that
exists, only a real UUID can reach the `click_id` foreign key, the postback fails
closed without a secret, and the A/B variants actually differ.

## Wire up the ad

Destination URL in Meta (macros auto-fill):

```
https://YOURDOMAIN/api/c?s=meta&lp=default
  &c={{campaign.id}}&as={{adset.id}}&ad={{ad.id}}&pl={{placement}}
```

`lp` must be lowercase letters, digits and hyphens, and must match a directory
under `lp/`. Anything else falls back to `default`.

Meta appends `fbclid` itself when auto-tagging is on. `/api/c` stores it, and
it is what any Conversions API attribution depends on.

## Wire up the offer (ClickBank)

Put the click_id in `aff_sub1`, not `tid`. ClickBank's newer affiliate tracking
parameters allow 100 characters including hyphens, so a 36-character UUID fits.
Pass `fbclid` through as well, because ClickBank's own Meta integration reads it
from the link.

`OFFER_URL` in the environment:

```
https://HOPLINK_OR_DIRECT_TRACKING_LINK?aff_sub1={subid}&traffic_source=meta&traffic_type=paid
```

`{subid}` is substituted with the click_id by `/api/go`. Without the placeholder
it falls back to appending `?subid=`, which ClickBank ignores.

## Wire up the postback (ClickBank)

Affiliates can configure postbacks in their own ClickBank account; this is not
seller-only. Set the postback URL to:

```
https://YOURDOMAIN/api/pb?subid={aff_sub1}&payout={affiliate_earnings}&txn={receipt_id}&k=YOUR_SECRET
```

| adstack param | ClickBank macro | Why |
|---|---|---|
| `subid` | `{aff_sub1}` | Resolves back to the click row |
| `payout` | `{affiliate_earnings}` | Your commission, not the order total |
| `txn` | `{receipt_id}` | Dedupes network retries |
| `k` | your `POSTBACK_SECRET` | `/api/pb` returns 403 without it |

Use `{affiliate_earnings}`, not the gross sale figure. Every ROI number in
`ad_decisions` is computed against what you actually get paid.

On another network the shape is the same, only the macro names change. Always
get a transaction-id macro if one exists: without it, dedupe falls back to one
conversion per click, and a genuine second purchase from the same click is
rejected as a duplicate.

## Conversions API: pick one path, never both

ClickBank ships affiliate-side Meta CAPI natively. You supply your own Pixel ID
and access token in your ClickBank account, and it sends order form impression
as InitiateCheckout and initial purchase as Purchase, server to server.

`lib/capi.ts` does the same job from your own postback. **Running both sends Meta
two Purchase events per sale** with different `event_id` values, which Meta
cannot dedupe. Reported conversions double, value per conversion halves, and the
optimiser learns from the wrong number.

Default recommendation for a ClickBank offer: **use ClickBank's, disable ours.**
Theirs is first-party to the transaction, so it does not depend on your postback
arriving, on `fbclid` surviving your landing page, or on the `fb.1.` subdomain
index in `lib/capi.ts` being right for your domain (it assumes the apex; on a
subdomain it must be 2, and a wrong index fails silently).

Disabling ours takes no code change. Leave `META_PIXEL_ID` unset and
`sendConversion` returns `{ skipped: ... }`, which is recorded in
`conversions.capi_response` so the skip is visible rather than assumed.

Use `lib/capi.ts` instead when the network has no native CAPI, or when you leave
ClickBank. ClickBank's integration covers their network and Meta only.

## Prove it works before you spend

The whole chain is verifiable for the price of a domain and zero ad spend,
because you own both ends of it. Set `META_TEST_EVENT_CODE` first so nothing
here reaches your live pixel.

```bash
# 1. a click, exactly as Meta would send it
curl -sI "https://YOURDOMAIN/api/c?s=meta&lp=default&ad=smoketest&fbclid=abc123" | grep -i location
```

Confirm the redirect goes to `/lp/default` and that a row landed:

```sql
select click_id, ad_id, fbclid, lp_variant from clicks order by ts desc limit 1;
```

```bash
# 2. the postback, using the click_id from that row
curl -s "https://YOURDOMAIN/api/pb?subid=<click_id>&payout=57.35&txn=smoke-1&k=<secret>"
```

```sql
select click_id, sub_id, payout, capi_sent, capi_response
from conversions order by ts desc limit 1;
select unmatched_postbacks from tracker_health;
```

A non-null `click_id` and `unmatched_postbacks = 0` is the pass. That is the
exact link that was silently broken before the audit: a sub-ID that failed to
resolve used to kill the insert while still answering 200, so the network
recorded a successful delivery of a conversion that no longer existed.

Run step 2 a second time with the same `txn` and confirm you get `OK duplicate`
and no second row.

## Read the numbers

Start here. One row, plain English, tells you what to do today:

```sql
select * from adstack_status;
```

Then the per-ad verdicts, worst first:

```sql
select ad_id, verdict, next_action, spend, revenue, roi_pct, cpc, breakeven_cpc, reason
from ad_decisions order by priority, spend desc;
```

`ad_decisions` gives every ad one of four verdicts over a trailing window, and
shows the arithmetic behind it so the call is checkable rather than trusted:

| Verdict | Means | Action |
|---|---|---|
| `CUT` | Past both thresholds and losing, or zero conversions | Pause it |
| `SCALE` | ROI at or above `scale_roi_pct` | Raise budget 20% |
| `KEEP` | Inside the do-nothing band | Leave it |
| `WAIT` | Below `min_clicks_to_judge` **or** `min_spend_to_judge` | Leave it |

`WAIT` is the guardrail: no ad can be told to die until it has cleared both a
click threshold and a spend threshold. Killing on 4 clicks and no conversion is
killing on noise.

Every threshold lives in the `config` table, not in the view:

```sql
update config set value = 150 where key = 'min_clicks_to_judge';
```

Set `target_payout` and `target_cvr` to your actual offer the moment you pick
one. They produce `breakeven_cpc`, which is the number every verdict leans on.

`tracker_health` answers the different question of whether the machinery works,
since a healthy-looking $0 and a broken tracker look identical. `adstack_status`
surfaces its verdict in one `plumbing` column, so you only read the detail when
that column is not `ok`.

`ad_performance` is still underneath all of it: the per-day fact table joining
spend from the ad platform against conversions from your own postbacks. Its
day/ad spine is the union of spend, tracked clicks and conversions, so a
conversion that lands after an ad is paused still shows up. Days bucket in UTC
while ad platforms report in the ad account timezone; set the account to UTC or
accept a boundary drift of one day.

Nothing in this layer acts. It recommends, and the optimiser that will read it
stays unbuilt until there is live data to build it against.

## Not built yet

- `spend_daily` ingest from the Meta Marketing API (needs your access token)
- Daily optimiser — pointless until there's data to optimise
- Variant weighting from performance
- TikTok / Google / Snap / Reddit / Pinterest conversion adapters

## Guardrail

When the optimiser gets built, no rule may pause anything without a minimum
spend AND minimum click threshold. Killing on 4 clicks and no conversion is
killing on noise, and it's how DIY optimisers murder winners.
