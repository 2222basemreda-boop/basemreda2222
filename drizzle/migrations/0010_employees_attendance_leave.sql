CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  phone text,
  job_title text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read employees" ON public.employees FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "hr insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::app_role[]));
CREATE POLICY "hr update employees" ON public.employees FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::app_role[]));
CREATE POLICY "admin delete employees" ON public.employees FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.employee_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  present boolean NOT NULL DEFAULT true,
  recorded_by uuid,
  recorded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_attendance TO authenticated;
GRANT ALL ON public.employee_attendance TO service_role;
ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read attendance" ON public.employee_attendance FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "hr insert attendance" ON public.employee_attendance FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::app_role[]));
CREATE POLICY "hr update attendance" ON public.employee_attendance FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::app_role[]));
CREATE POLICY "hr delete attendance" ON public.employee_attendance FOR DELETE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::app_role[]));
CREATE INDEX employee_attendance_emp_idx ON public.employee_attendance(employee_id);

CREATE TABLE public.leave_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  settlement_date date NOT NULL DEFAULT CURRENT_DATE,
  leave_days integer NOT NULL DEFAULT 0 CHECK (leave_days >= 0),
  cash_days integer NOT NULL DEFAULT 0 CHECK (cash_days >= 0),
  balance_after integer NOT NULL DEFAULT 0,
  notes text,
  recorded_by uuid,
  recorded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (leave_days + cash_days > 0)
);
GRANT SELECT, INSERT ON public.leave_settlements TO authenticated;
GRANT ALL ON public.leave_settlements TO service_role;
ALTER TABLE public.leave_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read leave" ON public.leave_settlements FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "hr insert leave" ON public.leave_settlements FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::app_role[]));
CREATE INDEX leave_settlements_emp_idx ON public.leave_settlements(employee_id);

-- Balance: 4 days per full 30 present days; minus leave and cash days.
CREATE OR REPLACE FUNCTION public.employee_leave_balance(_employee_id uuid)
RETURNS TABLE(worked_days integer, earned_days integer, leave_taken integer, cash_days integer, remaining integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH w AS (SELECT count(*)::int n FROM public.employee_attendance WHERE employee_id = _employee_id AND present),
       s AS (SELECT COALESCE(sum(leave_days),0)::int l, COALESCE(sum(cash_days),0)::int c FROM public.leave_settlements WHERE employee_id = _employee_id)
  SELECT w.n, (w.n / 30) * 4, s.l, s.c, (w.n / 30) * 4 - s.l - s.c FROM w, s
$$;
GRANT EXECUTE ON FUNCTION public.employee_leave_balance(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_leave_settlement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rem int;
BEGIN
  PERFORM 1 FROM public.employees WHERE id = NEW.employee_id FOR UPDATE;
  SELECT remaining INTO v_rem FROM public.employee_leave_balance(NEW.employee_id);
  IF NEW.leave_days + NEW.cash_days > v_rem THEN
    RAISE EXCEPTION 'LEAVE_BALANCE_EXCEEDED: % available', v_rem;
  END IF;
  NEW.balance_after := v_rem - NEW.leave_days - NEW.cash_days;
  IF auth.uid() IS NOT NULL THEN
    NEW.recorded_by := auth.uid();
    NEW.recorded_by_name := (SELECT full_name FROM public.profiles WHERE id = auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_leave_settlement BEFORE INSERT ON public.leave_settlements FOR EACH ROW EXECUTE FUNCTION public.guard_leave_settlement();

-- Removing attendance must not push an employee's balance below zero.
CREATE OR REPLACE FUNCTION public.guard_attendance_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_rem int;
BEGIN
  v_emp := COALESCE(NEW.employee_id, OLD.employee_id);
  SELECT remaining INTO v_rem FROM public.employee_leave_balance(v_emp);
  IF v_rem < 0 THEN RAISE EXCEPTION 'LEAVE_BALANCE_NEGATIVE'; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER guard_attendance_change AFTER UPDATE OR DELETE ON public.employee_attendance FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_change();
CREATE TRIGGER attendance_recorder BEFORE INSERT OR UPDATE ON public.employee_attendance FOR EACH ROW EXECUTE FUNCTION public.set_payment_recorder();

CREATE OR REPLACE FUNCTION public.log_activity()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

CREATE TRIGGER log_employees AFTER INSERT OR UPDATE OR DELETE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_leave_settlements AFTER INSERT ON public.leave_settlements FOR EACH ROW EXECUTE FUNCTION public.log_activity();

ALTER PUBLICATION supabase_realtime ADD TABLE public.employees, public.employee_attendance, public.leave_settlements;