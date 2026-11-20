'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AI_TASKS, PRESETS, TIERS, presetById } from '@/lib/ai/presets';

type Settings = {
  mode: 'platform' | 'own' | 'off'; preset: string | null; base_url: string | null;
  model_light: string | null; model_standard: string | null; has_key: boolean;
  light_in_usd: number; light_out_usd: number; standard_in_usd: number; standard_out_usd: number;
  monthly_budget_usd: number | null;
  last_test: { ok: boolean; error?: string | null; latency_ms?: number; model_tested?: string; at?: string } | null;
};
type Data = {
  settings: Settings;
  news: { configured: boolean; enabled: boolean; use_llm: boolean } | null;
  available: boolean; reason: string;
  platform: { mode: string; daily_budget_usd: number; spent_today_usd: number; reachable: boolean };
  month: { platform_usd: number; own_usd: number };
  usage: { day: string; task: string; scope: string; calls: number | null; not_run: number; cost_usd: number }[];
  allowLocal: boolean; secretsReady: boolean;
};

const input = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none';
const label = 'mb-1 block text-xs text-slate-400';
const usd = (n: number) => n < 0.01 && n > 0 ? '<$0.01' : `$${n.toFixed(2)}`;
const TASK_LABEL: Record<string, string> = {
  ...Object.fromEntries(AI_TASKS.map(t => [t.id, t.label])),
  'news.extract': 'News: tagging stories', 'news.digest_writer': 'News editions',
};

const MODES = [
  { id: 'platform', title: 'new.vote’s AI', text: 'Included. Uses the site’s AI within its daily limit. Nothing to set up.' },
  { id: 'own', title: 'Our own provider', text: 'Bring your own API key or model server. Your Society pays the provider directly, within a monthly budget you set.' },
  { id: 'off', title: 'No AI', text: 'Everything still works: editions use the outlets’ own headlines and Quality Reports run the rule checks only.' },
] as const;

function Guidance() {
  return (
    <details className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-slate-300">
      <summary className="cursor-pointer font-semibold text-blue-200">Which provider should we choose?</summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <li><strong>Just want it to work?</strong> Stay on new.vote’s AI. Switch only if you need more than the site’s daily limit, a particular model, or control over where your data goes.</li>
        <li><strong>Privacy first:</strong> choose a paid API whose terms say it doesn’t train on your data (Anthropic, OpenAI and Mistral paid APIs do not by default), or run a model yourself. For processing in the EU, Mistral is a good fit. Free tiers (e.g. Google’s) may use your prompts to improve their products.</li>
        <li><strong>Lowest cost:</strong> Google Gemini Flash, Groq, or small models through OpenRouter. Use the cheap model for light tasks only, and a better one for writing.</li>
        <li><strong>Best writing and reviews:</strong> larger models such as Claude Sonnet, OpenAI’s full-size models or Gemini Pro. Debate reviews benefit most from a strong model.</li>
        <li><strong>Two models:</strong> “Light tasks” (tagging, sorting) need only a small model; “Writing and reviewing” (edition summaries, Quality Reports) is where quality shows. You can use the same model for both.</li>
        <li><strong>What it costs:</strong> roughly 1–2 cents for a daily News edition with a small or mid-size model, and 5–30 cents for a Quality Report review, depending on the size of the debate and the model.</li>
        <li><strong>Keys:</strong> create a key just for this Society and set a spending limit at the provider as well. Keys are stored encrypted and never shown again, even to you.</li>
      </ul>
    </details>
  );
}

