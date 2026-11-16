'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// The call UI uses browser media APIs: load it only in the browser
const CallRoom = dynamic(() => import('./CallRoom'), { ssr: false });

type Participant = { identity: string; name: string; micOn: boolean; cameraOn: boolean };
type Room = { id: string; name: string; mode: 'video' | 'audio'; max_participants: number; is_default: boolean; locked: boolean; e2ee: boolean; participants: Participant[] };
type Data = { available: boolean; canModerate: boolean; me: string | null; myName: string; rooms: Room[] };

// A Society's rooms for audio and video calls, and who is in each now
export default function SocietyMeet({ societyId }: { societyId: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [inCall, setInCall] = useState<Room | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'video' | 'audio'>('video');
  const [e2ee, setE2ee] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/societies/${societyId}/rtc/rooms`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? 'Could not load the rooms.'); return; }
    setData(d);
  }, [societyId]);
  useEffect(() => { void load(); }, [load]);
  // Keep "who's in" fresh while browsing the list
  useEffect(() => {
    if (inCall) return;
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load, inCall]);

  async function addRoom(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch(`/api/societies/${societyId}/rtc/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mode, e2ee }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? 'Could not add the room.'); return; }
    setAdding(false); setName(''); setE2ee(false); await load();
  }

  async function roomAction(room: Room, method: 'PATCH' | 'DELETE', body?: unknown) {
    if (method === 'DELETE' && !confirm(`Delete “${room.name}”? Anyone in it will be disconnected.`)) return;
    const r = await fetch(`/api/societies/${societyId}/rtc/rooms/${room.id}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? 'That didn’t work.');
    await load();
  }

  if (!data) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Talk face to face or by voice with other members. Up to 25 people per room; nothing is recorded.</p>
        {data.canModerate && !adding && (
          <button onClick={() => setAdding(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">+ New room</button>
        )}
      </div>
      {!data.available && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">Calls aren’t available on this server yet.</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {adding && (
        <form onSubmit={addRoom} className="card-dr flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-xs text-slate-400">Room name</label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={80} required autoFocus placeholder="e.g. Committee"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Type</label>
            <select value={mode} onChange={e => setMode(e.target.value as 'video' | 'audio')}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
              <option value="video">Video and audio</option>
              <option value="audio">Audio only</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300" title="Members enter a shared passphrase; the server can't see or hear the call">
            <input type="checkbox" checked={e2ee} onChange={e => setE2ee(e.target.checked)} className="h-4 w-4 accent-blue-500" />
            End-to-end encrypted
          </label>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="px-2 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
        </form>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {data.rooms.map(room => (
          <li key={room.id} className="card-dr flex flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-100">{room.name}</h3>
                <p className="text-xs text-slate-500">
                  {room.mode === 'audio' ? '🎙 Audio only' : '🎥 Video and audio'}
                  {room.e2ee && <span className="text-emerald-300" title="End-to-end encrypted: needs the room passphrase"> · 🔐 end-to-end encrypted</span>}
                  {room.locked && <span className="text-amber-300"> · 🔒 locked</span>}
                </p>
              </div>
              {room.participants.length > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{room.participants.length} in the room
                </span>
              )}
            </div>
            <p className="mt-2 min-h-[1.25rem] text-sm text-slate-400">
              {room.participants.length ? room.participants.map(p => p.name).join(', ') : 'Nobody here yet.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={() => setInCall(room)} disabled={!data.available || (room.locked && !data.canModerate)}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">
                {room.participants.length ? 'Join' : 'Start'}
              </button>
              {data.canModerate && (
                <>
                  <button onClick={() => roomAction(room, 'PATCH', { locked: !room.locked })} className="text-xs text-slate-400 hover:text-slate-200">{room.locked ? 'Unlock' : 'Lock'}</button>
                  <button onClick={() => { if (confirm(room.e2ee ? 'Turn off end-to-end encryption? Any call in progress will end.' : 'Turn on end-to-end encryption? Members will need a passphrase you share with them outside new.vote. Any call in progress will end.')) void roomAction(room, 'PATCH', { e2ee: !room.e2ee }); }}
                    className="text-xs text-slate-400 hover:text-slate-200">{room.e2ee ? 'Encryption off' : 'Encrypt'}</button>
                  {!room.is_default && <button onClick={() => roomAction(room, 'DELETE')} className="text-xs text-rose-400 hover:text-rose-300">Delete</button>}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-slate-500">
        Works in current Chrome, Edge, Firefox and Safari, on computers and phones. If you can’t connect from a workplace network, it may block calls; try another network.
      </p>

      {inCall && (
        <CallRoom societyId={societyId} roomId={inCall.id} roomName={inCall.name} mode={inCall.mode} e2ee={inCall.e2ee}
          canModerate={data.canModerate} me={data.me} myName={data.myName} onLeave={() => { setInCall(null); void load(); }} />
      )}
    </div>
  );
}
