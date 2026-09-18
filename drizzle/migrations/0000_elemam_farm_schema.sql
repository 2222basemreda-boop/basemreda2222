-- ===== Enums =====
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'worker', 'accountant');
CREATE TYPE public.animal_status AS ENUM ('available', 'reserved', 'sold');
CREATE TYPE public.payment_status AS ENUM ('paid', 'partial', 'unpaid');

-- ===== Profiles =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== Roles =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.has_any_users()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles)
$$;
GRANT EXECUTE ON FUNCTION public.has_any_users() TO anon, authenticated;

-- profiles policies
CREATE POLICY "staff read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
-- user_roles policies
CREATE POLICY "staff read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ===== Barns =====
CREATE TABLE public.barns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  capacity INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barns TO authenticated;
GRANT ALL ON public.barns TO service_role;
ALTER TABLE public.barns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read barns" ON public.barns FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "managers insert barns" ON public.barns FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));
CREATE POLICY "managers update barns" ON public.barns FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));
CREATE POLICY "admin delete barns" ON public.barns FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Customers =====
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  code TEXT NOT NULL UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read customers" ON public.customers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant','worker']::public.app_role[]));
CREATE POLICY "managers update customers" ON public.customers FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY "admin delete customers" ON public.customers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Animals =====
CREATE TABLE public.animals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_number TEXT NOT NULL UNIQUE,
  color TEXT,
  current_weight NUMERIC(10,2),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  barn_id UUID REFERENCES public.barns(id) ON DELETE SET NULL,
  status public.animal_status NOT NULL DEFAULT 'available',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX animals_barn_idx ON public.animals(barn_id);
