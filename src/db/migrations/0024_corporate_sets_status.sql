ALTER TABLE "corporate_sets" ADD COLUMN "status" text NOT NULL DEFAULT 'PUBLISHED';--> statement-breakpoint
CREATE INDEX "idx_corporate_sets_status" ON "corporate_sets" USING btree ("status");
