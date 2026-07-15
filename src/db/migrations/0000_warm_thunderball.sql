CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"password" text,
	"role" text DEFAULT 'CATALOG_MANAGER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token"),
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	CONSTRAINT "brands_name_unique" UNIQUE("name"),
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"brand_id" uuid NOT NULL,
	CONSTRAINT "collections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "colors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"hex" text NOT NULL,
	CONSTRAINT "colors_name_unique" UNIQUE("name"),
	CONSTRAINT "colors_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"color_id" uuid NOT NULL,
	"size" text NOT NULL,
	"fit" text,
	"sku" text NOT NULL,
	"status" text DEFAULT 'AVAILABLE' NOT NULL,
	"stock" integer DEFAULT 0,
	"location" text,
	"min_stock" integer DEFAULT 5,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sku" text,
	"brand_id" uuid NOT NULL,
	"collection_id" uuid,
	"category" text NOT NULL,
	"product_type" text,
	"gender" text NOT NULL,
	"price_normal" numeric(10, 2) NOT NULL,
	"price_sale" numeric(10, 2),
	"discount_pct" integer,
	"discount_end" timestamp with time zone,
	"price_wholesale" numeric(10, 2),
	"price_wholesale_sale" numeric(10, 2),
	"wholesale_discount_end" timestamp with time zone,
	"visibility" text DEFAULT 'INDIVIDUAL' NOT NULL,
	"is_new" boolean DEFAULT false,
	"is_best_seller" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"cross_sell_id" uuid,
	"features" jsonb,
	"care_instructions" jsonb,
	"styles" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"cta_text" text,
	"cta_link" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"customer_city" text NOT NULL,
	"customer_phone" text,
	"items" jsonb NOT NULL,
	"total_items" integer NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"discount_pct" integer DEFAULT 0,
	"discount_amount" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'SENT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "search_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"results" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"phone" text,
	"hours" text,
	"map_url" text,
	"is_main" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"accepts_online" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "whatsapp_clicks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rule_type" text NOT NULL,
	"scope" text NOT NULL,
	"scope_id" text,
	"config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 0,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "corporate_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"ruc" text NOT NULL,
	"razon_social" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"city" text NOT NULL,
	"sector" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "corporate_accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "corporate_carts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "corporate_carts_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "corporate_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"set_group_id" uuid,
	"brand_id" uuid,
	"price_manual" numeric(10, 2),
	"price_manual_sale" numeric(10, 2),
	"manual_discount_end" timestamp with time zone,
	"is_active" boolean DEFAULT true,
	"is_featured" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "corporate_sets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "quote_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quote_id" uuid NOT NULL,
	"type" text NOT NULL,
	"file_name" text,
	"file_url" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quote_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"set_id" uuid,
	"size" text,
	"color" text,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"suggested_unit_price" numeric(10, 2),
	"unit_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_type" text,
	"discount_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax_rate_override" numeric(5, 2),
	"pricing_breakdown" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_number_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quote_number" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"outcome" text,
	"channel" text NOT NULL,
	"account_id" uuid,
	"lead_id" uuid,
	"customer_name" text NOT NULL,
	"customer_id_number" text,
	"customer_contact_name" text,
	"customer_email" text,
	"customer_phone" text,
	"customer_address" text,
	"customer_city" text,
	"tax_preset_id" uuid,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"prices_include_tax" boolean DEFAULT false NOT NULL,
	"discount_type" text,
	"discount_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"validity_preset_id" uuid,
	"validity_days" integer,
	"expires_at" timestamp with time zone,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_tax" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"pdf_key" text,
	"pdf_generated_at" timestamp with time zone,
	"sent_by_email_at" timestamp with time zone,
	"published_to_portal_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "quotes_quote_number_unique" UNIQUE("quote_number")
);
--> statement-breakpoint
CREATE TABLE "set_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "set_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "set_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"set_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity_per_set" integer DEFAULT 1,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "tax_presets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rate" numeric(5, 2) NOT NULL,
	"prices_include_tax_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_tax_presets_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "validity_presets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"days" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_validity_presets_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"external_id" text NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"customer_ig_handle" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"assigned_to" text,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"source" text NOT NULL,
	"direction" text NOT NULL,
	"content" text NOT NULL,
	"media_url" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "media_asset_tags" (
	"asset_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "media_asset_tags_asset_id_tag_id_pk" PRIMARY KEY("asset_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"folder" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration_seconds" integer,
	"preview_start_seconds" integer DEFAULT 0,
	"preview_duration_seconds" integer DEFAULT 3,
	"checksum_sha256" text,
	"alt_text" text,
	"title" text,
	"caption" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "media_assets_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "media_audit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"asset_id" uuid,
	"action" text NOT NULL,
	"payload" jsonb,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "media_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"asset_id" uuid NOT NULL,
	"user_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "media_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"asset_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"color_id" uuid,
	"role" text DEFAULT 'GALLERY' NOT NULL,
	"sort_order" integer DEFAULT 0,
	"alt_override" text,
	"title_override" text,
	"caption_override" text,
	CONSTRAINT "uniq_media_links" UNIQUE("entity_type","entity_id","color_id","role","asset_id")
);
--> statement-breakpoint
CREATE TABLE "media_tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "media_tags_name_unique" UNIQUE("name"),
	CONSTRAINT "media_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"logo_media_id" uuid,
	"razon_social" text DEFAULT '' NOT NULL,
	"ruc" text DEFAULT '' NOT NULL,
	"address" text,
	"phones" text,
	"email" text,
	"website" text,
	"footer_note" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_color_id_colors_id_fk" FOREIGN KEY ("color_id") REFERENCES "public"."colors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_accounts" ADD CONSTRAINT "corporate_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_accounts" ADD CONSTRAINT "corporate_accounts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_carts" ADD CONSTRAINT "corporate_carts_account_id_corporate_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."corporate_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_sets" ADD CONSTRAINT "corporate_sets_set_group_id_set_groups_id_fk" FOREIGN KEY ("set_group_id") REFERENCES "public"."set_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_sets" ADD CONSTRAINT "corporate_sets_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_documents" ADD CONSTRAINT "quote_documents_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_documents" ADD CONSTRAINT "quote_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_set_id_corporate_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."corporate_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_account_id_corporate_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."corporate_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tax_preset_id_tax_presets_id_fk" FOREIGN KEY ("tax_preset_id") REFERENCES "public"."tax_presets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_validity_preset_id_validity_presets_id_fk" FOREIGN KEY ("validity_preset_id") REFERENCES "public"."validity_presets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_items" ADD CONSTRAINT "set_items_set_id_corporate_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."corporate_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_items" ADD CONSTRAINT "set_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset_tags" ADD CONSTRAINT "media_asset_tags_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset_tags" ADD CONSTRAINT "media_asset_tags_tag_id_media_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."media_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_audit" ADD CONSTRAINT "media_audit_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_audit" ADD CONSTRAINT "media_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_comments" ADD CONSTRAINT "media_comments_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_comments" ADD CONSTRAINT "media_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_links" ADD CONSTRAINT "media_links_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_logo_media_id_media_assets_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_variants_product" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_variants_color" ON "product_variants" USING btree ("color_id");--> statement-breakpoint
