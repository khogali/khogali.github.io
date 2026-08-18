# adstack

Affiliate media buying operations, as a Claude Code plugin.

## Skills

| Skill | Use |
|---|---|
| `adstack-offer` | Vet an offer before spending. **Run this first.** |
| `adstack-lp` | Build an angle-matched landing page |
| `adstack-daily` | Daily optimisation: pull spend, join conversions, act, report |

## Reference

- `reference/platforms.md` — per-platform conversion APIs and strategy differences
- `reference/guardrails.md` — the rules that prevent expensive mistakes

## Template

`template/` holds the deployable tracker: click endpoints, postback receiver,
Meta Conversions API bridge, Supabase schema, and a landing page shell.
See `template/README.md` to deploy.

## Status

Built: tracker, Meta CAPI, offer/LP/daily skills.
Not built: TikTok, Google, Snap, Reddit, Pinterest adapters; spend ingest; the
optimiser itself. Those wait until there is a live campaign producing data.
