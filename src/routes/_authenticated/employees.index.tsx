import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Briefcase, CalendarCheck } from "lucide-react";
import { employeesQuery } from "@/lib/employees";
import { fmtNum } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Loading, EmptyState, StatTile } from "@/components/farm/ui";
import { EmployeeDialog } from "@/components/farm/employee-forms";

export const Route = createFileRoute("/_authenticated/employees/")({
  head: () => ({
    meta: [
      { title: "الموظفين والإجازات — Elemam Farm" },
      { name: "description", content: "أيام العمل ورصيد الإجازات المكتسبة والمستخدمة لكل موظف." },
      { property: "og:title", content: "الموظفين والإجازات — Elemam Farm" },
      { property: "og:description", content: "رصيد إجازات موظفي المزرعة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const auth = useAuth();
  const { data, isLoading } = useQuery(employeesQuery);
  const [q, setQ] = useState("");
  const [add, setAdd] = useState(false);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((e) => !t || e.name.toLowerCase().includes(t) || (e.phone ?? "").includes(t));
  }, [data, q]);
  const totalRemaining = (data ?? []).reduce((s, e) => s + e.balance.remaining, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="الموظفين والإجازات"
        subtitle="4 أيام إجازة مدفوعة عن كل 30 يوم عمل مكتمل، والرصيد يتراكم"
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/attendance"><CalendarCheck /> الحضور اليومي</Link></Button>
            {auth.can("employees.write") && <Button onClick={() => setAdd(true)}><Plus /> موظف جديد</Button>}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="عدد الموظفين" value={fmtNum(data?.filter((e) => e.is_active).length ?? 0)} />
        <StatTile label="إجمالي أرصدة الإجازات" value={`${fmtNum(totalRemaining)} يوم`} tone="amber" />
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم الموظف أو الهاتف…" className="pr-12" />
      </div>
      {isLoading ? <Loading /> : list.length === 0 ? (
        <EmptyState icon={<Briefcase />} title={data?.length ? "لا توجد نتائج" : "لا يوجد موظفون بعد"} hint={data?.length ? undefined : "أضف الموظفين ثم سجّل حضورهم يومياً."}
          action={!data?.length && auth.can("employees.write") ? <Button onClick={() => setAdd(true)}><Plus /> إضافة موظف</Button> : undefined} />
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
              {["الموظف", "أيام العمل", "الإجازات المكتسبة", "إجازات مستخدمة", "تعويض نقدي", "الرصيد المتبقي"].map((h) => <th key={h} className="p-3 text-start font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="border-b border-border/50 last:border-0">
                  <td className="p-3">
                    <Link to="/employees/$id" params={{ id: e.id }} className="font-bold text-brand underline-offset-2 hover:underline">{e.name}</Link>
                    <p className="text-xs text-muted-foreground">{e.job_title ?? ""}{!e.is_active && " · غير نشط"}</p>
                  </td>
                  <td className="num p-3">{fmtNum(e.balance.worked_days)}</td>
                  <td className="num p-3">{fmtNum(e.balance.earned_days)}</td>
                  <td className="num p-3">{fmtNum(e.balance.leave_taken)}</td>
                  <td className="num p-3">{fmtNum(e.balance.cash_days)}</td>
                  <td className="num p-3 text-base font-bold text-brand">{fmtNum(e.balance.remaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <EmployeeDialog open={add} onOpenChange={setAdd} />
    </div>
  );
}
