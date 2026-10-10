import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Pencil, Plane, CalendarCheck, UserX, UserCheck, Banknote } from "lucide-react";
import { employeeQuery, daysToNextLeave } from "@/lib/employees";
import { fmtDate, fmtNum } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, EmptyState, GlassCard, StatTile, SectionTitle } from "@/components/farm/ui";
import { EmployeeDialog, LeaveSettlementDialog, EmployeeStatusDialog, CashLeaveDialog } from "@/components/farm/employee-forms";

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

function nextAccrual(daysLeft: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysLeft - 1);
  return d.toISOString().slice(0, 10);
}

function EmployeePage() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const { data, isLoading } = useQuery(employeeQuery(id));
  const [edit, setEdit] = useState(false);
  const [settle, setSettle] = useState(false);
  const [status, setStatus] = useState(false);
  const [cash, setCash] = useState(false);

  if (isLoading) return <Loading />;
  if (!data) return <EmptyState title="الموظف غير موجود" action={<Button asChild variant="outline"><Link to="/employees">العودة للموظفين</Link></Button>} />;
  const { employee: e, balance: b, attendance, ledger, periods, leavePeriods } = data;
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
            <Button onClick={() => setSettle(true)}><Plane /> تسوية إجازة</Button>
            <Button variant="outline" onClick={() => setCash(true)}><Banknote /> صرف نقدي بدل إجازة</Button>
            {e.is_active
              ? <Button variant="outline" onClick={() => setStatus(true)}><UserX /> إنهاء الخدمة</Button>
              : <Button variant="outline" onClick={() => setStatus(true)}><UserCheck /> إعادة تفعيل</Button>}
          </div>
        )}
      />
      <GlassCard className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${e.is_active ? "bg-available/15 text-available" : "bg-muted text-muted-foreground"}`}>{e.is_active ? "على رأس العمل" : "منتهي الخدمة"}</span>
        {!e.is_active && e.left_date && <span>آخر يوم عمل: <b className="num">{fmtDate(e.left_date)}</b></span>}
        {periods.length > 0 && <span className="text-muted-foreground">فترات العمل: {periods.map((p) => `${fmtDate(p.start_date)} ← ${p.end_date ? fmtDate(p.end_date) : "حتى الآن"}`).join(" · ")}</span>}
      </GlassCard>
      {e.notes && <GlassCard className="text-sm">{e.notes}</GlassCard>}

      <div>
        <SectionTitle>الإجازات</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="تاريخ بدء العمل" value={fmtDate(b.start_date)} hint={`الحضور اليومي منذ ${fmtDate(b.attendance_start_date)}`} />
          <StatTile label="أيام عمل سابقة (تاريخية)" value={fmtNum(b.historical_days)} tone="muted" />
          <StatTile label="أيام حضور في التطبيق" value={fmtNum(b.attendance_days)} tone="muted" />
          <StatTile label="إجمالي أيام العمل المكتملة" value={fmtNum(b.worked_days)} hint={`باقي ${daysToNextLeave(b.worked_days)} يوم للإجازة القادمة`} />
          <StatTile label="الإجازات المكتسبة" value={`${fmtNum(b.earned_days)} يوم`} />
          <StatTile label="إجازات سابقة" value={`${fmtNum(b.prev_leave)} يوم`} tone="muted" />
          <StatTile label="تعويض نقدي سابق" value={`${fmtNum(b.prev_cash)} يوم`} tone="muted" />
          <StatTile label="إجازات عبر التطبيق" value={`${fmtNum(b.app_leave)} يوم`} tone="muted" />
          <StatTile label="تعويض نقدي عبر التطبيق" value={`${fmtNum(b.app_cash)} يوم`} tone="muted" />
          <StatTile label="الإجازات المأخوذة (إجمالي)" value={`${fmtNum(b.prev_leave + b.prev_cash + b.app_leave + b.app_cash)} يوم`} tone="muted" />
          <StatTile label="إجازة مقدّمة (سالب)" value={`${fmtNum(Math.max(0, -b.remaining))} يوم`} tone="muted" />
          <StatTile label="الاستحقاق القادم (+4)" value={e.is_active ? fmtDate(nextAccrual(daysToNextLeave(b.worked_days))) : "متوقف"} hint={`بعد ${daysToNextLeave(b.worked_days)} يوم عمل (تقديري)`} />
          <StatTile label="آخر خروج / عودة" value={leavePeriods[0] ? fmtDate(leavePeriods[0].departure_date) : "—"} hint={leavePeriods[0] ? (leavePeriods[0].return_date ? `عاد ${fmtDate(leavePeriods[0].return_date)}` : "لم يعد بعد") : undefined} />
          <StatTile label="الرصيد الحالي" value={<span dir="ltr">{fmtNum(b.remaining)} يوم</span>} tone="amber" />
        </div>
      </div>

      <div>
        <SectionTitle>فترات الغياب والإجازات</SectionTitle>
        {leavePeriods.length === 0 ? <EmptyState title="لا توجد فترات غياب" /> : (
          <div className="glass mb-5 overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
                {["تاريخ الخروج", "آخر يوم غياب", "تاريخ العودة", "المدة", "إجازة معتمدة", "بدون أجر", "أخرى"].map((h) => <th key={h} className="p-3 text-start font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {leavePeriods.map((p) => (
                  <tr key={p.departure_date} className="border-b border-border/50 last:border-0">
                    <td className="num p-3">{fmtDate(p.departure_date)}</td>
                    <td className="num p-3">{fmtDate(p.last_absent_date)}</td>
                    <td className="num p-3">{p.return_date ? fmtDate(p.return_date) : "لم يعد بعد"}</td>
                    <td className="num p-3 font-bold">{fmtNum(p.absent_days)} يوم</td>
                    <td className="num p-3">{fmtNum(p.leave_days)}</td>
                    <td className="num p-3">{fmtNum(p.unpaid_days)}</td>
                    <td className="num p-3">{fmtNum(p.other_days)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <SectionTitle>سجل حركات الإجازات</SectionTitle>
        {ledger.length === 0 ? <EmptyState icon={<Plane />} title="لا توجد حركات بعد" /> : (
          <div className="glass overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
                {["التاريخ", "الموظف", "الحركة", "إجازة فعلية", "تعويض نقدي", "المضاف", "الرصيد السابق", "الرصيد الجديد", "سجّلها"].map((h) => <th key={h} className="p-3 text-start font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {ledger.map((s, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="num p-3">{fmtDate(s.entry_date)}</td>
                    <td className="p-3">{e.name}</td>
                    <td className="p-3 font-bold">{({ accrual: "استحقاق 30 يوم", previous: "إجازات سابقة", leave_period: "فترة إجازة (حضور)", cash: "صرف نقدي", settlement: "تسوية إجازة" } as Record<string, string>)[s.kind] ?? s.kind}</td>
                    <td className="num p-3">{fmtNum(s.leave_days)}</td>
                    <td className="num p-3">{fmtNum(s.cash_days)}</td>
                    <td className="num p-3">{s.added ? `+${s.added}` : "—"}</td>
                    <td className="num p-3" dir="ltr">{fmtNum(s.prev_balance)}</td>
                    <td className="num p-3 font-bold" dir="ltr">{fmtNum(s.new_balance)}</td>
                    <td className="p-3">{s.kind === "accrual" || s.kind === "leave_period" ? "تلقائي" : s.recorded_by_name || "—"}{s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}</td>
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
              <span key={a.id} className={`num rounded-full px-3 py-1 text-xs font-bold ${a.present ? "bg-available/15 text-available" : a.absence_type === "leave" ? "bg-amber/20" : "bg-destructive/10 text-destructive"}`}>
                {fmtDate(a.work_date)} · {a.present ? "حاضر" : a.absence_type === "leave" ? "إجازة" : a.absence_type === "other" ? "غياب (أخرى)" : "غياب"}
              </span>
            ))}
          </div>
        )}
      </div>

      <EmployeeDialog open={edit} onOpenChange={setEdit} initial={e} />
      <EmployeeStatusDialog open={status} onOpenChange={setStatus} employee={e} mode={e.is_active ? "leave" : "reactivate"} />
      <CashLeaveDialog open={cash} onOpenChange={setCash} employee={e} remaining={b.remaining} />
      <LeaveSettlementDialog open={settle} onOpenChange={setSettle} employee={e} remaining={b.remaining} />
    </div>
  );
}
