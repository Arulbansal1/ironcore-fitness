-- Executed automatically by the Postgres container on first boot.
-- pgvector powers the Knowledge Base similarity search used for RAG.
CREATE EXTENSION IF NOT EXISTS vector;
