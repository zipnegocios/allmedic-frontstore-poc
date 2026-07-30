CREATE TABLE "set_colors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"set_id" uuid NOT NULL,
	"color_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_set_colors_set_color" UNIQUE("set_id","color_id")
);
--> statement-breakpoint
ALTER TABLE "set_colors" ADD CONSTRAINT "set_colors_set_id_corporate_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."corporate_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_colors" ADD CONSTRAINT "set_colors_color_id_colors_id_fk" FOREIGN KEY ("color_id") REFERENCES "public"."colors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_set_colors_set" ON "set_colors" USING btree ("set_id");