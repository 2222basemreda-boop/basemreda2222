CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant','worker']::public.app_role[]));
CREATE POLICY "managers update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY "admin delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.animals ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.animals ADD COLUMN supplier_cost numeric CHECK (supplier_cost IS NULL OR supplier_cost >= 0);
ALTER TABLE public.animals ADD COLUMN supplier_paid numeric NOT NULL DEFAULT 0 CHECK (supplier_paid >= 0);
CREATE INDEX animals_supplier_idx ON public.animals(supplier_id);

CREATE TABLE public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  animal_id uuid REFERENCES public.animals(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  recorded_by uuid,
  recorded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX supplier_payments_supplier_idx ON public.supplier_payments(supplier_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read supplier payments" ON public.supplier_payments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "finance insert supplier payments" ON public.supplier_payments FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY "finance update supplier payments" ON public.supplier_payments FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY "admin delete supplier payments" ON public.supplier_payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_payment_recorder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.recorded_by := auth.uid();
    NEW.recorded_by_name := (SELECT full_name FROM public.profiles WHERE id = auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER supplier_payments_recorder BEFORE INSERT ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.set_payment_recorder();

CREATE TRIGGER suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER log_suppliers AFTER INSERT OR UPDATE OR DELETE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_supplier_payments AFTER INSERT OR UPDATE OR DELETE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Link existing calves to suppliers created from the supplier names already saved on them.
INSERT INTO public.suppliers(name)
SELECT DISTINCT btrim(supplier_name) FROM public.animals WHERE supplier_name IS NOT NULL AND btrim(supplier_name) <> '';
UPDATE public.animals a SET supplier_id = s.id FROM public.suppliers s
WHERE a.supplier_id IS NULL AND btrim(a.supplier_name) = s.name;

ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers, public.supplier_payments;