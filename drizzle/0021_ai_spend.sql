CREATE TABLE "ai_spend" (
	"day" text NOT NULL,
	"model" text NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micro" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_spend_day_model_pk" PRIMARY KEY("day","model")
);
