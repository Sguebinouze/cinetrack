CREATE INDEX IF NOT EXISTS idx_watchentry_year ON WatchEntry(strftime('%Y', COALESCE(watchedAt, updatedAt)));
CREATE INDEX IF NOT EXISTS idx_episode_year ON Episode(strftime('%Y', watchedAt));
