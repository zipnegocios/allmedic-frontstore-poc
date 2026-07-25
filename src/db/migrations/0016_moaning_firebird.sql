CREATE TYPE "public"."scope_level" AS ENUM('OWN', 'ALL');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'SALES', 'CATALOG_MANAGER', 'DISPATCHER', 'CORPORATE_CLIENT');--> statement-breakpoint
CREATE TYPE "public"."catalog_activity_action" AS ENUM('CREATE', 'UPDATE');--> statement-breakpoint
CREATE TYPE "public"."catalog_entity_type" AS ENUM('PRODUCT', 'VARIANT', 'SET', 'MEDIA');--> statement-breakpoint
CREATE TABLE "catalog_activity_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" "catalog_entity_type" NOT NULL,
	"entity_id" text,
	"action" "catalog_activity_action" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"module" text NOT NULL,
	"action" text NOT NULL,
	CONSTRAINT "uq_permissions_module_action" UNIQUE("module","action")
);
--> statement-breakpoint
CREATE TABLE "permissions_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productivity_targets" (
	"user_id" uuid NOT NULL,
	"daily_target" integer DEFAULT 25 NOT NULL,
	CONSTRAINT "productivity_targets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" "user_role" NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "uq_role_permissions_role_permission" UNIQUE("role","permission_id")
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CATALOG_MANAGER'::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "scope_level" "scope_level" DEFAULT 'OWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_protected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "corporate_accounts" ADD COLUMN "sales_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "sales_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "catalog_activity_log" ADD CONSTRAINT "catalog_activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productivity_targets" ADD CONSTRAINT "productivity_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_accounts" ADD CONSTRAINT "corporate_accounts_sales_agent_id_users_id_fk" FOREIGN KEY ("sales_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_sales_agent_id_users_id_fk" FOREIGN KEY ("sales_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_quotes_sales_agent" ON "quotes" USING btree ("sales_agent_id");