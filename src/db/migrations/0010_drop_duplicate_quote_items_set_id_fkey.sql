-- `quote_items` tenía DOS foreign keys sobre `set_id` apuntando a `corporate_sets(id)`:
-- `quote_items_set_id_corporate_sets_id_fk` (ON DELETE SET NULL, la que declara el
-- esquema Drizzle) y una duplicada `quote_items_set_id_fkey` sin `ON DELETE` (RESTRICT
-- por default), sobrante de una evolución anterior del esquema vía `db:push`. Postgres
-- aplica AMBAS constraints simultáneamente, así que la RESTRICT bloqueaba el borrado
-- permanente de cualquier set corporativo referenciado por una cotización, aunque el
-- esquema y la otra constraint dijeran "set null". Se elimina la duplicada sobrante.
ALTER TABLE "quote_items" DROP CONSTRAINT "quote_items_set_id_fkey";
