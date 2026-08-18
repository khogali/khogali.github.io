---
name: adstack-lp
description: Build a fast, angle-matched affiliate landing page from an offer. Use after an offer passes evaluation. Triggers on "build the landing page", "make an LP", "write the pre-sell page", or when the user shares an offer to promote.
---

# Landing page generation

Start from `template/lp/default/index.html`. Everything inline, zero external
requests. On cold paid traffic, render speed is conversion rate.

## Match the page to the traffic source

The single most common failure is running the wrong page shape for the source.

| Source | Page shape | Why |
|---|---|---|
| Meta / TikTok | Advertorial pre-sell | Cold interrupt traffic. Needs a story before the ask. |
| Google Search | Direct, intent-matched | They already searched for this. Get out of the way. |
| Native (Taboola/Outbrain) | Long-form editorial | Arrived expecting an article. Give them one. |
| Push / pop | Short, aggressive | Cheapest, coldest traffic. Seconds of attention. |

## Structure that works on cold traffic

1. **Hook** — restate the problem in the visitor's own words, not the brand's
2. **Agitate** — the cost of not solving it, concretely
3. **Bridge** — how the offer solves it, without overclaiming
4. **Proof** — specific and checkable, never generic testimonials
5. **CTA** — one action, repeated; never compete with yourself

## Rules

- **Congruence beats cleverness.** The page must continue the ad's promise. Mismatch between ad and LP is the #1 killer of otherwise good campaigns.
- **One CTA.** Every additional link is a leak.
- **No fake scarcity, no fake countdown timers.** Bans, chargebacks, and legal exposure.
- **Claims must survive scrutiny.** Health, income, and financial claims are what get ad accounts permanently disabled — not aggressive copy.

## Variants

Build 3-5 variants that differ on **angle**, not wording. Changing "Discover" to
"Unlock" teaches you nothing. Changing the *reason someone should care* teaches
you everything. Fill `window.VARIANTS` and set `LP_VARIANTS` in env.

## Before shipping

- Renders under 1s on throttled mobile
- CTA carries `cid` through to `/api/go`
- Advertising disclosure present
- Privacy and terms pages exist and resolve
