// Alias of /api/cron/crawl: POST /api/cron/generate runs one pipeline pass
// (ingest -> dedup -> AI write -> quality gate -> store/publish) and returns the per-item results.
export { default } from './crawl.post'
