---
name: adstack-daily
description: Daily optimisation run — pull ad spend, join it against tracked conversions, decide what to pause or scale, and report. Use for "run the daily", "check the campaigns", "how did yesterday do", or any routine campaign review.
---

# Daily optimisation

Reads `ad_performance` (spend joined to your own conversions), applies rules,
logs every decision, then reports.

## Do this in order

1. Pull yesterday's spend per ad from the platform API into `spend_daily`
2. Query `ad_performance` for the day
3. Apply the rules below
4. Write every decision to `decisions` with its reasoning — including no-ops
5. Push changes to the platform
6. Report: what was killed, what was scaled, what needs human judgement

## The rules

**Never act on thin data.** Both thresholds must clear before any kill:
- minimum spend ≥ 2× the offer payout, AND
- minimum 100 tracked clicks

Killing an ad on 4 clicks is killing on noise. This is how homemade optimisers
murder their winners during a slow afternoon.

**Kill** when spend ≥ 3× payout with zero conversions, or ROI < -40% after both
thresholds clear.

**Scale** by no more than 20% per day, and only when ROI > +25% across two
consecutive days. Larger jumps reset the platform's learning phase and you lose
the very performance you were trying to buy.

**Flag for human** anything between -40% and +25%. Do not act. Ambiguous ads are
where judgement beats rules.

## Report format

Lead with profit or loss for the day. Then killed, then scaled, then flagged.
Never bury the number.

## Honest limits

Rules cannot fix a bad offer, bad creative, or a mismatched landing page. If
everything is losing, the answer is upstream — do not optimise your way through
a fundamentally broken funnel.
