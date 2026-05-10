import type { VisitorProfile } from './signals.ts';

/** Full page with fixed slot scaffolding; streamed sections replace placeholders (no CLS: min-heights reserved). */
export function shellStreamPage(profile: VisitorProfile): string {
  const utmLabel = profile.utm.source ? ` via ${profile.utm.source}` : '';
  const visitLabel = `visit #${profile.visitCount + 1}`;
  /** Safe JSON for inline script — no `</script>` in JSON */
  const slotSkeleton = (label: string) => `
      <div class="slot-loading pointer-events-none absolute inset-4 rounded-xl bg-stone-200/70 animate-pulse flex flex-col gap-4 p-8 z-10" aria-hidden="true">
        <div class="h-10 bg-stone-300/90 rounded-lg w-2/3 max-w-md"></div>
        <div class="h-6 bg-stone-300/60 rounded w-1/3"></div>
        <div class="flex-1 min-h-[12rem] bg-stone-300/40 rounded-lg mt-6"></div>
        <div class="h-14 bg-stone-300/50 rounded-xl w-48 mt-auto"></div>
        <span class="sr-only">Loading ${label}</span>
      </div>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rustling Lynx Roasters</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white">

  <nav class="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-stone-100 px-6 py-3 flex items-center justify-between">
    <span class="font-semibold tracking-tight text-stone-900">Rustling Lynx</span>
    <div class="flex items-center gap-6 text-sm text-stone-500">
      <a href="#" class="hover:text-stone-900">Shop</a>
      <a href="#" class="hover:text-stone-900">About</a>
      <a href="#" class="hover:text-stone-900">Cart (0)</a>
    </div>
  </nav>

  <div class="pt-14">
    <main class="flex flex-col w-full min-h-screen">

      <div data-slot="hero" class="relative min-h-[85vh] w-full shrink-0 [contain:layout]">
${slotSkeleton('hero')}
      </div>

      <div data-slot="details" class="relative min-h-[28rem] w-full shrink-0 [contain:layout] border-t border-stone-100/80">
${slotSkeleton('product details')}
      </div>

      <div data-slot="tasting" class="relative min-h-[22rem] w-full shrink-0 [contain:layout] border-t border-stone-100/80">
${slotSkeleton('tasting notes')}
      </div>

      <div data-slot="cta" class="relative min-h-[20rem] w-full shrink-0 [contain:layout] border-t border-stone-100/80 mb-24">
${slotSkeleton('call to action')}
      </div>

    </main>
  </div>

  <footer class="border-t border-stone-100 px-6 py-10 text-center">
    <p class="text-sm text-stone-400">&copy; 2026 Rustling Lynx Roasters</p>
    <p class="text-xs text-stone-300 mt-1">Sections stream in as they finish — each slot keeps this layout shell.</p>
  </footer>

  <aside class="fixed bottom-4 right-4 bg-black/85 text-white text-xs font-mono rounded-xl px-3 py-2.5 max-w-[220px] leading-5 z-50 shadow-xl">
    <div class="text-amber-400 font-bold mb-1">signals</div>
    <div class="text-stone-300">${visitLabel}</div>
    <div class="text-stone-300">${profile.country} &middot; ${profile.device} &middot; ${profile.lang}</div>
    <div class="text-stone-300 truncate">${profile.referer}${utmLabel}</div>
    <div class="text-stone-400">UTC ${profile.hourUtc}:00</div>
    <div data-stream-status class="text-emerald-400 mt-2">Connecting…</div>
  </aside>

  <script>
(function(){
  var nl = String.fromCharCode(10);
  function setStatus(t) {
    var el = document.querySelector('[data-stream-status]');
    if (el) el.textContent = t;
  }
  var finalized = false;
  function dispatchBlock(block) {
    if (block.indexOf('data:') !== 0) return;
    var json = block.slice(5).trim();
    var msg = null;
    try { msg = JSON.parse(json); } catch (e) { return; }
    if (msg.type === 'slot' && msg.slot && typeof msg.html === 'string') {
      var el = document.querySelector('[data-slot="' + msg.slot + '"]');
      if (!el) return;
      el.innerHTML = msg.html;
      setStatus('Live · ' + msg.slot);
    } else if (msg.type === 'done') {
      finalized = true;
      setStatus(msg.error ? ('Done (' + msg.error + ')') : 'Done');
    }
  }

  async function consume() {
    var reader = null;
    try {
      var res = await fetch('/stream', { credentials: 'same-origin' });
      if (!res.ok || !res.body) { setStatus('Stream failed'); return; }
      reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      while (true) {
        var next = await reader.read();
        buf += decoder.decode(next.value || new Uint8Array(0), { stream: !next.done });
        for (;;) {
          var sepIdx = buf.indexOf(nl + nl);
          if (sepIdx === -1) break;
          dispatchBlock(buf.slice(0, sepIdx));
          buf = buf.slice(sepIdx + nl.length + nl.length);
        }
        if (next.done) break;
      }
      dispatchBlock(buf);
      if (!finalized) setStatus('Disconnected');
    } catch (e) {
      setStatus('Error');
      console.error(e);
    } finally {
      if (reader) { try { reader.cancel(); } catch (_) {} }
    }
  }
  }
  consume();
})();
  </script>
</body>
</html>`;
}
