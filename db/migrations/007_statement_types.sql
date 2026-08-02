-- Add Public Forum debate statement types
ALTER TYPE stat_type_t ADD VALUE IF NOT EXISTS 'framework';
ALTER TYPE stat_type_t ADD VALUE IF NOT EXISTS 'impact';
ALTER TYPE stat_type_t ADD VALUE IF NOT EXISTS 'turn';
