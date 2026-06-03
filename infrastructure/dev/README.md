# OmniHealth Local Development Environment

This directory contains the Docker Compose setup for the OmniHealth data plane. It allows you to run all required infrastructure services locally.

## Services

- **PostgreSQL 16**: Relational database for structured data.
- **MongoDB 7**: Document store for FHIR resources.
- **Redis 7**: Caching and session management.
- **Apache Kafka**: Message bus for event-driven communication (using KRaft mode).
- **MinIO**: S3-compatible object storage for documents and archives.
- **Elasticsearch 8**: Full-text search and analytics.

## Getting Started

1.  **Copy the environment file**:
    ```bash
    cp .env.example .env
    ```

2.  **Start the infrastructure**:
    ```bash
    docker-compose up -d
    ```

3.  **Check service status**:
    ```bash
    docker-compose ps
    ```

## Service Endpoints

- **PostgreSQL**: `localhost:5432` (User: `admin`, Pass: `password`)
- **MongoDB**: `localhost:27017` (User: `admin`, Pass: `password`)
- **Redis**: `localhost:6379`
- **Kafka**: `localhost:9092`
- **MinIO Console**: `http://localhost:9001` (User: `admin`, Pass: `password`)
- **MinIO API**: `http://localhost:9000`
- **Elasticsearch**: `http://localhost:9200`

## Utilities

- **scripts/wait-for-it.sh**: Use this script in your application Dockerfiles or entrypoints to ensure infrastructure services are ready before your app starts.
  Example: `./scripts/wait-for-it.sh localhost:5432 -- npm start`

## Initialization

- **Postgres**: On the first start, the scripts in `postgres-init/` are executed. This creates the initial databases: `clinical`, `identity`, `terminology`, and `audit`.
