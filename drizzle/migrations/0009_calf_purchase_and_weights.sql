ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS purchase_price_per_kg numeric CHECK (purchase_price_per_kg IS NULL OR purchase_price_per_kg >= 0),
  ADD COLUMN IF NOT EXISTS receive_weight numeric CHECK (receive_weight IS NULL OR receive_weight >= 0),
  ADD COLUMN IF NOT EXISTS farm_weight numeric CHECK (farm_weight IS NULL OR farm_weight >= 0),
  ADD COLUMN IF NOT EXISTS expenses numeric NOT NULL DEFAULT 0 CHECK (expenses >= 0);
COMMENT ON COLUMN public.animals.supplier_cost IS 'Total calf cost = purchase_price_per_kg * receive_weight + expenses (or manual for older rows)';