CREATE OR REPLACE FUNCTION public.guard_leave_settlement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rem int;
BEGIN
  PERFORM 1 FROM public.employees WHERE id = NEW.employee_id FOR UPDATE;
  SELECT remaining INTO v_rem FROM public.employee_leave_balance(NEW.employee_id);
  NEW.balance_after := v_rem - NEW.leave_days - NEW.cash_days;
  IF auth.uid() IS NOT NULL THEN
    NEW.recorded_by := auth.uid();
    NEW.recorded_by_name := (SELECT full_name FROM public.profiles WHERE id = auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_attendance_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN NULL; END $$;

CREATE OR REPLACE FUNCTION public.guard_employee_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN NULL; END $$;

CREATE OR REPLACE FUNCTION public.employee_leave_ledger(_employee_id uuid)
RETURNS TABLE(entry_date date, kind text, leave_days integer, cash_days integer, added integer, prev_balance integer, new_balance integer, recorded_by_name text, notes text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (SELECT * FROM public.employees WHERE id = _employee_id AND public.is_staff(auth.uid())),
  days AS (
    SELECT d::date AS dt FROM e, generate_series(e.start_date, LEAST(e.attendance_start_date, CURRENT_DATE + 1) - 1, interval '1 day') d
    UNION ALL
    SELECT t.work_date FROM public.employee_attendance t, e WHERE t.employee_id = e.id AND t.present AND t.work_date >= GREATEST(e.attendance_start_date, e.start_date)
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
GRANT EXECUTE ON FUNCTION public.employee_leave_ledger(uuid) TO authenticated;