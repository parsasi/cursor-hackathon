import type { VisitorProfile } from './signals.ts';

export function shell(mainHtml: string, profile: VisitorProfile): string {
  const utmLabel = profile.utm.source ? ` via ${profile.utm.source}` : '';
  const visitLabel = `visit #${profile.visitCount + 1}`;

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
    ${mainHtml}
  </div>

  <footer class="border-t border-stone-100 px-6 py-10 text-center">
    <p class="text-sm text-stone-400">&copy; 2025 Rustling Lynx Roasters</p>
    <p class="text-xs text-stone-300 mt-1">Every visitor sees a unique page &mdash; yours was generated just now.</p>
  </footer>

  <!-- Debug panel: shows the signals that shaped this page -->
  <aside class="fixed bottom-4 right-4 bg-black/85 text-white text-xs font-mono rounded-xl px-3 py-2.5 max-w-[220px] leading-5 z-50 shadow-xl">
    <div class="text-amber-400 font-bold mb-1">signals</div>
    <div class="text-stone-300">${visitLabel}</div>
    <div class="text-stone-300">${profile.country} &middot; ${profile.device} &middot; ${profile.lang}</div>
    <div class="text-stone-300 truncate">${profile.referer}${utmLabel}</div>
    <div class="text-stone-400">UTC ${profile.hourUtc}:00</div>
  </aside>

</body>
</html>`;
}
