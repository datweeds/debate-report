'use client';

import '@livekit/components-styles';
import { useEffect, useMemo, useState } from 'react';
import {
  AudioConference, LiveKitRoom, PreJoin, VideoConference, useParticipants, useRoomContext, type LocalUserChoices,
} from '@livekit/components-react';
import { ExternalE2EEKeyProvider, Room, RoomEvent } from 'livekit-client';

type Joined = { url: string; token: string; choices: LocalUserChoices };

// End-to-end encrypted rooms: media is encrypted in the browser with a key
// derived from a passphrase members share outside new.vote. It is never sent
// to the server, which only relays encrypted media.

// A call: a device check first (camera, microphone, preview), then the room.
// Loaded only in the browser.
export default function CallRoom({ societyId, roomId, roomName, mode, e2ee, canModerate, me, myName, onLeave }: {
  societyId: number; roomId: string; roomName: string; mode: 'video' | 'audio'; e2ee: boolean; canModerate: boolean; me: string | null;
  myName: string; onLeave: () => void;
}) {
  const [joined, setJoined] = useState<Joined | null>(null);
  const [error, setError] = useState('');
  const [showPeople, setShowPeople] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseSet, setPassphraseSet] = useState(false);

  // For encrypted rooms, a Room set up with the passphrase-derived key
  const room = useMemo(() => {
    if (!e2ee || !passphraseSet) return undefined;
    const keyProvider = new ExternalE2EEKeyProvider();
    void keyProvider.setKey(passphrase);
    // LiveKit's encryption worker, copied to /public by `npm run build` (prebuild)
    const worker = new Worker('/livekit-e2ee-worker.mjs', { type: 'module' });
    return new Room({ adaptiveStream: true, dynacast: true, e2ee: { keyProvider, worker } });
  }, [e2ee, passphraseSet, passphrase]);

  async function join(choices: LocalUserChoices) {
    setError('');
    const r = await fetch(`/api/societies/${societyId}/rtc/rooms/${roomId}/token`, { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? 'Could not join the room.'); return; }
    setJoined({ url: d.url, token: d.token, choices });
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0b0f17]" data-lk-theme="default">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2 text-sm text-slate-200">
        <span className="font-semibold">{roomName}{mode === 'audio' && <span className="ml-2 text-xs font-normal text-slate-400">audio only</span>}
          {e2ee && <span className="ml-2 text-xs font-normal text-emerald-300">🔐 end-to-end encrypted</span>}</span>
        <div className="flex items-center gap-2">
          {joined && canModerate && (
            <button onClick={() => setShowPeople(v => !v)} className="rounded-md border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10">
              {showPeople ? 'Hide moderation' : 'Moderate'}
            </button>
          )}
          {!joined && <button onClick={onLeave} className="rounded-md border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10">Back</button>}
        </div>
      </div>

      {e2ee && !passphraseSet ? (
        <form onSubmit={e => { e.preventDefault(); if (passphrase.length >= 8) setPassphraseSet(true); }}
          className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 p-4 text-sm text-slate-300">
          <p className="text-base font-semibold text-slate-100">🔐 This room is end-to-end encrypted</p>
          <p>Enter the room passphrase. Your moderator shares it with members outside new.vote (in person, or by an encrypted messenger). It never leaves your device, so not even new.vote can see or hear this call.</p>
          <input type="password" autoFocus value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="Room passphrase (at least 8 characters)"
            className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-slate-100" />
          <p className="text-xs text-slate-500">Everyone must use exactly the same passphrase. With a different one you’ll join but won’t see or hear the others.</p>
          <button type="submit" disabled={passphrase.length < 8} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">Continue</button>
        </form>
      ) : !joined ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-auto p-4">
          <p className="text-sm text-slate-400">Check your {mode === 'audio' ? 'microphone' : 'camera and microphone'}, then join.</p>
          {/* The name comes from the member's profile, so its field is hidden */}
          <div className="w-full max-w-md [&_.lk-username-container]:hidden">
            <PreJoin
              onSubmit={join}
              onError={err => setError(`Your browser blocked the ${mode === 'audio' ? 'microphone' : 'camera or microphone'}: ${err.message}`)}
              defaults={{ username: myName, videoEnabled: mode === 'video', audioEnabled: true }}
              persistUserChoices
              joinLabel="Join"
              micLabel="Microphone"
              camLabel="Camera"
              userLabel="Name"
            />
          </div>
          {error && <p className="max-w-md text-center text-sm text-rose-300">{error}</p>}
          <p className="max-w-md text-center text-xs text-slate-500">
            {e2ee ? 'End-to-end encrypted: only people with the passphrase can see or hear this call. Chat is turned off in encrypted rooms.' : 'Calls are encrypted in transit and never recorded. Only members of this Society can join.'}
          </p>
        </div>
      ) : (
        <LiveKitRoom
          room={room}
          serverUrl={joined.url}
          token={joined.token}
          connect
          audio={joined.choices.audioEnabled ? { deviceId: joined.choices.audioDeviceId } : false}
          video={mode === 'video' && joined.choices.videoEnabled ? { deviceId: joined.choices.videoDeviceId } : false}
          options={{ adaptiveStream: true, dynacast: true }}
          onDisconnected={onLeave}
          onError={err => setError(err.message)}
          className="flex min-h-0 flex-1"
        >
          {e2ee && <EnableEncryption onProblem={setError} />}
          {/* Chat goes over the data channel, which isn't end-to-end encrypted: hidden in encrypted rooms */}
          {e2ee && <style>{'.lk-chat-toggle, .lk-chat { display: none !important; }'}</style>}
          <div className="min-w-0 flex-1">{mode === 'audio' ? <AudioConference /> : <VideoConference />}</div>
          {error && joined && <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-rose-900/90 px-3 py-2 text-xs text-rose-100">{error}</div>}
          {showPeople && canModerate && <ModerationPanel societyId={societyId} roomId={roomId} me={me} />}
        </LiveKitRoom>
      )}
    </div>
  );
}

