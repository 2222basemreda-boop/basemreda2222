ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Allow re-selling an animal whose previous sale was cancelled
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
  IF EXISTS (SELECT 1 FROM public.sales WHERE animal_id = NEW.animal_id AND cancelled_at IS NULL) THEN
    RAISE EXCEPTION 'ANIMAL_ALREADY_SOLD';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id UUID, _reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_animal UUID;
  v_customer UUID;
  v_cancelled TIMESTAMPTZ;
  v_invoice TEXT;
  v_tag TEXT;
  v_name TEXT;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  SELECT animal_id, customer_id, cancelled_at, invoice_number
    INTO v_animal, v_customer, v_cancelled, v_invoice
  FROM public.sales WHERE id = _sale_id FOR UPDATE;

  IF v_animal IS NULL THEN
    RAISE EXCEPTION 'SALE_NOT_FOUND';
  END IF;
  IF v_cancelled IS NOT NULL THEN
    RAISE EXCEPTION 'SALE_ALREADY_CANCELLED';
  END IF;

  UPDATE public.sales
     SET cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = _reason, updated_at = now()
   WHERE id = _sale_id;

  -- The animal and all of its data stay intact; only its sale state is reverted.
  UPDATE public.animals
     SET status = 'available', customer_id = NULL, updated_at = now()
   WHERE id = v_animal
  RETURNING tag_number INTO v_tag;

  INSERT INTO public.animal_customer_history(animal_id, customer_id, status, changed_by, event, note)
  VALUES (v_animal, v_customer, 'available', auth.uid(), 'sale_cancelled',
          COALESCE(_reason, 'إلغاء البيع ' || COALESCE(v_invoice, '')));

  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.activity_logs(user_id, user_name, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), COALESCE(v_name, ''), 'cancelled', 'sales', _sale_id, COALESCE(v_invoice, v_tag),
          jsonb_build_object('animal_id', v_animal, 'customer_id', v_customer, 'reason', _reason));
END; $$;

GRANT EXECUTE ON FUNCTION public.cancel_sale(UUID, TEXT) TO authenticated;