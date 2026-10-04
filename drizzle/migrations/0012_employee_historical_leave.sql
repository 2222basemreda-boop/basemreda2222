ALTER TABLE public.employees
  ADD COLUMN attendance_start_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN prev_leave_days integer NOT NULL DEFAULT 0 CHECK (prev_leave_days >= 0),
  ADD COLUMN prev_cash_days integer NOT NULL DEFAULT 0 CHECK (prev_cash_days >= 0);
UPDATE public.employees SET attendance_start_date = (created_at AT TIME ZONE 'Africa/Cairo')::date;
COMMENT ON COLUMN public.employees.attendance_start_date IS 'Day the app started tracking attendance; days from start_date until the day before count as historical working days.';

CREATE OR REPLACE FUNCTION public.employee_leave_breakdown(_employee_id uuid)
RETURNS TABLE(start_date date, attendance_start_date date, historical_days integer, attendance_days integer, worked_days integer, earned_days integer, prev_leave integer, prev_cash integer, app_leave integer, app_cash integer, remaining integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (SELECT * FROM public.employees WHERE id = _employee_id),
  h AS (SELECT GREATEST(0, LEAST(e.attendance_start_date, CURRENT_DATE + 1) - e.start_date)::int n FROM e),
  a AS (SELECT count(*)::int n FROM public.employee_attendance t, e WHERE t.employee_id = e.id AND t.present AND t.work_date >= GREATEST(e.attendance_start_date, e.start_date)),
  s AS (SELECT COALESCE(sum(leave_days),0)::int l, COALESCE(sum(cash_days),0)::int c FROM public.leave_settlements WHERE employee_id = _employee_id)
  SELECT e.start_date, e.attendance_start_date, h.n, a.n, h.n + a.n, ((h.n + a.n) / 30) * 4,
         e.prev_leave_days, e.prev_cash_days, s.l, s.c,
         ((h.n + a.n) / 30) * 4 - e.prev_leave_days - e.prev_cash_days - s.l - s.c
  FROM e, h, a, s
$$;
GRANT EXECUTE ON FUNCTION public.employee_leave_breakdown(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.employee_leave_balance(_employee_id uuid)
RETURNS TABLE(worked_days integer, earned_days integer, leave_taken integer, cash_days integer, remaining integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.worked_days, b.earned_days, b.prev_leave + b.app_leave, b.prev_cash + b.app_cash, b.remaining
  FROM public.employee_leave_breakdown(_employee_id) b
$$;

CREATE OR REPLACE FUNCTION public.guard_employee_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rem int;
BEGIN
  SELECT remaining INTO v_rem FROM public.employee_leave_balance(NEW.id);
  IF v_rem < 0 THEN RAISE EXCEPTION 'LEAVE_BALANCE_NEGATIVE'; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER guard_employee_balance AFTER INSERT OR UPDATE OF start_date, attendance_start_date, prev_leave_days, prev_cash_days ON public.employees FOR EACH ROW EXECUTE FUNCTION public.guard_employee_balance();