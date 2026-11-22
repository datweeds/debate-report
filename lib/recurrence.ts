// Recurring events: the repeat rule, its occurrences, and a label for people.
// Shared by the browser (which works out the dates in the viewer's own time
// zone, so 7pm stays 7pm across clock changes) and the server (which checks them).

export const FREQS = ['daily', 'weekly', 'monthly_date', 'monthly_weekday'] as const;
export type Freq = typeof FREQS[number];
export type Rule = { freq: Freq; interval: number; until: string };   // until: last date, 'YYYY-MM-DD' (inclusive)
export type Occurrence = { startsAt: string; endsAt: string | null };

export const MAX_OCCURRENCES = 104;
export const MAX_SPAN_DAYS = 2 * 366;

const ORD = ['first', 'second', 'third', 'fourth', 'fifth'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** Date parts of the start: local time for timed events, UTC for all-day events (stored at midnight UTC). */
function parts(d: Date, allDay: boolean) {
  return allDay
    ? { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), h: 0, mi: 0 }
    : { y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), wd: d.getDay(), h: d.getHours(), mi: d.getMinutes() };
}
const make = (allDay: boolean, y: number, m: number, d: number, h: number, mi: number) =>
  allDay ? new Date(Date.UTC(y, m, d)) : new Date(y, m, d, h, mi);
const dayKey = (x: Date, allDay: boolean) => {
  const p = parts(x, allDay);
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
};

/** Every occurrence from the first event until rule.until (at most MAX_OCCURRENCES). */
export function occurrences(start: Date, end: Date | null, allDay: boolean, rule: Rule): Occurrence[] {
  const p = parts(start, allDay);
  const length = end ? end.getTime() - start.getTime() : null;
  const nth = Math.ceil(p.d / 7);                       // 1..5
  const last = p.d + 7 > daysIn(p.y, p.m);             // the last such weekday of its month
  const out: Occurrence[] = [];
  for (let i = 0; out.length < MAX_OCCURRENCES && i < 1000; i++) {
    let at: Date | null;
    const step = i * rule.interval;
    if (rule.freq === 'daily') at = make(allDay, p.y, p.m, p.d + step, p.h, p.mi);
    else if (rule.freq === 'weekly') at = make(allDay, p.y, p.m, p.d + 7 * step, p.h, p.mi);
    else {
      const y = p.y + Math.floor((p.m + step) / 12), m = (p.m + step) % 12;
      if (rule.freq === 'monthly_date') {
        at = p.d <= daysIn(y, m) ? make(allDay, y, m, p.d, p.h, p.mi) : null;   // no 31st that month: skipped
      } else {
        const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
        const firstDay = 1 + ((p.wd - first + 7) % 7);
        let day = last ? firstDay + 7 * Math.floor((daysIn(y, m) - firstDay) / 7) : firstDay + 7 * (nth - 1);
        if (day > daysIn(y, m)) day = 0;
        at = day ? make(allDay, y, m, day, p.h, p.mi) : null;
      }
    }
    if (!at) continue;
    if (dayKey(at, allDay) > rule.until) break;
    if (at.getTime() - start.getTime() > MAX_SPAN_DAYS * 86400000) break;
    out.push({ startsAt: at.toISOString(), endsAt: length === null ? null : new Date(at.getTime() + length).toISOString() });
  }
  return out;
}

/** "Every 2 weeks on Tuesday, until 3 March 2027" */
export function describe(rule: Rule, start: Date, allDay: boolean): string {
  const p = parts(start, allDay);
  const n = rule.interval;
  const until = new Date(`${rule.until}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const every = (unit: string) => (n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`);
  const lastOne = p.d + 7 > daysIn(p.y, p.m);
  const what = rule.freq === 'daily' ? every('day')
    : rule.freq === 'weekly' ? `${every('week')} on ${DAYS[p.wd]}`
    : rule.freq === 'monthly_date' ? `${every('month')} on the ${ordinal(p.d)}`
    : `${every('month')} on the ${lastOne ? 'last' : ORD[Math.ceil(p.d / 7) - 1]} ${DAYS[p.wd]}`;
  return `${what}, until ${until}`;
}

const ordinal = (d: number) =>
  `${d}${d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'}`;

/**
 * The occurrences the browser worked out, checked on the server: in order,
 * starting with the event itself, at least a day apart, each as long as the
 * first, none past the rule's end date, and not too many.
 */
export function checkOccurrences(list: unknown, first: { startsAt: Date; endsAt: Date | null }, rule: Rule): Occurrence[] | string {
  if (!Array.isArray(list) || list.length < 2) return 'A repeating event needs at least two dates: check the end date.';
  if (list.length > MAX_OCCURRENCES) return `A series can have at most ${MAX_OCCURRENCES} events.`;
  const length = first.endsAt ? first.endsAt.getTime() - first.startsAt.getTime() : null;
  const limit = new Date(`${rule.until}T00:00:00Z`).getTime() + 2 * 86400000;   // the end date, with time-zone slack
  const out: Occurrence[] = [];
  let prev = 0;
  for (const [i, o] of list.entries()) {
    const s = new Date(String((o as Occurrence)?.startsAt)), e = (o as Occurrence)?.endsAt ? new Date(String((o as Occurrence).endsAt)) : null;
    if (isNaN(s.getTime()) || (e && isNaN(e.getTime()))) return 'A date in the series isn’t valid.';
    if (i === 0 && Math.abs(s.getTime() - first.startsAt.getTime()) > 1000) return 'The series must start with this event.';
    if (i > 0 && s.getTime() - prev < 20 * 3600000) return 'Events in a series must be at least a day apart.';
    if ((length === null) !== (e === null) || (length !== null && e && Math.abs(e.getTime() - s.getTime() - length) > 3600000)) return 'Every event in the series must be the same length.';
    if (s.getTime() > limit || s.getTime() - first.startsAt.getTime() > MAX_SPAN_DAYS * 86400000) return 'The series runs past its end date.';
    prev = s.getTime();
    out.push({ startsAt: s.toISOString(), endsAt: e ? e.toISOString() : null });
  }
  return out;
}

/** A rule as sent by the browser, checked. */
export function readRule(v: unknown): Rule | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const interval = Number(r.interval);
  if (!(FREQS as readonly unknown[]).includes(r.freq) || !Number.isInteger(interval) || interval < 1 || interval > 12) return null;
  if (typeof r.until !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.until)) return null;
  return { freq: r.freq as Freq, interval, until: r.until };
}
