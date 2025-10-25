-- Add quantity column to purchases for recording item quantities
ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

-- Backfill existing rows with quantity = 1 if any nulls (defensive)
UPDATE public.purchases SET quantity = 1 WHERE quantity IS NULL;

-- Index on purchases by company for potential aggregation
CREATE INDEX IF NOT EXISTS idx_purchases_company_id_quantity ON public.purchases(company_id);
