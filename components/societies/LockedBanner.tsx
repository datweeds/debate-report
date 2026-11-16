// Shown inside a private Society while the master key hasn't been supplied since a restart
export default function LockedBanner() {
  return (
    <div className="mb-3 rounded-lg border border-slate-600/50 bg-slate-800/40 px-3 py-2 text-xs text-slate-300">
      <strong>🔒 Temporarily locked.</strong> This private Society’s encrypted content is unavailable until an administrator
      unlocks it with a key we keep off our servers. Nothing has been lost. Please check back shortly.
    </div>
  );
}
