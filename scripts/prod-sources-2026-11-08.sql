-- Production ingestion source cleanup (2026-11-08). Run once:
--   npx wrangler d1 execute checkin-daily-db --remote --file=scripts/prod-sources-2026-11-08.sql
-- All statements are reversible configuration changes (no articles are touched).

-- TAT newsroom: the stored URL was the homepage, not the RSS feed.
UPDATE news_sources
SET endpoint_url = 'https://www.tatnews.org/feed/', is_active = 1, fetch_interval_minutes = 120, last_fetched_at = NULL
WHERE id = 'tat_news';

-- Homepages without feeds, and Google News search feeds (headline-only, always rejected as thin sources).
UPDATE news_sources SET is_active = 0
WHERE id IN ('aot_press', 'pha_phuket', 'srt_railway') OR endpoint_url LIKE 'https://news.google.com/%';

-- Direct publisher feeds with full summaries. 'Editorial Fair Citation' keeps the publication gate
-- closed until an editor records usage rights on each article.
INSERT OR IGNORE INTO news_sources (id, name, source_type, endpoint_url, license_info, is_active, fetch_interval_minutes) VALUES
  ('simpleflying', 'Simple Flying', 'rss', 'https://simpleflying.com/feed/', 'Editorial Fair Citation', 1, 120),
  ('skift', 'Skift', 'rss', 'https://skift.com/feed/', 'Editorial Fair Citation', 1, 120),
  ('traveldailynews', 'Travel Daily News International', 'rss', 'https://www.traveldailynews.com/feed/', 'Editorial Fair Citation', 1, 120),
  ('ttgasia', 'TTG Asia', 'rss', 'https://www.ttgasia.com/feed/', 'Editorial Fair Citation', 1, 120);

-- Gemini budget: at most 2 AI articles per cron run (every 2 hours = up to 24/day).
UPDATE automation_policies SET value = '2', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'max_generations_per_run';

SELECT id, is_active, endpoint_url FROM news_sources WHERE is_active = 1;
