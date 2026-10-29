CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "savings_goals" ADD COLUMN "institution" text;--> statement-breakpoint
ALTER TABLE "savings_goals" ADD COLUMN "cdi_percent" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "savings_goals" ADD COLUMN "currency" text DEFAULT 'BRL' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_goals" ADD COLUMN "lock_days" integer;--> statement-breakpoint
ALTER TABLE "savings_goals" ADD COLUMN "deposit_date" date;