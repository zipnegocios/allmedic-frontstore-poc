DROP INDEX "idx_products_category";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "fit";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "product_type";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "styles";