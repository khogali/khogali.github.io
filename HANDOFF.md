# HANDOFF — adstack (read first)

**Updated:** 2026-08-31 · Tracker audited and repaired. Pick up here.

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

`npm run check` in `template/` now runs an assert suite plus `tsc --strict` and
exits 0. **The SQL has never been executed against a real Postgres** — it is
parse-verified only.

**Decided:**
- Paid media buying, all major social + Google eventually, Meta first
- ClickBank as the marketplace (MaxBounty rejected him — no traffic history)
- Target category: **Performance E-Commerce** (physical gadget offers, $50–100
  payout, 2–3% CVR claimed) over supplements — better break-even math, far lower
  ad-account risk, less saturated

**Open:**
- Pick the specific offer. Need marketplace rows: name, gravity, avg $/conversion.
  Screen gravity 50–200; above that is saturated.
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

Get the ClickBank performance-e-commerce marketplace rows, run `adstack-offer`
math on the top candidates, pick one, build the LP. The tracker is no longer the
blocker.
