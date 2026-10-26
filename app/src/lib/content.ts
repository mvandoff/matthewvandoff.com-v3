/**
 * Content module: every piece of copy on the site lives here, typed and static.
 * Components read only from this module; edit text here, not in the layout.
 *
 * Japanese labels and Episode numbers are set in DotGothic16, which is subset to
 * exactly the glyphs it renders (see src/lib/fonts.ts). After editing any of them,
 * run `pnpm fonts` to regenerate the subset, or the font test fails.
 */

import { zeroPad } from './format.ts';

export type SectionId = 'about' | 'experience' | 'links';

export interface SectionCopy {
  id: SectionId;
  /** Two-digit index shown on the Cel and the Section heading, e.g. "02". */
  number: string;
  label: string;
  /** Japanese label, set in DotGothic16. */
  jp: string;
  /** Extra heading text hidden on phones, e.g. " · episode guide". */
  headingSuffix?: string;
}

export interface Episode {
  /** Episode number, newest first. Rendered as "ep.03". */
  number: number;
  years: string;
  role: string;
  company: string;
  /** The company's website; the company name links to it. */
  companyHref?: string;
  description: string;
}

export interface ExternalLink {
  label: string;
  href: string;
}

/** A run of running copy: plain text, or a link around its label. */
export type Inline = string | ExternalLink;

export const site = {
  meta: {
    title: 'matthew van doff',
    description: 'matthew van doff, software developer for the information superhighway.',
    /** The Open Graph / Twitter card image. `pnpm og` (scripts/og-image.ts) renders it from the Name card. */
    shareImage: {
      path: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'The name matthew van doff in pixel type on a dark terminal card, with the line software developer for the information superhighway.',
    },
  },

  header: {
    home: '[ mvd ]',
    /** The phone Section menu's accessible name (its button reads as the prompt). */
    menu: 'sections',
  },

  notFound: {
    title: 'not found · matthew van doff',
    /** The 404 card, laid out like the Name card. */
    prompt: '404 · ~/??? $ pwd',
    code: '404',
    /** Vertical Japanese label, set in DotGothic16: "page not found". */
    jp: 'ページが見つかりません',
    heading: 'page not found',
    tagline: 'it may have moved when the site was rebuilt',
    /** `bubble` floats up from the fish now and then. */
    fish: { art: '><(((º>', label: 'a little ascii fish, swimming in circles', bubble: '?' },
    /** The log box under the card. */
    logPrompt: '~/404 $ cat error.log',
    /** Shown as-is without JavaScript; the script appends `: /<path>`. */
    line: 'cd: no such page',
    /**
     * Old paths (v2's pages) and the Section that took their place. When the visitor's
     * path starts with one, the script adds a `try` line linking to that Section.
     */
    moved: [
      { from: '/work', to: 'experience' },
      { from: '/resume', to: 'experience' },
    ] satisfies readonly { from: string; to: SectionId }[],
    /** Followed by " <tryCommand><section>", e.g. "try: cd ~/experience". */
    tryPrefix: 'try:',
    tryCommand: 'cd ~/',
    back: '[ back home ]',
  },

  /** The caption under the Boot line. */
  boot: '~/home $ boot',

  nameCard: {
    prompt: '01 · ~/home $ whoami',
    /** The name as it breaks across the two display lines. */
    nameLines: ['matthew', 'van doff'],
    katakana: 'マシュー・ヴァン・ドフ',
    role: 'software developer',
    tagline: 'for the information superhighway',
    ascii: {
      fish: { art: '><(((º>', label: 'a little ascii fish swimming back and forth' },
      shades: {
        frames: ['( •_•)', '( •_•)>⌐■-■', '(⌐■_■)'],
        label: 'a kaomoji putting on sunglasses',
      },
    },
  },

  terminal: {
    /** Header line before the echoed command, e.g. "01b · ~/now $ cat status.txt". */
    prompt: '01b · ~/now $',
    idleCommand: 'cat status.txt',
    /** Shown in the header when there is no meta label. */
    jp: '現在',
    inputPrompt: '~/now $',
    inputLabel: 'terminal command, type help',
    hint: 'try help',
    /** Hint while command output is showing. */
    closeHint: 'esc · close',
    /** The album art in the header opens it full size; followed by its caption, e.g. "full size: Adjust Brightness — Bilal". */
    artOpen: 'full size:',
    artClose: '[ close ]',
    status: {
      building: { key: 'building', value: 'Insight @ Cyncly' },
      listeningKey: 'listening',
    },
  },

  sections: [
    { id: 'about', number: '02', label: 'about', jp: '自己紹介' },
    {
      id: 'experience',
      number: '03',
      label: 'experience',
      jp: '経歴',
      headingSuffix: ' · episode guide',
    },
    { id: 'links', number: '04', label: 'links', jp: 'リンク' },
  ] satisfies readonly SectionCopy[],

  /** Lock-on tag on a Section heading after navigating to it, followed by the Section id. */
  lockOn: 'found ~/',

  /** Denominator in Section headings ("02 / 04"): the Name card is 01. */
  sectionTotal: '04',

  about: {
    heading: {
      lead: "hey, i'm matthew, a human software developer,",
      /** Set in the Accent. */
      accent: 'one of the last of my kind.',
    },
    /** Each paragraph is a list of runs, so a phrase can be a link. */
    paragraphs: [
      [
        "Thanks for visiting my home on the web. I'm a full stack developer based in the Raleigh-Durham area of North Carolina, and I've been writing software since a friend handed me my first programming book in 2015. These days I'm on the ",
        { label: 'Insight', href: 'https://www.cyncly.com/products/insight' },
        ' team at ',
        { label: 'Cyncly', href: 'https://www.cyncly.com/' },
        '.',
      ],
    ] satisfies readonly (readonly Inline[])[],
  },

  episodes: [
    {
      number: 3,
      years: '2024 — present',
      role: 'full stack developer',
      company: 'cyncly',
      companyHref: 'https://www.cyncly.com/',
      description:
        'Moving Insight, an ERP system for manufacturers, off a monolithic legacy app and onto a modern React web app, while building new features along the way.',
    },
    {
      number: 2,
      years: '2023 — 2024',
      role: 'full stack developer',
      company: 'game builds',
      description:
        'Helped build, launch and maintain diablobuilds.com, a Diablo IV community site centered on a character builder with detailed stats and customization.',
    },
    {
      number: 1,
      years: '2021 — 2023',
      role: 'software engineer',
      company: 'applied visions',
      companyHref: 'https://avi.com/',
      description:
        "Developed two enterprise apps for clients: a professional network for the insurance industry and an AI-assisted project management tool for government agencies. Also mentored the client's junior developers.",
    },
  ] satisfies readonly Episode[],

  /** External links open in a new tab; screen readers hear this after the link's name. */
  newTab: 'opens in a new tab',

  links: [
    { label: 'github', href: 'https://github.com/mvandoff' },
    { label: 'linkedin', href: 'https://www.linkedin.com/in/matthew-vandoff' },
  ] satisfies readonly ExternalLink[],

  footer: {
    /** Preceded by "© <current year> ". */
    owner: 'matthew van doff',
    thanks: "(>'.')> thanks for stopping by",
    backToTop: '[ back to top ↑ ]',
  },
} as const;

/** "ep.03" for Episode 3. */
export function episodeLabel(episode: Pick<Episode, 'number'>): string {
  return `ep.${zeroPad(episode.number)}`;
}
