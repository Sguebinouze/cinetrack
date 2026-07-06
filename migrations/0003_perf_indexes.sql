CREATE INDEX IF NOT EXISTS idx_watchentry_status_updatedat ON WatchEntry(status, updatedAt DESC);
CREATE INDEX IF NOT EXISTS idx_watchentry_watchedat ON WatchEntry(watchedAt);
CREATE INDEX IF NOT EXISTS idx_episode_watchedat ON Episode(watchedAt);
