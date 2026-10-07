# Check-in Daily workspace notes

- Keep API request and response contracts aligned with `shared/openapi.yaml`.
- The backend is Go/Gin with GORM and SQLite; the Nuxt server proxies `/api/*` to `API_INTERNAL_BASE`.
- Public clients must only receive published articles. Admin endpoints are development-only and currently unauthenticated.
- Run the backend with `cd backend && go run .`; run the web app with `cd frontend && npm run dev`.