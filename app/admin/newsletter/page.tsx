'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanHtml } from '@/lib/cleanHtml';

// Newsletter (Admin): write topics, gather unused ones into an issue, preview,
// test and send it. Sending archives the issue and its topics.

type Topic = {
  id: string; title: string; image_path: string | null; topic_date: string; body_html: string;
  issue_id: string | null; position: number; issue_title: string | null; issue_status: 'draft' | 'sending' | 'sent' | null;
};
type Issue = {
  id: string; title: string; subject: string | null; intro_html: string; status: 'draft' | 'sending' | 'sent';
  sent_at: string | null; sent_count: number; failed_count: number; created_at: string; topic_count: number;
};
type Data = { topics: Topic[]; issues: Issue[]; subscribers: { active: number; total: number }; myEmail: string | null };

// The address test copies go to: the last one used on this device, else your account's email
const TEST_KEY = 'dr_newsletter_test_to';
function savedTestAddress(fallback: string | null): string {
  try { return localStorage.getItem(TEST_KEY) || fallback || ''; } catch { return fallback || ''; }
}

const input = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none';
const btn = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors';
const ghost = 'rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:opacity-40 transition-colors';
const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const today = () => new Date().toISOString().slice(0, 10);

function Chip({ t }: { t: Topic }) {
  if (!t.issue_id) return <span className="rounded-full border border-emerald-600/40 bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Available</span>;
  if (t.issue_status === 'draft') return <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">In draft · {t.issue_title}</span>;
  return <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">Sent · {t.issue_title}</span>;
}

// ── Topic editor ──────────────────────────────────────────────────────────────

