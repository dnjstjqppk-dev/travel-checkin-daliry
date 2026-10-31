ALTER TABLE articles ADD COLUMN workflow_token TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_publish_jobs_article_status ON publish_jobs(article_id, status);
