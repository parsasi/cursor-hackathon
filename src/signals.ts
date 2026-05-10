import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';

export interface VisitorProfile {
  country: string;
  device: 'mobile' | 'desktop' | 'tablet';
  lang: string;
  referer: string;
  utm: { source?: string; campaign?: string; medium?: string };
  visitCount: number;
  hourUtc: number;
}

export function extractSignals(c: Context): VisitorProfile {
  const ua = c.req.header('user-agent') ?? '';
  const acceptLang = c.req.header('accept-language') ?? 'en';
  const refererRaw = c.req.header('referer') ?? '';

  const country =
    c.req.header('cf-ipcountry') ??
    c.req.header('x-vercel-ip-country') ??
    (acceptLang.match(/[-_]([A-Z]{2})(?:;|,|$)/)?.[1] ?? 'unknown');

  const device: VisitorProfile['device'] =
    /iPad|Android(?!.*Mobile)|Tablet/i.test(ua)
      ? 'tablet'
      : /Mobile|iPhone|Android/i.test(ua)
        ? 'mobile'
        : 'desktop';

  const lang = acceptLang.split(',')[0]?.trim().split(';')[0] ?? 'en';

  let referer = '(direct)';
  try {
    referer = new URL(refererRaw).hostname.replace(/^www\./, '');
  } catch {}

  const q = c.req.query();
  const utm = {
    source: q['utm_source'],
    campaign: q['utm_campaign'],
    medium: q['utm_medium'],
  };

  const visitCount = parseInt(getCookie(c, 'visit_count') ?? '0', 10);
  const hourUtc = new Date().getUTCHours();

  return { country, device, lang, referer, utm, visitCount, hourUtc };
}
