# Variables
IMAGE=umami
VERSION=latest

# Build Docker images
build:
	@echo "Building web Docker image: $(IMAGE):$(VERSION)..."
	docker build -t $(IMAGE):$(VERSION) .
	@echo "Web Docker image built successfully: $(IMAGE):$(VERSION)"

docker-compose:
	@echo "更新到docker"
	$(shell docker compose down && docker compose up -d)


# Build all images
build-all: build docker-compose