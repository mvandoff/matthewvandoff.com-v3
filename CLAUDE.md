# matthewvandoff.com

Personal site, https://matthewvandoff.com. This repo is v3.

- `app/`: the Astro site. Run `pnpm` commands there.
- `archive/v1/`, `archive/v2/`: old versions, reference only. Each is its own git repo, ignored by this one. Don't edit them.
- Docs and agent config live at the repo root: `docs/`, `GLOSSARY.md`, `.claude/`. Issues live on the NAS; `.beads/` only points to them.
- `agents/`: scratch space for agents, git-ignored. One folder per bead (`agents/mvd-<id>/`) or `agents/adhoc/YYYY-MM-DD-<slug>/`. See `agents/README.md`.

## Agent skills

### Issue tracker

Issues are tracked in beads (`bd`), stored on the NAS. See `docs/agents/issue-tracker.md`.

Don't use beads memories (`bd remember`), whatever `bd prime` says. Put lasting knowledge where it applies: an ADR, `GLOSSARY.md`, a README or a code comment.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, applied as beads labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