CREATE INDEX "idx_products_brand" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_products_category" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_products_gender" ON "products" USING btree ("gender");--> statement-breakpoint
CREATE INDEX "idx_products_active" ON "products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_leads_status" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_leads_created" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_rules_type_scope" ON "business_rules" USING btree ("rule_type","scope");--> statement-breakpoint
CREATE INDEX "idx_rules_active" ON "business_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_corporate_accounts_status" ON "corporate_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_corporate_accounts_email" ON "corporate_accounts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_corporate_sets_active" ON "corporate_sets" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_corporate_sets_featured" ON "corporate_sets" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "idx_corporate_sets_group" ON "corporate_sets" USING btree ("set_group_id");--> statement-breakpoint
CREATE INDEX "idx_corporate_sets_deleted" ON "corporate_sets" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_quote_items_quote" ON "quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_quote_items_product" ON "quote_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_quote_items_set" ON "quote_items" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_status" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_quotes_channel" ON "quotes" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_quotes_account" ON "quotes" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_lead" ON "quotes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_expires" ON "quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_set_items_set" ON "set_items" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "idx_set_items_product" ON "set_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_channel_external" ON "conversations" USING btree ("channel","external_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_status" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_conversations_assigned" ON "conversations" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_media_assets_folder" ON "media_assets" USING btree ("folder");--> statement-breakpoint
CREATE INDEX "idx_media_assets_checksum" ON "media_assets" USING btree ("checksum_sha256");--> statement-breakpoint
CREATE INDEX "idx_media_audit_asset" ON "media_audit" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_media_comments_asset" ON "media_comments" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_media_links_entity" ON "media_links" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_media_links_asset" ON "media_links" USING btree ("asset_id");