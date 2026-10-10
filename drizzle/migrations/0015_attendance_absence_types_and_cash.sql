ALTER TABLE public.employee_attendance ADD COLUMN absence_type text CHECK (absence_type IN ('leave','unpaid','other'));
UPDATE public.employee_attendance SET absence_type = 'unpaid' WHERE NOT present;
ALTER TABLE public.leave_settlements ADD COLUMN cash_amount numeric CHECK (cash_amount IS NULL OR cash_amount >= 0);
ALTER TABLE public.employees ADD COLUMN daily_wage numeric CHECK (daily_wage IS NULL OR daily_wage >= 0);

CREATE OR REPLACE FUNCTION public.normalize_absence_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.present THEN NEW.absence_type := NULL;
  ELSIF NEW.absence_type IS NULL THEN NEW.absence_type := 'unpaid'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER normalize_absence_type BEFORE INSERT OR UPDATE ON public.employee_attendance FOR EACH ROW EXECUTE FUNCTION public.normalize_absence_type();

CREATE OR REPLACE FUNCTION public.employee_leave_periods(_employee_id uuid)
RETURNS TABLE(departure_date date, last_absent_date date, return_date date, absent_days integer, leave_days integer, unpaid_days integer, other_days integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH a AS (
    SELECT work_date, present, absence_type,
      sum(CASE WHEN present THEN 1 ELSE 0 END) OVER (ORDER BY work_date) g
    FROM public.employee_attendance WHERE employee_id = _employee_id AND public.is_staff(auth.uid())
  ),
  p AS (
    SELECT g, min(work_date) d0, max(work_date) d1, count(*)::int n,
      count(*) FILTER (WHERE absence_type = 'leave')::int l,
      count(*) FILTER (WHERE absence_type = 'unpaid')::int u,
      count(*) FILTER (WHERE absence_type = 'other')::int o
    FROM a WHERE NOT present GROUP BY g
  )
  SELECT p.d0, p.d1, (SELECT min(work_date) FROM public.employee_attendance t WHERE t.employee_id = _employee_id AND t.present AND t.work_date > p.d1), p.n, p.l, p.u, p.o
  FROM p ORDER BY p.d0 DESC
$$;
GRANT EXECUTE ON FUNCTION public.employee_leave_periods(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.employee_leave_breakdown(_employee_id uuid)
RETURNS TABLE(start_date date, attendance_start_date date, historical_days integer, attendance_days integer, worked_days integer, earned_days integer, prev_leave integer, prev_cash integer, app_leave integer, app_cash integer, remaining integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (SELECT * FROM public.employees WHERE id = _employee_id),
  h AS (SELECT count(*)::int n FROM e, generate_series(e.start_date, LEAST(e.attendance_start_date, CURRENT_DATE + 1) - 1, interval '1 day') d WHERE public.employed_on(e.id, d::date)),
  a AS (SELECT count(*)::int n FROM public.employee_attendance t, e WHERE t.employee_id = e.id AND t.present AND t.work_date >= GREATEST(e.attendance_start_date, e.start_date) AND public.employed_on(e.id, t.work_date)),
  al AS (SELECT count(*)::int n FROM public.employee_attendance t WHERE t.employee_id = _employee_id AND NOT t.present AND t.absence_type = 'leave'),
  s AS (SELECT COALESCE(sum(leave_days),0)::int l, COALESCE(sum(cash_days),0)::int c FROM public.leave_settlements WHERE employee_id = _employee_id)
  SELECT e.start_date, e.attendance_start_date, h.n, a.n, h.n + a.n, ((h.n + a.n) / 30) * 4,
         e.prev_leave_days, e.prev_cash_days, s.l + al.n, s.c,
         ((h.n + a.n) / 30) * 4 - e.prev_leave_days - e.prev_cash_days - s.l - al.n - s.c
  FROM e, h, a, al, s
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
    SELECT p.departure_date, 2, 'leave_period', p.leave_days, 0, 0, NULL,
      'من ' || p.departure_date || COALESCE(' — عودة ' || p.return_date, ' — لم يعد بعد'), NULL
    FROM e, public.employee_leave_periods(e.id) p WHERE p.leave_days > 0
    UNION ALL
    SELECT s.settlement_date, 3, CASE WHEN s.leave_days = 0 THEN 'cash' ELSE 'settlement' END, s.leave_days, s.cash_days, 0, s.recorded_by_name,
      concat_ws(' · ', CASE WHEN s.cash_amount IS NOT NULL THEN 'المبلغ: ' || s.cash_amount || ' ج.م' END, s.notes), s.created_at
    FROM public.leave_settlements s, e WHERE s.employee_id = e.id
  ),
  run AS (SELECT *, sum(a - l - c) OVER (ORDER BY d, ord, ts ROWS UNBOUNDED PRECEDING)::int bal FROM ev)
  SELECT d, k, l, c, a, bal - (a - l - c), bal, who, nt FROM run ORDER BY d DESC, ord DESC, ts DESC NULLS LAST
$$;