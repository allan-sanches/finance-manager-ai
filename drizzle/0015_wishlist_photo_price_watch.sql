ALTER TABLE "shopping_items" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD COLUMN "product_url" text;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD COLUMN "price_history" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD COLUMN "price_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD COLUMN "price_check_error" text;--> statement-breakpoint
UPDATE "shopping_items"
SET "price_history" = jsonb_build_array(
  jsonb_build_object(
    'date', to_char(("created_at" AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD'),
    'price', "estimated_price"
  )
)
WHERE "estimated_price" IS NOT NULL;
