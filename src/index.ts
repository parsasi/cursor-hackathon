import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { extractSignals } from './signals.ts';
import { generateSlotsStreaming } from './generate.ts';
import { shellStreamPage } from './shell.ts';

const DEFAULT_PORT = 3000;

function isValidListenPort(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

/** CLI (`--port` / `-p`) wins over `PORT`; default 3000. */
function resolvePort(): number {
  const argv = process.argv;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' || a === '-p') {
      const n = Number.parseInt(argv[i + 1] ?? '', 10);
      if (isValidListenPort(n)) return n;
      console.warn(`Ignoring invalid value after ${a}: ${argv[i + 1] ?? '(missing)'}`);
      i += 1;
      continue;
    }
    if (a.startsWith('--port=')) {
      const n = Number.parseInt(a.slice('--port='.length), 10);
      if (isValidListenPort(n)) return n;
      console.warn(`Ignoring invalid --port= value: ${a}`);
    }
  }

  const fromEnv = process.env.PORT;
  if (fromEnv !== undefined && fromEnv !== '') {
    const n = Number.parseInt(fromEnv, 10);
    if (isValidListenPort(n)) return n;
    console.warn(`Ignoring invalid PORT=${JSON.stringify(fromEnv)}`);
  }

  return DEFAULT_PORT;
}

const port = resolvePort();

const app = new Hono();

/** Non-stream snapshot for logging parity with streamed generation (stream uses its own extraction). */
function logSignals(ts: () => string, profile: ReturnType<typeof extractSignals>): void {
  console.log(`\n${ts()} ── signals extracted ─────────────────────────`);
  console.log(`  country  : ${profile.country}`);
  console.log(`  device   : ${profile.device}`);
  console.log(`  lang     : ${profile.lang}`);
  console.log(`  referer  : ${profile.referer}`);
  console.log(`  utm      : ${JSON.stringify(profile.utm)}`);
  console.log(`  visit #  : ${profile.visitCount + 1}`);
  console.log(`  UTC hour : ${profile.hourUtc}`);
}

app.get('/', async (c) => {
  const ts = () => `[${new Date().toISOString()}]`;

  console.log(`\n${ts()} ── incoming request ─────────────────────────`);
  console.log(`  ${c.req.method} ${c.req.url}`);
  console.log(`  user-agent : ${c.req.header('user-agent') ?? '(none)'}`);
  console.log(`  referer    : ${c.req.header('referer') ?? '(direct)'}`);
  console.log(`  accept-lang: ${c.req.header('accept-language') ?? '(none)'}`);

  const profile = extractSignals(c);
  logSignals(ts, profile);

  setCookie(c, 'visit_count', String(profile.visitCount + 1), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: 'Lax',
  });

  console.log(`${ts()} ── HTML shell sent (stream via GET /stream) ──────────────\n`);

  c.header('Cache-Control', 'no-store');
  return c.html(shellStreamPage(profile));
});

app.get('/stream', async (c) => {
  const ts = () => `[${new Date().toISOString()}]`;
  const profile = extractSignals(c);

  console.log(`\n${ts()} ── /stream open ─────────────────────────────`);
  logSignals(ts, profile);
  console.log(`${ts()} ── AI stream starting ─────────────────────────`);

  const encoder = new TextEncoder();
  const sseData = (obj: Record<string, unknown>) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const t0 = Date.now();
      try {
        await generateSlotsStreaming(
          profile,
          {
            async onSlot(slot, html) {
              controller.enqueue(sseData({ type: 'slot', slot, html }));
            },
            async onComplete(errorMessage) {
              controller.enqueue(sseData({ type: 'done', error: errorMessage ?? null }));
              controller.close();
              console.log(`${ts()} ── stream closed (${Date.now() - t0}ms) ──────────────\n`);
            },
          },
          c.req.raw.signal,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${ts()} ── stream controller error: ${msg}`);
        try {
          controller.enqueue(sseData({ type: 'done', error: msg }));
          controller.close();
        } catch {
          controller.error(err instanceof Error ? err : new Error(msg));
        }
      }
    },
  });

  c.header('Cache-Control', 'no-store');
  c.header('Connection', 'keep-alive');
  return c.newResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
    },
  });
});

export default {
  port,
  idleTimeout: 120,
  fetch: app.fetch,
};