// Turns on end-to-end encryption once connected, and reports decryption
// problems (usually a different passphrase)
function EnableEncryption({ onProblem }: { onProblem: (msg: string) => void }) {
  const room = useRoomContext();
  useEffect(() => {
    void room.setE2EEEnabled(true).catch(() => onProblem('This browser can’t join end-to-end encrypted calls. Try a current Chrome, Edge, Firefox or Safari.'));
    const onErr = () => onProblem('Some audio or video couldn’t be decrypted. Check that everyone uses the same passphrase.');
    room.on(RoomEvent.EncryptionError, onErr);
    return () => { room.off(RoomEvent.EncryptionError, onErr); };
  }, [room, onProblem]);
  return null;
}

// Moderators: everyone in the room, with mute and remove; lock and end
function ModerationPanel({ societyId, roomId, me }: { societyId: number; roomId: string; me: string | null }) {
  const participants = useParticipants();
  const [msg, setMsg] = useState('');

  async function act(body: Record<string, unknown>, done: string) {
    setMsg('');
    const r = await fetch(`/api/societies/${societyId}/rtc/rooms/${roomId}`, {
      method: body.locked !== undefined ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? done : d.error ?? 'That didn’t work.');
  }

  return (
    <aside className="w-72 flex-shrink-0 overflow-y-auto border-l border-white/10 p-3 text-sm text-slate-200">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">In the room ({participants.length})</p>
      <ul className="space-y-1.5">
        {participants.map(p => (
          <li key={p.identity} className="flex items-center justify-between gap-2">
            <span className="truncate">{p.name || 'Someone'}{p.identity === me && <span className="text-slate-500"> (you)</span>}{!p.isMicrophoneEnabled && <span className="text-slate-500"> · muted</span>}</span>
            {p.identity !== me && (
              <span className="flex flex-shrink-0 gap-1">
                <button onClick={() => act({ action: 'mute', identity: p.identity }, `${p.name} muted`)} className="rounded border border-white/15 px-1.5 text-xs hover:bg-white/10">Mute</button>
                <button onClick={() => { if (confirm(`Remove ${p.name} from the room for an hour?`)) void act({ action: 'remove', identity: p.identity }, `${p.name} removed`); }}
                  className="rounded border border-rose-400/40 px-1.5 text-xs text-rose-300 hover:bg-rose-950/40">Remove</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
        <button onClick={() => act({ locked: true }, 'Room locked: only moderators can join now')} className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10">Lock room</button>
        <button onClick={() => act({ locked: false }, 'Room unlocked')} className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10">Unlock</button>
        <button onClick={() => { if (confirm('End the call for everyone?')) void act({ action: 'end' }, 'Call ended'); }}
          className="rounded border border-rose-400/40 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950/40">End for everyone</button>
      </div>
      {msg && <p className="mt-2 text-xs text-slate-400">{msg}</p>}
    </aside>
  );
}
