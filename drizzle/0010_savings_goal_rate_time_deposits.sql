ALTER TABLE "savings_goals" ADD COLUMN "annual_rate" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "savings_goals" ADD COLUMN "time_deposits" jsonb DEFAULT '[]'::jsonb NOT NULL;