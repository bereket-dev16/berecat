ALTER TABLE "work_item_comments" ADD COLUMN "parent_comment_id" uuid;--> statement-breakpoint
ALTER TABLE "work_item_comments" ADD CONSTRAINT "work_item_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."work_item_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_item_comments_parent_comment_id_idx" ON "work_item_comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "work_items_status_completed_at_idx" ON "work_items" USING btree ("status","completed_at");--> statement-breakpoint
CREATE INDEX "work_items_completed_by_idx" ON "work_items" USING btree ("completed_by");--> statement-breakpoint
CREATE INDEX "work_items_status_module_key_completed_at_idx" ON "work_items" USING btree ("status","module_key","completed_at");--> statement-breakpoint
ALTER TABLE "work_items" DROP COLUMN "process_code";--> statement-breakpoint
ALTER TABLE "work_item_comments" ADD CONSTRAINT "work_item_comments_not_self_parent_check" CHECK ("work_item_comments"."parent_comment_id" is null or "work_item_comments"."parent_comment_id" <> "work_item_comments"."id");