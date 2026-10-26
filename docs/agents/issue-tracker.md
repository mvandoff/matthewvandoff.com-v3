# Issue tracker: Beads

Issues and specs live in beads (`bd`), a local Dolt-backed tracker in `.beads/`. Use the `bd` CLI for every operation and pass `--json` when parsing output. IDs look like `mvd-a3f2dd`.

## Conventions

- **Create**: `bd create "<title>" -t <type> -p <0-4> --body-file - --json` with a heredoc body. Always include a description. Types: `feature`, `bug`, `task`, `chore`, `epic`.
- **Read**: `bd show <id> --json`; comments via `bd comments <id> --json`.
- **List**: `bd list --status open --json`, filtered with `--label`, `--type`, `--parent`.
- **Sub-issue**: `--parent <id>` on create, or `bd update <child> --parent <id>`.
- **Blocking**: `--deps blocked-by:<id>` on create, or `bd dep add <blocked> <blocker>`. `bd ready` lists open issues with no open blockers.
- **Comment**: `bd comment <id> --stdin` with a heredoc.
- **Labels**: `bd update <id> --add-label <l>` / `--remove-label <l>`. Labels need no creation.
- **Claim**: `bd update <id> --claim` (assigns you, sets `in_progress`).
- **Close**: `bd close <id> --reason "<summary + commit sha>"`.

## Specs and tickets

- A **spec** is an `epic` whose description is the spec body.
- **Tickets** are children of the spec epic (`--parent <epic>`), created blockers-first so `--deps blocked-by:` can reference real IDs.
- Triage **category** maps to the beads type: `bug` → `bug`, `enhancement` → `feature` (`bd update <id> -t feature`).
- ADRs live in `docs/adr/`, not as beads `decision` issues.

## How work closes

The remote is GitHub, `mvandoff/matthewvandoff.com-v3`. A push to `main` runs the tests and deploys the site (`.github/workflows/deploy.yml`), so push only work that's ready to go live. There are still no PRs: work closes with `bd close` once it's on `main`. **PRs as a request surface: no.**

## Sync

Beads commits every write to its own Dolt history, so don't hand-commit beads data. There's no Dolt remote yet; skip `bd dolt push` until one exists.

## When a skill says "publish to the issue tracker"

Create a beads issue (an `epic` for a spec).

## When a skill says "fetch the relevant ticket"

`bd show <id> --json`.

## Wayfinding operations

- **Map**: an `epic` labelled `wayfinder:map`; its description holds Notes / Decisions-so-far / Fog.
- **Child ticket**: `bd create ... --parent <map> --labels wayfinder:<type>`.
- **Blocking**: as above.
- **Frontier**: `bd ready --parent <map> --unassigned --sort oldest --json`; first wins.
- **Claim**: `bd update <id> --claim`.
- **Resolve**: `bd comment` the answer, `bd close`, then append a pointer to the map's Decisions-so-far.
