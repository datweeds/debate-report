// Provider adapters: Anthropic's API, and the OpenAI-compatible API used by
// most other providers and local model servers. Provider-specific code lives
// only here. Server-only.

import Anthropic from '@anthropic-ai/sdk';
import dns from 'dns/promises';
import net from 'net';
import type { Adapter } from './presets';

export type Completion = { text: string; model: string; tokensIn: number; tokensOut: number };

export class ProviderError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

export const localEndpointsAllowed = () => process.env.AI_ALLOW_LOCAL_ENDPOINTS === '1';

function isPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
}

// Custom endpoints: https to public addresses only, unless this install
// allows local endpoints (self-hosting). Stops a Society reaching the
// server's internal network.
export async function checkEndpoint(baseUrl: string): Promise<void> {
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new ProviderError('That isn’t a valid URL'); }
  if (localEndpointsAllowed()) {
    if (!['http:', 'https:'].includes(url.protocol)) throw new ProviderError('Only http and https URLs are allowed');
    return;
  }
  if (url.protocol !== 'https:') throw new ProviderError('The address must start with https://');
  const addrs = net.isIP(url.hostname) ? [url.hostname] : (await dns.lookup(url.hostname, { all: true }).catch(() => [])).map(a => a.address);
  if (!addrs.length) throw new ProviderError(`Can’t find ${url.hostname}`);
  if (addrs.some(isPrivate)) throw new ProviderError('Private and local network addresses aren’t allowed on this site');
}

export type ProviderConfig = { adapter: Adapter; baseUrl: string | null; apiKey: string | null };

export async function listModels(p: ProviderConfig): Promise<string[]> {
  if (p.adapter === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: { 'x-api-key': p.apiKey ?? '', 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new ProviderError(res.status === 401 ? 'The API key was not accepted' : `Anthropic replied ${res.status}`, res.status);
    return ((await res.json()).data ?? []).map((m: { id: string }) => m.id);
  }
  if (!p.baseUrl) throw new ProviderError('Enter the base URL');
  await checkEndpoint(p.baseUrl);
  const res = await fetch(`${p.baseUrl.replace(/\/$/, '')}/models`, {
    headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}, signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  if (!res.ok) throw new ProviderError(res.status === 401 || res.status === 403 ? 'The API key was not accepted' : `The provider replied ${res.status}`, res.status);
  const body = await res.json();
  const list = (body.data ?? body.models ?? []) as { id?: string; name?: string }[];
  return list.map(m => (m.id ?? m.name ?? '').replace(/^models\//, '')).filter(Boolean).sort();
}

export async function complete(p: ProviderConfig, model: string, system: string, user: string, maxTokens: number,
  timeoutMs = 180_000): Promise<Completion> {
  if (p.adapter === 'anthropic') {
    const client = new Anthropic({ apiKey: p.apiKey ?? '', timeout: timeoutMs, maxRetries: 1 });
    try {
      const msg = await client.messages.create({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] });
      return {
        text: msg.content.map(b => (b.type === 'text' ? b.text : '')).join(''), model: msg.model,
        tokensIn: msg.usage.input_tokens, tokensOut: msg.usage.output_tokens,
      };
    } catch (err) {
      throw new ProviderError((err as Error).message, (err as { status?: number }).status);
    }
  }
  if (!p.baseUrl) throw new ProviderError('No base URL');
  await checkEndpoint(p.baseUrl);
  const res = await fetch(`${p.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}) },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
  }).catch(err => { throw new ProviderError(`Couldn’t reach the provider: ${(err as Error).message}`); });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ProviderError(body?.error?.message ?? `The provider replied ${res.status}`, res.status);
  return {
    text: body.choices?.[0]?.message?.content ?? '', model: body.model ?? model,
    tokensIn: body.usage?.prompt_tokens ?? 0, tokensOut: body.usage?.completion_tokens ?? 0,
  };
}

// The JSON object in a reply, tolerating code fences or a preamble
export function parseJson(text: string): unknown {
  const t = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
  const start = t.indexOf('{'), end = t.lastIndexOf('}');
  if (start < 0 || end <= start) throw new ProviderError('The reply had no JSON');
  return JSON.parse(t.slice(start, end + 1));
}
