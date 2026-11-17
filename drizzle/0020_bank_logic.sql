ALTER TABLE "credit_cards" ADD COLUMN "cdi_percent" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "credit_cards" ADD COLUMN "used_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "credit_cards" ADD COLUMN "used_date" date;--> statement-breakpoint
ALTER TABLE "savings_goals" ADD COLUMN "amount_date" date;