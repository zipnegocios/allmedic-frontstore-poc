CREATE TABLE "brand_product_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_type_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_brand_product_types" UNIQUE("brand_id","product_type_id")
);
--> statement-breakpoint
ALTER TABLE "brand_product_types" ADD CONSTRAINT "brand_product_types_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_product_types" ADD CONSTRAINT "brand_product_types_product_type_id_product_types_id_fk" FOREIGN KEY ("product_type_id") REFERENCES "public"."product_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- ─── Migración de datos: Tipos de Producto globales reutilizables (PROMPT-tipos-atributos-globales.md) ───
-- 1) Activación: cada marca que hoy "posee" un product_type queda con ese tipo activado.
INSERT INTO "brand_product_types" ("id", "brand_id", "product_type_id")
SELECT gen_random_uuid(), "brand_id", "id" FROM "product_types"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- 2) Mapa semántico explícito (decisión ya tomada, no reabrir): Pants -> Pantalones, Tops -> Camisas.
UPDATE "product_types" SET "name" = 'Pantalones', "slug" = 'pantalones'
WHERE lower(trim("name")) = 'pants' AND lower(trim("name")) <> 'pantalones';
--> statement-breakpoint
UPDATE "product_types" SET "name" = 'Camisas', "slug" = 'camisas'
WHERE lower(trim("name")) = 'tops' AND lower(trim("name")) <> 'camisas';
--> statement-breakpoint

-- 3) Fusión genérica de duplicados exactos (mismo nombre normalizado, case-insensitive
--    + trim). Canónico = fila más antigua (created_at, desempate por id). Redirige
--    products, product_type_attributes y brand_product_types al canónico sin duplicar
--    pares, y elimina las filas absorbidas. Idempotente: sin duplicados, no hace nada.
DO $$
DECLARE
  grp RECORD;
  canonical_id uuid;
  dup_ids uuid[];
BEGIN
  FOR grp IN
    SELECT lower(trim("name")) AS norm_name, array_agg("id" ORDER BY "created_at" ASC, "id" ASC) AS ids
    FROM "product_types"
    GROUP BY lower(trim("name"))
    HAVING count(*) > 1
  LOOP
    canonical_id := grp.ids[1];
    dup_ids := grp.ids[2:array_length(grp.ids, 1)];

    UPDATE "products" SET "product_type_id" = canonical_id
      WHERE "product_type_id" = ANY(dup_ids);

    -- insert-then-delete (no UPDATE) para que ON CONFLICT resuelva colisiones
    -- fila por fila, incluso cuando dos filas absorbidas comparten el mismo par
    -- (canónico, atributo) dentro del mismo lote.
    INSERT INTO "product_type_attributes" ("id", "product_type_id", "attribute_id", "is_required", "sort_order")
      SELECT gen_random_uuid(), canonical_id, "attribute_id", "is_required", "sort_order"
      FROM "product_type_attributes" WHERE "product_type_id" = ANY(dup_ids)
      ON CONFLICT ("product_type_id", "attribute_id") DO NOTHING;
    DELETE FROM "product_type_attributes" WHERE "product_type_id" = ANY(dup_ids);

    INSERT INTO "brand_product_types" ("id", "brand_id", "product_type_id", "sort_order")
      SELECT gen_random_uuid(), "brand_id", canonical_id, "sort_order"
      FROM "brand_product_types" WHERE "product_type_id" = ANY(dup_ids)
      ON CONFLICT ("brand_id", "product_type_id") DO NOTHING;
    DELETE FROM "brand_product_types" WHERE "product_type_id" = ANY(dup_ids);

    DELETE FROM "product_types" WHERE "id" = ANY(dup_ids);
  END LOOP;
END $$;
--> statement-breakpoint

ALTER TABLE "product_types" DROP CONSTRAINT "uq_product_types_brand_slug";--> statement-breakpoint
ALTER TABLE "product_types" DROP CONSTRAINT "product_types_brand_id_brands_id_fk";
--> statement-breakpoint
ALTER TABLE "product_types" DROP COLUMN "brand_id";--> statement-breakpoint
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_slug_unique" UNIQUE("slug");
