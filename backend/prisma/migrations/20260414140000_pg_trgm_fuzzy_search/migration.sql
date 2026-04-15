-- Enable trigram search for fuzzy matching (Postgres).
-- This powers typo-tolerant search for stores and products.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Store name/description indexes (global search)
CREATE INDEX IF NOT EXISTS store_name_trgm_idx
  ON "Store" USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS store_description_trgm_idx
  ON "Store" USING gin (description gin_trgm_ops);

-- Product name_normalized index (item search)
CREATE INDEX IF NOT EXISTS product_name_normalized_trgm_idx
  ON "Product" USING gin (name_normalized gin_trgm_ops);

