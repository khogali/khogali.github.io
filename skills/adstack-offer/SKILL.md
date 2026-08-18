---
name: adstack-offer
description: Evaluate an affiliate offer BEFORE spending money on it. Use when the user shares an offer page, network listing, or is deciding what to promote. Triggers on "should I run this offer", "look at this offer", "is this worth promoting", or any offer URL pasted into chat.
---

# Offer evaluation

Most affiliate money is lost running a **bad offer well**, not a good offer badly.
This runs before any landing page or ad spend.

## Read the offer first

If the user gives a URL, open it (WebFetch, or Chrome via Playwright if it is
login-walled or JS-heavy). Read the actual advertiser page — not the network's
description of it. You are looking for what the *visitor* will experience after
they click, because that is what converts or doesn't.

## The five questions

**1. What is the required conversion rate to break even?**

```
break-even CVR = CPC / payout
```

If clicks cost $0.80 and the offer pays $30, you need 2.7% of clicks to convert.
State this number explicitly. If the user cannot name a realistic CPC for their
traffic source and geo, that is the first thing to find out — everything else
is guesswork without it.

**2. How many steps between click and payout?**

Count them on the actual page. Each step roughly halves conversion.
- Email submit → 1 step, high CVR, low payout
- Form fill → 2-3 steps
- Credit card / purchase → 4+ steps, low CVR, high payout

A high payout behind five steps is usually worse than a small payout behind one.

**3. Does the advertiser scrub?**

Scrubbing = the advertiser reports fewer conversions than actually happened.
Signals: network reviews mentioning "shaving", payout that looks too good for
the vertical, a brand-new advertiser, or no public complaint history at all.
Ask the affiliate manager directly what the historical approval rate is.
If they dodge, treat that as the answer.

**4. Is the angle already saturated?**

Check what is currently running — competitor ad libraries (Meta Ad Library is
free and public), and search the offer name. If fifty buyers run the same angle,
the auction price already reflects it. You need a different angle, not the same
one executed slightly better.

**5. Can you even get approved?**

Networks reject applicants with no track record. Before designing a funnel,
confirm the user is actually accepted for this offer. This is the most common
place a plan dies silently.

## Output

Give a **RUN / SKIP / CONDITIONAL** verdict with the break-even CVR stated
numerically, the step count, and the single biggest risk. Recommend SKIP freely —
the cost of skipping a mediocre offer is zero; the cost of running one is the
whole test budget.
