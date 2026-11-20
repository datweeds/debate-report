// Society calendar events: input validation and calendar (.ics) export.

export function parseTime(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Validates an event body; shared by create and update.
// `sealed`: the calendar is sealed, so title, description and location arrive
// already encrypted in the browser and must pass this check (they're never cut).
export function readEvent(body: Record<string, unknown>, sealed?: (v: unknown) => boolean):
  { ok: true; title: string; description: string | null; location: string | null; startsAt: Date; endsAt: Date | null; allDay: boolean }
  | { ok: false; error: string } {
  if (sealed) {
    const opt = (v: unknown) => v == null || v === '' || sealed(v);
    if (!sealed(body.title) || !opt(body.description) || !opt(body.location)) {
      return { ok: false, error: 'This sealed calendar’s keys have changed: reload the page and try again' };
    }
  } else if ([body.title, body.description, body.location].some(v => typeof v === 'string' && v.startsWith('sn1:'))) {
    return { ok: false, error: 'This calendar isn’t sealed' };
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return { ok: false, error: 'A title is required' };
  const startsAt = parseTime(body.startsAt);
  if (!startsAt) return { ok: false, error: 'A start date is required' };
  const endsAt = body.endsAt ? parseTime(body.endsAt) : null;
  if (body.endsAt && !endsAt) return { ok: false, error: 'The end date is not valid' };
  if (endsAt && endsAt < startsAt) return { ok: false, error: 'The event must end after it starts' };
  const text = (v: unknown, max: number) => typeof v === 'string' && v.trim() ? (sealed ? v : v.trim().slice(0, max)) : null;
  return {
    ok: true,
    title: sealed ? title : title.slice(0, 200),
    description: text(body.description, 5000),
    location: text(body.location, 500),
    startsAt, endsAt, allDay: body.allDay === true,
  };
}

// One event as an iCalendar file, so people can add it to their own calendar.
export function toIcs(e: {
  id: string; title: string; description: string | null; location: string | null;
  starts_at: Date; ends_at: Date | null; all_day: boolean;
}, societyName: string, url: string): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const date = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  // All-day events are stored at midnight UTC on their first and last day;
  // an iCalendar all-day end date is exclusive, so it's the day after the last.
  const end = e.all_day
    ? new Date((e.ends_at ?? e.starts_at).getTime() + 86400000)
    : e.ends_at ?? new Date(e.starts_at.getTime() + 3600000);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//new.vote//Society calendar//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.id}@new.vote`,
    `DTSTAMP:${stamp(new Date())}`,
    e.all_day ? `DTSTART;VALUE=DATE:${date(e.starts_at)}` : `DTSTART:${stamp(e.starts_at)}`,
    e.all_day ? `DTEND;VALUE=DATE:${date(end)}` : `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc([e.description, `${societyName} — ${url}`].filter(Boolean).join('\n\n'))}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    `URL:${url}`,
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
