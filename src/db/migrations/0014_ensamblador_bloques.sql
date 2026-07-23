CREATE TABLE "set_blocks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"set_id" uuid NOT NULL,
	"block_code" text NOT NULL,
	"quantity_per_set" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_set_blocks_set_code" UNIQUE("set_id","block_code")
);
--> statement-breakpoint
CREATE TABLE "set_block_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"block_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_set_block_options_block_product" UNIQUE("block_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "set_recommended_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"set_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_set_recommended_items_set_product" UNIQUE("set_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "set_blocks" ADD CONSTRAINT "set_blocks_set_id_corporate_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."corporate_sets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "set_block_options" ADD CONSTRAINT "set_block_options_block_id_set_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."set_blocks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "set_block_options" ADD CONSTRAINT "set_block_options_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "set_recommended_items" ADD CONSTRAINT "set_recommended_items_set_id_corporate_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."corporate_sets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "set_recommended_items" ADD CONSTRAINT "set_recommended_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_set_blocks_set" ON "set_blocks" USING btree ("set_id");
--> statement-breakpoint
CREATE INDEX "idx_set_block_options_block" ON "set_block_options" USING btree ("block_id");
--> statement-breakpoint
CREATE INDEX "idx_set_block_options_product" ON "set_block_options" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX "idx_set_recommended_items_set" ON "set_recommended_items" USING btree ("set_id");
--> statement-breakpoint
CREATE INDEX "idx_set_recommended_items_product" ON "set_recommended_items" USING btree ("product_id");
--> statement-breakpoint
DROP TABLE "set_items" CASCADE;
