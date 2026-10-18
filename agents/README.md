# agents/

Scratch space for agents. Everything here except this README is git-ignored.

## Layout

- `mvd-<id>/`: work for one bead, named by its full ID (e.g. `mvd-pc7.2/`). Flat, no nesting by epic.
- `adhoc/YYYY-MM-DD-<slug>/`: work with no bead.

## Rules

- Put probes, throwaway scripts, raw output, drafts and notes here, never in a site folder.
- Anything worth keeping gets promoted: decisions to `docs/adr/`, specs to the bead, findings to a `bd comment`. Don't rely on files here surviving.
- Scripts here that need the v3 last.fm key use `--env-file=../../matthewvandoff.com-v3/app/.env` (adjust depth for `adhoc/`).
