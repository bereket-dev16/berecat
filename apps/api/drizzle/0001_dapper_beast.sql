CREATE TABLE "work_item_assignees" (
	"work_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_item_assignees_work_item_id_user_id_pk" PRIMARY KEY("work_item_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "work_item_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_item_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_item_comments_body_trimmed_check" CHECK ("work_item_comments"."body" = btrim("work_item_comments"."body")),
	CONSTRAINT "work_item_comments_body_length_check" CHECK (char_length("work_item_comments"."body") between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_key" varchar(50) NOT NULL,
	"order_code" varchar(100),
	"company_name" varchar(200) NOT NULL,
	"product_name" varchar(250) NOT NULL,
	"packaging_type" varchar(150),
	"supplier_company" varchar(200),
	"order_type" varchar(50),
	"stock_value" varchar(100),
	"need_order_value" varchar(100),
	"ordered_quantity" varchar(100),
	"received_quantity" varchar(100),
	"order_received_date" date,
	"order_placed_date" date,
	"order_deadline_date" date,
	"order_shipment_date" date,
	"process_code" varchar(50),
	"process_stage" varchar(150),
	"product_detail" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_items_module_key_check" CHECK ("work_items"."module_key" in ('incoming-orders', 'new-designs', 'revisions', 'team-approval', 'customer-approval-mail', 'pricing', 'digital')),
	CONSTRAINT "work_items_company_name_trimmed_check" CHECK ("work_items"."company_name" = btrim("work_items"."company_name")),
	CONSTRAINT "work_items_company_name_not_empty_check" CHECK (char_length("work_items"."company_name") > 0),
	CONSTRAINT "work_items_product_name_trimmed_check" CHECK ("work_items"."product_name" = btrim("work_items"."product_name")),
	CONSTRAINT "work_items_product_name_not_empty_check" CHECK (char_length("work_items"."product_name") > 0)
);
--> statement-breakpoint
ALTER TABLE "work_item_assignees" ADD CONSTRAINT "work_item_assignees_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_assignees" ADD CONSTRAINT "work_item_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_assignees" ADD CONSTRAINT "work_item_assignees_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_comments" ADD CONSTRAINT "work_item_comments_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_comments" ADD CONSTRAINT "work_item_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_item_assignees_user_id_idx" ON "work_item_assignees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "work_item_assignees_assigned_by_idx" ON "work_item_assignees" USING btree ("assigned_by");--> statement-breakpoint
CREATE INDEX "work_item_comments_work_item_id_created_at_idx" ON "work_item_comments" USING btree ("work_item_id","created_at");--> statement-breakpoint
CREATE INDEX "work_item_comments_author_id_idx" ON "work_item_comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "work_items_module_key_created_at_idx" ON "work_items" USING btree ("module_key","created_at");--> statement-breakpoint
CREATE INDEX "work_items_created_by_idx" ON "work_items" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "work_items_order_deadline_date_idx" ON "work_items" USING btree ("order_deadline_date");