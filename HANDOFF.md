# HANDOFF — adstack (read first)

**Updated:** 2026-09-01 · Database LIVE and verified. Offer confirmed: Purisaki.
Pick up here.

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

## LIVE INFRASTRUCTURE (2026-09-01)

| Thing | Value |
|---|---|
| Supabase project | `adstack` / ref `xiodpbhapjitjqtuavwy` / us-east-1 / PG 17 / free, $0/mo |
| Schema | **Applied and verified.** 35 statements, migration `adstack_initial_schema` |
| Vercel team | `team_b2Q2wZtXXXRROzcSJWoKtJcF`, plan **pro** (upgraded 2026-09-01) |
| Vercel project | `adstack` / `prj_FUpbBCIwOx843OtZbPkuaU9jp2Qo` / branch `adstack-main` / root `template` |
| Live URL | `https://thecravingsnote.com` — `/`, `/lp/default`, `/privacy`, `/terms` all 200 |
| Meta portfolio | **Sélectionné store**, `business_id=1117661844127145` (moved off `Kho's Recs` 2026-09-01) |
| Meta domain | **`thecravingsnote.com` VERIFIED** in Sélectionné store, asset id `2470795726763483` |
| Meta ad account | `124463681691678` — personal, **cannot be claimed**, unbilled. A new one must be created inside the portfolio |
| Burner domain | **`thecravingsnote.com`** — bought, attached to Production, apex only (www redirect deliberately OFF) |
| Offer | **Purisaki Berberine Patches**, lander `cbpage=lp1`, on Meta (decided 2026-09-01) |
| ClickBank | nickname **`shilkawia`** (new, hops cleanly). `ashilkawi` and `a7medkhoga` are dead — `accntstate`. Vendor `otppurisak` |
| Hoplink | `b4802imbtdqkj90h8ixt32-vno` + `?cbpage=lp1` — verified correct product, `aff_sub1` and `fbclid` both survive |

**The SQL is no longer unverified.** Seeded synthetic data and every verdict was
correct: `ad-cut` 200 clicks/$300/0 conv -> CUT; `ad-scale` 150/$200/5 conv ->
SCALE at 87.5% ROI; `ad-wait` 50 clicks -> WAIT "Needs 50 more clicks";
`ad-keep` -> KEEP at 12.5%. `adstack_status` collapsed it to "Pause 1 ad(s).
Start with ad-cut, it has burned $300.00." Test rows deleted, tables at 0.

**Running it found a bug that reading it never did** (commit `d3271ad`).
`tracker_health.capi_undelivered` counted every conversion with
`capi_sent = false` as a failure. The chosen setup is ClickBank's native CAPI
with `lib/capi.ts` off, which leaves that flag false forever, so `plumbing`
would have read "N conversion(s) never reached Meta" permanently and masked the
landing-page check underneath it. Now counts only genuine failures.

Supabase security advisors: only INFO `rls_enabled_no_policy` on all five
tables, which is the intended design. No errors, no warnings.

**Vercel is deployed.** The MCP 403s on project creation (OAuth scope limit —
read and list work), so it was created through the browser instead. Production
branch `adstack-main`, root directory `template`, both saved. Vercel's own
"Redeploy" toast does not actually fire; push a commit to `adstack-main` instead.

**The audit's headline fix is verified on a real host.** `/lp/default` returns
**200** and carries `x-robots-tag: noindex, nofollow`, which also proves the root
directory is correct since that header comes from `template/vercel.json`. Before
the audit this URL was `/default` and would have 404'd every paid click.

**The functions were broken from the very first deploy, and it was misdiagnosed
twice as "missing env vars".** Vercel transpiles the `.ts` handlers to `.js`;
without `"type": "module"` Node loaded them as CommonJS and the process died on
the first `import` before any handler code ran. Adding it exposed the second
half: ESM requires file extensions on relative specifiers, so `'../lib/db'` had
to become `'../lib/db.js'` (TypeScript maps it back to the `.ts`). Fixed in
`f65061e` and `f0a4461`.

Two lessons worth keeping:
- `npm run check` printed `MODULE_TYPELESS_PACKAGE_JSON` on every run and it was
  dismissed as cosmetic. It was the bug.
