import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Employee = Tables<"employees">;
export type Attendance = Tables<"employee_attendance">;
export type LeaveSettlement = Tables<"leave_settlements">;
export type LeaveBalance = { worked_days: number; earned_days: number; leave_taken: number; cash_days: number; remaining: number };

/** Policy: 4 paid leave days per full 30 present days, accumulating. */
export const LEAVE_DAYS_PER_PERIOD = 4;
export const WORK_DAYS_PER_PERIOD = 30;

const ZERO: LeaveBalance = { worked_days: 0, earned_days: 0, leave_taken: 0, cash_days: 0, remaining: 0 };

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export const employeesQuery = queryOptions({
  queryKey: ["employees"],
  queryFn: async () => {
    const [emps, sums] = await Promise.all([
      supabase.from("employees").select("*").order("name"),
      supabase.rpc("employees_leave_summary"),
    ]);
    const list = must(emps);
    const s = must(sums) ?? [];
    return list.map((e) => {
      const b = s.find((x) => x.employee_id === e.id);
      return { ...e, balance: b ? { worked_days: b.worked_days, earned_days: b.earned_days, leave_taken: b.leave_taken, cash_days: b.cash_days, remaining: b.remaining } : ZERO };
    });
  },
});

export const employeeQuery = (id: string) =>
  queryOptions({
    queryKey: ["employees", id],
    queryFn: async () => {
      const [emp, bal, att, set] = await Promise.all([
        supabase.from("employees").select("*").eq("id", id).maybeSingle(),
        supabase.rpc("employee_leave_balance", { _employee_id: id }),
        supabase.from("employee_attendance").select("*").eq("employee_id", id).order("work_date", { ascending: false }).limit(60),
        supabase.from("leave_settlements").select("*").eq("employee_id", id).order("settlement_date", { ascending: false }).order("created_at", { ascending: false }),
      ]);
      const e = must(emp);
      if (!e) return null;
      const b = (must(bal) ?? [])[0] ?? ZERO;
      return { employee: e, balance: b as LeaveBalance, attendance: must(att), settlements: must(set) };
    },
  });

export const attendanceOnQuery = (day: string) =>
  queryOptions({
    queryKey: ["employee_attendance", day],
    queryFn: async () => must(await supabase.from("employee_attendance").select("*").eq("work_date", day)),
  });

/** Days left until the next 4-day leave is earned. */
export function daysToNextLeave(worked: number) {
  return WORK_DAYS_PER_PERIOD - (worked % WORK_DAYS_PER_PERIOD);
}
