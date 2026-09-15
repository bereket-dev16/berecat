CREATE TABLE "master_data_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(40) NOT NULL,
	"display_value" text NOT NULL,
	"normalized_key" text NOT NULL,
	"search_value" text NOT NULL,
	"source" varchar(20) NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "master_data_entries_kind_normalized_key_unique" UNIQUE("kind","normalized_key"),
	CONSTRAINT "master_data_entries_kind_check" CHECK ("master_data_entries"."kind" in ('company', 'product', 'packaging_type', 'supplier', 'order_type', 'process_stage')),
	CONSTRAINT "master_data_entries_source_check" CHECK ("master_data_entries"."source" in ('csv', 'user', 'backfill')),
	CONSTRAINT "master_data_entries_display_value_trimmed_check" CHECK ("master_data_entries"."display_value" = btrim("master_data_entries"."display_value")),
	CONSTRAINT "master_data_entries_display_value_not_empty_check" CHECK (char_length("master_data_entries"."display_value") > 0),
	CONSTRAINT "master_data_entries_normalized_key_not_empty_check" CHECK (char_length("master_data_entries"."normalized_key") > 0),
	CONSTRAINT "master_data_entries_search_value_not_empty_check" CHECK (char_length("master_data_entries"."search_value") > 0),
	CONSTRAINT "master_data_entries_usage_count_check" CHECK ("master_data_entries"."usage_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "master_data_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_sha256" varchar(64) NOT NULL,
	"source_filename" text NOT NULL,
	"total_rows" integer NOT NULL,
	"accepted_values" integer NOT NULL,
	"skipped_values" integer NOT NULL,
	"suspicious_values" integer NOT NULL,
	"inserted_entries" integer NOT NULL,
	"updated_entries" integer NOT NULL,
	"inserted_relations" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"summary" jsonb NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "master_data_import_batches_file_sha256_unique" UNIQUE("file_sha256"),
	CONSTRAINT "master_data_import_batches_file_sha256_check" CHECK (char_length("master_data_import_batches"."file_sha256") = 64),
	CONSTRAINT "master_data_import_batches_counts_check" CHECK ("master_data_import_batches"."total_rows" >= 0 and "master_data_import_batches"."accepted_values" >= 0 and "master_data_import_batches"."skipped_values" >= 0 and "master_data_import_batches"."suspicious_values" >= 0 and "master_data_import_batches"."inserted_entries" >= 0 and "master_data_import_batches"."updated_entries" >= 0 and "master_data_import_batches"."inserted_relations" >= 0),
	CONSTRAINT "master_data_import_batches_status_check" CHECK ("master_data_import_batches"."status" = 'applied')
);
--> statement-breakpoint
CREATE TABLE "master_data_relations" (
	"relation_type" varchar(50) NOT NULL,
	"from_entry_id" uuid NOT NULL,
	"to_entry_id" uuid NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "master_data_relations_relation_type_from_entry_id_to_entry_id_pk" PRIMARY KEY("relation_type","from_entry_id","to_entry_id"),
	CONSTRAINT "master_data_relations_relation_type_check" CHECK ("master_data_relations"."relation_type" in ('company_product', 'product_packaging_type', 'packaging_type_supplier', 'packaging_type_order_type')),
	CONSTRAINT "master_data_relations_distinct_entries_check" CHECK ("master_data_relations"."from_entry_id" <> "master_data_relations"."to_entry_id"),
	CONSTRAINT "master_data_relations_usage_count_check" CHECK ("master_data_relations"."usage_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "master_data_relations" ADD CONSTRAINT "master_data_relations_from_entry_id_master_data_entries_id_fk" FOREIGN KEY ("from_entry_id") REFERENCES "public"."master_data_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_data_relations" ADD CONSTRAINT "master_data_relations_to_entry_id_master_data_entries_id_fk" FOREIGN KEY ("to_entry_id") REFERENCES "public"."master_data_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "master_data_entries_kind_is_active_idx" ON "master_data_entries" USING btree ("kind","is_active");--> statement-breakpoint
CREATE INDEX "master_data_entries_kind_normalized_key_idx" ON "master_data_entries" USING btree ("kind","normalized_key");--> statement-breakpoint
CREATE INDEX "master_data_entries_kind_search_value_prefix_idx" ON "master_data_entries" USING btree ("kind","search_value" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "master_data_entries_kind_usage_count_idx" ON "master_data_entries" USING btree ("kind","usage_count");--> statement-breakpoint
CREATE INDEX "master_data_relations_type_from_idx" ON "master_data_relations" USING btree ("relation_type","from_entry_id");--> statement-breakpoint
CREATE INDEX "master_data_relations_type_to_idx" ON "master_data_relations" USING btree ("relation_type","to_entry_id");--> statement-breakpoint
CREATE INDEX "master_data_relations_type_usage_count_idx" ON "master_data_relations" USING btree ("relation_type","usage_count");