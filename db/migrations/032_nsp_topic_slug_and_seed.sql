-- Add slug to nsp_topics (used for routing and Header links)
ALTER TABLE nsp_topics ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS nsp_topics_slug_tenant_idx ON nsp_topics (slug, tenant_id);

-- Seed the 12 unified subject areas for tenant 1
-- These match the TOPICS array in components/Header.tsx
INSERT INTO nsp_topics (name, slug, description, sort_order, tenant_id) VALUES
  ('Culture, Identity & Social Issues',       'culture',     'Arts, heritage, identity politics, religion in public life, immigration, equality and diversity.', 1,  1),
  ('Economics & Markets',                      'economics',   'Fiscal policy, taxation, trade, business regulation, labour markets, inequality and economic growth.', 2,  1),
  ('Education & Knowledge',                    'education',   'Schools, universities, skills, research policy, curriculum and access to learning.', 3,  1),
  ('Environment & Energy',                     'environment', 'Climate change, net zero, energy policy, land use, biodiversity, waste and water.', 4,  1),
  ('Future & Existential Questions',           'future',      'Long-term risks and opportunities: AI, population, pandemics, space and civilisational strategy.', 5,  1),
  ('Health, Medicine & Bioethics',             'health',      'NHS, public health, mental health, end-of-life care, reproductive rights and medical ethics.', 6,  1),
  ('History & Historical Interpretation',      'history',     'How the past is understood, taught and commemorated; statues, memorials and historical justice.', 7,  1),
  ('Law, Rights & Justice',                    'law',         'Criminal justice, civil liberties, human rights, policing, courts and prison policy.', 8,  1),
  ('Media, Information & Epistemology',        'media',       'Press freedom, misinformation, social media regulation, public broadcasting and epistemic trust.', 9,  1),
  ('Philosophy, Ethics & Religion',            'philosophy',  'Moral philosophy, applied ethics, the role of religion in public life and normative foundations of policy.', 10, 1),
  ('Politics, Policy & Governance',            'politics',    'Democracy, devolution, electoral reform, lobbying, constitutional change and public administration.', 11, 1),
  ('Science & Technology',                     'science',     'R&D policy, digital infrastructure, data governance, biotech, space and the regulation of emerging technologies.', 12, 1)
ON CONFLICT DO NOTHING;
