import { randomInt } from 'node:crypto';
import OpenAI from 'openai';
import { PRODUCT } from './product.ts';
import type { VisitorProfile } from './signals.ts';
import { sanitize } from './sanitize.ts';
import { SLOT_DELIMITER, STREAM_SLOTS, type StreamSlotId } from './slots.ts';

const CLOD_MODEL = process.env.CLOD_MODEL ?? 'claude-haiku-4-5-20251001';

const client = new OpenAI({
  baseURL: 'https://api.clod.io/v1',
  apiKey: process.env.CLOD_API_KEY,
});

const SYSTEM_PROMPT = `You are an avant-garde e-commerce designer. Generate a visually STRIKING, COLORFUL product page as FOUR SEPARATE HTML fragments in ONE assistant reply.

OUTPUT RULES (violations break the page):
1. Output exactly 4 fragments in this order — no preamble, no markdown fences, no trailing commentary:
   (a) Hero (b) Product details (c) Tasting notes (d) Buy / CTA
2. After each fragment except the last, insert the EXACT sentinel on its own line: ${SLOT_DELIMITER}
   Example shape: "<section>...</section>\n${SLOT_DELIMITER}\n<section>...</section>" ... (four sections total).
3. Each fragment is ONE complete subtree: a single <section>...</section> root — balanced tags, fully closed.
4. Allowed tags inside sections: section, div, header, h1, h2, h3, h4, h5, h6, p, span, a, img, button, ul, ol, li, strong, em, br
5. Tailwind utility classes ONLY via class=. No <style>, no style=, no on* handlers, no <script>.
6. Images: ONLY https://picsum.photos/{width}/{height}?random={n} (n = 1–99). Every img needs width="…" height="…" matching the dimensions in the URL, plus alt text.
7. Links: href must start with https:// or #.

PRODUCT:
${JSON.stringify(PRODUCT, null, 2)}

DESIGN MANDATE:
- Fragment 1 hero: headline text-6xl or larger (text-7xl/text-8xl ok), immersive inside the slot — use min-h-full w-full on your &lt;section&gt; root (parents already reserve ~85vh height; avoid duplicating separate full-viewport wrappers that balloon layout)
- All four fragments together should feel like one cohesive storefront page
- Highly varied visuals — follow the random design brief in the user message literally for palette, typography mood, layout energy
- 3–6 meaningful child elements inside each section; no HTML comments`;

const FALLBACK_SLOTS: Record<StreamSlotId, string> = {
  hero: `<section class="min-h-full w-full flex flex-col justify-center px-8 bg-gradient-to-br from-violet-600 to-indigo-800 text-white">
    <header class="max-w-4xl">
      <p class="text-sm uppercase tracking-widest text-violet-200 mb-4">${PRODUCT.badge}</p>
      <h1 class="text-7xl font-black leading-tight mb-6">${PRODUCT.brand}</h1>
      <p class="text-2xl text-violet-100 mb-4">${PRODUCT.name}</p>
      <p class="text-lg text-violet-200 max-w-2xl">${PRODUCT.tagline}</p>
    </header>
  </section>`,
  details: `<section class="py-20 px-8 bg-stone-50">
    <div class="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
      <img src="https://picsum.photos/640/800?random=7" width="640" height="800" alt="${PRODUCT.name} bag" class="rounded-2xl shadow-xl w-full h-auto object-cover aspect-[4/5]" />
      <div>
        <h2 class="text-4xl font-bold text-stone-900 mb-6">Origin &amp; process</h2>
        <p class="text-stone-600 leading-relaxed mb-6">${PRODUCT.description}</p>
        <ul class="space-y-2 text-stone-700">
          <li><strong>Origin:</strong> ${PRODUCT.origin}</li>
          <li><strong>Process:</strong> ${PRODUCT.process}</li>
          <li><strong>Altitude:</strong> ${PRODUCT.altitude}</li>
          <li><strong>Roast:</strong> ${PRODUCT.roast}</li>
        </ul>
      </div>
    </div>
  </section>`,
  tasting: `<section class="py-20 px-8 bg-white">
    <div class="max-w-3xl mx-auto text-center">
      <h2 class="text-4xl font-bold text-stone-900 mb-10">Tasting notes</h2>
      <ul class="flex flex-wrap justify-center gap-4">
        ${PRODUCT.tastingNotes.map((n) => `<li class="px-6 py-3 rounded-full bg-amber-100 text-amber-900 font-medium">${n}</li>`).join('')}
      </ul>
    </div>
  </section>`,
  cta: `<section class="py-24 px-8 bg-stone-900 text-white">
    <div class="max-w-2xl mx-auto text-center">
      <h2 class="text-4xl font-bold mb-4">Bring it home</h2>
      <p class="text-stone-300 mb-10">From ${PRODUCT.variants[0].price} · ${PRODUCT.variants[0].size}</p>
      <a href="#" class="inline-block bg-amber-400 text-stone-900 px-10 py-4 rounded-xl text-lg font-semibold hover:bg-amber-300">Shop now</a>
    </div>
  </section>`,
};

