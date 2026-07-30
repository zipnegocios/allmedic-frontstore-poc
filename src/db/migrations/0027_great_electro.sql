CREATE TABLE "product_media_dismissals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"color_id" uuid,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uniq_product_media_dismissals" UNIQUE("product_id","color_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "product_media_dismissals" ADD CONSTRAINT "product_media_dismissals_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_product_media_dismissals_product" ON "product_media_dismissals" USING btree ("product_id");