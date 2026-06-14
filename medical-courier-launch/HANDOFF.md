# HANDOFF — Medical Courier Side Hustle (read this first)

*Purpose: let a fresh chat pick up without re-deriving anything. Read this top to bottom, then the deeper docs (01–05) only if needed.*

**Last updated:** 2026-06-14

---

## Your role (for the assistant)

Operating partner / COO for the user — not a cheerleader. Be blunt, use real numbers, label guesses, never invent figures. Keep explanations **substantive but readable** — not dense/cramped tables, not baby-simple one-liners. The user pushed back on both extremes; aim for the middle: plain prose, breathing room, real specifics.

---

## Who the user is (don't re-ask)

- Co-owns **Khogali Transport LLC** (NEMT) in Upper Darby / Delaware County, PA. Has **LLC + EIN**.
- **Works full-time at T-Mobile** — this is the key constraint. Courier is a side thing around that job.
- **Driving solo for now**, using a **2019 Kia Sorento** (SUV, 7 yrs old — qualifies for every platform's vehicle-age rule).
- Originally had a partner (Amro, ops) and his dad (driver) + a 2015 Kia Sedona, but the **active plan is solo gig work** (see decision below).
- Constraints: sales-light (no cold pitching), capital-light (<$2k), halal (no interest/riba), must eventually run without him day-to-day.

---

## The decision he's made: Option 1 (gig work around the job)

He is **NOT** starting a courier company right now. He's doing **pick-your-hours medical delivery gigs** on evenings/weekends around T-Mobile, to earn a little and learn the work cheaply.

Why not the bigger plans:
- Driving full scheduled routes himself conflicts with a full-time job.
- Having his dad drive a route (the "real business" version) is on hold — depends on dad's availability, which is unconfirmed.
- Standing up his own insured courier company ("prime") is a *later* move, only after a route is proven.

---

## Platform lineup (verified June 2026)

Sign up for several; run 2–3 at once to catch the best-paying gig at any moment.

- **Roadie** (UPS company) — LEAD option. Active, pharmacy-delivery program live. Unlock medical gigs via a free in-app pharmacy certification. driver.roadie.com/sign-up
- **MedZoomer** — Philadelphia prescription delivery, 1099. Requires HIPAA cert before first delivery. Accepts vehicles <15 yrs.
- **Senpex** — medical/lab line, gig, keeps 80–90% of fee + tips. Backup.
- **Courial** — specialized medical, gig. Backup; verify local volume.
- ❌ **ParaWorks — SHUT DOWN.** ❌ **American Expediting — ceased operations June 2026.** Do not recommend.

---

## What he'll make (set expectations honestly)

Gig pay is per-delivery and volume-dependent — no salary to quote.

- Effective **~$13–25/hour** while actively on a delivery; medical-tagged gigs at the higher end.
- Around a full-time job (~10–15 hrs evenings/weekends): **realistically $150–$350/week, irregular.**
- This is **supplemental income + a learning ground**, not a second salary.

---

## Open / next actions

1. **Start Roadie signup** + knock out a **$20–40 OSHA Bloodborne Pathogens cert** and **basic HIPAA training** (these unlock the better-paying medical gigs; MedZoomer requires HIPAA anyway).
2. **Call his auto insurer** — confirm he's covered while delivering for pay, or get a small delivery endorsement. (The one real gotcha.)
3. Add MedZoomer next (Philly-specific medical).
4. Open question for later: **is his dad actually available/willing to drive a steady route?** That determines whether the "real business" version (Option 2) is ever on the table.

---

## If he later wants to scale up (context, not active)

The fuller analysis lives in the PR docs:
- `01-verdict-and-risks.md` — GO-with-conditions verdict, risks, regulatory cheat-sheet
- `02-the-plan.md` — sub-for-a-prime wedge, compliance/insurance/training/pricing
- `03-target-list.md` — local primes to sub for (Capstone–Boothwyn, MedLab–Aston, carGO), who to avoid
- `04-artifacts.md` — service one-pager, sub pitch, onboarding checklist, ops SOP
- `05-board-review.md` — CFO/CISO GO-KILL gate

Short version of that path: sub for a local prime (driver in the seat) → land one recurring LTC-pharmacy route → only then stand up his own insured company. Real money needs **3–4 routes** on the same fixed cost base. Skip controlled substances and direct-to-hospital/lab at launch.

---

## Housekeeping

- All work lives on branch `claude/medical-courier-launch-p7i4ze`, **draft PR #2** (khogali/khogali.github.io). PR base branch is `calc`.
- A PR webhook subscription is active (just Netlify deploy-preview noise; all green; no action).
- The `c-suite-board` skill the user referenced is **not installed** in this environment — the board review in `05` was done manually.
