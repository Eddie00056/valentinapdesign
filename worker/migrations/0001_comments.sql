-- Pinned review comments on the /work prototypes.
--
-- dx / dy are CSS pixels from the CENTRE of the page's first island. Nearly
-- every prototype is a fixed-size piece centred on its stage, so an offset
-- from the centre keeps a pin on the same point of the design at any
-- viewport size, where a viewport-relative position would drift.
--
-- author_key is a SHA-256 of a random token the commenter's browser keeps.
-- It is never returned by the API; it only answers "may this browser delete
-- this comment".
CREATE TABLE IF NOT EXISTS comments (
  id         TEXT    PRIMARY KEY,
  page       TEXT    NOT NULL,
  dx         REAL    NOT NULL,
  dy         REAL    NOT NULL,
  body       TEXT    NOT NULL,
  name       TEXT    NOT NULL DEFAULT '',
  author_key TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS comments_page ON comments (page, created_at);
CREATE INDEX IF NOT EXISTS comments_author ON comments (author_key, created_at);
