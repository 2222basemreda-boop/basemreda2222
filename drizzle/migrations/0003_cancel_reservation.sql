ALTER TABLE public.animal_customer_history
  ADD COLUMN IF NOT EXISTS event TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;

CREATE OR REPLACE FUNCTION public.cancel_reservation(_animal_id UUID, _reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status animal_status;
  v_customer UUID;
  v_tag TEXT;
  v_hist UUID;
  v_name TEXT;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  SELECT status, customer_id, tag_number INTO v_status, v_customer, v_tag
  FROM public.animals WHERE id = _animal_id FOR UPDATE;

  IF v_tag IS NULL THEN
    RAISE EXCEPTION 'ANIMAL_NOT_FOUND';
  END IF;
  IF v_status <> 'reserved' THEN
    RAISE EXCEPTION 'NOT_RESERVED';
  END IF;

  UPDATE public.animals
     SET status = 'available', customer_id = NULL, updated_at = now()
   WHERE id = _animal_id;

  SELECT id INTO v_hist FROM public.animal_customer_history
   WHERE animal_id = _animal_id
   ORDER BY changed_at DESC, id DESC LIMIT 1;

  IF v_hist IS NOT NULL THEN
    UPDATE public.animal_customer_history
       SET event = 'cancelled', customer_id = v_customer, note = _reason
     WHERE id = v_hist;
  ELSE
    INSERT INTO public.animal_customer_history(animal_id, customer_id, status, changed_by, event, note)
    VALUES (_animal_id, v_customer, 'available', auth.uid(), 'cancelled', _reason);
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.activity_logs(user_id, user_name, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), COALESCE(v_name, ''), 'cancelled', 'animals', _animal_id, v_tag,
          jsonb_build_object('customer_id', v_customer, 'reason', _reason));
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_reservation(UUID, TEXT) TO authenticated;