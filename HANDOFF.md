# HANDOFF — adstack (read first)

**Updated:** 2026-09-01 · Tracker audited, repaired, decision layer added, and
ClickBank wiring confirmed against their live docs. Pick up here.

## Who / what

Ahmed. Building affiliate income through **paid media buying**. Works full time at
T-Mobile. Capital-constrained (~$2k). Has an active TikTok (@shilkawi, tech +
health/fitness) but **is running ads, not organic** — see the rule below.

## RULE: do not relitigate paid vs organic

He has stated three times that he is running paid ads. The previous session kept
steering him toward organic and he called it out. **Paid media is settled.**
Critique execution, offers, and numbers — never the channel choice.

## Output format he wants

- **TL;DR** — answer in one line
- **⚠️ Critique** — what's wrong, including with my own work
- **✅ Better** — ranked alternatives, name a pick
- **🔨 Built** — what actually happened
- **→ Next** — one action

Short paragraphs, bold leads. Not dense tables, not one-line bullets. He rejected
both extremes. He also asked: **critique every input and output, always offer
better alternatives.**

> Note: a global output style (`output-system:report`) is now enforced via
> `~/.claude/settings.json` and overrides the headers above in Claude Code
> sessions. Same spirit — lead with the outcome, critique own work, one question
> at the end. Reconcile the two if it ever matters.

## Where the code is

Cloned locally at `/Users/shilkawi/Developer/Personal Repo/adstack`, branch
`adstack-main`, remote `github.com/khogali/khogali.github.io`.

## State

**Built and pushed** (branch `adstack-main`):
- `template/` — click tracker, postback receiver, Meta Conversions API bridge,
  Supabase schema, static LP shell
- `skills/` — adstack-offer (vet before spending), adstack-lp, adstack-daily
- `reference/` — platform APIs, guardrails

**Audited and repaired 2026-08-31** (commit `78eda42`). The tracker did not work
end to end. Thirteen defects, two of which lost money on the first paid click:

- `c.ts` redirected to `/<slug>` while Vercel serves the page at `/lp/<slug>`.
  Every click landed on a 404.
- `pb.ts` wrote the network's raw subid into `conversions.click_id`, a uuid
  foreign key. A non-UUID or unmatched subid failed the insert while the
  endpoint still returned 200, so the conversion was lost and the network never
  retried. Click is now resolved before insert; raw value kept in `sub_id`.
- Open redirect via the `lp` param (`?lp=/evil.com` → `Location: //evil.com/`)
  on the exact domain being used to buy traffic. Now whitelisted.
- `POSTBACK_SECRET` skipped the check when unset. Now fails closed with 503.
- `window.VARIANTS` was never defined, so both arms of the split test served
  identical HTML while logging distinct variant labels.
- `ad_performance` built its spine from `spend_daily` alone, so revenue from a
  conversion arriving after an ad was paused vanished from the report.
- Plus RLS, dedupe for txn-less networks, CAPI 400 handling, CAPI fallback on
  ip/user-agent, token out of the query string.

**Decision layer added 2026-09-01** (commit `7d691bd`). `ad_performance` gave
seven numbers and left the judging to him, which is the thing that makes him
overthink. Three views now sit on top of it:

- `adstack_status` — one row, one sentence. Spend, revenue, profit, ROI, counts
  of ads needing action, a `plumbing` column that reads `ok` or names the fault,
  and a `next_action` in plain English. This is the daily query.
- `ad_decisions` — one row per ad over a trailing window with a verdict
  (`CUT` / `SCALE` / `KEEP` / `WAIT`), the arithmetic behind it in `reason`, and
  `cpc` against `breakeven_cpc`. Four verdicts, each mapping to exactly one
  action. A fifth (`WATCH`) was designed and cut, because it shared an action
  with `KEEP` and a distinction with no different action is what causes the
  overthinking.
- `tracker_health` — is the plumbing working. A healthy-looking $0 and a broken
  tracker are indistinguishable, so this counts unmatched postbacks, undelivered
  CAPI events, click-out rate, and pending vs reversed revenue.

The README's kill guardrail is now enforced in SQL rather than promised in prose:
`WAIT` is returned until an ad clears **both** `min_clicks_to_judge` and
`min_spend_to_judge`. Nothing can be told to die on noise.

