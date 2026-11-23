CREATE TABLE "votes" (
	"joke_id" text NOT NULL,
	"user_id" text NOT NULL,
	"value" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_joke_id_user_id_pk" PRIMARY KEY("joke_id","user_id"),
	CONSTRAINT "votes_value_check" CHECK ("votes"."value" in (1, -1))
);
--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_joke_id_jokes_id_fk" FOREIGN KEY ("joke_id") REFERENCES "public"."jokes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "votes_joke_idx" ON "votes" USING btree ("joke_id");