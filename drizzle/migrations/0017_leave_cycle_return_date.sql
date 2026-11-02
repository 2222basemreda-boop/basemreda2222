-- The 30-day leave cycle now restarts from the return-to-work date after every leave period.
-- Accruals are computed per segment (days between leave periods); each full 30 present days grants 4 days.

CREATE OR REPLACE FUNCTION public.employee_leave_breakdown(_employee_id uuid)
RETURNS TABLE(start_date date, attendance_start_date date, historical_days integer, attendance_days integer, worked_days integer, earned_days integer, prev_leave integer, prev_cash integer, app_leave integer, app_cash integer, remaining integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (SELECT * FROM public.employees WHERE id = _employee_id),
  days AS (
    SELECT d::date AS dt FROM e, generate_series(e.start_date, LEAST(e.attendance_start_date, CURRENT_DATE + 1) - 1, interval '1 day') d WHERE public.employed_on(e.id, d::date)
    UNION ALL
    SELECT t.work_date FROM public.employee_attendance t, e WHERE t.employee_id = e.id AND t.present AND t.work_date >= GREATEST(e.attendance_start_date, e.start_date) AND public.employed_on(e.id, t.work_date)
  ),
  seg AS (
    SELECT dt,
      (SELECT count(*)::int FROM public.employee_attendance l WHERE l.employee_id = _employee_id AND NOT l.present AND l.absence_type = 'leave' AND l.work_date < dt) AS sg
    FROM days
  ),
  h AS (SELECT count(*)::int n FROM e, generate_series(e.start_date, LEAST(e.attendance_start_date, CURRENT_DATE + 1) - 1, interval '1 day') d WHERE public.employed_on(e.id, d::date)),
  a AS (SELECT count(*)::int n FROM public.employee_attendance t, e WHERE t.employee_id = e.id AND t.present AND t.work_date >= GREATEST(e.attendance_start_date, e.start_date) AND public.employed_on(e.id, t.work_date)),
  acc AS (SELECT COALESCE(sum(c.n / 30), 0)::int periods FROM (SELECT count(*)::int n FROM seg GROUP BY sg) c),
  al AS (SELECT count(*)::int n FROM public.employee_attendance t WHERE t.employee_id = _employee_id AND NOT t.present AND t.absence_type = 'leave'),
  s AS (SELECT COALESCE(sum(leave_days),0)::int l, COALESCE(sum(cash_days),0)::int c FROM public.leave_settlements WHERE employee_id = _employee_id)
  SELECT e.start_date, e.attendance_start_date, h.n, a.n, h.n + a.n, acc.periods * 4,
         e.prev_leave_days, e.prev_cash_days, s.l + al.n, s.c,
         acc.periods * 4 - e.prev_leave_days - e.prev_cash_days - s.l - al.n - s.c
  FROM e, h, a, acc, al, s
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
  seg AS (
    SELECT dt,
      (SELECT count(*)::int FROM public.employee_attendance l WHERE l.employee_id = _employee_id AND NOT l.present AND l.absence_type = 'leave' AND l.work_date < dt) AS sg
    FROM days
  ),
  num AS (SELECT dt, row_number() OVER (PARTITION BY sg ORDER BY dt) rn FROM seg),
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

-- Current 30-day segment: starts at the return-to-work date after the last leave period
-- (or the employee start date when no leave has been taken yet), with days worked in it.
CREATE OR REPLACE FUNCTION public.employee_current_segment(_employee_id uuid)
RETURNS TABLE(segment_start date, segment_days integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (SELECT * FROM public.employees WHERE id = _employee_id),
  ll AS (SELECT max(work_date) d FROM public.employee_attendance WHERE employee_id = _employee_id AND NOT present AND absence_type = 'leave'),
  ss AS (SELECT CASE WHEN ll.d IS NULL THEN NULL ELSE (SELECT min(t.work_date) FROM public.employee_attendance t WHERE t.employee_id = _employee_id AND t.present AND t.work_date > ll.d) END s FROM ll),
  h AS (SELECT count(*)::int n FROM e, generate_series(e.start_date, LEAST(e.attendance_start_date, CURRENT_DATE + 1) - 1, interval '1 day') d WHERE public.employed_on(e.id, d::date)),
  a AS (SELECT count(*)::int n FROM public.employee_attendance t, e, ll WHERE t.employee_id = e.id AND t.present AND public.employed_on(e.id, t.work_date) AND t.work_date >= GREATEST(e.attendance_start_date, e.start_date) AND (ll.d IS NULL OR t.work_date > ll.d))
  SELECT COALESCE(ss.s, e.start_date), h.n + a.n FROM e, ll, ss, h, a
$$;
GRANT EXECUTE ON FUNCTION public.employee_current_segment(uuid) TO authenticated;