CREATE TABLE IF NOT EXISTS Media (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdbId       INTEGER NOT NULL UNIQUE,
  mediaType    TEXT NOT NULL,
  title        TEXT NOT NULL,
  posterPath   TEXT,
  backdropPath TEXT,
  overview     TEXT,
  releaseDate  TEXT,
  genres       TEXT,
  runtime      INTEGER,
  voteAverage  REAL,
  createdAt    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS WatchEntry (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  mediaId       INTEGER NOT NULL UNIQUE REFERENCES Media(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'watchlist',
  rating        REAL,
  reviewPrivate TEXT,
  reviewPublic  TEXT,
  watchedAt     TEXT,
  addedAt       TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Season (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mediaId      INTEGER NOT NULL REFERENCES Media(id) ON DELETE CASCADE,
  seasonNumber INTEGER NOT NULL,
  name         TEXT,
  episodeCount INTEGER,
  UNIQUE(mediaId, seasonNumber)
);

CREATE TABLE IF NOT EXISTS Episode (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  seasonId      INTEGER NOT NULL REFERENCES Season(id) ON DELETE CASCADE,
  episodeNumber INTEGER NOT NULL,
  name          TEXT,
  airDate       TEXT,
  watched       INTEGER NOT NULL DEFAULT 0,
  watchedAt     TEXT,
  UNIQUE(seasonId, episodeNumber)
);

CREATE TABLE IF NOT EXISTS WatchLog (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdbId    INTEGER NOT NULL,
  mediaType TEXT NOT NULL,
  title     TEXT NOT NULL,
  watchedAt TEXT NOT NULL DEFAULT (datetime('now')),
  note      TEXT
);

CREATE INDEX IF NOT EXISTS idx_watchentry_status ON WatchEntry(status);
CREATE INDEX IF NOT EXISTS idx_media_tmdbid ON Media(tmdbId);
CREATE INDEX IF NOT EXISTS idx_episode_watched ON Episode(watched);
