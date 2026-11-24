-- The free plan is now called Pod (was Huddle): the read-only message in the
-- society_writable trigger (migrations 083/084) says so.
DO $$
BEGIN
  EXECUTE replace(pg_get_functiondef('trg_society_writable'::regproc), 'Huddle', 'Pod');
END $$;
