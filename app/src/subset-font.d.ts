// subset-font ships without types; this covers the options scripts/build-fonts.ts uses.
declare module 'subset-font' {
  interface SubsetFontOptions {
    targetFormat?: 'sfnt' | 'woff' | 'woff2';
    variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
  }
  export default function subsetFont(
    buffer: Buffer,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Buffer>;
}
