import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { extractSignals } from './signals.ts';
import { generate } from './generate.ts';
import { sanitize } from './sanitize.ts';
import { shell } from './shell.ts';

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

app.get('/', async (c) => {
  const start = Date.now();
  const ts = () => `[${new Date().toISOString()}]`;

  console.log(`\n${ts()} ── incoming request ─────────────────────────`);
  console.log(`  ${c.req.method} ${c.req.url}`);
  console.log(`  user-agent : ${c.req.header('user-agent') ?? '(none)'}`);
  console.log(`  referer    : ${c.req.header('referer') ?? '(direct)'}`);
  console.log(`  accept-lang: ${c.req.header('accept-language') ?? '(none)'}`);

  const profile = extractSignals(c);
  console.log(`\n${ts()} ── signals extracted ─────────────────────────`);
  console.log(`  country  : ${profile.country}`);
  console.log(`  device   : ${profile.device}`);
  console.log(`  lang     : ${profile.lang}`);
  console.log(`  referer  : ${profile.referer}`);
  console.log(`  utm      : ${JSON.stringify(profile.utm)}`);
  console.log(`  visit #  : ${profile.visitCount + 1}`);
  console.log(`  UTC hour : ${profile.hourUtc}`);

  setCookie(c, 'visit_count', String(profile.visitCount + 1), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: 'Lax',
  });

  console.log(`\n${ts()} ── calling AI ────────────────────────────────`);
  const aiStart = Date.now();
  const rawHtml = await generate(profile);
  const aiMs = Date.now() - aiStart;
  console.log(`${ts()} ── AI done (${aiMs}ms, ${rawHtml.length} chars) ──────────────`);

  const safeHtml = sanitize(rawHtml);
  const stripped = rawHtml.length - safeHtml.length;
  console.log(`${ts()} ── sanitized (${stripped} chars stripped) ─────────────────`);

  const totalMs = Date.now() - start;
  console.log(`${ts()} ── response sent (${totalMs}ms total) ────────────────────\n`);

  c.header('Cache-Control', 'no-store');
  return c.html(shell(safeHtml, profile));
});

export default {
  port,
  idleTimeout: 60,
  fetch: app.fetch,
};
