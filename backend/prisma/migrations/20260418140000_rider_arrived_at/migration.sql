-- Rider tapped "Arrived at restaurant" — required before marking picked up.
ALTER TABLE "Order" ADD COLUMN "rider_arrived_at" TIMESTAMP(3);
