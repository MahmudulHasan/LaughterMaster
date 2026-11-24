ALTER TABLE "jokes" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "jokes" ADD COLUMN "moderation_decision" text;--> statement-breakpoint
ALTER TABLE "jokes" ADD COLUMN "moderation_reason" text;--> statement-breakpoint
ALTER TABLE "jokes" ADD COLUMN "moderation_model" text;--> statement-breakpoint
ALTER TABLE "jokes" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jokes" ADD COLUMN "moderation_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jokes" ADD COLUMN "duplicate_of" text;