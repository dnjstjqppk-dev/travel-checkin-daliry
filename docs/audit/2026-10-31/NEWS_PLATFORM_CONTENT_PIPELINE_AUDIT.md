# News platform audit ? 2026-10-31

Status: IN PROGRESS / NO_GO. This is an evidence-based interim audit, not certification.
Base commit: 5686d95e6616ee45e02458a0f304c3623fa76365; branch: audit/news-platform-20261031. Existing uncommitted user changes are preserved. No deployment or production DB mutation performed.

Source tables record endpoint/license metadata; access to RSS is not a republication license. Previous cron generated prose from titles and fabricated regional/translation mapping. It now creates empty-content review-only drafts with source name/link/license metadata; original feed payload remains in ingestion queue. Auto-publish policy no longer publishes these drafts.

Shared validation now checks body requirements and requires explicit non-default rights metadata on review/schedule paths. A text license field is an editorial record, not proof of a legal grant.

OPEN: all existing 66 seeded articles and 330 translations require factual, temporal, image and rights review. Seed counts prove DB integrity only. Retry isolation, source interval enforcement, concurrency/idempotency and rights evidence remain incomplete.

Direct article create/update now also rejects publication with missing/default rights metadata. Scheduled crawler selection excludes rejected or unscheduled drafts. RSS translations require an actual translation row; absent languages are not silently labeled using the Korean original.
