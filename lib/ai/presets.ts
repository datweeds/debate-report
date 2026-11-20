// AI providers a Society can choose, with guidance for admins. Model names
// are not hard-coded: the admin picks from the list the provider reports.
// Shared by server and browser.

export type Adapter = 'anthropic' | 'openai_compat';

export type Preset = {
  id: string;
  name: string;
  adapter: Adapter;
  baseUrl: string | null;      // null: the admin enters it
  keyUrl: string | null;       // where to create an API key
  pricingUrl: string | null;
  keyRequired: boolean;
  local?: boolean;             // runs on your own server (self-hosted installs only)
  blurb: string;               // one line, shown on the card
  notes: string;               // more detail, shown when chosen
};

export const PRESETS: Preset[] = [
  {
    id: 'anthropic', name: 'Anthropic (Claude)', adapter: 'anthropic', baseUrl: null,
    keyUrl: 'https://console.anthropic.com/settings/keys', pricingUrl: 'https://www.anthropic.com/pricing#api', keyRequired: true,
    blurb: 'Strong writing and careful reasoning; the platform’s own default.',
    notes: 'Haiku models suit light tasks; Sonnet models suit writing edition summaries and reviewing debates. Anthropic does not train on API data by default.',
  },
  {
    id: 'openai', name: 'OpenAI', adapter: 'openai_compat', baseUrl: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys', pricingUrl: 'https://openai.com/api/pricing', keyRequired: true,
    blurb: 'Widely used general models in several sizes.',
    notes: 'Pick a “mini” model for light tasks and a full-size model for writing and reviews.',
  },
  {
    id: 'google', name: 'Google Gemini', adapter: 'openai_compat', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyUrl: 'https://aistudio.google.com/app/apikey', pricingUrl: 'https://ai.google.dev/pricing', keyRequired: true,
    blurb: 'Fast, low-cost “Flash” models; a free tier for light use.',
    notes: 'Uses Google’s OpenAI-compatible endpoint. On the free tier Google may use your prompts to improve its products; use a paid key for anything sensitive.',
  },
  {
    id: 'mistral', name: 'Mistral', adapter: 'openai_compat', baseUrl: 'https://api.mistral.ai/v1',
    keyUrl: 'https://console.mistral.ai/api-keys', pricingUrl: 'https://mistral.ai/pricing', keyRequired: true,
    blurb: 'European provider (EU data processing); good value small models.',
    notes: 'A good choice if your Society wants its data processed in the EU.',
  },
  {
    id: 'groq', name: 'Groq', adapter: 'openai_compat', baseUrl: 'https://api.groq.com/openai/v1',
    keyUrl: 'https://console.groq.com/keys', pricingUrl: 'https://groq.com/pricing', keyRequired: true,
    blurb: 'Very fast open models (Llama, Qwen and others) at low prices.',
    notes: 'Open-weight models; choose a larger one (around 70B) for writing and reviews.',
  },
  {
    id: 'openrouter', name: 'OpenRouter', adapter: 'openai_compat', baseUrl: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys', pricingUrl: 'https://openrouter.ai/models', keyRequired: true,
    blurb: 'One key for hundreds of models from many providers.',
    notes: 'Handy for trying different models. Each model’s price and data policy is shown on OpenRouter.',
  },
  {
    id: 'together', name: 'Together AI', adapter: 'openai_compat', baseUrl: 'https://api.together.xyz/v1',
    keyUrl: 'https://api.together.ai/settings/api-keys', pricingUrl: 'https://www.together.ai/pricing', keyRequired: true,
    blurb: 'Hosted open-weight models.',
    notes: 'Open-weight models in many sizes.',
  },
  {
    id: 'custom', name: 'Other OpenAI-compatible service', adapter: 'openai_compat', baseUrl: null,
    keyUrl: null, pricingUrl: null, keyRequired: false,
    blurb: 'Any service with an OpenAI-compatible API, e.g. your own model server reachable over HTTPS.',
    notes: 'Enter the base URL (usually ending in /v1). For your own server, put it behind HTTPS and an API key.',
  },
  {
    id: 'ollama', name: 'Ollama / LM Studio on this server', adapter: 'openai_compat', baseUrl: 'http://127.0.0.1:11434/v1',
    keyUrl: null, pricingUrl: null, keyRequired: false, local: true,
    blurb: 'Fully private: models run on the same server. Self-hosted installs only.',
    notes: 'Needs spare memory: about 8–16 GB RAM for a small model (light tasks, slow), or a GPU for writing at a usable speed. LM Studio’s default address is http://127.0.0.1:1234/v1.',
  },
];

export const presetById = (id: string | null | undefined) => PRESETS.find(p => p.id === id) ?? null;

// The kinds of work, so admins can pick a model for each
export const TIERS = {
  light: {
    label: 'Light tasks',
    examples: 'tagging and sorting: topics, places, short labels',
    advice: 'A small, cheap, fast model is enough.',
  },
  standard: {
    label: 'Writing and reviewing',
    examples: 'News edition summaries and “why it matters”, Debate Quality Report reviews',
    advice: 'Use a mid-size or larger model: quality shows here.',
  },
} as const;

// Every AI feature, the kind of work it is, and what happens without AI
export const AI_TASKS = [
  { id: 'news.digest_writer', label: 'News editions: overview, headlines, summaries', tier: 'standard', uses: 'society', fallback: 'The outlets’ own headlines and snippets' },
  { id: 'debate.quality_review', label: 'Debate Quality Report: AI review', tier: 'standard', uses: 'society', fallback: 'The rule checks only' },
  { id: 'debate.argue', label: 'AI Arg Generator: suggested arguments for a statement', tier: 'standard', uses: 'society', fallback: 'Not available' },
  { id: 'news.extract', label: 'News: tagging stories with topics and places', tier: 'light', uses: 'platform', fallback: 'Stories still grouped and ranked, without tags' },
] as const;