function TopicForm({ topic, onDone }: { topic: Topic | null; onDone: (saved: boolean) => void }) {
  const [title, setTitle] = useState(topic?.title ?? '');
  const [date, setDate] = useState(topic?.topic_date ?? today());
  const [image, setImage] = useState<string | null>(topic?.image_path ?? null);
  const [body, setBody] = useState(topic?.body_html ?? '');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(f: File) {
    setBusy(true); setErr('');
    const fd = new FormData(); fd.append('image', f);
    const r = await fetch('/api/admin/newsletter/image', { method: 'POST', body: fd });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setImage(d.imagePath); else setErr(d.error ?? 'Upload failed');
  }
  async function save() {
    setBusy(true); setErr('');
    const r = await fetch(topic ? `/api/admin/newsletter/topics/${topic.id}` : '/api/admin/newsletter/topics', {
      method: topic ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, topic_date: date, image_path: image, body_html: body }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) onDone(true); else setErr(d.error ?? 'Could not save');
  }

  return (
    <div className="card-dr space-y-3 p-5">
      <h2 className="text-sm font-semibold text-slate-200">{topic ? 'Edit topic' : 'New topic'}</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder="Title" className={input} />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${input} sm:w-44`} aria-label="Date" />
      </div>
      <div>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="mb-2 max-h-48 w-full rounded-lg border border-slate-700 object-cover" />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={ghost}>{image ? 'Replace image' : 'Add image'}</button>
          {image && <button type="button" onClick={() => setImage(null)} className="text-xs text-rose-400 hover:text-rose-300">Remove image</button>}
          <span className="text-[11px] text-slate-600">JPEG, PNG, WebP or GIF, up to 5 MB</span>
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs text-slate-400">Body (HTML: &lt;p&gt;, &lt;h3&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;a href&gt;, &lt;ul&gt;&lt;li&gt;, &lt;img&gt;…)</label>
          <button type="button" onClick={() => setPreview(p => !p)} className="text-xs text-blue-400 hover:underline">{preview ? 'Edit' : 'Preview'}</button>
        </div>
        {preview
          ? <div className="prose-dark min-h-40 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3" dangerouslySetInnerHTML={{ __html: cleanHtml(body) }} />
          : <textarea value={body} onChange={e => setBody(e.target.value)} rows={12} spellCheck placeholder={'<p>What happened, and why it matters.</p>\n<p><a href="https://new.vote/features">Read more</a></p>'} className={`${input} font-mono text-xs`} />}
        <p className="mt-1 text-[11px] text-slate-600">Scripts and embedded frames are removed when the newsletter is sent.</p>
      </div>
      {err && <p className="text-xs text-rose-300">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={() => onDone(false)} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
        <button onClick={save} disabled={busy || !title.trim()} className={btn}>{busy ? 'Saving…' : 'Save topic'}</button>
      </div>
    </div>
  );
}

// ── Issue editor ──────────────────────────────────────────────────────────────

function IssueForm({ issue, topics, onDone }: { issue: Issue | null; topics: Topic[]; onDone: (saved: boolean) => void }) {
  const [title, setTitle] = useState(issue?.title ?? '');
  const [subject, setSubject] = useState(issue?.subject ?? '');
  const [intro, setIntro] = useState(issue?.intro_html ?? '');
  const [chosen, setChosen] = useState<string[]>(
    issue ? topics.filter(t => t.issue_id === issue.id).sort((a, b) => a.position - b.position).map(t => t.id) : []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Topics that can go in: unused ones, and this issue's own
  const pickable = topics.filter(t => !t.issue_id || (issue && t.issue_id === issue.id));
  const byId = new Map(topics.map(t => [t.id, t]));

  const toggle = (id: string) => setChosen(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  const move = (i: number, d: number) => setChosen(c => { const n = [...c]; const j = i + d; if (j < 0 || j >= n.length) return c; [n[i], n[j]] = [n[j], n[i]]; return n; });

  async function save() {
    setBusy(true); setErr('');
    const r = await fetch(issue ? `/api/admin/newsletter/issues/${issue.id}` : '/api/admin/newsletter/issues', {
      method: issue ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subject, intro_html: intro, topicIds: chosen }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error ?? 'Could not save'); return; }
    if (d.skipped) window.alert(`${d.skipped} topic(s) were already in another issue and were left out.`);
    onDone(true);
  }

  return (
    <div className="card-dr space-y-3 p-5">
      <h2 className="text-sm font-semibold text-slate-200">{issue ? 'Edit issue' : 'New issue'}</h2>
      <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder='Issue name, e.g. "Issue 1 · December 2026"' className={input} />
      <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={250} placeholder="Email subject (optional: defaults to new.vote · issue name)" className={input} />
      <textarea value={intro} onChange={e => setIntro(e.target.value)} rows={3} placeholder="Introduction (optional, HTML)" className={`${input} font-mono text-xs`} />
      <div>
        <p className="mb-1.5 text-xs text-slate-400">Topics in this issue ({chosen.length}), in order</p>
        {chosen.length > 0 && (
          <ol className="mb-3 space-y-1">
            {chosen.map((id, i) => (
              <li key={id} className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-1.5 text-sm text-slate-200">
                <span className="w-5 text-xs text-slate-500">{i + 1}.</span>
                <span className="flex-1 truncate">{byId.get(id)?.title}</span>
                <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1 text-slate-500 hover:text-slate-200 disabled:opacity-30" aria-label="Move up">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === chosen.length - 1} className="px-1 text-slate-500 hover:text-slate-200 disabled:opacity-30" aria-label="Move down">↓</button>
                <button onClick={() => toggle(id)} className="px-1 text-xs text-rose-400 hover:text-rose-300">Remove</button>
              </li>
            ))}
          </ol>
        )}
        {pickable.filter(t => !chosen.includes(t.id)).length === 0 ? (
          <p className="text-xs text-slate-600">No other topics are available. Write one in the Topics tab.</p>
        ) : (
          <ul className="max-h-60 space-y-1 overflow-auto">
            {pickable.filter(t => !chosen.includes(t.id)).map(t => (
              <li key={t.id}>
                <button onClick={() => toggle(t.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-800/60">
                  <span className="text-emerald-400">+</span>
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-slate-600">{day(t.topic_date)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {err && <p className="text-xs text-rose-300">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={() => onDone(false)} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
        <button onClick={save} disabled={busy || !title.trim()} className={btn}>{busy ? 'Saving…' : 'Save issue'}</button>
      </div>
    </div>
  );
}

// ── A draft issue: preview, test, send ─────────────────────────────────────────

function IssueCard({ issue, subscribers, myEmail, onEdit, onChanged }: { issue: Issue; subscribers: number; myEmail: string | null; onEdit: () => void; onChanged: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  useEffect(() => { setTestTo(savedTestAddress(myEmail)); }, [myEmail]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const sent = issue.status !== 'draft';

  async function preview() {
    if (html) { setHtml(null); return; }
    const r = await fetch(`/api/admin/newsletter/issues/${issue.id}`);
    if (r.ok) setHtml((await r.json()).html);
  }
  async function send(body: object, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setMsg('');
    const r = await fetch(`/api/admin/newsletter/issues/${issue.id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(d.error ?? 'Could not send'); return; }
    if (d.test) {
      try { localStorage.setItem(TEST_KEY, d.test); } catch {}
      setMsg(`Test sent to ${d.test}. Check your inbox (and spam folder) before sending to everyone.`);
    }
    else { setMsg(`Sent to ${d.sent} of ${d.subscribers} subscribers${d.failed ? ` (${d.failed} failed)` : ''}. The issue is now archived.`); onChanged(); }
  }
  async function remove() {
    if (!window.confirm('Delete this draft? Its topics become available again.')) return;
    const r = await fetch(`/api/admin/newsletter/issues/${issue.id}`, { method: 'DELETE' });
    if (r.ok) onChanged();
  }

  return (
    <div className={`card-dr space-y-3 p-5 ${sent ? 'opacity-90' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-slate-100">{issue.title}</p>
          <p className="text-xs text-slate-500">
            {issue.topic_count} topic{issue.topic_count === 1 ? '' : 's'}
            {sent && issue.sent_at ? ` · sent ${day(issue.sent_at)} to ${issue.sent_count}${issue.failed_count ? ` (${issue.failed_count} failed)` : ''}` : ` · draft, started ${day(issue.created_at)}`}
          </p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sent ? 'border-slate-600 bg-slate-800 text-slate-400' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}>
          {sent ? 'Archived' : 'Draft'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={preview} className={ghost}>{html ? 'Hide preview' : 'Preview email'}</button>
        {sent ? (
          <a href={`/newsletter/${issue.id}`} target="_blank" rel="noopener noreferrer" className={ghost}>View on the web ↗</a>
        ) : (
          <>
            <button onClick={onEdit} className={ghost}>Edit</button>
            <button onClick={remove} className="text-xs text-rose-400 hover:text-rose-300">Delete draft</button>
          </>
        )}
      </div>
      {html && <iframe title={`Preview of ${issue.title}`} srcDoc={html} sandbox="" className="h-[32rem] w-full rounded-lg border border-slate-700 bg-white" />}
      {!sent && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
          <input value={testTo} onChange={e => setTestTo(e.target.value)} type="email" placeholder="Your email address" aria-label="Send a test copy to"
            className={`${input} max-w-xs py-1.5 text-xs`} />
          <button onClick={() => send({ test: testTo })} disabled={busy || !testTo.includes('@') || !issue.topic_count} className={ghost}
            title="Sends one copy, marked [Test], to this address only. The issue stays a draft.">
            Send test to me
          </button>
          <span className="flex-1" />
          <button onClick={() => send({ confirm: true }, `Send "${issue.title}" to ${subscribers} subscriber${subscribers === 1 ? '' : 's'}? This can't be undone, and the issue will be archived.`)}
            disabled={busy || !issue.topic_count || subscribers === 0} className={btn}>
            {busy ? 'Sending…' : `Send to ${subscribers} subscriber${subscribers === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
      {msg && <p role="status" className="text-xs text-emerald-300">{msg}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewsletterAdminPage() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<'topics' | 'issues' | 'subscribers'>('topics');
  const [editTopic, setEditTopic] = useState<Topic | null | 'new'>(null);
  const [editIssue, setEditIssue] = useState<Issue | null | 'new'>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [paste, setPaste] = useState('');
  const [importMsg, setImportMsg] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/newsletter');
    if (r.ok) setData(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function removeTopic(t: Topic) {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    const r = await fetch(`/api/admin/newsletter/topics/${t.id}`, { method: 'DELETE' });
    if (r.ok) load(); else window.alert((await r.json().catch(() => ({}))).error ?? 'Could not delete');
  }
  async function importSubs() {
    setImportMsg('');
    const r = await fetch('/api/admin/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscribers: paste }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setImportMsg(d.error ?? 'Could not import'); return; }
    setImportMsg(`Found ${d.found} address${d.found === 1 ? '' : 'es'}: ${d.added} added, ${d.existing} already on the list${d.named ? ` (${d.named} given a name)` : ''}.`);
    setPaste(''); load();
  }

  if (!data) return <div className="min-h-screen bg-dr-base px-4 py-10"><div className="mx-auto h-64 max-w-4xl animate-pulse rounded-2xl bg-slate-800/40" /></div>;
  const topics = data.topics.filter(t => showArchived || !t.issue_id || t.issue_status === 'draft');
  const archivedCount = data.topics.filter(t => t.issue_id && t.issue_status !== 'draft').length;

  return (
    <div className="min-h-screen bg-dr-base px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Newsletter</h1>
          <p className="mt-0.5 text-sm text-slate-500">Write topics, gather them into an issue, then send it to {data.subscribers.active} subscriber{data.subscribers.active === 1 ? '' : 's'}.</p>
        </div>

        <div className="mb-6 flex gap-1 border-b border-slate-800">
          {([['topics', 'Topics'], ['issues', 'Issues'], ['subscribers', 'Subscribers']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${tab === id ? 'border-blue-500 text-blue-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'topics' && (
          <div className="space-y-4">
            {editTopic ? (
              <TopicForm topic={editTopic === 'new' ? null : editTopic} onDone={saved => { setEditTopic(null); if (saved) load(); }} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show sent topics ({archivedCount})
                </label>
                <button onClick={() => setEditTopic('new')} className={btn}>+ New topic</button>
              </div>
            )}
            {topics.length === 0 ? (
              <div className="card-dr p-10 text-center text-sm text-slate-500">No topics yet. Write the first one.</div>
            ) : (
              <ul className="space-y-2">
                {topics.map(t => {
                  const locked = !!t.issue_id && t.issue_status !== 'draft';
                  return (
                    <li key={t.id} className="card-dr flex items-start gap-3 p-4">
                      {t.image_path && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.image_path} alt="" className="h-14 w-20 flex-shrink-0 rounded-md object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-100">{t.title}</p>
                          <Chip t={t} />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{day(t.topic_date)}</p>
                      </div>
                      {!locked && (
                        <div className="flex flex-shrink-0 gap-2">
                          <button onClick={() => setEditTopic(t)} className={ghost}>Edit</button>
                          <button onClick={() => removeTopic(t)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {tab === 'issues' && (
          <div className="space-y-4">
            {editIssue ? (
              <IssueForm issue={editIssue === 'new' ? null : editIssue} topics={data.topics} onDone={saved => { setEditIssue(null); if (saved) load(); }} />
            ) : (
              <div className="flex justify-end"><button onClick={() => setEditIssue('new')} className={btn}>+ New issue</button></div>
            )}
            {data.issues.length === 0 ? (
              <div className="card-dr p-10 text-center text-sm text-slate-500">No issues yet. Write some topics, then start an issue.</div>
            ) : data.issues.map(i => (
              <IssueCard key={i.id} issue={i} subscribers={data.subscribers.active} myEmail={data.myEmail} onEdit={() => setEditIssue(i)} onChanged={load} />
            ))}
          </div>
        )}

        {tab === 'subscribers' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="card-dr p-5 text-center"><p className="text-3xl font-extrabold text-blue-400">{data.subscribers.active}</p><p className="mt-1 text-xs text-slate-500">Subscribed</p></div>
              <div className="card-dr p-5 text-center"><p className="text-3xl font-extrabold text-slate-400">{data.subscribers.total - data.subscribers.active}</p><p className="mt-1 text-xs text-slate-500">Unsubscribed</p></div>
            </div>
            <div className="card-dr space-y-3 p-5">
              <h2 className="text-sm font-semibold text-slate-200">Add subscribers</h2>
              <p className="text-xs text-slate-500">
                Paste email addresses, one per line: plain, &ldquo;Name &lt;email&gt;&rdquo;, or rows of a CSV export (e.g. the old debate.report user list).
                Addresses already on the list keep their status, so anyone who unsubscribed stays unsubscribed; a name is added if none was on file.
                Names are used to greet subscribers (&ldquo;Dear Jane,&rdquo;); without one, the email says &ldquo;Hello,&rdquo;.
              </p>
              <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={8} placeholder={'jane@example.org\nJohn Smith <john@example.org>'} className={`${input} font-mono text-xs`} />
              <div className="flex items-center gap-3">
                <button onClick={importSubs} disabled={!paste.trim()} className={btn}>Add subscribers</button>
                {importMsg && <p role="status" className="text-xs text-emerald-300">{importMsg}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