Every threshold lives in a `config` table, not in a view. Change one with an
`update config set value = ... where key = ...`, never by editing SQL.

Nothing in this layer acts. It recommends. The optimiser is still deliberately
unbuilt; when it exists it reads `ad_decisions` and writes `decisions`.

`npm run check` in `template/` runs an assert suite plus `tsc --strict` and
exits 0. It also guards config-key drift, because a typo'd key does not error in
Postgres — it falls through to the `coalesce` default and the verdicts quietly
use the wrong number.

**The SQL has never been executed against a real Postgres.** It is parse-verified
only, and the decision layer leans hard on `format()`, aggregate `filter` and
scalar subqueries, so it is the likelier half to need a fix on first run.

**Decided:**
- Paid media buying, all major social + Google eventually, Meta first
- ClickBank as the marketplace (MaxBounty rejected him — no traffic history)
- Target category: **Performance E-Commerce** (physical gadget offers, $50–100
  payout, 2–3% CVR claimed) over supplements — better break-even math, far lower
  ad-account risk, less saturated

## Marketplace pulled 2026-09-01 — the gravity screen was wrong

Read the full ClickBank physical catalogue (474 offers, sorted by gravity) in
his logged-in Chrome. **The gravity 50–200 screen selects against him.** Every
single offer in that band is a Health & Fitness supplement, and their conversion
rates are so low that the break-even CPC is unbuyable on Meta:

| Offer | Gravity | Payout | CVR | Break-even CPC |
|---|---|---|---|---|
| YU SLEEP | 131.6 | $141.46 | 0.31% | $0.44 |
| FemiCore | 99.1 | $212.72 | 0.42% | $0.89 |
| ProDentim | 95.1 | $161.85 | 0.44% | $0.71 |
| Joint Genesis | 62.2 | $161.02 | 0.08% | $0.13 |
| **Derila pillow** | **42.8** | **$53.56** | **3.54%** | **$1.90** |

A $212 payout at 0.42% is worth less per click than a $53 payout at 3.54%.
Gravity counts how many affiliates got paid, and on ClickBank those are email
and native buyers, not Meta buyers. **Screen on break-even CPC, not gravity.**

The non-supplement physical universe is tiny — roughly 15 offers. Shortlist:

| Offer | Gravity | Payout | CVR | BE CPC | Approval |
|---|---|---|---|---|---|
| Derila Ergo Memory Foam Pillow | 42.8 | $53.56 | 3.54% | $1.90 | **Required** |
| Purisaki Berberine Patches | 29.8 | $57.35 | 3.52% | $2.02 | No |
| Pulsetto Lite | 2.8 | $112.00 | 3.19% | $3.57 | Required |
| Matsato Osuren knife | 10.4 | $38.71 | 1.94% | $0.75 | No |

His $1.88 working number was right by accident. Derila lands at $1.90, and its
listed EPC of $1.91 confirms it independently.

**Pick: Derila**, best economics in the whole physical catalogue. Blocked on
approval, which is the step that already killed MaxBounty. **Fallback: Purisaki**,
same economics, no approval gate, but it is a weight-loss patch and therefore
carries the supplement ad-account risk he chose e-commerce to avoid.

Derila, Purisaki and Matsato all come from one vendor (Orbio,
`simona.jazdauskaite@orbio.world`). One approval conversation likely covers all.

Halal filter removed a large slice of the high-gravity list regardless of
numbers: The Genius Switch / Genius Song / Memory Wave (manifestation), Year of
the Horse (astrology), His Secret Obsession.

## ClickBank wiring, verified against their docs 2026-09-01

- **Affiliates can configure postbacks.** Not seller-only. `/api/pb` does fire.
- **Use `aff_sub1`, not `tid`.** The newer affiliate tracking parameters allow
  100 chars including hyphens, so a 36-char UUID click_id fits. This was a real
  risk: the legacy TID field would not have held one.
- Macro mapping: `subid`←`{aff_sub1}`, `payout`←`{affiliate_earnings}`,
  `txn`←`{receipt_id}`. Use affiliate earnings, not gross sale — every ROI
  number is computed against what he actually gets paid.
- **ClickBank ships affiliate-side Meta CAPI natively.** Own Pixel ID and token,
  configured in his ClickBank account, sends InitiateCheckout and Purchase S2S.
