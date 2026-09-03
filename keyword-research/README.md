# keyword-research

Free keyword research. No Ahrefs, no API key, no quota.

## What works where

| Layer | Source | Works in cloud? |
|---|---|---|
| Keyword expansion | Google Autocomplete | ✅ yes |
| Intent + opportunity scoring | local logic | ✅ yes |
| SERP difficulty | Playwright scraping | ❌ **local only** |

Search engines block datacenter IPs. Expansion and scoring run anywhere;
SERP difficulty needs your own machine (or a paid SERP API dropped into the
same adapter interface).

## Use

```bash
npm install
npx tsx src/cli.ts "ergonomic pillow"
npx tsx src/cli.ts "ergonomic pillow" --serp --top 40
```

## What it does

**Expansion** takes one seed and returns 150-600 real queries by hitting Google
Autocomplete with buyer-intent prefixes (`best`, `cheapest`, `is`, `worth it`),
comparison suffixes (`vs`, `alternative`, `review`), and alphabet soup.

**Scoring** ranks for *affiliate value*, not volume. Commercial intent beats
informational every time — a 200/mo "best X for side sleepers" is worth more
than a 5,000/mo "what is X". Long-tail, `for <audience>`, and comparison
queries score up. `near me` scores down hard.

**Difficulty** reads the actual SERP: how many authority sites hold the top 10,
whether Reddit and Quora rank (a soft SERP you can beat), and whether a few
domains own everything. Not a vendor's black box — just who you'd compete with.

## Adding Google Ads volume later

Keyword Planner gives real search volume free with a Google Ads developer token.
Add it as a third signal alongside intent and difficulty — the scoring function
already accepts external inputs.
