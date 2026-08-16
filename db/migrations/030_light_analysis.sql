-- Track when principles are edited
ALTER TABLE nsp_principles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE nsp_principles SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE nsp_principles ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE nsp_principles ALTER COLUMN updated_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nsp_principles_updated_at ON nsp_principles;
CREATE TRIGGER nsp_principles_updated_at
BEFORE UPDATE ON nsp_principles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Monthly AI budget agreed at contract stage (NULL = unlimited)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ai_budget_cents INT DEFAULT NULL;

-- Light analysis: 1–10 relevance score per (tenant, entity, topic)
CREATE TABLE IF NOT EXISTS society_light_analyses (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT  NOT NULL,
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('act','bill','ssi','proposal')),
  entity_id     INT  NOT NULL,
  topic_id      INT  NOT NULL,
  score         SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
  rationale     TEXT,
  synopsis_used TEXT,
  model         TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
  input_tokens  INT  NOT NULL DEFAULT 0,
  output_tokens INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, entity_id, topic_id)
);
CREATE INDEX IF NOT EXISTS sla_tenant_topic  ON society_light_analyses (tenant_id, topic_id);
CREATE INDEX IF NOT EXISTS sla_entity        ON society_light_analyses (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS sla_score         ON society_light_analyses (tenant_id, score DESC);

-- Interest flags: entities marked for deep-analysis scheduling
CREATE TABLE IF NOT EXISTS society_interest_flags (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT  NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   INT  NOT NULL,
  flagged_by  TEXT NOT NULL,
  notes       TEXT,
  flagged_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS sif_tenant ON society_interest_flags (tenant_id);

-- AI usage log: every API call (light + heavy), for cost tracking and stats
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT  NOT NULL,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('light','heavy')),
  entity_type   TEXT NOT NULL,
  entity_id     INT,
  topic_id      INT,
  model         TEXT NOT NULL,
  input_tokens  INT  NOT NULL DEFAULT 0,
  output_tokens INT  NOT NULL DEFAULT 0,
  -- cost in microdollars (divide by 1,000,000 for dollars)
  cost_micro    INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aul_tenant_month ON ai_usage_log (tenant_id, created_at DESC);
