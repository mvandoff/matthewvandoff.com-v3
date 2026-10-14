# Spec: Warm Terminal, implemented locally

**Status:** ready for implementation
**Tracking:** beads epic `mvd-034` (`bd show mvd-034`)
**Design source:** the "Warm Terminal" board on the claude.ai Design canvas *matthew van doff — portfolio* (https://claude.ai/artifact/X5Jwhwuai4DM4m3sXHk9V7). The other boards on that canvas ("a · faded crt v2" and "a · transition storyboard") are out of scope.
**Vocabulary:** terms in **bold capitals** are defined in [`GLOSSARY.md`](../../GLOSSARY.md).

## Problem Statement

The live matthewvandoff.com is the v2 site: a GSAP, three.js and Vanta build with a work page and a résumé. Matthew has since designed a new direction, "Warm Terminal", on a Claude Design canvas. It's a single dark, terminal-flavoured page with a live clock, a typeable Terminal, glitch type, a Crosshair HUD and a mono teal Accent. The canvas is a prototype only: it runs in the canvas runtime, has around 20 design-time tweaks, mixes alternative directions, and can't be built, tested or shipped as is. Matthew wants the design turned into a real Astro + TypeScript + native CSS codebase that runs locally and matches the design closely, so that deploying it later is a separate, small step.

## Solution

A new Astro site in `app/` that faithfully reproduces the Warm Terminal board:

- One page made of the **Strip** and three **Sections** (about, experience, links), plus a footer.
- A minimal 404 page in the same style.
- The design-time tweaks are frozen at the values the canvas currently shows. Every unchosen variant is deleted.
- Interactivity is written in vanilla TypeScript with no UI framework.
- The **Terminal** works fully, reading music data from a mock source behind a typed interface so that real last.fm data can be dropped in later.
- The visitor's chosen **Accent** persists across reloads and is applied before first paint.
- The page reads fully without JavaScript.
- A Playwright harness checks the build against reference captures of the design at desktop and phone widths.
- Copy stays as designed, including the lorem ipsum about paragraphs, but lives in one typed content module so it can be edited later.

## User Stories

### Arriving

1. As a visitor, I want to see a short **Boot** animation on every page load, a CRT-style line that opens the screen, so that the site feels like a machine powering on.
2. As a visitor, I want the name "matthew van doff" to glitch into place with two Accent-coloured ghost copies after the Boot, so that the name card has a memorable entrance.
3. As a visitor, I want the **Name card** to show a live clock (day, date, month, year, hh:mm:ss) ticking every second, so that the page feels live.
4. As a visitor on a narrow screen, I want the clock to shorten to hh:mm:ss, so that it fits.
5. As a visitor, I want to see the tagline "software developer · for the information superhighway", so that I immediately know what Matthew does.
6. As a visitor, I want a small ASCII animation in the Name card, randomly either a swimming fish or a kaomoji putting on sunglasses, so that there is a small surprise on each visit.
7. As a visitor, I want the vertical katakana of Matthew's name on the Name card, so that the Japanese-terminal motif reads clearly.
8. As a visitor, I want slowly drifting Accent-tinted blobs behind the Name card and a faint background field that shifts with scroll and cursor, so that the page has depth without being busy.

### Hovering and pointing

9. As a visitor with a mouse, I want faint Crosshair lines that follow my cursor, and a HUD in the corner showing x/y coordinates, rulers and a mini-map with my scroll position, so that the page feels like an instrument.
10. As a visitor with a mouse, I want the Crosshair's centre square to grow when I'm over something clickable, so that I get extra affordance.
11. As a touch-screen visitor, I want no Crosshair at all, so that nothing is stuck on screen.
12. As a visitor, I want the name's ghost copies to split further apart when I hover the name, so that it reacts to me.
13. As a visitor, I want the github and linkedin link text to scramble through glyphs and resolve when I hover or focus them, so that links feel alive.
14. As a visitor, I want navigation **Cels** to show a dotted Accent wash, an Accent border and an Accent label on hover or focus, so that it's clear they are links.

### Navigating

15. As a visitor, I want three Cels in the Strip labelled 02 about, 03 experience and 04 links, each with its Japanese label, so that I can jump to a **Section**.
16. As a visitor, I want clicking a Cel to smooth-scroll to its Section, followed by a brief **Lock-on** bracket around that Section's heading reading "found ~/about" (and so on), so that I can see where I landed.
17. As a visitor, I want the sticky header to show `[ mvd ]` and a prompt `~/<current section> $` that updates as I scroll, so that I always know where I am.
18. As a visitor, I want a thin Accent progress line under the header that fills as I scroll, and the header border to appear once I've scrolled, so that I can see my position.
19. As a visitor, I want `[ mvd ]` and the footer's `[ back to top ↑ ]` to scroll me back to the top, so that I can return home.
20. As a visitor, I want each Section to fade and rise into view as I reach it, with its heading rule drawing across in Accent, so that the scroll has rhythm.
21. As a visitor arriving with a `#about`, `#experience` or `#links` hash, I want to land at that Section, so that shared links work.

### Reading

22. As a visitor, I want the about Section to show the heading "hey, i'm matthew, a human software developer, one of the last of my kind." with the last clause in Accent, followed by two body paragraphs, so that I get a sense of who Matthew is.
23. As a visitor, I want the experience Section to list three **Episodes**, newest first, each showing its episode number, years, role, company and a description, so that I can scan Matthew's career like an episode guide.
24. As a visitor, I want an Episode row to tint and its title to turn Accent on hover, so that the list feels responsive.
25. As a visitor, I want the links Section to show large github ↗ and linkedin ↗ links pointing to Matthew's real profiles, so that I can find him elsewhere.
26. As a visitor, I want a footer with "© \<current year\> matthew van doff", "(>'.')> thanks for stopping by" and back-to-top, so that the page ends warmly.

### Using the Terminal

27. As a visitor, I want the Terminal to show an idle status, `~/now $ cat status.txt` with "building → Insight @ Cyncly" and "listening → \<last track\> · 2h ago", so that I see what Matthew is up to without typing.
28. As a visitor, I want clicking anywhere in the Terminal to focus its input, so that I don't have to aim for a small field.
29. As a visitor, I want a blinking block cursor and a "try help" hint when the input is idle, so that I know I can type.
30. As a visitor, I want `help` (or `?`) to list the available commands, so that I can discover them.
31. As a visitor, I want `top`, with optional `artists`/`tracks`/`albums` and `--week`/`--month`/`--year`/`--all`, to show a top-10 list with bar charts and a meta line such as "top artists · 12 months · mock data", so that I can see Matthew's listening habits.
32. As a visitor, I want `np` to show now playing, or the last played track, and `recent` to show the last 10 tracks with relative times, so that I can see what he listened to recently.
33. As a visitor, I want `ls` to list `about/ experience/ links/`, and `cd <section>` to scroll to that Section with Lock-on, so that I can navigate like in a shell.
34. As a visitor, I want `cd` to accept `home`, `..`, a trailing `/` and a leading `~/`, and to reply "cd: no such section: x" for unknown names, so that it behaves like a real shell.
35. As a visitor, I want `accent <value>` to recolour the whole site. It should accept any CSS colour, a hue from 0 to 360, `peach`/`teal`/`lilac`/`gold`, `random` or `reset`, so that I can make the site mine.
36. As a visitor, I want any colour I give `accent` re-tuned to the palette's lightness and chroma, with grays becoming a warm neutral, so that the site always stays legible and on-brand.
37. As a visitor, I want `accent` with no value to print the current Accent and usage, and invalid input to explain what's accepted, so that I can learn the command.
38. As a returning visitor, I want my chosen Accent to persist across reloads with no flash of the default teal, so that my choice sticks.
39. As a visitor, I want `whoami`, `date` and `sudo` (with a joke reply), plus `clear`, `cls`, `exit`, `status` and `cat` to return to the idle status, so that the Terminal rewards curiosity.
40. As a visitor, I want unknown commands to reply "command not found: x · try help", so that I'm never stuck.
41. As a visitor, I want Tab to complete commands and their arguments (for `top`, `cd` and `accent`). With several matches it should complete the shared prefix or list the options, so that typing is fast.
42. As a visitor, I want ↑/↓ to recall my last 30 commands, with back-to-back repeats stored once, so that I can re-run things.
43. As a visitor, I want Esc to clear the output and input and blur the Terminal, so that I can dismiss it.
44. As a desktop visitor, I want large output (`help`, `top`, `np`, `recent`) to expand the Terminal upward over the Name card with larger text, while small output stays in place, so that rich output has room.
45. As a visitor, I want the Terminal header to echo the command that ran and the output to scroll inside the box, resetting to the top on each run, so that it reads like a real terminal.

### Phone visitors

46. As a phone visitor, I want the Strip to stack vertically: Name card, then the Cels as full-width rows with a → arrow, then the Terminal, so that it works in one column.
47. As a phone visitor, I want the name to scale down to fit, and the katakana, prompt and Terminal hint to be hidden, so that nothing overflows.
48. As a phone visitor, I want the Terminal input at 16px so iOS doesn't zoom, and no upward expansion, so that typing is comfortable.
49. As a phone visitor, I want body copy in about and experience set in Geist at 15px with roomier spacing, and Episodes reflowed into a number/years row with the title and description below, so that long text is readable.

### Accessibility and resilience

50. As a visitor who prefers reduced motion, I want the Boot, glitch, Crosshair, drifting blobs, reveals, Lock-on, scramble and all looping animations turned off, so that the page is calm.
51. As a keyboard user, I want every link, Cel and the Terminal input reachable by Tab, with a visible 1px Accent focus outline, so that I can use the site without a mouse.
52. As a screen-reader user, I want decorative elements (ghost names, katakana, scope, Crosshair, blobs, kaomoji frames) hidden, ASCII art given text alternatives, and Terminal output announced politely, so that the page makes sense aloud.
53. As a visitor without JavaScript, I want every Section fully visible and the Cels working as plain anchor links, with the Terminal showing its idle status, so that the content is never hidden behind script.
54. As a visitor who mistypes a URL, I want a 404 page in the same style saying `cd: no such page: /<path>` with a `[ back home ]` link, so that I can recover.

### Owner and developer

55. As Matthew, I want all copy (tagline, building line, about heading and paragraphs, Episodes, link URLs, footer lines) in one typed content module, so that I can edit text without touching layout.
56. As Matthew, I want the music data behind a typed interface with a mock implementation, so that wiring real last.fm later doesn't change the Terminal.
57. As a developer, I want to run the site locally with one pnpm command and build it with another, so that the workflow is simple.
58. As a developer, I want a test command that checks the built page against the design at 1440px and 390px, so that drift from the design is caught.
59. As a developer, I want the Terminal's command behaviour covered by fast unit tests, so that I can change commands with confidence.
60. As a developer, I want fonts self-hosted with no third-party font requests, so that the site is fast and private.

## Implementation Decisions

### Scope and fidelity

- The Warm Terminal board is the only source. "faded crt v2" and the envelop transition from the transition storyboard are not built. The board's unused `run()` transition code is dropped.
- Tweaks were for design only. They are frozen at the values the canvas currently shows (the declared defaults on the board, not the fallbacks inside its code):
  - Accent `#8fb3ad` (teal), mono palette, so the second and third colours equal the Accent.
  - Display font Gridular; headings use the display font; body is Martian Mono.
  - Terminal fill "now"; listening state "last played".
  - Katakana on; ghost strength 1, giving a ghost opacity of 0.55.
  - Name intro "glitch"; name hover "split".
  - Section header order "number first".
  - Motion feel "smooth"; Boot on; Crosshair on.
  - Field 0.7; Name card blob saturation 0.65 and opacity 0.2; corners off.
  - Grain overlay 0, so it is removed entirely. The separate Name card grain texture stays.
  - Marquee off, so it is removed. Footer centred.
- Deleted variants: the scope, photo, seigaiha, asanoha and shippo fills; the alternative fonts (Tektur, Doto, Major Mono Display); the slice and color name hovers and the "rise" intro; "title first" headers; the marquee and its kaomoji; the Name card corner brackets; the unused links dropdown menu.
- Kept randomness: the fish/shades ASCII coin flip on each load.
- The Boot plays on every page load, not once per session, as designed.
- Dark only, with no light theme and no response to the visitor's colour-scheme preference.

### Structure

- One Astro project in `app/`, using pnpm, Node 24, the current stable Astro and strict TypeScript.
- Routes: `/` (the page) and a 404 page. The directory-style output format is kept.
- Styling is native CSS: custom properties for the design tokens (ground colours, ink colours, rule colours, Accent, second and third colours, font stacks), component-scoped styles, and one global sheet for page basics, keyframes and the responsive and reduced-motion rules. The design's breakpoints are preserved exactly: 760px for phone, 900px for the Episode reflow, and hover/fine-pointer for the Crosshair.
- The page is composed from Astro components that mirror the glossary: page shell and header, Strip, Name card, Terminal, Cel, Section heading, the about, experience and links Sections, Episode, footer, Boot, Crosshair and background field.

### Modules

- **Content module.** A typed, static source for every piece of copy:
  - name and tagline
  - the "building" line
  - the about heading, with its Accent clause marked
  - about paragraphs (lorem ipsum, kept as designed)
  - Episodes (number, years, role, company, description, verbatim from the design)
  - link labels and URLs: github.com/mvandoff and linkedin.com/in/matthew-vandoff
  - footer lines

  Components read only from this module.
- **Music source.** A small typed interface with three async queries:
  - top items by kind (artists, tracks, albums) and period (week, month, year, all)
  - the now-playing or last-played track, with a playing flag and a relative time
  - the recent tracks

  The only implementation is a mock that reproduces the design's placeholder data exactly, including its per-period scaling. Results say whether they are mock, which drives the "· mock data" meta labels.
- **Terminal command module (pure).** Holds all Terminal behaviour, with no DOM access. It provides:
  - **Execute:** takes the raw input plus context (the current Accent and the music source) and returns a result describing:
    - the output, as styled text lines and/or ranked bar rows
    - the header command echo
    - the meta label
    - whether the output is large (expands the Terminal on desktop) or small
    - any effects to apply: scroll to a Section, set the Accent, clear the Accent, or return to idle

    It is async because the music source is.
  - **Complete:** takes the current input value and returns either a replacement value or a list of options. It covers commands, then arguments for `top`, `cd` and `accent`, with shared-prefix completion.
  - **History:** keeps the last 30 commands, stores back-to-back repeats once, and supports ↑/↓ navigation that ends on an empty input.
  - **Accent tuning:** turns any input into an Accent hex. It accepts the four named presets, `random`, a bare hue (0–360, optional `deg`), bare 3- or 6-digit hex, and any CSS colour. It re-tunes the result to OKLCH L 0.78 and C 0.08, reducing chroma until the colour is in gamut. Grays (C < 0.02) become the warm neutral (L 0.8, C 0.012, H 80). Invalid input is reported as such. Parsing an arbitrary CSS colour requires the browser, so that one capability is injected rather than imported.

  Commands are matched case-insensitively. The command set, wording and output formats are exactly as written on the board and in the canvas's Terminal handoff note.
- **Terminal controller.** The browser wiring, which:
  - focuses the input when the Terminal is clicked (unless text is selected)
  - handles the keys: Enter runs, Tab completes, ↑/↓ recalls, Esc clears and blurs
  - renders results into the Terminal body, resets its scroll and toggles the desktop expansion
  - shows or hides the cursor and the hint
  - applies effects through the Accent store and the scroll-and-lock helper
- **Accent store.** Reads and writes the visitor's Accent override in localStorage, guarding every read and write so that failures fall back to the default. It sets the Accent custom properties on the root. A tiny inline script in the document head applies a stored override before first paint, so there's no flash of teal.
- **Motion controller.** All non-Terminal page behaviour:
  - Boot and name-intro timing
  - the live clock
  - scroll tracking for the current Section in the header prompt, the progress line, the header border, the field and the HUD lift near the footer
  - reveal-on-scroll, which only activates once JavaScript runs
  - smooth-scroll plus Lock-on for Cels, `[ mvd ]`, back-to-top and `cd`
  - Crosshair and HUD pointer tracking via root custom properties
  - the github and linkedin scramble on hover and focus
  - the ASCII coin flip

  Everything is skipped or short-circuited under reduced motion, matching the design's rules.

### Fonts

- Self-hosted woff2 only, with no Google Fonts requests:
  - Gridular, reused from the v2 site. Matthew has confirmed web use is licensed.
  - Martian Mono, as a variable font at the weights used.
  - DotGothic16, subset to exactly the glyphs it renders: the katakana and kanji labels plus the Latin `ep.` and digits of the Episode numbers. A test fails if any text set in DotGothic16 contains a glyph missing from the subset, so editing that copy can't silently fall back to a system font.
  - Geist, Latin subset at weight 400 only, used just for phone body copy. It is not preloaded, so desktop visitors never download it.
- Gridular and Martian Mono are preloaded. Every font uses `font-display: swap`.

### Head

- Title `matthew van doff`, a one-line meta description from the tagline, and v2's `favicon.svg`. Open Graph and other social tags wait for deployment.

### 404 page

- The header bar, one line `cd: no such page: /<path>` with the path filled in at runtime (falling back to a generic line without JS), and a `[ back home ]` link, in the same tokens and Accent.

## Testing Decisions

- **What makes a good test here:** tests exercise only external behaviour, either what a visitor sees and does in a browser or what the Terminal command module returns for a given input. They never assert on internal state, component structure or CSS class names beyond what's needed to locate an element.
- **Seam 1, primary: the built page in a real browser.** Playwright runs against a preview of the production build.
  - **Behaviour tests:**
    - typing commands and reading the Terminal output
    - Tab completion and ↑/↓ history
    - Esc
    - `cd` scrolling to a Section with Lock-on
    - `accent` recolouring the page, surviving a reload with no flash, and `reset` clearing it
    - Cels, `[ mvd ]` and back-to-top navigation
    - the header prompt tracking the current Section
    - the 404 page
    - the page with JavaScript disabled (all Sections visible, anchors work)
    - phone-width layout rules at 390px (stacking, hidden elements, 16px input)
    - reduced-motion behaviour
  - **Design-accuracy tests:** screenshot diffs of the full page at 1440px and 390px against reference captures of the Warm Terminal board. The references come from the copy of the board in [`design/reference/`](../../design/README.md), which runs on the canvas's own runtime. Playwright renders it without needing claude.ai, and the references are captured by a script and committed as baselines. Both sides use the same frozen state: animations and transitions at their end state, a fixed clock, a fixed ASCII coin flip, and the Crosshair and pointer effects hidden. The diff uses a tolerance tuned for font rasterisation differences. Computed-style spot-checks sit beside the diffs for key elements: font families, sizes, weights and letter-spacing for the name, Section headings, Episode titles, body text and Terminal text; ground, ink, rule and Accent colours; Strip height and Cel gaps; container max-width and gutters.
  - **Manual motion pass:** a documented manual check of the Boot, name glitch, Lock-on, Terminal expansion, scramble and Crosshair against the canvas, since timing is impractical to assert automatically.
- **Seam 2, narrow: the Terminal command module.** Vitest unit tests for the large input space only:
  - every command and alias
  - `top` kind and period combinations and their meta lines
  - `cd` path normalisation and unknown sections
  - completion (single match, shared prefix, option listing, argument completion)
  - history (cap, dedupe, navigation bounds)
  - Accent tuning (presets, hues, hex shorthand, named colours, grays, `random`, invalid input, gamut reduction)
- No other seams. The mock music source, Accent store, Motion controller and Terminal controller are covered only through these two.
- **Prior art:** none. The repo is greenfield, and neither v1 nor v2 had tests. `astro check` runs alongside the tests as a type gate.

## Out of Scope

- All deployment: S3 sync, CloudFront invalidation and cache headers, the apex-to-www setup, Route 53, CI and deploy credentials, and redirects for v2's `/work/` and `/resume.pdf`.
- Real last.fm data and the server-side proxy (Lambda) it needs.
- Analytics.
- Open Graph images and social tags, and a new favicon from the "MVD tag logo" canvas.
- Real about copy (lorem ipsum stays).
- A light theme.
- The "faded crt v2" direction, the envelop page transition, and every design tweak variant listed above as deleted.
- Work, projects or résumé content from v2.

## Further Notes

- The design board and the canvas's Terminal handoff note are copied into `design/` (see its README), so the work never needs claude.ai access. The handoff note is the authoritative description of Terminal behaviour, and the board's code matches it. Where the board's code falls back to different values than its declared tweak defaults, the declared defaults win, because they are what the canvas renders.
- For the later deployment spec, the current hosting is:
  - CloudFront `ERDW8C816CETB` serves `www.matthewvandoff.com` from the public S3 website bucket of the same name.
  - The apex 301s to www through a second distribution and an empty redirect bucket.
  - The wildcard ACM certificate auto-renews through a DNS CNAME that must stay.
  - Zoho mail records (MX, SPF, DKIM) must not be touched.
  - The bucket's error document `404.html` is currently missing.
  - There is no Cache-Control on objects, so a cutover needs an invalidation.
  - The current site was deployed by a manual sync. There's no CI or IaC.
