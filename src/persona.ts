import type { VisitorProfile } from './signals.ts';

export interface Persona {
  id: string;
  name: string;
  background: string;
  accent: string;
  heroText: string;
  layout: string;
  copyTone: string;
  tailwindClasses: string;
}

const PERSONAS: Persona[] = [
  {
    id: 'midnight-drop',
    name: 'MIDNIGHT DROP',
    background: 'bg-zinc-950 and bg-black for all sections',
    accent: 'electric cyan: text-cyan-400, bg-cyan-500, border-cyan-400',
    heroText: 'text-7xl font-black uppercase tracking-tighter text-white, full viewport height hero',
    layout: 'full-bleed dark sections, image takes half the screen, neon cyan CTA button',
    copyTone: 'brutally short punchy lines. "DARK ROAST. DARKER NIGHTS." No sentence over 6 words.',
    tailwindClasses: 'bg-zinc-950, bg-zinc-900, text-cyan-400, bg-cyan-500, text-white, text-zinc-300',
  },
  {
    id: 'hacker-spec',
    name: 'HACKER SPEC',
    background: 'bg-white hero, bg-orange-50 for secondary sections',
    accent: 'orange: text-orange-600, bg-orange-500, border-orange-400',
    heroText: 'font-mono text-4xl font-bold — monospace terminal feel',
    layout: '2-column grid: specs/data table left, image right; monospace pricing table; quick-stat bar at top',
    copyTone: 'only facts and numbers. "1,900m. Natural process. 21-day dry. $24/250g." Zero adjectives.',
    tailwindClasses: 'bg-white, bg-orange-50, text-orange-600, bg-orange-500, font-mono, text-zinc-800',
  },
  {
    id: 'editorial-luxe',
    name: 'EDITORIAL LUXE',
    background: 'bg-amber-50',
    accent: 'deep burgundy: text-rose-900, bg-rose-900',
    heroText: 'font-serif text-8xl leading-none font-light — one massive headline word per line',
    layout: 'asymmetric 2-col, full-bleed image left, editorial text right, one pull-quote, generous whitespace',
    copyTone: 'poetic and sensory. "21 days under the Ethiopian sun." Literary, slow, no CTAs until the end.',
    tailwindClasses: 'bg-amber-50, text-rose-900, bg-rose-900, text-amber-900, font-serif',
  },
  {
    id: 'zen-minimal',
    name: 'ZEN MINIMAL',
    background: 'bg-white only, no other backgrounds',
    accent: 'single red accent and nothing else: text-red-600, bg-red-600',
    heroText: 'font-thin text-5xl tracking-widest text-zinc-900',
    layout: 'extreme whitespace between every element, centered single column, nothing grouped together',
    copyTone: 'as few words as possible. "Ethiopia. 1,900m. Natural." Full stop. No sentences.',
    tailwindClasses: 'bg-white, text-red-600, bg-red-600, text-zinc-900, font-thin, tracking-widest',
  },
  {
    id: 'loyal-regular',
    name: 'LOYAL REGULAR',
    background: 'bg-indigo-950 hero, bg-indigo-900 sections',
    accent: 'warm gold: text-amber-400, border-amber-400, bg-amber-500',
    heroText: 'font-serif text-5xl font-medium text-amber-100',
    layout: 'skip the generic hero entirely — open straight to tasting notes grid, then origin story, then process deep-dive',
    copyTone: 'insider, skip the basics. "You already know it\'s good. Here\'s what makes this lot different from last season."',
    tailwindClasses: 'bg-indigo-950, bg-indigo-900, text-amber-400, bg-amber-500, text-amber-100, font-serif',
  },
  {
    id: 'sunday-brunch',
    name: 'SUNDAY BRUNCH',
    background: 'bg-orange-50 (warm cream)',
    accent: 'terracotta: text-orange-700, bg-orange-600',
    heroText: 'text-5xl font-semibold text-orange-900, relaxed and warm',
    layout: 'lifestyle card grid, morning-ritual context copy, brewing guide section, soft rounded cards',
    copyTone: 'unhurried and friendly. "Best with a quiet morning and no meetings until 10."',
    tailwindClasses: 'bg-orange-50, text-orange-700, bg-orange-600, text-orange-900, rounded-2xl',
  },
  {
    id: 'hype-drop',
    name: 'HYPE DROP',
    background: 'bg-gradient-to-br from-purple-600 to-pink-500 on every section',
    accent: 'white + yellow: text-white, text-yellow-300, bg-yellow-400',
    heroText: 'text-8xl font-black text-white uppercase, centered',
    layout: 'massive full-bleed gradient, centered product image, giant CTA button, bold LIMITED badge in top-right corner',
    copyTone: 'FOMO and hype with caps. "SOLD OUT TWICE. BACK FOR 48 HOURS ONLY."',
    tailwindClasses: 'from-purple-600, to-pink-500, text-white, bg-yellow-400, text-yellow-300, font-black',
  },
];

export function selectPersona(profile: VisitorProfile): Persona {
  const utm = profile.utm.source?.toLowerCase() ?? '';
  const referer = profile.referer.toLowerCase();
  const { device, visitCount, hourUtc, lang, country } = profile;

  // Loyal Regular — check first, overrides everything for return visitors
  if (visitCount >= 3) return PERSONAS[4]; // loyal-regular

  // Zen Minimal — language/country signals
  if (/^(ja|ko|zh)/.test(lang) || ['JP', 'KR', 'CN', 'TW'].includes(country)) {
    return PERSONAS[3]; // zen-minimal
  }

  // Hype Drop — instagram/pinterest referer or UTM
  if (utm === 'instagram' || referer.includes('instagram') || referer.includes('pinterest')) {
    return PERSONAS[6]; // hype-drop
  }

  // Midnight Drop — social UTM or late night
  if (['twitter', 'tiktok', 'x'].includes(utm) || hourUtc >= 20 || hourUtc <= 5) {
    return PERSONAS[0]; // midnight-drop
  }

  // Hacker Spec — tech community referers
  if (referer.includes('ycombinator') || referer.includes('lobste') || referer.includes('reddit') || referer.includes('algolia')) {
    return PERSONAS[1]; // hacker-spec
  }

  // Editorial Luxe — design community or email
  if (
    referer.includes('dribbble') || referer.includes('behance') || referer.includes('awwwards') ||
    utm === 'newsletter' || profile.utm.medium === 'email'
  ) {
    return PERSONAS[2]; // editorial-luxe
  }

  // Sunday Brunch — morning, no UTM, desktop
  if (hourUtc >= 6 && hourUtc <= 11 && !utm && device === 'desktop') {
    return PERSONAS[5]; // sunday-brunch
  }

  // Default: Editorial Luxe
  return PERSONAS[2];
}
