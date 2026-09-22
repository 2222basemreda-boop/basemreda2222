ALTER TABLE public.treatments
  ADD COLUMN record_type TEXT NOT NULL DEFAULT 'treatment',
  ADD COLUMN first_dose_date DATE,
  ADD COLUMN second_dose_date DATE;

ALTER TABLE public.treatments
  ADD CONSTRAINT treatments_record_type_check CHECK (record_type IN ('treatment', 'vaccination'));

ALTER TABLE public.animal_customer_history
  ADD COLUMN reservation_weight NUMERIC(10,2),
  ADD COLUMN price_per_kg NUMERIC(12,2),
  ADD COLUMN worker_tip NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN transportation NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN slaughtering NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN payment_method TEXT,
  ADD COLUMN transaction_date DATE;

ALTER TABLE public.animal_customer_history
  ADD CONSTRAINT reservation_weight_nonnegative CHECK (reservation_weight IS NULL OR reservation_weight >= 0),
  ADD CONSTRAINT reservation_price_nonnegative CHECK (price_per_kg IS NULL OR price_per_kg >= 0),
  ADD CONSTRAINT reservation_worker_tip_nonnegative CHECK (worker_tip >= 0),
  ADD CONSTRAINT reservation_transportation_nonnegative CHECK (transportation >= 0),
  ADD CONSTRAINT reservation_slaughtering_nonnegative CHECK (slaughtering >= 0),
  ADD CONSTRAINT reservation_paid_nonnegative CHECK (paid_amount >= 0);

CREATE OR REPLACE FUNCTION public.reserve_animal_details(
  _animal_id UUID,
  _customer_id UUID,
  _weight NUMERIC,
  _price_per_kg NUMERIC,
  _worker_tip NUMERIC DEFAULT 0,
  _transportation NUMERIC DEFAULT 0,
  _slaughtering NUMERIC DEFAULT 0,
  _paid_amount NUMERIC DEFAULT 0,
  _payment_method TEXT DEFAULT NULL,
  _transaction_date DATE DEFAULT CURRENT_DATE,
  _note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.animal_status;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF _weight IS NULL OR _weight <= 0 OR _price_per_kg IS NULL OR _price_per_kg <= 0 THEN
    RAISE EXCEPTION 'INVALID_RESERVATION_AMOUNT';
  END IF;

  IF COALESCE(_worker_tip, 0) < 0 OR COALESCE(_transportation, 0) < 0 OR COALESCE(_slaughtering, 0) < 0 OR COALESCE(_paid_amount, 0) < 0 THEN
    RAISE EXCEPTION 'INVALID_RESERVATION_AMOUNT';
  END IF;

  SELECT status INTO v_status
  FROM public.animals
  WHERE id = _animal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ANIMAL_NOT_FOUND';
  END IF;

  IF v_status <> 'available' THEN
    RAISE EXCEPTION 'ANIMAL_NOT_AVAILABLE';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = _customer_id) THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
  END IF;

  UPDATE public.animals
  SET status = 'reserved', customer_id = _customer_id, updated_at = now()
  WHERE id = _animal_id;

  UPDATE public.animal_customer_history
  SET reservation_weight = _weight,
      price_per_kg = _price_per_kg,
      worker_tip = COALESCE(_worker_tip, 0),
      transportation = COALESCE(_transportation, 0),
      slaughtering = COALESCE(_slaughtering, 0),
      paid_amount = COALESCE(_paid_amount, 0),
      payment_method = NULLIF(BTRIM(_payment_method), ''),
      transaction_date = COALESCE(_transaction_date, CURRENT_DATE),
      note = NULLIF(BTRIM(_note), '')
  WHERE id = (
    SELECT id
    FROM public.animal_customer_history
    WHERE animal_id = _animal_id
      AND customer_id = _customer_id
      AND status = 'reserved'
      AND event = 'reserved'
    ORDER BY changed_at DESC
    LIMIT 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_animal_details(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_animal_details(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_animal_details(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE, TEXT) TO service_role;