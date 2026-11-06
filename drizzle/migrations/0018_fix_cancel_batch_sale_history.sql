-- Cancelling a batch sale must not write an animal history row (no single animal involved).
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_animal UUID;
  v_batch UUID;
  v_qty integer;
  v_weight numeric;
  v_customer UUID;
  v_cancelled TIMESTAMPTZ;
  v_invoice TEXT;
  v_tag TEXT;
  v_name TEXT;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  SELECT animal_id, batch_id, quantity, weight, customer_id, cancelled_at, invoice_number
    INTO v_animal, v_batch, v_qty, v_weight, v_customer, v_cancelled, v_invoice
  FROM public.sales WHERE id = _sale_id FOR UPDATE;

  IF v_animal IS NULL AND v_batch IS NULL THEN
    RAISE EXCEPTION 'SALE_NOT_FOUND';
  END IF;
  IF v_cancelled IS NOT NULL THEN
    RAISE EXCEPTION 'SALE_ALREADY_CANCELLED';
  END IF;

  UPDATE public.sales
     SET cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = _reason, updated_at = now()
   WHERE id = _sale_id;

  -- Tied calves: revert to available, all data intact. Loose batches: restore remaining inventory.
  IF v_animal IS NOT NULL THEN
    UPDATE public.animals
       SET status = 'available', customer_id = NULL, updated_at = now()
     WHERE id = v_animal
    RETURNING tag_number INTO v_tag;
  END IF;
  IF v_batch IS NOT NULL THEN
    UPDATE public.calf_batches
       SET remaining_quantity = remaining_quantity + v_qty,
           remaining_weight = remaining_weight + v_weight,
           updated_at = now()
     WHERE id = v_batch;
  END IF;

  -- Animal history only exists for tied calves; batch sales are logged in activity logs below.
  IF v_animal IS NOT NULL THEN
    INSERT INTO public.animal_customer_history(animal_id, customer_id, status, changed_by, event, note)
    VALUES (v_animal, v_customer, 'available', auth.uid(), 'sale_cancelled',
            COALESCE(_reason, 'إلغاء البيع ' || COALESCE(v_invoice, '')));
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.activity_logs(user_id, user_name, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), COALESCE(v_name, ''), 'cancelled', 'sales', _sale_id, COALESCE(v_invoice, v_tag),
          jsonb_build_object('animal_id', v_animal, 'batch_id', v_batch, 'customer_id', v_customer, 'reason', _reason));
END; $function$;