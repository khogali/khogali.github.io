# Guardrails

Rules that exist because breaking them is expensive.

## Money

- **Budget the first test as tuition, not investment.** First campaigns from zero rarely profit.
- **Never scale more than 20%/day.** Bigger jumps reset the learning phase.
- **Break-even CVR before spend.** `CPC / payout`. If you cannot state it, do not launch.

## Data

- **Never act on fewer than 100 tracked clicks.** Statistical noise looks exactly like a losing ad.
- **Log every automated decision with its reasoning.** An optimiser you cannot audit is an optimiser you cannot trust.
- **Postback secret is mandatory.** Without it anyone can forge conversions and poison your optimisation.

## Compliance

- No fake scarcity, countdown timers, or fabricated testimonials.
- Health, income, and financial claims are the top cause of permanent account loss.
- Advertising disclosure on every landing page.
- Privacy policy and terms must exist and resolve.

## Operational

- Never commit real credentials. `.env` is gitignored; secrets live in the host's env settings.
- Landing pages never served from a domain you care about.
- Rules cannot fix a bad offer. If everything loses, the problem is upstream.
