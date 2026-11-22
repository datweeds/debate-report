-- Reporting any item (an event, a discussion reply, a document…), by members
-- and by people without an account. Reports go into content_alerts, the same
-- review queue as the abuse scanner.
--   report_route  'society': the Society's moderators (Sys Admin as backstop)
--                 'platform': Sys Admin only (possibly illegal content, a whole
--                 Society, a profile). Moderators and the author don't see these.
--   urgent        possibly illegal: top of the queue, and the Society can't be
--                 deleted until it has been reviewed
--   reporter_hash someone without an account: their address, hashed with the
--                 day, so a second report of the same item is caught that day
--                 but addresses can't be followed across days
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS urgent        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS report_route  TEXT CHECK (report_route IN ('society', 'platform'));
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS reporter_hash TEXT;
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS item_kind     TEXT;
CREATE INDEX IF NOT EXISTS idx_content_alerts_report ON content_alerts (content_key, item_kind) WHERE report_route IS NOT NULL;

-- Reports per address or account per day (5 a day without an account)
CREATE TABLE IF NOT EXISTS report_limits (
    key  TEXT    NOT NULL,
    day  DATE    NOT NULL,
    n    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (key, day)
);

-- Society tasks and project tasks shared the scanner's type names, so masking a
-- Society task looked in the wrong table. Society tasks now have their own.
UPDATE content_alerts ca SET content_type = 'society_' || ca.content_type
 WHERE ca.content_type IN ('task_name', 'task_description', 'task_notes')
   AND EXISTS (SELECT 1 FROM society_tasks t WHERE t.id::text = COALESCE(ca.content_key, ca.content_id::text));
