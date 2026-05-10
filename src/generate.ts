import OpenAI from 'openai';
import { PRODUCT } from './product.ts';
import { selectPersona } from './persona.ts';
import type { VisitorProfile } from './signals.ts';

const CLOD_MODEL = process.env.CLOD_MODEL ?? 'claude-haiku-4-5-20251001';

const client = new OpenAI({
  baseURL: 'https://api.clod.io/v1',
  apiKey: process.env.CLOD_API_KEY,
});

const SYSTEM_PROMPT = `You are an avant-garde e-commerce designer. Generate a visually STRIKING, COLORFUL product page.

OUTPUT RULES (violations break the page):
1. Output ONLY a <main>…</main> block. No prose, no markdown fences, nothing else.
2. Allowed tags: main, section, div, header, h1, h2, h3, h4, h5, h6, p, span, a, img, button, ul, ol, li, strong, em, br
3. Tailwind utility classes ONLY via class=. No <style>, no style=, no on* handlers, no <script>.
4. Images: ONLY https://picsum.photos/{width}/{height}?random={n} (n = 1–99). Always include alt.
5. Links: href must start with https:// or #.

PRODUCT:
${JSON.stringify(PRODUCT, null, 2)}

DESIGN MANDATE:
- Minimum 4 sections: hero, product details, tasting notes, buy/CTA section
- Hero headline must be text-6xl or larger
- Fill the full viewport — no small card floating on white
- Use the EXACT Tailwind color classes specified in the persona — do not substitute neutrals
- Include at least 1 image using picsum.photos
- Make it look like a real website built by a skilled designer
- Keep each section's HTML concise — 3–5 elements per section is enough; do NOT write comments`;

const FALLBACK_MAIN = `<main class="min-h-screen bg-stone-50 flex items-center justify-center px-6 py-24">
  <div class="max-w-lg text-center">
    <p class="text-xs uppercase tracking-widest text-stone-400 mb-4">${PRODUCT.badge}</p>
    <h1 class="text-4xl font-bold text-stone-900 mb-2">${PRODUCT.brand}</h1>
    <p class="text-xl text-stone-600 mb-2">${PRODUCT.name}</p>
    <p class="text-stone-500 mb-8">${PRODUCT.tagline}</p>
    <a href="#" class="inline-block bg-stone-900 text-white px-8 py-3 rounded-lg font-medium">
      Shop Now — from ${PRODUCT.variants[0].price}
    </a>
  </div>
</main>`;

export async function generate(profile: VisitorProfile): Promise<string> {
  const persona = selectPersona(profile);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  console.log(`  persona  : ${persona.id} (${persona.name})`);
  console.log(`  model    : ${CLOD_MODEL}`);
  console.log(`  temp     : 1.0  max_tokens: 2500`);

  const personaInstructions = `SELECTED DESIGN PERSONA: ${persona.name}
Follow this persona exactly — use the specified colors, not substitutes.

Background: ${persona.background}
Accent colors: ${persona.accent}
Hero typography: ${persona.heroText}
Layout: ${persona.layout}
Copy tone: ${persona.copyTone}
Required Tailwind classes to use: ${persona.tailwindClasses}

Visitor context (use to personalize copy and emphasis):
${JSON.stringify(profile, null, 2)}

Generate the product page now.`;

  try {
    const resp = await client.chat.completions.create(
      {
        model: CLOD_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: personaInstructions },
        ],
        temperature: 1.0,
        max_tokens: 2500,
      },
      { signal: controller.signal },
    );

    clearTimeout(timeout);
    const raw = resp.choices[0]?.message?.content ?? '';
    const usage = resp.usage;

    console.log(`  finish   : ${resp.choices[0]?.finish_reason}`);
    if (usage) {
      console.log(`  tokens   : prompt=${usage.prompt_tokens}  completion=${usage.completion_tokens}  total=${usage.total_tokens}`);
    }

    // Strip markdown code fences the model sometimes wraps output in
    const clean = raw.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '');

    const start = clean.indexOf('<main');
    const end = clean.lastIndexOf('</main>');

    if (start === -1) {
      console.warn('  ⚠ no <main> tag found — using fallback');
      console.warn('  raw preview:', raw.slice(0, 200));
      return FALLBACK_MAIN;
    }

    if (end !== -1 && end > start) {
      return clean.slice(start, end + '</main>'.length);
    }

    // Output was truncated (hit token limit) — close the tag ourselves
    console.warn('  ⚠ output truncated (no </main>) — appending close tag');
    return clean.slice(start) + '\n</main>';

  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ AI call failed: ${msg} — serving fallback`);
    return FALLBACK_MAIN;
  }
}
