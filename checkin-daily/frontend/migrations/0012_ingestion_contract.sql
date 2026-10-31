-- Match the ingestion worker's persisted review queue contract without deleting history.
ALTER TABLE feed_ingestion_items ADD COLUMN summary TEXT NOT NULL DEFAULT '';
ALTER TABLE feed_ingestion_items ADD COLUMN category TEXT NOT NULL DEFAULT 'major';
ALTER TABLE feed_ingestion_items ADD COLUMN status TEXT NOT NULL DEFAULT 'ingested';
ALTER TABLE feed_ingestion_items ADD COLUMN raw_payload TEXT NOT NULL DEFAULT '{}';
ALTER TABLE feed_ingestion_items ADD COLUMN article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_feed_items_link ON feed_ingestion_items(link);
