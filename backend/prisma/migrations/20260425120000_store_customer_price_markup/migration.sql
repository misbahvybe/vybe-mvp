-- Per-store customer price uplift % (catalogue × (1 + pct/100)).
ALTER TABLE "Store" ADD COLUMN "customer_price_markup_percent" DECIMAL(5,2) NOT NULL DEFAULT 10;
