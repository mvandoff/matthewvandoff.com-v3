# mvd-034.11 Fidelity sign-off: motion pass

Method: Playwright, site (astro preview of a fresh build) vs board (design/reference via page.route), same paused fake clock, Math.random fixed, CSS animations/transitions seeked to matching times. Side-by-side contact sheets (left site, right board) at 1440 and 390 were reviewed for every scene; every sheet was looked at. The contact sheets and the script were scratch artefacts and are not kept in the repo.

## Per effect
- Boot (0-3.2s, 8 frames): Matches at 1440 and 390 (panels, accent line, caption, handover to the page, name glitch settling).
- Name glitch (idle) and split hover: Matches (1440; glitch frames 0-1.5s, hover +0-800ms, crosshair appears identically). 390 matches (no hover).
- Lock-on (about Cel): Matches (bracket + "found ~/about" tag appear at 650ms, hold, gone by 2.25s; same box and colours). 390 sheet checked, same.
- Terminal expansion (help, top, np, accent usage): Matches at 1440 (expand over the Name card, fade of the name card at +150ms, rows and bars) and at 390 (grows in place, no upward expansion). Only differences are data (site's mock music labels vs the board's), as agreed.
- Scramble (github hover, 0-20 ticks of 34ms): Matches frame for frame.
- Crosshair / HUD (1440 only): Matches (lines, square, HUD digits, over-Cel dot grid and outline, lift/scroll state).
- Reveals (about/experience/links, rule drawing): Matches.
- Accent change (accent 20, #6aa0ff, reset): Matches (header, tagline, field wash, Terminal outline, HUD).
Drift found: none in the motion pass. (Apparent differences in first captures, Terminal focus outline and HUD at "before", were un-seeked real-time transitions; computed styles at 390 and 1440 after settling are identical.)

## Clean install
Fresh `git clone -b warm-terminal` into a scratch directory: `pnpm install --frozen-lockfile`, `pnpm check` (0 errors, 0 warnings, 1 hint), `pnpm build`, `pnpm test` (vitest + 116 Playwright incl. both design diffs at 1440/390): all pass.

## Flakiness (mvd-034.12)
`--repeat-each=3` (348 runs) was green before any change, but 14-16 workers on the 10-core machine exposed real nondeterminism. Fixed in 7faa4c7 (tests only, no tolerances changed, no retries):
- design/pointer.spec: `scrollTo` poll jumped to the bottom once; late font loads changed the page height and `--sp` never reached 0.99 (the reduced-motion test timeout in the ticket). Now re-jumps on every poll.
- design/navigation.spec: "revealing experience" read running transitions in real time and raced their end; now recorded from `transitionrun`.
- e2e/clock.spec: the fake clock ran on in real time; now paused with `pauseAt`.
- e2e/navigation.spec: Lock-on 1.6s window asserted in real time and via `:visible` on a real-time CSS animation; now driven by the paused clock and the `hidden` attribute.
- playwright.config: timeout 90s, expect timeout 15s (design specs drive two pages through long flows; slow runs timed out at 30s).
Result: 3 consecutive full runs at 14 workers 116/116, then `--repeat-each=3` 348/348, `pnpm test` 116/116.

## Accessibility checks
- No-JS (1440 screenshot): full page renders, Sections visible, rules drawn, Terminal static. tests/e2e/no-js passes.
- Tab order: [ mvd ], Terminal input, 02 about, 03 experience, 04 links, github, linkedin, back to top, then wraps. Links/Cels show a 1px solid Accent outline (offset 4px). The Terminal input has no outline of its own; the Terminal box takes the Accent border on focus (same as the board), which is the visible indicator.
- aria-hidden on decorative elements (boot, field, crosshair/HUD, kana, lock parts, hover washes, rules, ghost names, arrows, cursor). aria-live=polite on the Terminal body and the header prompt. The fish and shades ASCII art are role=img with an aria-label (deliberate).
- Network: zero requests to Google Fonts or any non-local origin.

## Follow-ups
- None required. Optional: `astro check` reports 1 hint (pre-existing, not an error).
- Optional: the board is the only side loading Google Fonts, so design specs depend on network speed; a local font fixture for the board route would remove that residual variable.
