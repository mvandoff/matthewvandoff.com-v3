/** The Name card's live clock: "wed 14 oct 2026 · 09:30:05", or "09:30:05" short. */

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatStamp(d: Date): string {
  return `${DAYS[d.getDay()]} ${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${formatTime(d)}`;
}

/** Fills every [data-clock] element now, then on each second boundary. */
export function startClock(root: ParentNode = document): void {
  const long = [...root.querySelectorAll<HTMLElement>('[data-clock="long"]')];
  const short = [...root.querySelectorAll<HTMLElement>('[data-clock="short"]')];
  if (!long.length && !short.length) return;

  const tick = () => {
    const now = new Date();
    for (const el of long) el.textContent = formatStamp(now);
    for (const el of short) el.textContent = formatTime(now);
    setTimeout(tick, 1000 - (now.getTime() % 1000));
  };
  tick();
}
