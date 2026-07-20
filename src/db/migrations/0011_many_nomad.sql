CREATE TABLE "sizes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sizes_value_unique" UNIQUE("value")
);
--> statement-breakpoint
-- Siembra las tallas que hoy vive como lista fija en el código (`SIZES` en
-- product-form/schema.ts) — sin esto, reemplazar la lista fija por este catálogo
-- dejaría el selector de tallas vacío hasta que un admin cargue algo a mano.
INSERT INTO "sizes" ("id", "value", "sort_order", "is_active") VALUES
	(gen_random_uuid(), 'XXS', 0, true),
	(gen_random_uuid(), 'XS', 1, true),
	(gen_random_uuid(), 'S', 2, true),
	(gen_random_uuid(), 'M', 3, true),
	(gen_random_uuid(), 'L', 4, true),
	(gen_random_uuid(), 'XL', 5, true),
	(gen_random_uuid(), 'XXL', 6, true),
	(gen_random_uuid(), '2XL', 7, true),
	(gen_random_uuid(), '3XL', 8, true),
	(gen_random_uuid(), '4XL', 9, true),
	(gen_random_uuid(), '5XL', 10, true),
	(gen_random_uuid(), 'OS', 11, true)
ON CONFLICT ("value") DO NOTHING;
