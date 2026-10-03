CREATE OR REPLACE FUNCTION public.employees_leave_summary()
RETURNS TABLE(employee_id uuid, worked_days integer, earned_days integer, leave_taken integer, cash_days integer, remaining integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, b.worked_days, b.earned_days, b.leave_taken, b.cash_days, b.remaining
  FROM public.employees e CROSS JOIN LATERAL public.employee_leave_balance(e.id) b
  WHERE public.is_staff(auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.employees_leave_summary() TO authenticated;