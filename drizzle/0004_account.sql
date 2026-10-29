CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"password_hash" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
