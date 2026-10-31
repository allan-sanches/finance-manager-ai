ALTER TABLE "transactions" ADD COLUMN "is_transfer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "savings_goal_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_savings_goal_id_savings_goals_id_fk" FOREIGN KEY ("savings_goal_id") REFERENCES "public"."savings_goals"("id") ON DELETE set null ON UPDATE no action;