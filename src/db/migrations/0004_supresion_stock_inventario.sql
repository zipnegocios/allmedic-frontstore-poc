ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "stock";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "min_stock";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "location";--> statement-breakpoint
DELETE FROM "business_rules" WHERE "rule_type" = 'INVENTORY_MODE';
