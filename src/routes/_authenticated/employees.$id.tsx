import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Pencil, Plane, CalendarCheck } from "lucide-react";
import { employeeQuery, daysToNextLeave } from "@/lib/employees";
import { fmtDate, fmtNum } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, EmptyState, GlassCard, StatTile, SectionTitle } from "@/components/farm/ui";
import { EmployeeDialog, LeaveSettlementDialog } from "@/components/farm/employee-forms";

export const Route = createFileRoute("/_authenticated/employees/$id")({
  head: () => ({
    meta: [
      { title: "ملف الموظف — Elemam Farm" },
      { name: "description", content: "رصيد إجازات الموظف وسجل التسويات والحضور." },
      { property: "og:title", content: "ملف الموظف — Elemam Farm" },
      { property: "og:description", content: "رصيد الإجازات وسجل الحركات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeePage,
});

function EmployeePage() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const { data, isLoading } = useQuery(employeeQuery(id));
  const [edit, setEdit] = useState(false);
  const [settle, setSettle] = useState(false);

  if (isLoading) return <Loading />;
  if (!data) return <EmptyState title="الموظف غير موجود" action={<Button asChild variant="outline"><Link to="/employees">العودة للموظفين</Link></Button>} />;
  const { employee: e, balance: b, attendance, settlements } = data;
  const canWrite = auth.can("employees.write");

  return (
    <div className="space-y-5">
      <Link to="/employees" className="inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowRight className="size-4" /> كل الموظفين</Link>
      <PageHeader
        title={e.name}
        subtitle={[e.job_title, e.phone, `بدأ العمل ${fmtDate(e.start_date)}`].filter(Boolean).join(" · ")}
        action={canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEdit(true)}><Pencil /> تعديل</Button>
            <Button onClick={() => setSettle(true)} disabled={b.remaining <= 0}><Plane /> تسوية إجازة</Button>
          </div>
        )}
      />
      {e.notes && <GlassCard className="text-sm">{e.notes}</GlassCard>}

      <div>
        <SectionTitle>الإجازات</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile label="أيام العمل المكتملة" value={fmtNum(b.worked_days)} hint={`باقي ${daysToNextLeave(b.worked_days)} يوم للإجازة القادمة`} />
          <StatTile label="الإجازات المكتسبة" value={`${fmtNum(b.earned_days)} يوم`} />
          <StatTile label="إجازات مستخدمة" value={`${fmtNum(b.leave_taken)} يوم`} tone="muted" />
          <StatTile label="تعويض نقدي" value={`${fmtNum(b.cash_days)} يوم`} tone="muted" />
          <StatTile label="الرصيد المتبقي" value={`${fmtNum(b.remaining)} يوم`} tone="amber" />
        </div>
      </div>

      <div>
        <SectionTitle>سجل تسويات الإجازات</SectionTitle>
        {settlements.length === 0 ? <EmptyState icon={<Plane />} title="لا توجد تسويات مسجلة" /> : (
          <div className="glass overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
                {["التاريخ", "الموظف", "إجازة فعلية", "تعويض نقدي", "الرصيد بعدها", "سجّلها"].map((h) => <th key={h} className="p-3 text-start font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 last:border-0">
                    <td className="num p-3">{fmtDate(s.settlement_date)}</td>
                    <td className="p-3">{e.name}</td>
                    <td className="num p-3">{fmtNum(s.leave_days)}</td>
                    <td className="num p-3">{fmtNum(s.cash_days)}</td>
                    <td className="num p-3 font-bold">{fmtNum(s.balance_after)}</td>
                    <td className="p-3">{s.recorded_by_name || "—"}{s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <SectionTitle action={<Button asChild size="sm" variant="outline"><Link to="/attendance"><CalendarCheck /> الحضور اليومي</Link></Button>}>آخر أيام الحضور</SectionTitle>
        {attendance.length === 0 ? <EmptyState title="لم يُسجَّل حضور بعد" /> : (
          <div className="flex flex-wrap gap-2">
            {attendance.map((a) => (
              <span key={a.id} className={`num rounded-full px-3 py-1 text-xs font-bold ${a.present ? "bg-available/15 text-available" : "bg-destructive/10 text-destructive"}`}>
                {fmtDate(a.work_date)} · {a.present ? "حاضر" : "غائب"}
              </span>
            ))}
          </div>
        )}
      </div>

      <EmployeeDialog open={edit} onOpenChange={setEdit} initial={e} />
      <LeaveSettlementDialog open={settle} onOpenChange={setSettle} employee={e} remaining={b.remaining} />
    </div>
  );
}