- **Do not run both CAPI paths.** ClickBank's and `lib/capi.ts` would each send a
  Purchase with different `event_id`s, which Meta cannot dedupe. Conversions
  double, value halves, optimiser learns the wrong number.
- **Decision: use ClickBank's, disable ours.** Theirs is first-party to the
  transaction and does not depend on the postback arriving, on fbclid surviving
  the LP, or on the `fb.1.` subdomain index being right. Disabling needs no code
  change — leave `META_PIXEL_ID` unset and `sendConversion` returns `{skipped}`.
  Revisit if he leaves ClickBank; their integration is their network + Meta only.

Full wiring, macro table and a zero-spend smoke test are in `template/README.md`.

## Dub was evaluated and rejected 2026-09-01

Research suggested pointing outbound links at Dub instead of writing tracking
code. Read Dub's conversion docs: recording a sale needs their script on the
destination site, a prior lead event, and a server-side `POST /track/sale` from
the merchant's backend. He controls none of those — the destination is Orbio's
checkout. No documented path for third-party network postbacks, no Meta CAPI.

Dub is merchant-side, for running your own affiliate program. He is the
affiliate. It could replace `/api/c` only, at the cost of a redirect hop on paid
traffic. **Remember Dub for later**: if he ships a product with its own affiliate
program, Dub Partners is the right tool.

**Open:**
- Get approved for Derila (`simona.jazdauskaite@orbio.world`). Gating step.
- Set `config.target_payout` / `config.target_cvr` once the offer is confirmed.
  Still at the $75 / 2.5% defaults, which judge a different offer.
- Landing page (build after offer is picked)
- Deploy tracker: Supabase project + Vercel + throwaway domain (~$12)
- TikTok/Google/Snap/Reddit/Pinterest conversion adapters — only Meta is built
- The daily optimiser — deliberately not built, needs live data first

## Before deploying, non-negotiable

1. Run `template/supabase/schema.sql` in the Supabase SQL editor. It is
   re-runnable, and it adds `sub_id`, two indexes, RLS on four tables, and
   replaces the `ad_performance` view. An existing deployment **must** re-run it.
2. Set `POSTBACK_SECRET` in Vercel. `/api/pb` returns 503 without it.
3. Run `npm install && npm run check` in `template/`. Must exit 0.
4. Fire one test postback and confirm a row lands in `conversions` with a
   non-null `click_id`. That is the step that proves the chain, and it is the
   step that was silently broken.
5. The moment an offer is picked, set the two numbers every verdict leans on:

   ```sql
   update config set value = <payout> where key = 'target_payout';
   update config set value = <cvr>    where key = 'target_cvr';
   ```

   They produce `breakeven_cpc`. Left at the $75 / 2.5% defaults they will judge
   a different offer than the one being run.

## Money reality (tell him honestly if it comes up)

Infra is ~$1/mo. **Ad spend is the real cost: $1,500–3,000 to reach a profitable
campaign** is industry-typical. He may not have that. The cheap path is a $50–100
plumbing test on push traffic to prove tracking/postbacks/CAPI fire correctly,
before spending real money on Meta learning what converts.

## Key numbers already worked

```
break-even CPC = payout × conversion rate
```
- Performance e-com: $75 × 2.5% = **$1.88 break-even CPC** (model 1.5% → $1.13)
- Supplements: $150 × 1% = $1.50, but gravity 1156 = burned angles + ban risk

## Next action

Two tracks, and they do not block each other.

1. **Approval.** Email Orbio about Derila. Nothing downstream moves until it is
   answered, and it is the step that silently kills plans.
2. **Plumbing.** Does not need an offer or a dollar of ad spend. Deploy, then
   run the smoke test in `template/README.md`: one self-made click, one curl'd
   postback, confirm `conversions.click_id` is non-null and
   `tracker_health.unmatched_postbacks` is 0. That verifies the exact link that
   was silently broken before the audit.

If Derila is rejected, Purisaki needs no approval and has the same economics.
Say so plainly if he takes it: it is a weight-loss patch, which reintroduces the
supplement ad-account risk that e-commerce was chosen to avoid.

Once live, the daily loop is one query. Do not read raw tables:

```sql
select * from adstack_status;
```

Only drill into `ad_decisions` when it says an ad needs action, and only into
`tracker_health` when `plumbing` is not `ok`.
