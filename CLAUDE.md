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

## Shipping from the NAS host

The site goes live when a commit lands on GitHub's `main`: GitHub runs the checks and deploys only if they pass. A session on the NAS host (CC-NAS) ships a change Matthew asks for: it's done when it's live. Pushing means pushing to `main`; a worktree branch on GitHub ships nothing.

1. In `app/`: `pnpm install --frozen-lockfile`, then `pnpm check` and `pnpm build`. Both pass before you push. GitHub runs the end-to-end tests and Lighthouse.
2. Tell Matthew exactly what changes, old to new. GitHub's checks catch breakage, but a wrong price passes once its test changes to match, so this line is his check.
3. `git fetch origin && git rebase origin/main && git push origin HEAD:main`, fast-forward only. If the push is refused because `main` moved, rebase and push again.
4. Watch the run for your commit: `gh run list --commit <sha>`, then `gh run watch <id> --exit-status`. Live means the Deploy run passed.
5. Push Matthew that it's live, with what changed, old to new, and that undoing it is one revert. When the checks fail, nothing deployed: fix it and ship again, or push him that it didn't go live and why.

GitHub refuses a push that touches `.github/workflows/`: the login there can't change what the checks are or how the site deploys. Leave that to Matthew on the Mac.
