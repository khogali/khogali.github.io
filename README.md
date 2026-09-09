# khogali.github.io

Personal GitHub Pages repository for **Ahmed Khogali**.

A repo named `<user>.github.io` is a GitHub Pages *user site*: GitHub serves it at
`https://khogali.github.io/` from a single configured branch. Nothing else in the
repo is published.

## Current status

The site is **not serving anything**. `https://khogali.github.io/` returns 404,
because the configured branch holds no files — the previous site's files were
deleted in December 2024 and nothing replaced them.

This is intentional for now. The repo is being kept as a clean personal site
repo; the landing page will be added later.

## Branches

| Branch | What it holds |
| --- | --- |
| `calc` | Default branch. Empty — this is what Pages currently serves. |
| `css` | Last working version of the old "T-Mobile Sidekick" plan calculator (static HTML/CSS/JS with a service worker). Kept for reference. |
| `adstack-main` | Unrelated project: ad-stack tooling, skills and keyword research. Parked here; belongs in its own repo. |
| `claude/medical-courier-launch-*` | Unrelated project: medical courier launch documents. Parked here; belongs in its own repo. |
| `claude/llms-passwords-sensitive-data-*` | Unrelated project: a single spec document. Parked here; belongs in its own repo. |

The tags `AAL`, `new`, `testup`, `update` and `webapp` are older snapshots of the
same calculator app that `css` holds. They are kept only so the history stays
reachable.

## Publishing again

To bring the site back:

1. Add an `index.html` (plus any assets) to the branch Pages is configured to
   serve.
2. Push. GitHub Pages rebuilds within a minute or two.

No build step, no framework, no dependencies — this is a plain static site.

## Housekeeping still to do

These need repository settings changes, which cannot be made in a commit:

- **Rename the default branch.** It is currently `calc`, a leftover name from the
  calculator app. `main` is the conventional name for a personal site repo.
  Settings → Branches → rename.
- **Confirm the Pages source.** Settings → Pages should point at the default
  branch, root (`/`).
- **Move the three unrelated projects** to their own repositories, then delete
  those branches here.
