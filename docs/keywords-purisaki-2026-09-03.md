# Keyword data for the live campaign — 2026-09-03

Source: DataForSEO (Google Ads search volume, US), via `keyword-research/`.
Seeds: "berberine patch", "purisaki". Cost of the runs: under $0.10.

## The headline number: the category is past its peak

`berberine patch`, US monthly searches:

| Month | Searches |
|---|---|
| Aug 2025 | 1,300 |
| Oct 2025 | 9,900 |
| Dec 2025 | 22,200 |
| Jan–Feb 2026 | 49,500 |
| Mar–May 2026 | **74,000** |
| Jun 2026 | 49,500 |
| Jul 2026 | 33,100 |

Twelve-month average 40,500, CPC $2.72, competition index 100. The patch
category went from nothing to a spring-2026 spike and has fallen about 55%
from that peak in two months. This is a fad in its decline phase. Purisaki
still has demand, but the tailwind is gone and the audience has seen a lot of
patch ads already, which is consistent with the click-out problem.

## Brand search: people see the ads and go check

| Query | Searches/mo | CPC | Intent |
|---|---|---|---|
| purisaki patch reviews | 4,400 | $3.65 | commercial |
| purisaki berberine patches | 3,600 | $5.41 | navigational |
| purisaki berberine patches review(s) | 1,300 | $4.13 | commercial |
| purisaki berberine patches reviews and complaints | 390 | $5.52 | commercial |
| purisaki weight loss patches | 390 | $5.10 | navigational |
| purisaki patches for weight loss reviews | 260 | $5.12 | commercial |

Roughly 10,000 brand searches a month, and advertisers are paying $4–5.50 a
click on them, so someone is bidding on the brand. Orbio's Purisaki listing
does not state a brand-bidding rule (Derila's and Matsato's do). **Ask before
touching it.** Even if allowed, $5 clicks against a $57 payout need 9% of
clicks to buy; brand-review searchers can convert that high, cold clicks
cannot.

## Generic, non-brand

| Query | Searches/mo | CPC |
|---|---|---|
| berberine patch reviews | 4,400 | $2.97 |
| where to buy berberine | 2,900 | $2.04 |
| berberine weight loss reviews | 3,600 | $2.11 |
| best berberine patch(es) | 480 | $3.94 |
| best berberine patch for weight loss | 210 | $4.10 |
| berberine patch vs pill | 50 | $3.29 |

## What it means for the campaign

1. **Meta creative:** "reviews" and "vs pill/capsule" are the questions people
   actually type. The rewritten page and A6 ("patch instead of another
   capsule") are aimed at the right question. "Reviews and complaints" at
   390/mo says skepticism is part of the buyer's path; the page's "what we are
   not saying" box earns its place.
2. **Search is a different build.** A review/comparison page for
   "berberine patch reviews" (4,400/mo, $2.97) could work on paid search only
   if it converts 5%+ of clicks; the advertorial will not. Not a September
   item.
3. **Category decline is the strategic fact.** It argues for getting PIA live
   quickly rather than leaning further into Purisaki, and for treating any
   Purisaki scale-up as short-lived.

Reproduce: `cd keyword-research && set -a && source .env && set +a && npx tsx src/cli.ts "berberine patch" --top 25 --volume`
