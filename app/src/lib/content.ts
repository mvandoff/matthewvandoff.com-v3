/**
 * Content module: every piece of copy on the site lives here, typed and static.
 * Components read only from this module; edit text here, not in the layout.
 *
 * Japanese labels and Episode numbers are set in DotGothic16, which is subset to
 * exactly the glyphs it renders (see src/lib/fonts.ts). After editing any of them,
 * run `pnpm fonts` to regenerate the subset, or the font test fails.
 */

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
  description: string;
}

export interface ExternalLink {
  label: string;
  href: string;
}

export const site = {
  meta: {
    title: 'matthew van doff',
    description: 'matthew van doff, software developer for the information superhighway.',
  },

  header: {
    home: '[ mvd ]',
  },

  notFound: {
    title: 'not found · matthew van doff',
    /** Shown as-is without JavaScript; the script appends `: /<path>`. */
    line: 'cd: no such page',
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

  /** Denominator in Section headings ("02 / 04"): the Name card is 01. */
  sectionTotal: '04',

  about: {
    heading: {
      lead: "hey, i'm matthew, a human software developer,",
      /** Set in the Accent. */
      accent: 'one of the last of my kind.',
    },
    paragraphs: [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    ],
  },

  episodes: [
    {
      number: 3,
      years: '2024 — present',
      role: 'web developer',
      company: 'cyncly',
      description:
        'Worked on the frontend team for Insight, a full scale ERP solution for manufacturers, migrating a monolithic legacy application to a modern React web app as well as developing new cutting-edge features.',
    },
    {
      number: 2,
      years: '2023 — 2024',
      role: 'full stack developer',
      company: 'game builds',
      description:
        'Helped build, launch, and maintain diablobuilds.com, an online resource and community for Diablo IV, featuring an advanced character builder with in-depth analytics and customization.',
    },
    {
      number: 1,
      years: '2021 — 2023',
      role: 'software engineer',
      company: 'applied visions',
      description:
        'Developed two key enterprise applications: a professional networking platform for the insurance industry and an AI-powered project management tool for government clients, while mentoring junior developers for the client.',
    },
  ] satisfies readonly Episode[],

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
  return `ep.${String(episode.number).padStart(2, '0')}`;
}
