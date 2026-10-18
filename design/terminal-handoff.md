# Terminal handoff note

Copied verbatim from the sticky note beside the Warm Terminal board on the design canvas.

```text
TERMINAL · 01b box — dev handoff

WHERE
Warm Terminal board, the 01b box under the name card. It appears when the "fill" tweak is set to now. Clicking anywhere in the box focuses the input.

IDLE STATE
Header: 01b · ~/now $ cat status.txt
Body: building → Insight @ Cyncly (hard-coded). listening → current or last track. While playing, a 4-bar EQ animates in front of it. When not playing, " · 2h ago" is appended. The "listening" tweak switches between the two.
Input: "~/now $" with a blinking block cursor, hidden on focus or once typing starts. Hint on the right reads "try help", and "esc · close" while output is showing.

COMMANDS (case-insensitive)
help / ? — lists the commands
top [artists|tracks|albums] [--week|--month|--year|--all] — top 10 with bar chart. Defaults to artists over 12 months (--year is the same as the default).
np — now playing, or last played
recent — last 10 tracks with times
ls — prints about/  experience/  links/
cd <about|experience|links|home|..> — smooth-scrolls to that section. Trailing / and leading ~/ are accepted. Unknown name → "cd: no such section".
accent <value> — recolors the whole site. Accepts any CSS color, a hue 0–360, peach | teal | lilac | gold, random, or reset. Any color is re-tuned to the palette's lightness and chroma (OKLCH L 0.78, C 0.08); grays become a warm neutral. With no value it prints the current accent.
whoami — name + tagline
date — visitor's local date and time
clear (also cls, exit, status, cat) — back to the idle status
sudo — joke reply
anything else — "command not found: x · try help"

KEYS
Enter — run
Tab — complete the command, then its arguments (top, cd, accent). Several matches: completes the shared prefix, or lists the options.
↑ / ↓ — history (last 30, repeated back-to-back commands stored once)
Esc — clear output and input, blur

LAYOUT
Large output (help, top, np, recent) expands the box upward over the name card on desktop (wider than 760px) and bumps text to 13px / 1.8. Small output (ls, cd, accent, whoami, date, errors) stays in the box.
The header shows the command that ran, plus a meta line on the right for data output (e.g. "top artists · 12 months").
Output scrolls inside the box and resets to the top on each run. The body is aria-live=polite.
Mobile (760px and under): no expand, input is 16px so iOS doesn't zoom, hint is hidden.

TO WIRE UP
• last.fm: top, np, recent and the status line are mock data (artist.01, [track title]…). Map to user.gettopartists / gettoptracks / gettopalbums (period 7day, 1month, 12month, overall) and user.getrecenttracks (its nowplaying flag drives the EQ and np). Keep the API key server-side behind a proxy.
• The accent override lives only in component state and resets on reload. Decide whether it should persist (e.g. localStorage).
• "building" text is static; decide if it should come from content.
```
