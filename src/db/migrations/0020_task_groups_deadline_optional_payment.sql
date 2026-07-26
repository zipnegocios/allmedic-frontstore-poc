ALTER TABLE "catalog_task_groups" ADD COLUMN "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "catalog_task_groups" ADD COLUMN "has_payment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_task_groups" ALTER COLUMN "payment_amount" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_task_groups" DROP COLUMN "payment_cadence";--> statement-breakpoint
DROP TYPE "public"."payment_cadence";
