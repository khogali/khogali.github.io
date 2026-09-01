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
4. **Domain** — attach a dedicated domain. Keep it separate from your other sites;
   if it gets flagged you don't want the blast radius touching anything else.

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

## Wire up the network

Postback URL to paste into your affiliate network:

```
https://YOURDOMAIN/api/pb?subid={subid}&payout={payout}&txn={transaction_id}&k=YOUR_SECRET
```

Replace the braces with whatever macro names your network uses. Get a
transaction-id macro if the network has one: without it, dedupe falls back to
one conversion per click, and a genuine second purchase from the same click is
rejected as a duplicate.

## Read the numbers

```sql
select * from ad_performance where day = current_date - 1 order by profit desc;
```

`ad_performance` joins spend (from the ad platform) against conversions (from your
postbacks) and gives you true ROI, CPA and CVR per ad — the numbers Meta's own
dashboard cannot show you, because it doesn't know about your conversions.

Its day/ad spine is the union of spend, tracked clicks and conversions, so a
conversion that lands after an ad is paused still shows up. Days bucket in UTC
while ad platforms report in the ad account timezone; set the account to UTC or
accept a boundary drift of one day.

## Not built yet

- `spend_daily` ingest from the Meta Marketing API (needs your access token)
- Daily optimiser — pointless until there's data to optimise
- Variant weighting from performance
- TikTok / Google / Snap / Reddit / Pinterest conversion adapters

## Guardrail

When the optimiser gets built, no rule may pause anything without a minimum
spend AND minimum click threshold. Killing on 4 clicks and no conversion is
killing on noise, and it's how DIY optimisers murder winners.
