-- Private per-slide notes on the GUSTO presentation deck.
--
-- One row per slide number. Unlike comments, these are never public: the
-- Worker requires OWNER_PASSCODE to read OR write this table (see
-- worker/index.js), so a stray GET from a site visitor gets nothing at all.
CREATE TABLE IF NOT EXISTS deck_notes (
  n          INTEGER PRIMARY KEY,
  body       TEXT    NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
