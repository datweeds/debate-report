// Runs once when the server starts. Schedules the abuse-scanning sweep of
// new and changed text: every 15 minutes, plus a daily pass at 03:00 (server
// time) as a safety net. A full rescan of everything is manual (Admin →
// Scanning), since it grows with the site. Set CONTENT_SWEEP=off to disable.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.CONTENT_SWEEP === 'off') return;
  const { runSweep } = await import('./lib/scanner');

  const QUARTER_HOUR = 15 * 60 * 1000;
  // First pass a minute after start-up, then every 15 minutes
  setTimeout(() => {
    void runSweep('interval');
    setInterval(() => void runSweep('interval'), QUARTER_HOUR).unref();
  }, 60 * 1000).unref();

  const scheduleDaily = () => {
    const next = new Date();
    next.setHours(3, 0, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    setTimeout(async () => {
      await runSweep('daily');
      scheduleDaily();
    }, next.getTime() - Date.now()).unref();
  };
  scheduleDaily();
}
