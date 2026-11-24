CREATE TABLE "reports" (
	"joke_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_joke_id_user_id_pk" PRIMARY KEY("joke_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name_customized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_joke_id_jokes_id_fk" FOREIGN KEY ("joke_id") REFERENCES "public"."jokes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_joke_idx" ON "reports" USING btree ("joke_id");--> statement-breakpoint
CREATE INDEX "reports_user_created_idx" ON "reports" USING btree ("user_id","created_at");