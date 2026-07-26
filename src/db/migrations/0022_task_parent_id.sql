ALTER TABLE "catalog_tasks" ADD COLUMN "parent_task_id" uuid;--> statement-breakpoint
CREATE INDEX "idx_catalog_tasks_parent" ON "catalog_tasks" USING btree ("parent_task_id");
