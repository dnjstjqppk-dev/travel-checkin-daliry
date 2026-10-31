# News platform audit ? 2026-10-31

Status: IN PROGRESS / NO_GO. This is an evidence-based interim audit, not certification.
Base commit: 5686d95e6616ee45e02458a0f304c3623fa76365; branch: audit/news-platform-20261031. Existing uncommitted user changes are preserved. No deployment or production DB mutation performed.

Inspected edge auth uses PBKDF2 hashes, random session tokens stored as hashes, HttpOnly/SameSite cookies and origin checks. These observations are not a penetration-test pass.

Changes: canonical origin no longer derives from untrusted Host/Forwarded headers; Markdown sanitizer failure escapes text; publication actions gain shared validation.

OPEN: DNS-rebinding-aware SSRF defenses, input/rate-limit coverage, Go/edge parity, CSP broad script allowances, editorial RBAC, transaction integrity, dependency advisory scan, secret scanning and backup/restore. No secret values read or copied into reports.