export default function SocietyAiCard({ societyId }: { societyId: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<'' | 'save' | 'models' | 'test'>('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [test, setTest] = useState<Settings['last_test']>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/societies/${societyId}/ai`);
    if (!r.ok) return;
    const d: Data = await r.json();
    setData(d); setForm(d.settings); setTest(d.settings.last_test);
  }, [societyId]);
  useEffect(() => { void load(); }, [load]);

  if (!data || !form) return <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;
  const preset = presetById(form.preset);
  const set = (patch: Partial<Settings>) => setForm({ ...form, ...patch });
  const provider = { preset: form.preset, base_url: form.base_url, api_key: apiKey || undefined };

  async function post(path: string, body: unknown) {
    const r = await fetch(`/api/societies/${societyId}/ai${path}`, { method: path ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, d: await r.json().catch(() => ({})) };
  }

  async function save(extra: Record<string, unknown> = {}) {
    setBusy('save'); setMessage(null);
    const { ok, d } = await post('', { ai: { ...form, api_key: apiKey || undefined }, ...extra });
    setBusy('');
    if (!ok) { setMessage({ ok: false, text: d.error ?? 'Could not save.' }); return; }
    setApiKey('');
    setMessage({ ok: !d.warning, text: d.warning ?? 'Saved.' });
    await load();
  }

  async function loadModels() {
    setBusy('models'); setMessage(null);
    const { ok, d } = await post('/models', provider);
    setBusy('');
    if (!ok) { setMessage({ ok: false, text: d.error ?? 'Could not load the models.' }); return; }
    setModels(d.models ?? []);
    if (!d.models?.length) setMessage({ ok: false, text: 'The provider listed no models; type the model name instead.' });
  }

  async function runTest() {
    setBusy('test'); setMessage(null);
    const { d } = await post('/test', { ...provider, model: form!.model_standard || form!.model_light });
    setBusy('');
    setTest(d);
  }

  async function toggleNews(patch: { news_enabled?: boolean; news_use_llm?: boolean }) {
    setBusy('save');
    await post('', patch);
    setBusy('');
    await load();
  }

  const recent = data.usage.filter(u => u.cost_usd > 0 || u.not_run > 0).slice(0, 14);

  return (
    <div className="rounded-2xl border border-slate-800 bg-dr-card p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-200">AI</h2>
        <span className={`text-xs ${data.available ? 'text-emerald-400' : 'text-amber-300'}`}>
          {data.available ? '● AI available' : '● AI paused'}
        </span>
      </div>
      {!data.available && <p className="-mt-2 text-xs leading-relaxed text-amber-200/90">{data.reason}</p>}
      {data.settings.mode !== 'own' && data.settings.mode !== 'off' && (
        <p className="-mt-2 text-xs text-slate-500">
          new.vote’s AI today (all Societies): ${data.platform.spent_today_usd.toFixed(2)} of ${data.platform.daily_budget_usd.toFixed(2)} ·
          this Society this month: ${data.month.platform_usd.toFixed(2)}.
          {!data.available && ' Connect your own provider to keep using AI when the shared budget runs out.'}
        </p>
      )}

      {/* Which AI */}
      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map(m => (
          <button key={m.id} type="button" onClick={() => set({ mode: m.id })}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${form.mode === m.id ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}>
            <span className={`block text-sm font-semibold ${form.mode === m.id ? 'text-blue-200' : 'text-slate-300'}`}>{m.title}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{m.text}</span>
          </button>
        ))}
      </div>

      {form.mode === 'own' && (
        <div className="space-y-4 rounded-xl border border-slate-800 p-4">
          {!data.secretsReady && <p className="text-xs text-amber-300">Keys can’t be stored on this server yet (AI_SECRET_KEY isn’t set).</p>}
          <Guidance />
          <div>
            <p className={label}>Provider</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PRESETS.map(p => {
                const disabled = p.local && !data.allowLocal;
                return (
                  <button key={p.id} type="button" disabled={disabled}
                    onClick={() => { set({ preset: p.id, base_url: p.baseUrl && !p.local ? p.baseUrl : (p.id === form.preset ? form.base_url : p.baseUrl) }); setModels([]); }}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-40 ${form.preset === p.id ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}>
                    <span className="block text-sm font-medium text-slate-200">{p.name}</span>
                    <span className="block text-[11px] leading-snug text-slate-500">{disabled ? 'Self-hosted installs only.' : p.blurb}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {preset && (
            <>
              <p className="text-xs text-slate-400">
                {preset.notes}{' '}
                {preset.keyUrl && <a href={preset.keyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Get an API key ↗</a>}
                {preset.pricingUrl && <> · <a href={preset.pricingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Prices ↗</a></>}
              </p>
              {(preset.id === 'custom' || preset.local) && (
                <div>
                  <label className={label}>Base URL</label>
                  <input value={form.base_url ?? ''} onChange={e => set({ base_url: e.target.value })} className={input}
                    placeholder={preset.local ? 'http://127.0.0.1:11434/v1' : 'https://your-server.example.org/v1'} />
                </div>
              )}
              <div>
                <label className={label}>API key {!preset.keyRequired && <span className="text-slate-600">(if your server needs one)</span>}</label>
                <input type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} className={input}
                  placeholder={form.has_key && data.settings.preset === form.preset ? '•••••••• saved — leave blank to keep it' : 'Paste the key'} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={loadModels} disabled={!!busy}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                  {busy === 'models' ? 'Loading…' : 'Load the provider’s models'}
                </button>
                {models.length > 0 && <span className="text-xs text-slate-500">{models.length} models available</span>}
              </div>
              <datalist id={`ai-models-${societyId}`}>{models.map(m => <option key={m} value={m} />)}</datalist>

              {(['standard', 'light'] as const).map(tier => (
                <div key={tier} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                  <div>
                    <label className={label}>{TIERS[tier].label} model <span className="text-slate-600">— {TIERS[tier].examples}</span></label>
                    <input list={`ai-models-${societyId}`} value={(tier === 'light' ? form.model_light : form.model_standard) ?? ''}
                      onChange={e => set(tier === 'light' ? { model_light: e.target.value } : { model_standard: e.target.value })}
                      className={input} placeholder={tier === 'light' ? 'Optional: uses the writing model if empty' : 'Choose or type a model'} />
                    <p className="mt-1 text-[11px] text-slate-500">{TIERS[tier].advice}</p>
                  </div>
                  <div>
                    <label className={label}>Input $ / million tokens</label>
                    <input type="number" min={0} step="0.01" value={tier === 'light' ? form.light_in_usd : form.standard_in_usd}
                      onChange={e => set(tier === 'light' ? { light_in_usd: Number(e.target.value) } : { standard_in_usd: Number(e.target.value) })} className={input} />
                  </div>
                  <div>
                    <label className={label}>Output $ / million tokens</label>
                    <input type="number" min={0} step="0.01" value={tier === 'light' ? form.light_out_usd : form.standard_out_usd}
                      onChange={e => set(tier === 'light' ? { light_out_usd: Number(e.target.value) } : { standard_out_usd: Number(e.target.value) })} className={input} />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-slate-500">Prices come from the provider’s price list and are used to track spending against your budget. Use 0 for free or self-hosted models.</p>

              <div className="grid gap-3 sm:grid-cols-[1fr_2fr] sm:items-end">
                <div>
                  <label className={label}>Monthly budget (US$)</label>
                  <input type="number" min={0} step="1" value={form.monthly_budget_usd ?? ''} placeholder="No limit"
                    onChange={e => set({ monthly_budget_usd: e.target.value === '' ? null : Number(e.target.value) })} className={input} />
                </div>
                <p className="text-[11px] text-slate-500">When it is reached, AI pauses for your Society until the next month and features use their non-AI versions. Your Society is never moved onto new.vote’s AI instead.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={runTest} disabled={!!busy || !(form.model_standard || form.model_light)}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                  {busy === 'test' ? 'Testing…' : 'Test this model'}
                </button>
                {test && (
                  <span className={`text-xs ${test.ok ? 'text-emerald-400' : 'text-rose-300'}`}>
                    {test.ok ? `✓ ${test.model_tested} works: valid structured answer in ${((test.latency_ms ?? 0) / 1000).toFixed(1)} s` : `✗ ${test.error}`}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => save()} disabled={!!busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          {busy === 'save' ? 'Saving…' : 'Save AI settings'}
        </button>
        {message && <span className={`text-xs ${message.ok ? 'text-emerald-400' : 'text-rose-300'}`}>{message.text}</span>}
      </div>

      {/* News */}
      <div className="border-t border-slate-800 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">News</h3>
        {!data.news?.configured ? (
          <p className="mt-2 text-xs text-slate-400">News isn’t set up yet. <Link href={`/society/${societyId}/news/settings`} className="text-blue-400 hover:underline">Set up News →</Link></p>
        ) : (
          <div className="mt-2 space-y-2">
            <label className="flex items-start gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={data.news.enabled} disabled={!!busy} onChange={e => toggleNews({ news_enabled: e.target.checked })} className="mt-0.5 h-4 w-4 accent-blue-500" />
              <span>Publish News for this Society <span className="block text-xs text-slate-500">Off: no editions and no AI use for News. Earlier editions stay readable.</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={data.news.use_llm} disabled={!!busy || !data.news.enabled} onChange={e => toggleNews({ news_use_llm: e.target.checked })} className="mt-0.5 h-4 w-4 accent-blue-500" />
              <span>AI write-ups for editions <span className="block text-xs text-slate-500">An overview, plain headlines, summaries and “why it matters”. Off: editions use the outlets’ own headlines, at no AI cost.</span></span>
            </label>
          </div>
        )}
      </div>

      {/* What uses AI */}
      <div className="border-t border-slate-800 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">What uses AI</h3>
        <ul className="mt-2 space-y-1.5 text-xs">
          {AI_TASKS.map(t => (
            <li key={t.id} className="flex flex-wrap justify-between gap-x-4">
              <span className="text-slate-300">{t.label}</span>
              <span className="text-slate-500">
                {t.uses === 'platform' ? 'Always new.vote’s AI (shared by all Societies)' : form.mode === 'own' ? 'Your provider' : form.mode === 'off' ? 'Off' : 'new.vote’s AI'}
                {' · without AI: '}{t.fallback.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Spend */}
      <div className="border-t border-slate-800 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">This month</h3>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-800 px-3 py-2">
            <p className="text-[11px] text-slate-500">On new.vote’s AI (included)</p>
            <p className="text-lg font-bold tabular-nums text-slate-100">{usd(data.month.platform_usd)}</p>
          </div>
          <div className="rounded-lg border border-slate-800 px-3 py-2">
            <p className="text-[11px] text-slate-500">On your own provider{form.monthly_budget_usd != null && form.mode === 'own' ? ` (budget ${usd(form.monthly_budget_usd)})` : ''}</p>
            <p className="text-lg font-bold tabular-nums text-slate-100">{usd(data.month.own_usd)}</p>
          </div>
        </div>
        {recent.length > 0 && (
          <table className="mt-3 w-full text-left text-xs">
            <thead className="text-slate-500"><tr><th className="py-1 font-normal">Day</th><th className="font-normal">Feature</th><th className="font-normal">Paid by</th><th className="text-right font-normal">Cost</th></tr></thead>
            <tbody className="text-slate-300">
              {recent.map((u, n) => (
                <tr key={n} className="border-t border-slate-800/60">
                  <td className="py-1">{u.day}</td>
                  <td>{TASK_LABEL[u.task] ?? u.task}{u.not_run > 0 && <span className="text-amber-300"> · {u.not_run} not run</span>}</td>
                  <td className="text-slate-500">{u.scope === 'own' ? 'Your provider' : u.scope === 'platform' ? 'new.vote' : '—'}</td>
                  <td className="text-right tabular-nums">{usd(u.cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