CREATE INDEX animals_customer_idx ON public.animals(customer_id);
CREATE INDEX animals_status_idx ON public.animals(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.animals TO authenticated;
GRANT ALL ON public.animals TO service_role;
ALTER TABLE public.animals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read animals" ON public.animals FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "workers insert animals" ON public.animals FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','worker']::public.app_role[]));
CREATE POLICY "workers update animals" ON public.animals FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','worker']::public.app_role[]));
CREATE POLICY "admin delete animals" ON public.animals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Weight history =====
CREATE TABLE public.weight_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  weight NUMERIC(10,2) NOT NULL,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX weight_records_animal_idx ON public.weight_records(animal_id, recorded_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_records TO authenticated;
GRANT ALL ON public.weight_records TO service_role;
ALTER TABLE public.weight_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read weights" ON public.weight_records FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "workers insert weights" ON public.weight_records FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','worker']::public.app_role[]));
CREATE POLICY "managers update weights" ON public.weight_records FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));
CREATE POLICY "admin delete weights" ON public.weight_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Barn movements =====
CREATE TABLE public.barn_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  from_barn_id UUID REFERENCES public.barns(id) ON DELETE SET NULL,
  to_barn_id UUID REFERENCES public.barns(id) ON DELETE SET NULL,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  moved_by UUID,
  notes TEXT
);
CREATE INDEX barn_movements_animal_idx ON public.barn_movements(animal_id, moved_at DESC);
GRANT SELECT ON public.barn_movements TO authenticated;
GRANT ALL ON public.barn_movements TO service_role;
ALTER TABLE public.barn_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read movements" ON public.barn_movements FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ===== Customer history =====
CREATE TABLE public.animal_customer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status public.animal_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID
);
CREATE INDEX ach_animal_idx ON public.animal_customer_history(animal_id, changed_at DESC);
GRANT SELECT ON public.animal_customer_history TO authenticated;
GRANT ALL ON public.animal_customer_history TO service_role;
ALTER TABLE public.animal_customer_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read customer history" ON public.animal_customer_history FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ===== Sales =====
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  weight NUMERIC(10,2) NOT NULL,
  price_per_kg NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(14,2) GENERATED ALWAYS AS (weight * price_per_kg) STORED,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sales_date_idx ON public.sales(sale_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read sales" ON public.sales FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY "finance insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY "finance update sales" ON public.sales FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY "admin delete sales" ON public.sales FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Feed records =====
CREATE TABLE public.feed_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id UUID REFERENCES public.barns(id) ON DELETE SET NULL,
  feed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  feed_type TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'كجم',
  cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX feed_records_date_idx ON public.feed_records(feed_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_records TO authenticated;
GRANT ALL ON public.feed_records TO service_role;
ALTER TABLE public.feed_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read feed" ON public.feed_records FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "workers insert feed" ON public.feed_records FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','worker']::public.app_role[]));
CREATE POLICY "managers update feed" ON public.feed_records FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));
CREATE POLICY "admin delete feed" ON public.feed_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Treatments =====
CREATE TABLE public.treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  treatment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis TEXT NOT NULL,
  medicine TEXT,
  dose TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX treatments_animal_idx ON public.treatments(animal_id, treatment_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatments TO authenticated;
GRANT ALL ON public.treatments TO service_role;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read treatments" ON public.treatments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "workers insert treatments" ON public.treatments FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','worker']::public.app_role[]));
CREATE POLICY "managers update treatments" ON public.treatments FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));
CREATE POLICY "admin delete treatments" ON public.treatments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Activity logs =====
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_label TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_created_idx ON public.activity_logs(created_at DESC);
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ===== Trigger functions =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER barns_updated BEFORE UPDATE ON public.barns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER animals_updated BEFORE UPDATE ON public.animals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sales_updated BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Generic activity logger
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row JSONB;
  v_label TEXT;
  v_action TEXT;
  v_name TEXT;
  v_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := to_jsonb(OLD); v_action := 'deleted';
  ELSIF TG_OP = 'UPDATE' THEN v_row := to_jsonb(NEW); v_action := 'updated';
  ELSE v_row := to_jsonb(NEW); v_action := 'created'; END IF;

  IF TG_TABLE_NAME = 'animals' AND TG_OP = 'UPDATE' AND NEW.barn_id IS DISTINCT FROM OLD.barn_id THEN
    v_action := 'moved';
  END IF;

  v_id := (v_row->>'id')::uuid;
  v_label := COALESCE(v_row->>'tag_number', v_row->>'name', v_row->>'code', v_row->>'feed_type', v_row->>'diagnosis');
  IF v_label IS NULL AND (v_row ? 'animal_id') THEN
    SELECT a.tag_number INTO v_label FROM public.animals a WHERE a.id = (v_row->>'animal_id')::uuid;
  END IF;

  SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id = auth.uid();

  INSERT INTO public.activity_logs(user_id, user_name, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), v_name, v_action, TG_TABLE_NAME, v_id, v_label,
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)) ELSE v_row END);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER log_animals AFTER INSERT OR UPDATE OR DELETE ON public.animals FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_barns AFTER INSERT OR UPDATE OR DELETE ON public.barns FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_sales AFTER INSERT OR UPDATE OR DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_feed AFTER INSERT OR UPDATE OR DELETE ON public.feed_records FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_treatments AFTER INSERT OR UPDATE OR DELETE ON public.treatments FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_weights AFTER INSERT OR DELETE ON public.weight_records FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Animal history triggers
CREATE OR REPLACE FUNCTION public.track_animal_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.barn_id IS NOT NULL THEN
      INSERT INTO public.barn_movements(animal_id, from_barn_id, to_barn_id, moved_by) VALUES (NEW.id, NULL, NEW.barn_id, auth.uid());
    END IF;
    IF NEW.customer_id IS NOT NULL OR NEW.status <> 'available' THEN
      INSERT INTO public.animal_customer_history(animal_id, customer_id, status, changed_by) VALUES (NEW.id, NEW.customer_id, NEW.status, auth.uid());
    END IF;
    IF NEW.current_weight IS NOT NULL THEN
      INSERT INTO public.weight_records(animal_id, weight, recorded_at, recorded_by, notes) VALUES (NEW.id, NEW.current_weight, NEW.entry_date, auth.uid(), 'الوزن عند التسجيل');
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.barn_id IS DISTINCT FROM OLD.barn_id THEN
      INSERT INTO public.barn_movements(animal_id, from_barn_id, to_barn_id, moved_by) VALUES (NEW.id, OLD.barn_id, NEW.barn_id, auth.uid());
    END IF;
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id OR NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.animal_customer_history(animal_id, customer_id, status, changed_by) VALUES (NEW.id, NEW.customer_id, NEW.status, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER animals_track AFTER INSERT OR UPDATE ON public.animals FOR EACH ROW EXECUTE FUNCTION public.track_animal_changes();

-- New weight record updates the animal's current weight
CREATE OR REPLACE FUNCTION public.apply_weight_record()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE latest RECORD;
BEGIN
  SELECT weight INTO latest FROM public.weight_records WHERE animal_id = COALESCE(NEW.animal_id, OLD.animal_id) ORDER BY recorded_at DESC, created_at DESC LIMIT 1;
  UPDATE public.animals SET current_weight = latest.weight WHERE id = COALESCE(NEW.animal_id, OLD.animal_id) AND current_weight IS DISTINCT FROM latest.weight;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER weight_apply AFTER INSERT OR UPDATE OR DELETE ON public.weight_records FOR EACH ROW EXECUTE FUNCTION public.apply_weight_record();

-- Sale marks the animal sold
CREATE OR REPLACE FUNCTION public.apply_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.animals SET status = 'sold', customer_id = COALESCE(NEW.customer_id, customer_id) WHERE id = NEW.animal_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER sales_apply AFTER INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.apply_sale();

-- ===== Realtime =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.animals, public.barns, public.customers, public.weight_records, public.sales, public.feed_records, public.treatments, public.activity_logs, public.barn_movements, public.animal_customer_history, public.profiles, public.user_roles;