- Module-load failures produce an opaque `FUNCTION_INVOCATION_FAILED`, which
  reads like a config problem. **Read the Vercel runtime logs, do not infer.**
  `get_runtime_logs` gave the answer in one call after an hour of wrong guesses.

**Current state, verified live 2026-09-01:** `/api/c`, `/api/go` and `/api/pb`
all return `503 not configured`, and the Vercel log now names
**`SUPABASE_SERVICE_KEY is not set`** — it previously said `SUPABASE_URL`. That
change is the proof that `SUPABASE_URL` and `OFFERS` took: the guard checks in
order and has advanced past them. Two secrets remain. When one
route lags behind the others, check the `dep=` in the log — a stale function
from the previous deployment serves for a short window after a deploy.

Four env vars remain, which Claude will not set because they are secrets:
`SUPABASE_URL` = `https://xiodpbhapjitjqtuavwy.supabase.co`, plus
`SUPABASE_SERVICE_KEY`, `POSTBACK_SECRET` (`openssl rand -hex 24`), and `OFFERS`.

**`thecravingsnote.com` is live on the project.** Apex only — the "Redirect apex
domains to www" checkbox is ON by default and was deliberately unchecked, because
a www redirect adds a hop on paid traffic and breaks the `fb.1.` subdomain index
in `lib/capi.ts` if that path is ever re-enabled.

## Meta account structure — the trap, and the resolution (2026-09-01)

**There are THREE business portfolios, two of them named the same thing.** This
cost a lot of time; do not lose it again.

| Portfolio | ID | State |
|---|---|---|
| `Kho's Recs` | `1766809867805983` | Empty. Domain was first verified here, then moved out |
| `Sélectionné store` | `1117661844127145` | **The one to use.** Holds the verified domain. Empty otherwise |
| `Sélectionné store` | `175729199698075` | **Inaccessible.** Holds the Page. Business Manager returns *"Sorry, this content isn't available right now"* |

The Facebook Page `Sélectionné store` (`597277517109514`) is claimed by the
third portfolio, which Ahmed cannot administer. That is why:

- The Page shows `Request Sent` / pending approval forever — the approver is a
  portfolio he has no admin access to.
- No approve button exists anywhere. The Requests tab is empty and
  `Manage Request` only offers *Cancel*.
- Both usable portfolios report 0 Pages and 0 ad accounts.

Found via **Page → Settings & privacy → `facebook.com/settings/?tab=profile_access`
→ Business portfolio access**, which prints the owning portfolio ID. That ID
mismatch is the diagnostic; nothing in Business Manager surfaces it.

**Resolution: create fresh assets in `1117661844127145`. Do not chase the Page.**
Recovering admin on the third portfolio means a Meta support ticket, and the
prize is a Page named after a French store that does not match the funnel.

## SETUP SPEC for the new assets

All three go in **`Sélectionné store` / `1117661844127145`**, the portfolio that
holds the verified domain.

**1. Facebook Page** — Accounts → Pages → Add → Create a new Page
- Name: `The Cravings Note` (matches `thecravingsnote.com`; a mismatched name is
  a needless flag to a reviewer and to the buyer who sees it beside the ad)
- Category: something neutral like `Website` or `Blog`. Avoid health/medical
  categories — they invite scrutiny the content does not need.

**2. Ad account** — Accounts → Ad accounts → Add → Create a new ad account
- Currency: **USD — non-negotiable.** ClickBank pays USD and `ad_performance`
  computes `profit` as a raw `revenue - spend` with no FX anywhere. A non-USD
  account silently produces wrong profit, ROI and CPA that still look plausible.
- Time zone: **UTC.** The views bucket days with `date()` in UTC; matching
  removes the one-day boundary drift documented on `ad_performance`.
- Do NOT reuse `124463681691678`. It is personal, unbilled, and Meta refuses to
  claim it. It also holds a draft **Traffic** campaign that should not be used.

**3. Dataset** — Data Sources → Datasets & pixels → Create
- This produces the Pixel/Dataset ID that ClickBank's Meta integration needs.
- Generate its access token, then put both into ClickBank →
  Integrations → Postback/Pixels → **Facebook Pixel** template.
