import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { employeesQuery, attendanceOnQuery } from "@/lib/employees";
import { today, fmtNum } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { PageHeader, Loading, EmptyState, GlassCard } from "@/components/farm/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "الحضور اليومي — Elemam Farm" },
      { name: "description", content: "تسجيل حضور وغياب موظفي المزرعة يومياً لحساب الإجازات." },
      { property: "og:title", content: "الحضور اليومي — Elemam Farm" },
      { property: "og:description", content: "حضور الموظفين اليومي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const [day, setDay] = useState(today());
  const { data: emps, isLoading } = useQuery(employeesQuery);
  const { data: marks } = useQuery(attendanceOnQuery(day));
  const canWrite = auth.can("employees.write");
  const active = (emps ?? []).filter((e) => e.is_active);

  const mark = useMutation({
    mutationFn: async ({ employeeId, present }: { employeeId: string; present: boolean | null }) => {
      const existing = marks?.find((m) => m.employee_id === employeeId);
      if (present === null) {
        if (existing) { const { error } = await supabase.from("employee_attendance").delete().eq("id", existing.id); if (error) throw new Error(error.message); }
        return;
      }
      const { error } = await supabase.from("employee_attendance").upsert({ employee_id: employeeId, work_date: day, present }, { onConflict: "employee_id,work_date" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: (e) => toast.error(e instanceof Error && e.message.includes("LEAVE_BALANCE_NEGATIVE") ? "لا يمكن إلغاء هذا اليوم لأنه سيجعل رصيد الإجازات بالسالب" : "تعذر حفظ الحضور"),
  });

  const presentCount = marks?.filter((m) => m.present).length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader title="الحضور اليومي" subtitle="أيام الحضور فقط تُحسب ضمن أيام العمل للإجازات" />
      <div className="flex flex-wrap items-center gap-3">
        <Input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value || today())} className="num w-48" />
        <span className="text-sm text-muted-foreground">حاضر: <span className="num font-bold text-foreground">{fmtNum(presentCount)}</span> من <span className="num font-bold text-foreground">{fmtNum(active.length)}</span></span>
      </div>
      {isLoading ? <Loading /> : active.length === 0 ? (
        <EmptyState icon={<CalendarCheck />} title="لا يوجد موظفون نشطون" action={<Link to="/employees" className="font-bold text-brand">إضافة موظفين</Link>} />
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {active.map((e) => {
            const m = marks?.find((x) => x.employee_id === e.id);
            const state = m ? (m.present ? "present" : "absent") : "none";
            return (
              <GlassCard key={e.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Link to="/employees/$id" params={{ id: e.id }} className="font-bold">{e.name}</Link>
                  <p className="text-xs text-muted-foreground">رصيد الإجازات: <span className="num">{fmtNum(e.balance.remaining)}</span> يوم</p>
                </div>
                <button disabled={!canWrite || mark.isPending} onClick={() => mark.mutate({ employeeId: e.id, present: state === "present" ? null : true })}
                  className={cn("tap flex items-center gap-1 rounded-2xl px-4 text-sm font-bold", state === "present" ? "bg-brand text-primary-foreground" : "glass")}>
                  <Check className="size-4" /> حاضر
                </button>
                <button disabled={!canWrite || mark.isPending} onClick={() => mark.mutate({ employeeId: e.id, present: state === "absent" ? null : false })}
                  className={cn("tap flex items-center gap-1 rounded-2xl px-4 text-sm font-bold", state === "absent" ? "bg-destructive text-destructive-foreground" : "glass")}>
                  <X className="size-4" /> غائب
                </button>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
