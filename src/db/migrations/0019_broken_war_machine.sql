CREATE TYPE "public"."payment_cadence" AS ENUM('DAY', 'WEEK', 'MONTH');--> statement-breakpoint
CREATE TABLE "catalog_task_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"payment_amount" numeric(10, 2) NOT NULL,
	"payment_cadence" "payment_cadence" NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_period_task_group_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"period_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_payment_period_task_group_items_period_group" UNIQUE("period_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_task_coordinator" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_tasks" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "catalog_tasks" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "catalog_tasks" ADD COLUMN "block_a" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_tasks" ADD COLUMN "block_b" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_tasks" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "catalog_task_groups" ADD CONSTRAINT "catalog_task_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_period_task_group_items" ADD CONSTRAINT "payment_period_task_group_items_period_id_payment_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payment_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_period_task_group_items" ADD CONSTRAINT "payment_period_task_group_items_group_id_catalog_task_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."catalog_task_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_period_task_group_items" ADD CONSTRAINT "payment_period_task_group_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payment_period_task_group_items_period" ON "payment_period_task_group_items" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "idx_payment_period_task_group_items_user" ON "payment_period_task_group_items" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "catalog_tasks" ADD CONSTRAINT "catalog_tasks_group_id_catalog_task_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."catalog_task_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_catalog_tasks_group" ON "catalog_tasks" USING btree ("group_id");