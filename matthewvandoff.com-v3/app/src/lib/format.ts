/** Small text formatters shared by the clock, the HUD, the Terminal and the content module. */

/** A non-negative integer left-padded with zeros: `zeroPad(3)` = "03". */
export const zeroPad = (n: number, width = 2): string => String(n).padStart(width, '0');
