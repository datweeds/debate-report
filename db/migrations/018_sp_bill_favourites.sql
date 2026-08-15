CREATE TABLE IF NOT EXISTS sp_bill_favs (
  bill_id    INT  NOT NULL REFERENCES sp_bills(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bill_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sp_bill_favs_user ON sp_bill_favs(user_id);
