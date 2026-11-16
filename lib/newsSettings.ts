// Checking the News settings form, shared by save and test. Server-only.

import crypto from 'crypto';
import type { NewsLocation, NewsSettings } from './news';

export type SettingsInput = Omit<NewsSettings, 'subscription_id' | 'sections'> & {
  sections: { id?: string; heading: string; phrases: string; must_include?: string | null; must_exclude?: string | null }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function checkSettings(raw: unknown): { ok: true; value: Omit<NewsSettings, 'subscription_id'> } | { ok: false; error: string } {
  const b = (raw ?? {}) as Partial<SettingsInput>;
  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 120) || null : null;
  const cadence = b.cadence === 'weekly' ? 'weekly' : 'daily';
  const publish_time = typeof b.publish_time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.publish_time) ? b.publish_time : '07:00';
  const publish_weekday = Number.isInteger(b.publish_weekday) && b.publish_weekday! >= 0 && b.publish_weekday! <= 6 ? b.publish_weekday! : 0;
  const min_score = Math.max(0, Math.min(100, Math.round(Number(b.min_score ?? 35))));
  const max_items = Math.max(1, Math.min(30, Math.round(Number(b.max_items ?? 12))));

  const locations: NewsLocation[] = [];
  for (const l of Array.isArray(b.locations) ? b.locations.slice(0, 20) : []) {
    if (!l || typeof l.name !== 'string' || !['country', 'admin1', 'place'].includes(l.kind) || typeof l.country !== 'string') continue;
    locations.push({
      name: l.name.slice(0, 200), kind: l.kind, geonames_id: Number.isInteger(l.geonames_id) ? l.geonames_id : null,
      country: l.country.slice(0, 2).toUpperCase(), admin1: typeof l.admin1 === 'string' ? l.admin1.slice(0, 20) : null,
      lat: typeof l.lat === 'number' ? l.lat : null, lon: typeof l.lon === 'number' ? l.lon : null,
      radius_km: typeof l.radius_km === 'number' ? Math.max(1, Math.min(500, l.radius_km)) : 25,
    });
  }

  const input = Array.isArray(b.sections) ? b.sections : [];
  if (input.length > 12) return { ok: false, error: 'At most 12 sections' };
  const sections = [];
  for (const [n, s] of input.entries()) {
    const heading = String(s?.heading ?? '').trim();
    if (!heading) return { ok: false, error: `Section ${n + 1} needs a heading` };
    if (heading.length > 80) return { ok: false, error: `Section "${heading}": the heading is too long` };
    const phrases = String(s?.phrases ?? '').split('\n').map(p => p.trim()).filter(Boolean);
    if (!phrases.length) return { ok: false, error: `Section "${heading}" needs at least one search phrase` };
    if (phrases.length > 12) return { ok: false, error: `Section "${heading}": at most 12 search phrases` };
    if (phrases.some(p => p.length > 200)) return { ok: false, error: `Section "${heading}": each phrase must be at most 200 characters` };
    sections.push({
      id: typeof s?.id === 'string' && UUID.test(s.id) ? s.id : crypto.randomUUID(),
      heading, phrases: phrases.join('\n'),
      must_include: String(s?.must_include ?? '').trim().slice(0, 500) || null,
      must_exclude: String(s?.must_exclude ?? '').trim().slice(0, 500) || null,
      sort_order: n,
    });
  }
  return {
    ok: true,
    value: { enabled: b.enabled !== false, title, cadence, publish_time, publish_weekday, locations, min_score, max_items, use_llm: b.use_llm !== false, sections },
  };
}