- Remember the single-path rule: ClickBank's CAPI is ON, `lib/capi.ts` stays OFF
  (`META_PIXEL_ID` unset). Two paths = double-counted Purchases.

**4. First campaign** — when creative exists
- Objective: **Sales**, not Traffic. Optimise for the **Purchase** event that
  ClickBank's CAPI feeds back. Traffic optimises for link clicks, which is the
  exact failure mode this whole stack exists to correct.
- Destination: `https://thecravingsnote.com/api/c?s=meta&lp=default&c={{campaign.id}}&as={{adset.id}}&ad={{ad.id}}&pl={{placement}}`
- Turn on URL auto-tagging so Meta appends `fbclid`; `/api/c` stores it and
  `/api/go` forwards it, which is what ClickBank's CAPI matches on.

## Meta setup, done and not-done (2026-09-01)

**Domain verified in `Sélectionné store`** (`1117661844127145`), asset
`2470795726763483`. The tag lives in the `<head>` of `template/index.html` and
**must stay there** — Meta re-checks, and it must be server-rendered, not
JS-injected:

```html
<meta name="facebook-domain-verification" content="edzll9esrw55u74wv9r12vrz7wxftf" />
```

It was first verified in `Kho's Recs` and moved on 2026-09-01. A domain belongs
to exactly one portfolio, so moving it meant remove -> re-add -> new token ->
redeploy -> re-verify. **If it ever moves again, the token changes and
`template/index.html` must be updated in the same pass**, or verification
silently lapses.

**Neither portfolio owns a Page or an ad account.** Business Manager reports 0
Pages and 0 ad accounts for both. "Shilkawi Med" is the *user profile* name, not
a third portfolio. The Page `Sélectionné store` (`597277517109514`) and the ad
account `124463681691678` are **personal assets outside Business Manager**, and
Meta refuses to pull either in:

- The ad account is blocked with *"This personal ad account can't be added to
  Business Manager because a payment has not been made."*
- The Page would not move either.

So both must be **created inside the portfolio**, not adopted. Meta's own
suggestion for the ad account, and the only remaining path for the Page.

Verification was only possible after two prerequisites that did not exist:
a Business Portfolio (Ahmed created it), and a root page (`/` used to 404, so
there was no `<head>` to put the tag in).

**Still open on Meta, both needing Ahmed:**

1. **Ad account `124463681691678` is not in the portfolio.** Claiming an ad
   account into a business portfolio is **permanent — Meta does not allow
   removing it afterwards**, so Claude did not do it. Settings -> Accounts ->
   Ad accounts -> Add.
2. **No dataset/pixel exists.** ClickBank's Conversions API integration needs a
   Pixel/Dataset ID and an access token. Data Sources -> Datasets -> Create.
   The token is a credential; Ahmed generates and pastes it into ClickBank.

There is also an **unpublished draft campaign** in that ad account, "New Traffic
Campaign with recommended settings". Claude did not touch it. **Its objective is
wrong** — Traffic optimises for link clicks, which is the exact failure mode this
whole stack exists to fix. It needs to be a Sales campaign optimising on the
`Purchase` event that ClickBank's CAPI feeds back.

## Pages that now exist (2026-09-01)

