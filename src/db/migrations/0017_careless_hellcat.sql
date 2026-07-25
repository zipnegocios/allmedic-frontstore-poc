CREATE TYPE "public"."catalog_activity_status" AS ENUM('COMPLETED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."productivity_rate_component" AS ENUM('VARIANT', 'PRODUCT', 'SET', 'MEDIA', 'TIME_BONUS');--> statement-breakpoint
CREATE TYPE "public"."catalog_notification_type" AS ENUM('TASK_ASSIGNED', 'TASK_REJECTED', 'TASK_STATUS_CHANGED', 'TASK_COMMENT', 'ENTITY_COMMENT');--> statement-breakpoint
CREATE TYPE "public"."catalog_task_status" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."catalog_task_target_entity" AS ENUM('PRODUCT', 'SET');--> statement-breakpoint
CREATE TYPE "public"."catalog_task_type" AS ENUM('CREATE_PRODUCT', 'CREATE_SET', 'UPLOAD_MEDIA', 'EDIT_PRODUCT', 'EDIT_SET', 'GENERIC');--> statement-breakpoint
CREATE TYPE "public"."payment_period_status" AS ENUM('OPEN', 'CLOSED', 'PAID');--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_module_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "productivity_rate_tiers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "productivity_rate_tiers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "productivity_rates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tier_id" uuid NOT NULL,
	"component_type" "productivity_rate_component" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"amount" numeric(10, 2),
	"bonus_per_unit_under_target" numeric(10, 2),
	"penalty_per_unit_over_target" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "catalog_entity_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_type" "catalog_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "catalog_notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "catalog_notification_type" NOT NULL,
	"related_task_id" uuid,
	"related_comment_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "catalog_task_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "catalog_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" "catalog_task_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_code" text,
	"target_entity_type" "catalog_task_target_entity",
	"target_entity_id" text,
	"assigned_to" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"status" "catalog_task_status" DEFAULT 'PENDING' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_period_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"period_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"computed_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"manual_adjustment" numeric(10, 2) DEFAULT '0' NOT NULL,
	"adjustment_reason" text,
	"final_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"voided_items_count" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_periods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"status" "payment_period_status" DEFAULT 'OPEN' NOT NULL,
	"closed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tier_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "requires_assigned_task_for_payment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_activity_log" ADD COLUMN "task_id" text;--> statement-breakpoint
ALTER TABLE "catalog_activity_log" ADD COLUMN "changed_fields" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_activity_log" ADD COLUMN "media_count" integer;--> statement-breakpoint
ALTER TABLE "catalog_activity_log" ADD COLUMN "status" "catalog_activity_status" DEFAULT 'COMPLETED' NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_activity_log" ADD COLUMN "voided_by_rejection" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "productivity_rates" ADD CONSTRAINT "productivity_rates_tier_id_productivity_rate_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."productivity_rate_tiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_entity_comments" ADD CONSTRAINT "catalog_entity_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_notifications" ADD CONSTRAINT "catalog_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_notifications" ADD CONSTRAINT "catalog_notifications_related_task_id_catalog_tasks_id_fk" FOREIGN KEY ("related_task_id") REFERENCES "public"."catalog_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_task_comments" ADD CONSTRAINT "catalog_task_comments_task_id_catalog_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."catalog_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_task_comments" ADD CONSTRAINT "catalog_task_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_tasks" ADD CONSTRAINT "catalog_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_tasks" ADD CONSTRAINT "catalog_tasks_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_period_items" ADD CONSTRAINT "payment_period_items_period_id_payment_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payment_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_period_items" ADD CONSTRAINT "payment_period_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_productivity_rates_tier" ON "productivity_rates" USING btree ("tier_id");--> statement-breakpoint
CREATE INDEX "idx_catalog_entity_comments_entity" ON "catalog_entity_comments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_catalog_notifications_user_unread" ON "catalog_notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "idx_catalog_task_comments_task" ON "catalog_task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_catalog_tasks_assigned_to" ON "catalog_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_catalog_tasks_status" ON "catalog_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payment_period_items_period" ON "payment_period_items" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "idx_payment_period_items_user" ON "payment_period_items" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tier_id_productivity_rate_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."productivity_rate_tiers"("id") ON DELETE no action ON UPDATE no action;