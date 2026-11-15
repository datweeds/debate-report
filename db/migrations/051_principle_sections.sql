-- Principle sections (Debating, Privacy, …) and a second library based on
-- human rights. Library principles belong to a library and a section; a
-- Society's principles carry the section they were copied into or given.

ALTER TABLE principle_library  ADD COLUMN IF NOT EXISTS library TEXT NOT NULL DEFAULT 'Debating';
ALTER TABLE principle_library  ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE society_principles ADD COLUMN IF NOT EXISTS section TEXT;

-- Sections for the existing Debating library
UPDATE principle_library SET section = CASE title
    WHEN 'Debate the argument, not the person' THEN 'Conduct'
    WHEN 'Argue in good faith'                 THEN 'Conduct'
    WHEN 'Seek understanding as well as winning' THEN 'Conduct'
    WHEN 'Back claims with evidence'           THEN 'Evidence & reasoning'
    WHEN 'Declare your interests'              THEN 'Evidence & reasoning'
    WHEN 'Respect privacy'                     THEN 'Privacy'
    WHEN 'Welcome every member'                THEN 'Inclusion'
    WHEN 'Make decisions in the open'          THEN 'Decision-making'
    WHEN 'Change these principles openly'      THEN 'Decision-making'
    WHEN 'Moderate fairly and visibly'         THEN 'Moderation'
  END
WHERE library = 'Debating' AND section IS NULL;

-- Human rights library: a draft for SysAdmin to review, adapted from the
-- Universal Declaration of Human Rights (UDHR) and the European Convention
-- on Human Rights (ECHR) to how a Society runs. Seeded once.
INSERT INTO principle_library (library, section, sort_order, category, title, body, grounding)
SELECT * FROM (VALUES
  ('Human rights', 'Dignity & equality', 101, 'rule', 'Equal dignity',
   'Every member is treated with equal dignity and respect, whatever their background, beliefs or circumstances.',
   'All human beings are born free and equal in dignity and rights (UDHR Article 1).'),
  ('Human rights', 'Dignity & equality', 102, 'rule', 'No discrimination',
   'No one is treated less favourably because of race, colour, sex, sexual orientation, gender identity, disability, age, language, religion, political or other opinion, national or social origin, or any other status.',
   'Rights belong to everyone without distinction of any kind (UDHR Article 2; ECHR Article 14).'),
  ('Human rights', 'Thought & expression', 103, 'aspiration', 'Freedom of opinion and expression',
   'Everyone may hold opinions without interference and share them, within this Society''s rules on conduct.',
   'Everyone has the right to freedom of opinion and expression (UDHR Article 19; ECHR Article 10).'),
  ('Human rights', 'Thought & expression', 104, 'rule', 'Freedom of thought, conscience and belief',
   'No member is pressured to adopt or give up a belief. Beliefs may be questioned and debated; the people who hold them are respected.',
   'Everyone has the right to freedom of thought, conscience and religion (UDHR Article 18; ECHR Article 9).'),
  ('Human rights', 'Thought & expression', 105, 'guideline', 'Access to information',
   'Information the Society relies on for its decisions is available to its members, so they can form their own views.',
   'Freedom of expression includes the freedom to seek, receive and impart information (UDHR Article 19).'),
  ('Human rights', 'Privacy', 106, 'rule', 'Right to privacy',
   'Members'' private lives and personal information are not exposed or shared without their consent.',
   'No one shall be subjected to arbitrary interference with their privacy, family, home or correspondence (UDHR Article 12; ECHR Article 8).'),
  ('Human rights', 'Privacy', 107, 'rule', 'Protection of reputation',
   'Criticise ideas and actions, not people''s personal lives. Don''t make unfounded attacks on anyone''s honour or reputation.',
   'No one shall be subjected to attacks upon their honour and reputation (UDHR Article 12).'),
  ('Human rights', 'Participation', 108, 'rule', 'Freedom of assembly and association',
   'Members may meet, organise and form groups within the Society. No one is compelled to join a group.',
   'Everyone has the right to peaceful assembly and association; no one may be compelled to belong to an association (UDHR Article 20; ECHR Article 11).'),
  ('Human rights', 'Participation', 109, 'aspiration', 'Everyone can take part',
   'Every member can take part in the Society''s decisions, directly or through representatives they freely choose.',
   'Everyone has the right to take part in the government of their country, directly or through freely chosen representatives (UDHR Article 21).'),
  ('Human rights', 'Participation', 110, 'guideline', 'Fair and regular votes',
   'Votes are held fairly and regularly, with each member''s vote counting equally, and secret ballots where they are needed.',
   'The will of the people is expressed in periodic and genuine elections, by universal and equal suffrage and secret vote (UDHR Article 21).'),
  ('Human rights', 'Fair process', 111, 'rule', 'A fair hearing',
   'A member facing a moderation decision is told why, can respond, and has the matter decided impartially.',
   'Everyone is entitled to a fair and public hearing by an independent and impartial tribunal (UDHR Article 10; ECHR Article 6).'),
  ('Human rights', 'Fair process', 112, 'guideline', 'Presumed to act in good faith',
   'Members are treated as acting in good faith unless the evidence shows otherwise.',
   'Everyone charged is presumed innocent until proved guilty (UDHR Article 11; ECHR Article 6).'),
  ('Human rights', 'Fair process', 113, 'rule', 'Right to put things right',
   'Members can appeal decisions that affect them, and mistakes are corrected.',
   'Everyone has the right to an effective remedy for acts violating their rights (UDHR Article 8; ECHR Article 13).'),
  ('Human rights', 'Responsibilities', 114, 'aspiration', 'Rights with responsibilities',
   'Our rights come with duties to each other. Limits on anyone''s rights exist only to secure respect for the rights of others and the fair running of the Society.',
   'Everyone has duties to the community; limitations on rights are only those needed to secure respect for the rights of others (UDHR Article 29).')
) AS v(library, section, sort_order, category, title, body, grounding)
WHERE NOT EXISTS (SELECT 1 FROM principle_library WHERE library = 'Human rights');
