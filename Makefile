.PHONY: dev test lint build docker supergraph

dev:            ## Start development server
	npm run dev

test:           ## Run all tests with coverage
	npm run test:cov

test-e2e:       ## Run E2E tests
	npm run test:e2e

lint:           ## Lint and fix
	npm run lint

build:          ## Build for production
	npm run build

docker-build:   ## Build Docker image
	docker build -t constellation-gateway -f dockerfile .

docker-run:     ## Run Docker container
	docker run --rm -p 3000:3000 --env-file .env constellation-gateway

compose-up:     ## Start all services
	docker compose up -d

compose-down:   ## Stop all services
	docker compose down

supergraph:     ## Compose supergraph SDL from subgraph schemas (requires subgraphs running)
	npm run supergraph
