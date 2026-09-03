# keyword-research

Free keyword research. No Ahrefs, no API key, no quota.

## What works where

| Layer | Source | Works in cloud? |
|---|---|---|
| Keyword expansion | Google + YouTube + Amazon autocomplete | ✅ yes |
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

**Expansion** takes one seed and returns 300-600 real queries across three
autocomplete sources, each carrying a different signal:

| Source | Signal |
|---|---|
| **Amazon** | Pure purchase intent — someone typing here is shopping |
| **Google** | General search demand, widest coverage |
| **YouTube** | How people phrase problems — content angles |

Each is hit with buyer-intent prefixes (`best`, `cheapest`, `worth it`),
comparison suffixes (`vs`, `alternative`, `review`), and alphabet soup.
Keywords appearing in multiple sources keep all of them — that overlap is
itself a ranking signal.

```bash
npx tsx src/cli.ts "ergonomic pillow" --sources google,amazon
```

**Scoring** ranks for *affiliate value*, not volume. Amazon-sourced keywords
get the largest boost — an Amazon search box is the closest thing to a free
purchase-intent signal that exists. Commercial intent beats
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
