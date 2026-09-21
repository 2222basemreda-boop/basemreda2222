ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS supplier_name TEXT;

COMMENT ON COLUMN public.animals.supplier_name IS 'Supplier name captured when adding or editing an animal; independent from reservation/customer ownership.';

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS worker_tip NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transportation NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slaughtering NUMERIC(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.sales.total_price IS 'Base animal sale amount: weight * price_per_kg. Final invoice total is total_price + worker_tip + transportation + slaughtering.';
COMMENT ON COLUMN public.sales.worker_tip IS 'Additional invoice charge for workers tip.';
COMMENT ON COLUMN public.sales.transportation IS 'Additional invoice charge for transportation.';
COMMENT ON COLUMN public.sales.slaughtering IS 'Additional invoice charge for slaughtering.';

ALTER TABLE public.sales
  ADD CONSTRAINT sales_worker_tip_nonnegative CHECK (worker_tip >= 0),
  ADD CONSTRAINT sales_transportation_nonnegative CHECK (transportation >= 0),
  ADD CONSTRAINT sales_slaughtering_nonnegative CHECK (slaughtering >= 0);

CREATE OR REPLACE FUNCTION public.reserve_animal(_animal_id UUID, _customer_id UUID, _note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.animal_status;
  v_tag TEXT;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'manager'::public.app_role, 'worker'::public.app_role]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF _customer_id IS NULL THEN
    RAISE EXCEPTION 'CUSTOMER_REQUIRED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = _customer_id) THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
  END IF;

  SELECT status, tag_number INTO v_status, v_tag
  FROM public.animals
  WHERE id = _animal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ANIMAL_NOT_FOUND';
  END IF;

  IF v_status <> 'available' THEN
    RAISE EXCEPTION 'ANIMAL_NOT_AVAILABLE';
  END IF;

  UPDATE public.animals
     SET status = 'reserved', customer_id = _customer_id, updated_at = now()
   WHERE id = _animal_id;

  UPDATE public.animal_customer_history
     SET event = 'reserved', note = _note
   WHERE id = (
     SELECT id
     FROM public.animal_customer_history
     WHERE animal_id = _animal_id
     ORDER BY changed_at DESC
     LIMIT 1
   );

  INSERT INTO public.activity_logs(user_id, user_name, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), COALESCE((SELECT full_name FROM public.profiles WHERE id = auth.uid()), ''), 'reserved', 'animals', _animal_id, v_tag,
          jsonb_build_object('customer_id', _customer_id, 'note', _note));
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_animal(UUID, UUID, TEXT) TO authenticated;