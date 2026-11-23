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

  // Plan limits on call length (every minute) and the AI spend alert (every 15 minutes)
  const { enforceCallLimits } = await import('./lib/rtc');
  const { checkSpendAlerts } = await import('./lib/ai/spend');
  setInterval(() => void enforceCallLimits().catch(err => console.error('[rtc] call limits', err)), 60 * 1000).unref();
  setInterval(() => void checkSpendAlerts().catch(err => console.error('[ai] spend alert', err)), QUARTER_HOUR).unref();
  // Plan limits: warnings at 80% / 100%, and holding Societies past an owner's 3 free ones (hourly)
  const { planLimitsPass } = await import('./lib/holds');
  setInterval(() => void planLimitsPass().catch(err => console.error('[plans] hourly', err)), 4 * QUARTER_HOUR).unref();
  // Quarantined images past their time (30 days, or a year after an NCA report)
  const { purgeQuarantine } = await import('./lib/quarantine');
  setInterval(() => void purgeQuarantine().catch(err => console.error('[quarantine] purge', err)), 4 * QUARTER_HOUR).unref();
}
