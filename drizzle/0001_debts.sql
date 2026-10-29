CREATE TABLE "debts" (
	"id" text PRIMARY KEY NOT NULL,
	"creditor" text NOT NULL,
	"description" text NOT NULL,
	"source" text NOT NULL,
	"current_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"overdue_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"reference_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
