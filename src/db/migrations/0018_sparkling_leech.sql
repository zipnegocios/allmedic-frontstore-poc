CREATE TYPE "public"."email_status" AS ENUM('SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'OPENED', 'CLICKED', 'FAILED');--> statement-breakpoint
CREATE TABLE "request_number_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_event_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_key" text NOT NULL,
	"label" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "email_event_settings_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_key" text NOT NULL,
	"resend_id" text,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"status" "email_status" DEFAULT 'SENT' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now(),
	"last_event_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"resend_id" text,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "request_code" text;--> statement-breakpoint
CREATE INDEX "idx_email_log_resend_id" ON "email_log" USING btree ("resend_id");--> statement-breakpoint
CREATE INDEX "idx_email_log_event_key" ON "email_log" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "idx_email_webhook_events_resend_id" ON "email_webhook_events" USING btree ("resend_id");--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_request_code_unique" UNIQUE("request_code");