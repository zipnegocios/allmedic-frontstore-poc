CREATE TABLE "set_color_combo_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"combo_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"color_code" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set_color_combos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"set_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "corporate_sets" ADD COLUMN "color_mode" text;--> statement-breakpoint
UPDATE "corporate_sets" SET "color_mode" = 'MIXED' WHERE "color_mode" IS NULL;--> statement-breakpoint
ALTER TABLE "corporate_sets" ALTER COLUMN "color_mode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "set_color_combo_items" ADD CONSTRAINT "set_color_combo_items_combo_id_set_color_combos_id_fk" FOREIGN KEY ("combo_id") REFERENCES "public"."set_color_combos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_color_combo_items" ADD CONSTRAINT "set_color_combo_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_color_combos" ADD CONSTRAINT "set_color_combos_set_id_corporate_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."corporate_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_set_color_combo_items_combo" ON "set_color_combo_items" USING btree ("combo_id");--> statement-breakpoint
CREATE INDEX "idx_set_color_combo_items_product" ON "set_color_combo_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_set_color_combos_set" ON "set_color_combos" USING btree ("set_id");