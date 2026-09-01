# HANDOFF — adstack (read first)

**Updated:** 2026-08-18 · Continuing a session that ran remote. Pick up here.

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

## State

**Built and pushed** (branch `adstack-main`):
- `template/` — click tracker, postback receiver, Meta Conversions API bridge,
  Supabase schema, static LP shell
- `skills/` — adstack-offer (vet before spending), adstack-lp, adstack-daily
- `reference/` — platform APIs, guardrails

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
math on the top candidates, pick one, build the LP.
