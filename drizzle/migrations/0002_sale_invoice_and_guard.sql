ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS invoice_number TEXT;

CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1;
GRANT USAGE, SELECT ON SEQUENCE public.invoice_seq TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || to_char(COALESCE(NEW.sale_date, CURRENT_DATE), 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS sales_invoice_number ON public.sales;
CREATE TRIGGER sales_invoice_number BEFORE INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();

CREATE OR REPLACE FUNCTION public.guard_animal_sellable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE st animal_status;
BEGIN
  SELECT status INTO st FROM public.animals WHERE id = NEW.animal_id FOR UPDATE;
  IF st IS NULL THEN
    RAISE EXCEPTION 'ANIMAL_NOT_FOUND';
  END IF;
  IF st <> 'available' THEN
    RAISE EXCEPTION 'ANIMAL_NOT_AVAILABLE';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sales WHERE animal_id = NEW.animal_id) THEN
    RAISE EXCEPTION 'ANIMAL_ALREADY_SOLD';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS sales_guard_sellable ON public.sales;
CREATE TRIGGER sales_guard_sellable BEFORE INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.guard_animal_sellable();

UPDATE public.sales SET invoice_number = 'INV-' || to_char(sale_date, 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 5, '0') WHERE invoice_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sales_invoice_number_key ON public.sales(invoice_number);