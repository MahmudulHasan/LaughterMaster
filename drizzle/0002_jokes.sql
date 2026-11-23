CREATE TABLE "jokes" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"text" text NOT NULL,
	"normalized_text" text NOT NULL,
	"status" text DEFAULT 'approved' NOT NULL,
	"category" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jokes" ADD CONSTRAINT "jokes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jokes_status_created_idx" ON "jokes" USING btree ("status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jokes_author_created_idx" ON "jokes" USING btree ("author_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);