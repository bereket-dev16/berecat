CREATE TABLE "work_item_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_item_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"from_module_key" varchar(50),
	"to_module_key" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_item_events_event_type_check" CHECK ("work_item_events"."event_type" in ('moved', 'completed', 'reopened')),
	CONSTRAINT "work_item_events_from_module_key_check" CHECK ("work_item_events"."from_module_key" is null or "work_item_events"."from_module_key" in ('incoming-orders', 'new-designs', 'revisions', 'team-approval', 'customer-approval-mail', 'pricing', 'digital')),
	CONSTRAINT "work_item_events_to_module_key_check" CHECK ("work_item_events"."to_module_key" is null or "work_item_events"."to_module_key" in ('incoming-orders', 'new-designs', 'revisions', 'team-approval', 'customer-approval-mail', 'pricing', 'digital')),
	CONSTRAINT "work_item_events_shape_check" CHECK (("work_item_events"."event_type" = 'moved' and "work_item_events"."from_module_key" is not null and "work_item_events"."to_module_key" is not null and "work_item_events"."from_module_key" <> "work_item_events"."to_module_key") or ("work_item_events"."event_type" in ('completed', 'reopened') and "work_item_events"."from_module_key" is null and "work_item_events"."to_module_key" is null))
);
--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "completed_by" uuid;--> statement-breakpoint
ALTER TABLE "work_item_events" ADD CONSTRAINT "work_item_events_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_events" ADD CONSTRAINT "work_item_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_item_events_work_item_id_created_at_idx" ON "work_item_events" USING btree ("work_item_id","created_at");--> statement-breakpoint
CREATE INDEX "work_item_events_actor_id_idx" ON "work_item_events" USING btree ("actor_id");--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_items_status_module_key_created_at_idx" ON "work_items" USING btree ("status","module_key","created_at");--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_status_check" CHECK ("work_items"."status" in ('active', 'completed'));--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_completion_consistency_check" CHECK (("work_items"."status" = 'active' and "work_items"."completed_at" is null and "work_items"."completed_by" is null) or ("work_items"."status" = 'completed' and "work_items"."completed_at" is not null and "work_items"."completed_by" is not null));