`/` root (was 404, carries the Meta tag), `/privacy`, `/terms` (both were linked
from the LP footer and both 404'd), and a real `lp/default` replacing the
placeholder. The LP runs the cravings/timing angle matched to the domain and to
the vendor's stated demographics, and deliberately avoids numeric weight-loss
claims, before/after framing and institutional name-drops. Variant `b` swaps to
a reader-question angle under the same discipline.

## accntstate: SOLVED 2026-09-01 by a new nickname

`shilkawia` was created and hops cleanly, no `errCode`. The two older nicknames
stay broken and must not be used:

| Nickname | Hop result |
|---|---|
| `zzqxnotarl` (control, fake) | `errCode=invalidnickname` |
| `a7medkhoga` (2020) | `errCode=accntstate` — dead |
| `ashilkawi` (2022) | `errCode=accntstate` — dead |
| **`shilkawia`** (2026-09-01) | **clean hop to buy-purisaki.com** |

Whatever `accntstate` is, it is per-nickname, not per-master-account. A fresh
nickname routes around it. Not worth a support ticket now.

## SOLVED: the hoplink works. It was a landing-page setting, not a bad link.

ClickBank's link builder has a **Landing Page** dropdown. It defaults to
`Default`, and for this offer `Default` routes to **Nuubu**, a different Orbio
product. Nobody sent a wrong link; the link was built with `Default` selected.
Pick a named lander and it routes correctly. The selector is `?cbpage=`:

| `cbpage` | Destination |
|---|---|
| (none) / `Default` | `buy-purisaki.com/nuubu/product` — WRONG PRODUCT |
| `lp1` | `article/purisaki-wl-scientific-discovery-aff` — correct |
| `lp2` | `article/purisaki-wl-short-story-aff` — correct |
| `lp3` | falls back to Nuubu (invalid id) |

**`aff_sub1` survives the hop.** Verified: appending
`&aff_sub1=<uuid>&traffic_source=meta&traffic_type=paid&fbclid=X` to the
encrypted hoplink puts all four on the final URL. That is the proof adstack's
`click_id` reaches ClickBank and can come back on the postback. `fbclid` passes
too, which is what ClickBank's native Meta CAPI needs.

Working base link for nickname `shilkawia`, Scientific Discovery lander:

```
https://b4802imbtdqkj90h8ixt32-vno.hop.clickbank.net/?cbpage=lp1
```

Regenerate from Marketplace -> Get Affiliate Link if the encrypted id rotates.
`aff sub 1`..`5`, `tid`, `fbclid` and `extclid` are all togglable under
Edit Parameters.

## DECIDED 2026-09-01: keep Purisaki, run on Meta

Ahmed was shown all three destination pages and their claims, and chose to
proceed. **This is a made decision, not an oversight. Do not re-litigate it** —
same rule as paid-vs-organic. Critique execution, not the choice.

Practical consequences to manage rather than argue:
- The one surface he controls is `thecravingsnote.com`. Keep his own copy free
  of numeric weight-loss claims, before/after framing and the Harvard angle.
  It is the defensible surface and the only one he can edit.
- Expect ad-level rejections. Budget for creative iteration, not just spend.
- Do not spend the whole budget from one ad account.

## (context for that decision) every Purisaki destination breaches Meta policy

Read all three destination pages. Every path carries hard weight-loss claims
and fake-news framing:

| Page | Headline | Claims found |
|---|---|---|
| Product page | *"Lose 12+ lbs per Month Easily"* | specific amount + timeframe |
| `lp1` Scientific Discovery | *"JUST LEAKED: Harvard Scientist Accidentally Discovers an Ancient Green Molecule That Can Burn 3X More Fat..."* | "lost 27 pounds", "lost an average of 28 pounds" |
| `lp2` Short Story | *"SKEPTICS STUNNED: How This Weird Skin Trick Erased 52 Pounds Without Giving Up Wine, Pizza, & Even Hitting the Gym"* | "Lost 28 pounds", "lost 12 pounds" |

Meta's health and misleading-claims policies target exactly this: implied
specific weight-loss outcomes, unrealistic results, and sensationalised
"leaked/stunned" framing. The Harvard name-drop is a separate legal exposure —
Harvard pursues trademark misuse in supplement advertorials.

**Correction to an earlier recommendation in this file:** Scientific Discovery
was suggested as the more conservative angle. Having read it, it is not. Both
advertorials are equally aggressive and `lp2` is arguably worse.

A compliant landing page on `thecravingsnote.com` does not fix this. Meta
reviews destination pages, and he controls none of these.

**The technical build is done and proven. The offer is the problem.** Options:

1. **Run Purisaki on Native** (Taboola/Outbrain) instead of Meta. These
   advertorials are built for native and policy there tolerates them. The vendor
   says it scales on Native. Costs: higher minimums, and adstack has no native
   adapter yet, and ClickBank's native CAPI is Meta-only.
2. **Switch to Matsato Osuren knife** — same vendor, no approval, zero health
   claims, Meta-safe. Break-even CPC only $0.75, which is tight but knives are a
   strong visual/impulse product on Meta.
3. **Run Purisaki on Meta anyway** — highest expected value on paper, and the
   profile Meta restricts accounts for. A ban is identity-level.

`thecravingsnote.com` was named for the cravings angle, so option 2 would need a
second burner domain (~$11.25).

## (superseded) the encrypted link looked like a vendor error

The vendor supplied encrypted hoplink
`https://f8e86cuh-6qnl8db59skw239-e.hop.clickbank.net` **also lands on Nuubu**,
same as the generic hoplink. Both product pages are live and distinct:

| URL | `<title>` |
|---|---|
| `/nuubu/product` | *Limited Time Promo: 70% Off Detox Patches! \| Nuubu* |
| `/purisaki-berberine/product` | *Limited Time Promo: 70% Off Purisaki Berberine!* |

So this is not a rename or a dead product. The vendor handed over a Nuubu link.
Go back to `rasa.neniske@orbio.world` / Telegram `@rasaorbio` with that exact
link and ask for the Purisaki Berberine one.

## COMPLIANCE RISK on the destination page

The Purisaki page's own H1 is **"Lose 12+ lbs per Month Easily"**. That is a
specific weight-loss amount and timeframe. Meta restricts exactly this, and it
reviews destination pages, not just the ad and the landing page. A fully
compliant LP on `thecravingsnote.com` does not protect him if the page he hands
off to leads with that claim.

This is the concrete version of the risk flagged when Purisaki was picked:
weight-loss reintroduces the ad-account exposure that choosing e-commerce was
meant to avoid. Worth deciding deliberately, not drifting into.

## (superseded) the generic hoplink pointed at the wrong product

`https://shilkawia.otppurisak.hop.clickbank.net/` lands on
**`buy-purisaki.com/nuubu/product`** — Nuubu is a different Orbio product
(detox foot patches), not Purisaki Berberine. Confirmed consistent over three
runs, so it is not rotation.

Curiously, the *errored* hops earlier showed
`destinationUrl=.../purisaki-berberine/product?ang=clickbank-otp`, so the
intended destination exists. The vendor's own router is choosing Nuubu as the
default.

**This must be fixed before spending.** A cravings/berberine landing page on
`thecravingsnote.com` that hands off to a foot-patch offer breaks the funnel at
exactly the point the visitor decides.

The fix is the vendor, not code. Their affiliate page says explicitly to email
`rasa.neniske@orbio.world` or Telegram `@rasaorbio` for the affiliate link.
That is what that instruction is for. Verify whatever they send:

```bash
curl -sk -L -o /dev/null -w '%{url_effective}\n' '<LINK>'
```

Good = `buy-purisaki.com/purisaki-berberine/...` with no `errCode`.

Also note the demographics and creative pack in the Drive are Purisaki-specific.
If the vendor only offers Nuubu on this hop, the whole offer choice reopens.

## (historical) ClickBank hoplinks did not track (found 2026-09-01)

Both of his account nicknames return `errCode=accntstate` on a hop:

| Nickname | Hop result |
|---|---|
| `zzqxnotarl` (control, fake) | `errCode=invalidnickname` |
| `a7medkhoga` (his, 2020) | `errCode=accntstate` |
| `ashilkawi` (his, 2022) | `errCode=accntstate` |

The control proves the distinction is real: a nonexistent nickname errors
differently. `accntstate` means the nicknames exist but ClickBank refuses to
issue a **tracked** hop. **The visitor still lands on the Purisaki page**, so
this fails silently — he would buy traffic, watch it arrive, see zero
conversions, and blame the creative.

This is exactly question 5 of his own `adstack-offer` skill, the place a plan
dies quietly. **Do not spend a dollar until this clears.**

`accntstate` is not documented publicly (searched; nothing). ClickBank support
is the path. Likely candidates are incomplete payment/tax setup or a dormant
account, but that is inference, not confirmed.

Verify the fix with:

```bash
curl -sk -L -o /dev/null -w '%{url_effective}\n' \
  https://ashilkawi.otppurisak.hop.clickbank.net/
```

Green when the final URL is on `buy-purisaki.com` with no `errCode`.

## API key hygiene

He pasted a live ClickBank API key into chat on 2026-09-01. It is named
`CL Assistant` and, per the API Management screen, is **Active with full
permissions on both accounts**: Analytics, Products, Orders Read, **Orders
Read/Write**, and **Subscription Modification**. That is write access to orders
and subscriptions, not just reporting.

**Rotate it**, and scope the replacement to Analytics + Orders Read only, which
is all the reconciliation job would ever need. Claude declined to use or store
it; the repo was scanned and contains no secrets in the working tree or in any
commit.

**Purisaki hoplink shape, confirmed from inside the account:**

```
https://<AFFILIATE_NICKNAME>.otppurisak.hop.clickbank.net/
```

Vendor nickname is `otppurisak`. The affiliate nickname is Ahmed's ClickBank
account name — Claude does not have it. Once known, `OFFERS` is:

```json
{"thecravingsnote.com":{"name":"purisaki","url":"https://NICKNAME.otppurisak.hop.clickbank.net/?aff_sub1={subid}&traffic_source=meta&traffic_type=paid"}}
```

**Historical note on the domain purchase:** Pro perk unclaimed (domains dashboard empty) but the
`Free with Pro` filter still prices `thecravingsnote.com` at $11.25 with no $0
anywhere. Either .com is ineligible or the discount only applies in the cart.
Registration needs a full WHOIS record (legal name, phone, street address), so
Ahmed buys it in the cart himself. Terms: non-refundable, auto-renew ON at the
then-current price, charged to the card on file, tax added at charge time.

## config is set to Purisaki, live

`target_payout = 57.35`, `target_cvr = 0.0352`, so **break-even CPC = $2.02**.

**Known tension, his call:** `min_clicks_to_judge = 100` at $2.02 means **$201.87
of spend per ad before any CUT verdict is allowed**. Against a ~$2k budget that
is roughly 10 ad tests total. Lowering it buys more tests but 100 clicks at
3.52% CVR only expects 3.5 conversions, which is already statistically thin.
`min_spend_to_judge = 75` never binds at this CPC — it is a floor for cheap
traffic, not dead config (an earlier self-critique overstated that).

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

**CONFIRMED 2026-09-01: Purisaki.** Chosen over Derila because it needs no
seller approval (start today) and its asset pack is far deeper. Derila remains
the better pure economics at $1.90 break-even and stays the upgrade path if
Orbio ever approves him.

Purisaki asset pack (public Drive, actively maintained through `26w04` in Jan):
human UGC from 6+ named creators organised by angle, Facebook-specific video
cuts already edited, B-roll, photos, 3D/animations, three advertorials
(Scientific Discovery / Short Story / quiz funnel), email swipes, a marketing
instructions PDF and an angles/landers/guidelines PDF. Stated demographics:
70% female, 44-65+, USA only, 75% mobile. Contact `rasa.neniske@orbio.world`
or Telegram `@rasaorbio` for CPA terms — an upgrade, not a gate.

**Eliminated by reading the terms, not the numbers:** Advanced Amino had the
best CVR in the entire physical catalogue (4.55%, $2.33 EPC) and forbids
Facebook ads outright.

**Go in with eyes open.** This is weight-loss, which reintroduces the
supplement-adjacent ad-account risk e-commerce was chosen to avoid. Meta bans
before/after imagery and negative body-image framing, so their
`25w44-Before After Home` and `25w49 UGC (transformation/progress)` folders are
unusable as supplied. Their copy says "rapid fat burning" and "effortless" while
the product page hedges with "has been studied in weight-management contexts" —
running their advertorial inherits those claims, so use Scientific Discovery and
cut the strongest ones. `26w02 - HeyGen testimonial` is an AI avatar; there is
plenty of real human UGC, so that folder never needs touching.

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
- Deploy tracker: Supabase project + Vercel + burner domains.

## Domains and hosting, decided 2026-09-01

**`khomolab.com` is a keeper and must NOT be the ad domain.** He raised it, was
shown the blast-radius guardrail, and chose burner domains instead. Meta domain
flags are slow to reverse and often permanent, and cold traffic to someone
else's advertorial funnel is the highest-risk configuration there is.

**One burner domain per offer, one Vercel project for all of them.** Vercel
allows 50 domains per project even on Hobby, so this does not need a project per
offer. `lib/offers.ts` resolves hostname -> offer on both `/api/c` and
`/api/go` via an `OFFERS` JSON env map, normalising case, port and a leading
`www.`, and falling back to `OFFER_URL` when the host is unknown or `OFFERS` is
malformed. `clicks.offer` is stamped at click time and carries through
`ad_performance` into `ad_decisions`, so per-offer P&L is one `group by`.

**Vercel Hobby is not usable.** Its fair use guidelines restrict it to
"non-commercial, personal use only" and paid affiliate campaigns are commercial.
Pro is $20/mo. He has approved that spend. The old "~$1/mo infra" line in this
handoff was wrong; real infra is ~$21/mo before a dollar of ad spend.

Per burner domain, two slow steps to do at purchase time, not at launch:
- **Meta domain verification** in Business Manager. ClickBank's CAPI integration
  will not accept events for an unverified domain.
- Deploy on the apex, not `www.` or a subdomain. If `lib/capi.ts` is ever
  re-enabled its `fb.1.` prefix hardcodes subdomain index 1, correct only on the
  apex, and wrong silently everywhere else.
- TikTok/Google/Snap/Reddit/Pinterest conversion adapters — only Meta is built
- The daily optimiser — deliberately not built, needs live data first

## END-TO-END VERIFIED LIVE 2026-09-01

Every link in the chain except the postback itself has been exercised against
production and passed:

| Check | Result |
|---|---|
| `/api/pb` with no key | **403 forbidden** (was 503) — `POSTBACK_SECRET` is live |
| `/api/pb` with a wrong key | **403** — constant-time compare rejects |
| `/api/c` | 302 to `/lp/default?v=a&cid=<uuid>`, cookie set |
| `clicks` row | `offer=purisaki` (host map worked), `fbclid`, `ad_id`, `campaign_id`, `adset_id`, `placement`, `country=US` all captured |
| `/api/go` | redirects with `cbpage=lp1`, `aff_sub1=<real click_id>`, `traffic_source`, `traffic_type`, `fbclid` |
| The hop | lands on `buy-purisaki.com/article/purisaki-wl-scientific-discovery-aff` — **correct product**, `aff_sub1` intact on the final URL, ClickBank issued a `hopId` |
| `clicked_out` | flipped true with a timestamp |
| `tracker_health` | `clickout_pct` 100, `unmatched_postbacks` 0, `capi_undelivered` 0 |
| `adstack_status` | *"1 ad(s) still gathering data. Nothing to do today."* — correctly handles a click with no spend row, which validates the spine-union fix |

**The one untested link is the postback**, because it needs the secret. Smoke row
`7ff40da7-26d2-455a-93dc-2c76822e2fef` is left in `clicks` for that test. Run:

```bash
curl -s "https://thecravingsnote.com/api/pb?subid=7ff40da7-26d2-455a-93dc-2c76822e2fef&payout=57.35&txn=smoke-1&network=clickbank&k=YOUR_SECRET"
```

Expect `OK`. Re-run it and expect `OK duplicate`. Then check
`conversions.click_id` is non-null and `tracker_health.unmatched_postbacks` is 0.
Delete the smoke rows afterwards:

```sql
delete from conversions where sub_id = '7ff40da7-26d2-455a-93dc-2c76822e2fef';
delete from clicks where ad_id = 'SMOKE-AD';
```

## LAUNCH CHECKLIST — everything left, in order

Everything Claude can do without credentials is done. What remains needs
Ahmed's secrets, his legal agreement, or his money. In dependency order:

| # | Step | Where | Why it blocks |
|---|---|---|---|
| 1 | Tick Commercial Terms, click **Add ad account** | Meta -> Kho's Recs -> Ad accounts (staged) | Ad account must be in the portfolio that owns the verified domain |
| 2 | Create a **Dataset** | Meta -> Data Sources -> Datasets | ClickBank CAPI needs a Pixel/Dataset ID |
| 3 | Generate a CAPI **access token** | Meta, on that dataset | Credential. Ahmed only |
| 4 | Paste Pixel ID + token into ClickBank | ClickBank -> Integrations -> Meta | Turns on server-side Purchase events |
| 5a | ~~`SUPABASE_URL` + `OFFERS`~~ | **DONE** 2026-09-01, set as Config type, Production | — |
| 5b | `SUPABASE_SERVICE_KEY` | Vercel, type **Secret** | Service-role key, bypasses RLS. Ahmed only |
| 5c | `POSTBACK_SECRET` | Vercel Secret + the same value in ClickBank | `openssl rand -hex 24`. Never paste it into a chat |
| 6 | ~~Build the ClickBank postback~~ | **DONE** 2026-09-01, saved as `adstack`, status **Inactive** | Needs the secret appended, then activate |
| 7 | **Rotate the ClickBank API key** | ClickBank -> API Management | Pasted into chat; currently has Orders Read/Write + Subscription Modification |
| 8 | Run the smoke test | `template/README.md` | Proves the exact link the audit found broken |
| 9 | Change the draft campaign to **Sales**, optimising on `Purchase` | Meta Ads Manager | Traffic optimises for clicks, the failure mode this stack exists to fix |

Values needed for step 5:

```
SUPABASE_URL=https://xiodpbhapjitjqtuavwy.supabase.co
POSTBACK_SECRET=   # openssl rand -hex 24
OFFERS={"thecravingsnote.com":{"name":"purisaki","url":"https://b4802imbtdqkj90h8ixt32-vno.hop.clickbank.net/?cbpage=lp1&aff_sub1={subid}&traffic_source=meta&traffic_type=paid"}}
```

Postback URL for step 6:

```
https://thecravingsnote.com/api/pb?subid={aff_sub1}&payout={affiliate_earnings}&txn={receipt_id}&k=YOUR_SECRET
```

## ClickBank postback integration — built, inactive

Integrations -> Postback/Pixels -> `adstack`. Configured:

| Field | Value |
|---|---|
| Account | `shilkawia` |
| Role Type | Affiliate |
| Tracking Type | S2S Postback |
| Integration Level | Global (all offers) |
| Event Types | **Initial Purchase, Upsell Purchase** |
| Status | **Inactive** — activate after appending the secret |

URL as saved, deliberately ending in a bare `k=`:

```
https://thecravingsnote.com/api/pb?subid={aff_sub1}&payout={affiliate_earnings}&txn={receipt_id}&network=clickbank&offer={vendor}&k=
```

Ahmed appends his `POSTBACK_SECRET` after `k=` and flips Status to Active.

**Decisions baked into that config, with reasons:**

- **Upsell Purchase is included.** Upsells are real commission. Excluding them
  understates ROI enough to kill profitable ads. The cost is that
  `ad_performance.cvr_pct` overstates conversion rate, because one buyer can
  produce two conversion rows. Revenue, profit and ROI stay correct, and those
  are what `ad_decisions` acts on. **Read `cvr_pct` as "conversion events per
  click", not "buyers per click".**
- **Order Form Impression and Add Payment Info are excluded.** Neither is a
  sale; including them would write phantom `$0` conversion rows and wreck CPA.
- **`{currency}` is deliberately NOT mapped.** ClickBank documents
  `{affiliate_earnings}` as always in USD while `{currency}` is what the
  customer paid in. Mapping it would mislabel a USD payout as EUR/GBP and
  corrupt every revenue sum.
- `{vendor}` -> `offer_id` so rows are attributable to the seller account.
- `network=clickbank` is hardcoded because `NETWORK_NAME` is unset, and the
  dedupe index is on `(network, network_txn_id)` — it must be stable.

## Still deliberately NOT built

- **Spend ingest** into `spend_daily`. Until it exists `ad_decisions` is empty
  and `adstack_status` reads "Clicks are landing but no spend has been
  ingested." Needs a Meta Marketing API token, so it is gated on Ahmed.
- **Reconciliation ingest** for refunds/reversals. ClickBank's affiliate
  postback does not document a reversal event, so `conversions.status` never
  becomes `reversed` on its own and `tracker_health.revenue_reversed` stays 0.
  On a 60-day-guarantee physical product this matters from the first sale.
  Needs the rotated API key.
- **The optimiser.** Reads `ad_decisions`, writes `decisions`. Needs live data.

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
