.PHONY: dev backend frontend mobile check

dev:
	@echo "Run 'make backend' and 'make frontend' in separate terminals."

backend:
	cd backend && go run .

frontend:
	cd frontend && npm run dev

mobile:
	cd mobile && flutter run

check:
	cd backend && go test ./...
	cd frontend && npm run build