CREATE TABLE public.employee_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
GRANT SELECT ON public.employee_periods TO authenticated;
GRANT ALL ON public.employee_periods TO service_role;
ALTER TABLE public.employee_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read periods" ON public.employee_periods FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX employee_periods_emp_idx ON public.employee_periods(employee_id);

ALTER TABLE public.employees ADD COLUMN left_date date;

INSERT INTO public.employee_periods(employee_id, start_date, end_date)
SELECT id, start_date, CASE WHEN is_active THEN NULL ELSE GREATEST(start_date, (updated_at AT TIME ZONE 'Africa/Cairo')::date) END FROM public.employees;
UPDATE public.employees e SET left_date = p.end_date FROM public.employee_periods p WHERE p.employee_id = e.id AND p.end_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.employed_on(_employee_id uuid, _day date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.employee_periods p WHERE p.employee_id = _employee_id AND _day >= p.start_date AND (p.end_date IS NULL OR _day <= p.end_date))
$$;

CREATE OR REPLACE FUNCTION public.employee_first_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.employee_periods(employee_id, start_date, created_by) VALUES (NEW.id, NEW.start_date, auth.uid());
  ELSIF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
    UPDATE public.employee_periods SET start_date = NEW.start_date
    WHERE id = (SELECT id FROM public.employee_periods WHERE employee_id = NEW.id ORDER BY start_date LIMIT 1)
      AND (end_date IS NULL OR end_date >= NEW.start_date);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER employee_first_period AFTER INSERT OR UPDATE OF start_date ON public.employees FOR EACH ROW EXECUTE FUNCTION public.employee_first_period();

CREATE OR REPLACE FUNCTION public.mark_employee_left(_employee_id uuid, _last_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p record;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::app_role[]) THEN RAISE EXCEPTION 'row-level security: not allowed'; END IF;
  SELECT * INTO v_p FROM public.employee_periods WHERE employee_id = _employee_id AND end_date IS NULL ORDER BY start_date DESC LIMIT 1 FOR UPDATE;
  IF v_p IS NULL THEN RAISE EXCEPTION 'EMPLOYEE_ALREADY_LEFT'; END IF;
  IF _last_date < v_p.start_date THEN RAISE EXCEPTION 'LAST_DATE_BEFORE_START'; END IF;
  UPDATE public.employee_periods SET end_date = _last_date WHERE id = v_p.id;
  UPDATE public.employees SET is_active = false, left_date = _last_date WHERE id = _employee_id;
END $$;
GRANT EXECUTE ON FUNCTION public.mark_employee_left(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.reactivate_employee(_employee_id uuid, _start_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_end date;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::app_role[]) THEN RAISE EXCEPTION 'row-level security: not allowed'; END IF;
  IF EXISTS (SELECT 1 FROM public.employee_periods WHERE employee_id = _employee_id AND end_date IS NULL) THEN RAISE EXCEPTION 'EMPLOYEE_ALREADY_ACTIVE'; END IF;
  SELECT max(end_date) INTO v_end FROM public.employee_periods WHERE employee_id = _employee_id;
  IF v_end IS NOT NULL AND _start_date <= v_end THEN RAISE EXCEPTION 'NEW_START_BEFORE_END'; END IF;
  INSERT INTO public.employee_periods(employee_id, start_date, created_by) VALUES (_employee_id, _start_date, auth.uid());
  UPDATE public.employees SET is_active = true, left_date = NULL WHERE id = _employee_id;
END $$;
GRANT EXECUTE ON FUNCTION public.reactivate_employee(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_attendance_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.employed_on(NEW.employee_id, NEW.work_date) THEN RAISE EXCEPTION 'EMPLOYEE_NOT_EMPLOYED_ON_DATE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_attendance_period BEFORE INSERT OR UPDATE ON public.employee_attendance FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_period();

CREATE OR REPLACE FUNCTION public.employee_leave_breakdown(_employee_id uuid)
RETURNS TABLE(start_date date, attendance_start_date date, historical_days integer, attendance_days integer, worked_days integer, earned_days integer, prev_leave integer, prev_cash integer, app_leave integer, app_cash integer, remaining integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (SELECT * FROM public.employees WHERE id = _employee_id),
  h AS (SELECT count(*)::int n FROM e, generate_series(e.start_date, LEAST(e.attendance_start_date, CURRENT_DATE + 1) - 1, interval '1 day') d WHERE public.employed_on(e.id, d::date)),
  a AS (SELECT count(*)::int n FROM public.employee_attendance t, e WHERE t.employee_id = e.id AND t.present AND t.work_date >= GREATEST(e.attendance_start_date, e.start_date) AND public.employed_on(e.id, t.work_date)),
  s AS (SELECT COALESCE(sum(leave_days),0)::int l, COALESCE(sum(cash_days),0)::int c FROM public.leave_settlements WHERE employee_id = _employee_id)
  SELECT e.start_date, e.attendance_start_date, h.n, a.n, h.n + a.n, ((h.n + a.n) / 30) * 4,
         e.prev_leave_days, e.prev_cash_days, s.l, s.c,
         ((h.n + a.n) / 30) * 4 - e.prev_leave_days - e.prev_cash_days - s.l - s.c
  FROM e, h, a, s
$$;

CREATE OR REPLACE FUNCTION public.employee_leave_ledger(_employee_id uuid)
RETURNS TABLE(entry_date date, kind text, leave_days integer, cash_days integer, added integer, prev_balance integer, new_balance integer, recorded_by_name text, notes text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (SELECT * FROM public.employees WHERE id = _employee_id AND public.is_staff(auth.uid())),
  days AS (
    SELECT d::date AS dt FROM e, generate_series(e.start_date, LEAST(e.attendance_start_date, CURRENT_DATE + 1) - 1, interval '1 day') d WHERE public.employed_on(e.id, d::date)
    UNION ALL
    SELECT t.work_date FROM public.employee_attendance t, e WHERE t.employee_id = e.id AND t.present AND t.work_date >= GREATEST(e.attendance_start_date, e.start_date) AND public.employed_on(e.id, t.work_date)
  ),
  num AS (SELECT dt, row_number() OVER (ORDER BY dt) rn FROM days),
  ev AS (
    SELECT dt AS d, 0 AS ord, 'accrual'::text k, 0 l, 0 c, 4 a, NULL::text who, NULL::text nt, NULL::timestamptz ts FROM num WHERE rn % 30 = 0
    UNION ALL
    SELECT e.attendance_start_date, 1, 'previous', e.prev_leave_days, e.prev_cash_days, 0, NULL, NULL, NULL FROM e WHERE e.prev_leave_days + e.prev_cash_days > 0
    UNION ALL
    SELECT s.settlement_date, 2, 'settlement', s.leave_days, s.cash_days, 0, s.recorded_by_name, s.notes, s.created_at FROM public.leave_settlements s, e WHERE s.employee_id = e.id
  ),
  run AS (SELECT *, sum(a - l - c) OVER (ORDER BY d, ord, ts ROWS UNBOUNDED PRECEDING)::int bal FROM ev)
  SELECT d, k, l, c, a, bal - (a - l - c), bal, who, nt FROM run ORDER BY d DESC, ord DESC, ts DESC NULLS LAST
$$;

CREATE TRIGGER log_employee_periods AFTER INSERT OR UPDATE ON public.employee_periods FOR EACH ROW EXECUTE FUNCTION public.log_activity();
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_periods;