function stripMarkdownFences(s: string): string {
  return s.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(arr.length)]!;
}

function buildStochasticUserMessage(profile: VisitorProfile): string {
  const seed = randomInt(0, 2 ** 31);
  const palette = pick([
    'sunset orange + deep plum + cream',
    'electric cyan on near-black',
    'forest green + sand + copper accents',
    'slate + sky blue + crisp white',
    'terracotta + olive + warm ivory',
    'magenta gradient into indigo',
  ] as const);
  const mood = pick(['brutalist bold', 'editorial luxe', 'playful pop', 'minimal zen', 'hype streetwear', 'quiet craft'] as const);
  const shape = pick(['asymmetric split columns', 'full-bleed hero + tight grid below', 'stacked bands of color', 'magazine pull-quote layout', 'terminal / mono data sheet vibe'] as const);
  const copyEnergy = pick(['punchy 3-word lines', 'poetic long-form', 'spec-sheet facts only', 'whisper-quiet minimal copy'] as const);

  return `Design seed: ${seed} — treat this as a creative roll; do not ignore it.

Random design brief (interpret with Tailwind):
- Palette & contrast: ${palette}
- Mood: ${mood}
- Layout energy: ${shape}
- Copy style: ${copyEnergy}

Visitor context (subtle personalization only — do not echo raw JSON):
${JSON.stringify(profile, null, 2)}

Generate the four HTML fragments now, in order, with ${SLOT_DELIMITER} between them exactly as specified.`;
}

export interface StreamHandlers {
  onSlot(slot: StreamSlotId, html: string): void | Promise<void>;
  /** Called once after all slots are accounted for (model + fallbacks). */
  onComplete(errorMessage?: string): void | Promise<void>;
}

async function emitFallbackRemainder(fromIndex: number, handlers: StreamHandlers): Promise<number> {
  let i = fromIndex;
  for (; i < STREAM_SLOTS.length; i++) {
    const id = STREAM_SLOTS[i]!;
    await handlers.onSlot(id, sanitize(FALLBACK_SLOTS[id]));
  }
  return i;
}

/**
 * Single chat completion, streamed; server splits on SLOT_DELIMITER and emits sanitized slot HTML.
 */
export async function generateSlotsStreaming(
  profile: VisitorProfile,
  handlers: StreamHandlers,
  abortSignal?: AbortSignal,
): Promise<void> {
  const timeoutCtrl = new AbortController();
  const timeoutMs = 90_000;
  const timeout = setTimeout(() => timeoutCtrl.abort(), timeoutMs);

  const combinedSignal =
    abortSignal ?
      AbortSignal.any([timeoutCtrl.signal, abortSignal])
    : timeoutCtrl.signal;

  let slotIdx = 0;
  console.log(`  model    : ${CLOD_MODEL}`);
  console.log(`  stream   : true  temp: 1.0  max_tokens: 2800`);

  try {
    const stream = await client.chat.completions.create(
      {
        model: CLOD_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildStochasticUserMessage(profile) },
        ],
        temperature: 1.0,
        max_tokens: 2800,
        stream: true,
      },
      { signal: combinedSignal },
    );

    let buffer = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (!delta) continue;
      buffer += delta;

      let sep: number;
      while ((sep = buffer.indexOf(SLOT_DELIMITER)) !== -1 && slotIdx < STREAM_SLOTS.length) {
        const rawFrag = stripMarkdownFences(buffer.slice(0, sep));
        buffer = buffer.slice(sep + SLOT_DELIMITER.length).replace(/^\s*\n/, '');
        const safe = sanitize(rawFrag);
        const id = STREAM_SLOTS[slotIdx]!;
        slotIdx++;
        await handlers.onSlot(id, safe.length > 80 ? safe : sanitize(FALLBACK_SLOTS[id]));
      }
    }

    clearTimeout(timeout);

    const tail = stripMarkdownFences(buffer);
    if (tail.length > 80 && slotIdx < STREAM_SLOTS.length) {
      const safe = sanitize(tail);
      const id = STREAM_SLOTS[slotIdx]!;
      slotIdx++;
      await handlers.onSlot(id, safe.length > 80 ? safe : sanitize(FALLBACK_SLOTS[id]));
    }

    if (slotIdx < STREAM_SLOTS.length) {
      console.warn(`  ⚠ only ${slotIdx}/${STREAM_SLOTS.length} slots from model — filling fallbacks`);
    }
    await emitFallbackRemainder(slotIdx, handlers);
    await handlers.onComplete();
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ stream failed: ${msg} — emitting fallbacks for missing slots`);

    await emitFallbackRemainder(slotIdx, handlers);
    await handlers.onComplete(msg);
  }
}
