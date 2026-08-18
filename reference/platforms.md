# Platform reference

Each platform needs its own conversion feedback path. They are not interchangeable.

| Platform | Click ID | Conversion API | Notes |
|---|---|---|---|
| Meta | `fbclid` | Conversions API, `graph.facebook.com/v21.0/{pixel}/events` | Built. `fbc` must be `fb.1.{ts}.{fbclid}` exactly or attribution silently fails. |
| TikTok | `ttclid` | Events API 2.0 | Different auth header and payload shape. |
| Google | `gclid` | Offline Conversion Import / Enhanced Conversions | Often batch, not real-time. Uploads against a conversion action. |
| Snapchat | `sccid` | Conversions API | |
| Reddit | `rdt_cid` | Conversions API | |
| Pinterest | `epik` | Conversions API | |

## Strategic differences that matter more than the APIs

**Meta / TikTok** — interrupt traffic. Nobody was looking for you. Advertorial
pre-sell, aggressive creative testing, and the highest ban risk for affiliate
offers. Expect to lose ad accounts; plan account hygiene from day one.

**Google Search** — intent traffic. They typed the problem. Direct landing pages
convert best. Stricter affiliate policy than Meta, but far more durable accounts.

**Native** — cheap, cold, high volume. Editorial style mandatory. Long-form works
here and nowhere else.

## Account durability

Affiliate ad accounts die. Treat it as an operating cost, not a failure:
- separate domains per campaign, never share with anything you own long-term
- warm new ad accounts with benign spend before running offers
- never reuse a domain that has already been flagged
