# News platform audit ? 2026-10-31

Status: IN PROGRESS / NO_GO. This is an evidence-based interim audit, not certification.
Base commit: 5686d95e6616ee45e02458a0f304c3623fa76365; branch: audit/news-platform-20261031. Existing uncommitted user changes are preserved. No deployment or production DB mutation performed.

## Release gate
Do not deploy this interim working tree. Complete open gaps and staging verification. Record final SHA (working tree currently dirty), image/worker artifact digest, schema version, test logs and PO approval. No release candidate commit or digest currently exists.

## Staging
Install locked dependencies using Node 24; run npm test, typecheck and build; execute migrations on a disposable DB; run Go tests; test article create ? review ? publish ? detail/search/feed/sitemap ? retract. Verify draft exclusion and failure responses.

## Backup and rollback
Before production migration export D1 with a timestamp and test restoration into disposable DB. Preserve prior Worker deployment ID and versioned config. Roll back Worker to recorded prior version; never assume rollback of destructive schema/data changes is automatic. Operator approval required for production deployment, DNS, destructive migrations and paid service contracts.

## External verification
Verify health/readiness, real logs/alerts, published article pages and feeds. Submit sitemaps through operator-controlled Search Console/Bing accounts. Observe real traffic/CWV separately from lab tests.
