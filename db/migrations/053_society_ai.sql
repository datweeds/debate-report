-- AI settings per Society, and a log of every AI call (no content).

-- News: whether the Society's editions use AI write-ups
ALTER TABLE society_news ADD COLUMN IF NOT EXISTS use_llm BOOLEAN NOT NULL DEFAULT TRUE;

-- Which AI a Society uses: the platform's (default), its own provider, or none
CREATE TABLE IF NOT EXISTS society_ai (
    customer_id        INTEGER     PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    mode               TEXT        NOT NULL DEFAULT 'platform' CHECK (mode IN ('platform', 'own', 'off')),
    preset             TEXT,                  -- e.g. anthropic, openai, google, mistral, custom
    adapter            TEXT        CHECK (adapter IN ('anthropic', 'openai_compat')),
    base_url           TEXT,
    model_light        TEXT,                  -- tagging and sorting
    model_standard     TEXT,                  -- writing and reviewing
    secret_enc         TEXT,                  -- API key, AES-256-GCM (AI_SECRET_KEY); never returned
    light_in_usd       NUMERIC(10, 4) NOT NULL DEFAULT 0,   -- prices per million tokens
    light_out_usd      NUMERIC(10, 4) NOT NULL DEFAULT 0,
    standard_in_usd    NUMERIC(10, 4) NOT NULL DEFAULT 0,
    standard_out_usd   NUMERIC(10, 4) NOT NULL DEFAULT 0,
    monthly_budget_usd NUMERIC(10, 2),        -- own provider only; NULL = no limit
    last_test          JSONB,
    updated_by         UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_calls (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task        TEXT        NOT NULL,
    customer_id INTEGER     REFERENCES customers(id) ON DELETE SET NULL,
    scope       TEXT        NOT NULL CHECK (scope IN ('platform', 'own', 'none')),
    provider    TEXT        NOT NULL,
    model       TEXT,
    status      TEXT        NOT NULL CHECK (status IN ('ok', 'error', 'skipped')),
    tokens_in   INTEGER     NOT NULL DEFAULT 0,
    tokens_out  INTEGER     NOT NULL DEFAULT 0,
    cost_usd    NUMERIC(12, 6) NOT NULL DEFAULT 0,
    latency_ms  INTEGER,
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_calls_created ON ai_calls (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_calls_society ON ai_calls (customer_id, created_at DESC);
