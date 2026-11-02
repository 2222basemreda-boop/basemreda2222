-- Batch inventory for loose (untied) calves
CREATE TABLE public.calf_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  barn_id uuid REFERENCES public.barns(id) ON DELETE SET NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  quantity integer NOT NULL CHECK (quantity > 0),
  purchase_weight numeric CHECK (purchase_weight IS NULL OR purchase_weight >= 0),
  receive_weight numeric NOT NULL CHECK (receive_weight > 0),
  remaining_quantity integer NOT NULL CHECK (remaining_quantity >= 0),
  remaining_weight numeric NOT NULL CHECK (remaining_weight >= 0),
  purchase_price_per_kg numeric CHECK (purchase_price_per_kg IS NULL OR purchase_price_per_kg >= 0),
  expenses numeric NOT NULL DEFAULT 0 CHECK (expenses >= 0),
  total_cost numeric CHECK (total_cost IS NULL OR total_cost >= 0),
  supplier_paid numeric NOT NULL DEFAULT 0 CHECK (supplier_paid >= 0),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calf_batches TO authenticated;
GRANT ALL ON public.calf_batches TO service_role;
ALTER TABLE public.calf_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read calf batches" ON public.calf_batches FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert calf batches" ON public.calf_batches FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','worker']::public.app_role[]));
CREATE POLICY "staff update calf batches" ON public.calf_batches FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','worker']::public.app_role[]));
CREATE POLICY "admin delete calf batches" ON public.calf_batches FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX calf_batches_supplier_idx ON public.calf_batches(supplier_id);
CREATE INDEX calf_batches_barn_idx ON public.calf_batches(barn_id);
CREATE TRIGGER batches_updated BEFORE UPDATE ON public.calf_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER log_batches AFTER INSERT OR UPDATE OR DELETE ON public.calf_batches FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Subsequent total weighings of the remaining loose calves in a batch
CREATE TABLE public.batch_weighings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.calf_batches(id) ON DELETE CASCADE,
  weighing_date date NOT NULL,
  total_weight numeric NOT NULL CHECK (total_weight > 0),
  calf_count integer,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_weighings TO authenticated;
GRANT ALL ON public.batch_weighings TO service_role;
ALTER TABLE public.batch_weighings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read batch weighings" ON public.batch_weighings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert batch weighings" ON public.batch_weighings FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','worker']::public.app_role[]));
CREATE POLICY "staff update batch weighings" ON public.batch_weighings FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));
CREATE POLICY "admin delete batch weighings" ON public.batch_weighings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX batch_weighings_batch_idx ON public.batch_weighings(batch_id);
CREATE TRIGGER log_batch_weighings AFTER INSERT OR UPDATE OR DELETE ON public.batch_weighings FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- A sale can now reference a loose-calves batch instead of a single tied calf
ALTER TABLE public.sales ADD COLUMN batch_id uuid REFERENCES public.calf_batches(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0);
ALTER TABLE public.sales ALTER COLUMN animal_id DROP NOT NULL;
CREATE INDEX sales_batch_idx ON public.sales(batch_id);
COMMENT ON COLUMN public.sales.animal_id IS 'NULL for loose-calves batch sales; the batch is referenced by batch_id';

-- Guards: batch sales validate against remaining inventory
CREATE OR REPLACE FUNCTION public.guard_animal_sellable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE st animal_status;
BEGIN
  IF NEW.animal_id IS NULL THEN
    IF NEW.batch_id IS NULL THEN
      RAISE EXCEPTION 'SALE_TARGET_REQUIRED';
    END IF;
    PERFORM 1 FROM public.calf_batches WHERE id = NEW.batch_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'BATCH_NOT_FOUND';
    END IF;
    IF NEW.weight IS NULL OR NEW.weight <= 0 THEN
      RAISE EXCEPTION 'INVALID_SALE_AMOUNT';
    END IF;
    IF NEW.quantity IS NULL OR NEW.quantity < 1 THEN
      RAISE EXCEPTION 'BATCH_QUANTITY_INVALID';
    END IF;
    IF EXISTS (SELECT 1 FROM public.calf_batches b WHERE b.id = NEW.batch_id AND (b.remaining_quantity < NEW.quantity OR b.remaining_weight < NEW.weight)) THEN
      RAISE EXCEPTION 'BATCH_INSUFFICIENT';
    END IF;
    RETURN NEW;
  END IF;
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
END; $function$;

