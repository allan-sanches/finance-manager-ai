ALTER TABLE "transactions" ADD COLUMN "installment_group_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "installment_number" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "installment_count" integer;