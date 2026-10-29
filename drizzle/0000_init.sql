CREATE TABLE "credit_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"limit" numeric(14, 2) NOT NULL,
	"closing_day" integer NOT NULL,
	"due_day" integer NOT NULL,
	"current_invoice_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"target_amount" numeric(14, 2) NOT NULL,
	"current_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"deadline" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"list_type" text NOT NULL,
	"estimated_price" numeric(14, 2),
	"priority" text,
	"is_purchased" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"payment_method" text NOT NULL,
	"credit_card_id" text,
	"date" date NOT NULL,
	"is_fixed" boolean DEFAULT false NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE set null ON UPDATE no action;