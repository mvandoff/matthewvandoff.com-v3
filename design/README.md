# Design reference

This is a frozen copy of the **Warm Terminal** board from the claude.ai Design canvas *matthew van doff — portfolio* (https://claude.ai/artifact/X5Jwhwuai4DM4m3sXHk9V7), taken on 2026-10-14. v3 was built from it, and agents use it because they can't open the canvas. The site has moved on since, in content and elsewhere, and no tests compare against it: where the two differ, the site wins.

- `reference/warm-terminal.html` is the board's source, unchanged except that the Gridular font URL points at the local copy.
- `reference/support.js` is the canvas's Design Component runtime (it bundles React). The board loads it by that name.
- `reference/fonts/Gridular-Regular.woff2` is the display font. It's the same file the site self-hosts.
- `terminal-handoff.md` is the canvas's dev-handoff note for the Terminal, copied word for word.

## Rendering it

Open `reference/warm-terminal.html` over HTTP, not `file://`. The runtime applies the board's declared tweak defaults, so the render matches what the canvas shows.

All Google Fonts on the board except Gridular still load from the network. Sections fade in only after they have been scrolled into view once, so scroll through the page before taking a full-page capture.

Don't import anything from here into `app/`. It's a reference only and is never shipped.
