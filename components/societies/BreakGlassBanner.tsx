'use client';

// Shown to a SysAdmin inside a private Society under emergency access
export default function BreakGlassBanner({ societyId, until }: { societyId: number; until: string }) {
  async function end() {
    await fetch('/api/admin/break-glass', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ societyId }) });
    window.location.href = '/admin?tab=privacy';
  }
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
      <span>
        <strong>Emergency Sys Admin access</strong> to this private Society, until{' '}
        {new Date(until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. It is logged and shown to its Society Admins.
      </span>
      <button onClick={end} className="rounded-md border border-amber-400/50 px-2 py-0.5 hover:bg-amber-500/20">End access now</button>
    </div>
  );
}
