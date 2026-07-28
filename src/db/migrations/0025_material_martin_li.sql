ALTER TABLE "products" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "products" SET "created_by" = '4a4c185c-1cd0-4f3f-800b-d5557f48dcdf', "updated_by" = '4a4c185c-1cd0-4f3f-800b-d5557f48dcdf' WHERE "created_by" IS NULL;