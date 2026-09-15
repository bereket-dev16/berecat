CREATE TABLE "work_item_comment_reactions" (
	"comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_item_comment_reactions_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "work_item_comment_reactions" ADD CONSTRAINT "work_item_comment_reactions_comment_id_work_item_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."work_item_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_comment_reactions" ADD CONSTRAINT "work_item_comment_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_item_comment_reactions_user_id_idx" ON "work_item_comment_reactions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_items_deleted_at_idx" ON "work_items" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_deletion_consistency_check" CHECK (("work_items"."deleted_at" is null and "work_items"."deleted_by" is null) or ("work_items"."deleted_at" is not null and "work_items"."deleted_by" is not null));