-- Inventory: deduct on insert, restore on delete
CREATE OR REPLACE FUNCTION public.apply_batch_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.batch_id IS NOT NULL THEN
      UPDATE public.calf_batches
        SET remaining_quantity = remaining_quantity - NEW.quantity,
            remaining_weight = remaining_weight - NEW.weight,
            updated_at = now()
      WHERE id = NEW.batch_id;
    END IF;
    RETURN NEW;
  ELSE
    IF OLD.batch_id IS NOT NULL THEN
      UPDATE public.calf_batches
        SET remaining_quantity = remaining_quantity + OLD.quantity,
            remaining_weight = remaining_weight + OLD.weight,
            updated_at = now()
      WHERE id = OLD.batch_id;
    END IF;
    RETURN OLD;
  END IF;
END; $function$;
CREATE TRIGGER sales_apply_batch AFTER INSERT OR DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.apply_batch_sale();

-- Cancelling a batch sale restores the batch inventory
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

  INSERT INTO public.animal_customer_history(animal_id, customer_id, status, changed_by, event, note)
  VALUES (v_animal, v_customer, 'available', auth.uid(), 'sale_cancelled',
          COALESCE(_reason, 'إلغاء البيع ' || COALESCE(v_invoice, '')));

  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.activity_logs(user_id, user_name, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), COALESCE(v_name, ''), 'cancelled', 'sales', _sale_id, COALESCE(v_invoice, v_tag),
          jsonb_build_object('animal_id', v_animal, 'batch_id', v_batch, 'customer_id', v_customer, 'reason', _reason));
END; $function$;

-- Activity log labels for batch sales
CREATE OR REPLACE FUNCTION public.log_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row JSONB; v_old JSONB; v_label TEXT; v_action TEXT; v_name TEXT; v_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD); v_old := to_jsonb(OLD); v_action := 'deleted';
  ELSIF TG_OP = 'UPDATE' THEN
    v_row := to_jsonb(NEW); v_old := to_jsonb(OLD); v_action := 'updated';
  ELSE
    v_row := to_jsonb(NEW); v_old := NULL; v_action := 'created';
  END IF;
  IF TG_TABLE_NAME = 'animals' AND TG_OP = 'UPDATE' THEN
    IF (v_row ? 'barn_id') AND (v_row->>'barn_id') IS DISTINCT FROM (v_old->>'barn_id') THEN
      v_action := 'moved';
    END IF;
  END IF;
  v_id := (v_row->>'id')::uuid;
  v_label := COALESCE(v_row->>'tag_number', v_row->>'name', v_row->>'code', v_row->>'feed_type', v_row->>'diagnosis');
  IF v_label IS NULL AND (v_row ? 'animal_id') THEN
    SELECT a.tag_number INTO v_label FROM public.animals a WHERE a.id = (v_row->>'animal_id')::uuid;
  END IF;
  IF v_label IS NULL AND (v_row ? 'batch_id') THEN
    SELECT 'دفعة عجول حرة' || CASE WHEN b.supplier_name IS NOT NULL AND b.supplier_name <> '' THEN ' - ' || b.supplier_name ELSE '' END
      INTO v_label FROM public.calf_batches b WHERE b.id = (v_row->>'batch_id')::uuid;
  END IF;
  IF v_label IS NULL AND (v_row ? 'employee_id') THEN
    SELECT e.name INTO v_label FROM public.employees e WHERE e.id = (v_row->>'employee_id')::uuid;
  END IF;
  SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id = auth.uid();
  INSERT INTO public.activity_logs(user_id, user_name, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), v_name, v_action, TG_TABLE_NAME, v_id, v_label,
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('before', v_old, 'after', v_row) ELSE v_row END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $function$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.calf_batches, public.batch_weighings;