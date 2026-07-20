ALTER TABLE "set_groups" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "set_groups" CASCADE;--> statement-breakpoint
DROP INDEX "idx_corporate_sets_group";--> statement-breakpoint
ALTER TABLE "corporate_sets" DROP COLUMN "set_group_id";