# matthewvandoff.com

Three versions of https://matthewvandoff.com. We are working on v3.

- `matthewvandoff.com-v3/`: the active site. The Astro app is in `app/` (run `pnpm` commands there); `design/` holds the frozen Warm Terminal board and handoff note.
- `matthewvandoff.com-v1/`, `matthewvandoff.com-v2/`: old versions, reference only. Each is its own git repo, ignored by this one. Don't edit them.
- Docs, issues and agent config live at the repo root: `docs/`, `GLOSSARY.md`, `.beads/`, `.claude/`.
- `agents/`: scratch space for agents, git-ignored. One folder per bead (`agents/mvd-<id>/`) or `agents/adhoc/YYYY-MM-DD-<slug>/`. See `agents/README.md`.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

Issues are tracked with `bd` (beads). A SessionStart hook runs `bd prime` for workflow context; run it yourself if that context is missing.
<!-- END BEADS INTEGRATION -->

## Agent skills

### Issue tracker

Issues are tracked in beads (`bd`), stored locally in `.beads/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, applied as beads labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
