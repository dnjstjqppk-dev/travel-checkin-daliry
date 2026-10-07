# Security dependency audit

## Scope and interpretation

No separate vulnerability report or issue list was provided. The baseline below is reconstructed by running `npm audit` against the frontend `package.json` and lockfile at the repository's starting revision. npm reported 20 vulnerable package records (6 critical, 10 high, and 4 moderate); these are package/advisory records, not necessarily 20 independent application vulnerabilities.

The current audit uses Nuxt 4.6.0 and reports 11 high-severity package records and no critical records. Ten baseline package records no longer appear; ten baseline records remain, and `@nuxt/vite-server` is additionally reported in the current dependency tree.

## Baseline record mapping

| # | Package record | Baseline severity | Current status |
|---:|---|---|---|
| 1 | `@nuxt/cli` | High | Resolved by updating the Nuxt dependency tree. |
| 2 | `@nuxt/devtools` | Critical | Resolved by updating the Nuxt dependency tree and disabling DevTools in the application config. |
| 3 | `@nuxt/nitro-server` | Critical | Remains reported as high severity in the current Nuxt dependency tree. |
| 4 | `@nuxt/vite-builder` | Critical | Remains reported as high severity in the current Nuxt dependency tree. |
| 5 | `@nuxtjs/tailwindcss` | Moderate | Removed with the unused Tailwind module. |
| 6 | `@simple-git/argv-parser` | Critical | Resolved by overriding `simple-git` to 4.0.2. |
| 7 | `braces` | High | Remains reported; the registry's latest published version is 3.0.3, within the advisory range. |
| 8 | `chokidar` | High | No longer reported in the current dependency tree. |
| 9 | `fast-glob` | High | Remains reported in the current Nuxt dependency tree. |
| 10 | `globby` | High | Remains reported in the current Nuxt dependency tree. |
| 11 | `listhen` | High | Remains reported in the current Nuxt dependency tree. |
| 12 | `micromatch` | High | Remains reported in the current Nuxt dependency tree. |
| 13 | `nitropack` | High | Remains reported in the current Nuxt dependency tree. |
| 14 | `node-forge` | High | Remains reported; the registry's latest published version is 1.4.0, within the advisory range. |
| 15 | `nuxt` | Critical | Updated to 4.6.0; npm now reports this package as high severity. |
| 16 | `postcss-nested` | Moderate | No longer present after removing the unused Tailwind dependency chain. |
| 17 | `postcss-selector-parser` | Moderate | No longer present after removing the unused Tailwind dependency chain. |
| 18 | `simple-git` | Critical | Resolved by overriding to 4.0.2. |
| 19 | `tailwind-config-viewer` | Moderate | Removed with the unused Tailwind dependency chain. |
| 20 | `tailwindcss` | High | Removed with the unused Tailwind dependency chain. |

## Additional current record

| Package record | Severity | Status |
|---|---|---|
| `@nuxt/vite-server` | High | Reported by the current Nuxt 4.6.0 dependency tree; no non-breaking patched Nuxt version is offered by the current audit. |

The remaining advisories are in transitive framework/build dependencies. `npm audit fix` does not resolve them without downgrading Nuxt to 4.1.3; that downgrade reintroduces critical Nuxt advisories, so it was not applied. `braces` and `node-forge` also have no patched stable release in the registry at the time of this audit. Do not treat the remaining findings as fixed; rerun `npm audit` after upstream releases and update the framework dependencies when compatible patches are available.

## Application security changes

- Store administrator usernames, roles, active state, and bcrypt password hashes in SQLite; require a 32-byte-or-longer `SESSION_SECRET`, and fail closed when the database has no administrator account.
- Protect every `/api/admin/*` route with signed, expiring admin sessions and enforce same-origin checks on state-changing admin requests.
- Use `HttpOnly`, `SameSite=Strict`, eight-hour session cookies, secure by default, and an exact-origin CORS allowlist.
- Add login throttling, request body limits, security response headers, an isolated admin login route, and a route guard.
- Remove the unused Tailwind dependency chain and vulnerable `simple-git` versions.
