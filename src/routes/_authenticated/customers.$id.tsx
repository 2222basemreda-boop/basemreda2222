import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Pencil, Trash2, Phone, Plus } from "lucide-react";
import { customerQuery } from "@/lib/queries";
import { fmtNum, fmtWeight, fmtMoney, fmtDate } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, EmptyState, AnimalCard, GlassCard, SectionTitle, StatTile, PaymentBadge, StatusBadge } from "@/components/farm/ui";
import { CustomerDialog, AnimalDialog, useDeleteRow } from "@/components/farm/forms";
import { ConfirmDialog } from "@/components/farm/FormDialog";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  head: () => ({
    meta: [
      { title: "بيانات العميل — مزرعة الإمام" },
      { name: "description", content: "ماشية العميل وحجوزاته ومشترياته وإجمالي الوزن." },
      { property: "og:title", content: "بيانات العميل — مزرعة الإمام" },
      { property: "og:description", content: "بطاقة العميل." },
    ],
  }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(customerQuery(id));
  const [dlg, setDlg] = useState<null | "edit" | "add" | "delete">(null);
  const del = useDeleteRow();

  if (isLoading) return <Loading />;
  if (!data) return <EmptyState title="العميل غير موجود" action={<Button asChild variant="outline"><Link to="/customers">العودة</Link></Button>} />;
  const { customer, animals, sales, history } = data;

  const reserved = animals.filter((a) => a.status === "reserved");
  const owned = animals.filter((a) => a.status !== "sold");
  const totalWeight = owned.reduce((s, a) => s + Number(a.current_weight ?? 0), 0);
  const purchasesTotal = sales.reduce((s, x) => s + Number(x.total_price ?? 0), 0);
  const outstanding = sales.reduce((s, x) => s + (x.payment_status === "paid" ? 0 : Number(x.total_price ?? 0) - Number(x.paid_amount ?? 0)), 0);

  return (
    <div>
      <Link to="/customers" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowRight className="size-4" /> كل العملاء</Link>
      <PageHeader
        title={customer.name}
        subtitle={`كود العميل: ${customer.code}`}
        action={
          <div className="flex gap-1">
            {auth.can("customers.write") && <Button variant="ghost" size="icon" onClick={() => setDlg("edit")} aria-label="تعديل"><Pencil /></Button>}
            {auth.can("customers.delete") && <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDlg("delete")} aria-label="حذف"><Trash2 /></Button>}
          </div>
        }
      />
      {customer.phone && (
        <a href={`tel:${customer.phone}`} className="glass tap mb-3 flex items-center gap-3 rounded-2xl px-4 text-sm font-bold text-brand">
          <Phone className="size-5" /> <span className="num" dir="ltr">{customer.phone}</span>
        </a>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="محجوز له" value={fmtNum(reserved.length)} tone="amber" />
        <StatTile label="إجمالي الوزن" value={fmtWeight(totalWeight)} />
        {auth.can("sales.read") && <StatTile label="إجمالي المشتريات" value={fmtMoney(purchasesTotal)} />}
        {auth.can("sales.read") && <StatTile label="متبقي عليه" value={fmtMoney(outstanding)} tone={outstanding > 0 ? "amber" : "muted"} />}
      </div>
      {customer.notes && <GlassCard className="mt-2 text-sm"><span className="font-bold">ملاحظات: </span>{customer.notes}</GlassCard>}

      <SectionTitle action={auth.can("animals.write") ? <Button size="sm" variant="secondary" onClick={() => setDlg("add")}><Plus /> إضافة حيوان لهذا العميل</Button> : undefined}>ماشيته الحالية</SectionTitle>
      {owned.length === 0 ? <EmptyState title="لا توجد ماشية مرتبطة حالياً" /> : <div className="grid gap-2 lg:grid-cols-2">{owned.map((a) => <AnimalCard key={a.id} animal={a} compact />)}</div>}

      {auth.can("sales.read") && (
        <>
          <SectionTitle>المشتريات</SectionTitle>
          {sales.length === 0 ? <EmptyState title="لا توجد مشتريات" /> : (
            <GlassCard className="divide-y divide-border/60 p-0">
              {sales.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="flex-1">
                    <p className="font-bold">حيوان <Link to="/animals/$id" params={{ id: s.animal_id }} className="num text-brand">{s.animal?.tag_number}</Link> · {fmtWeight(s.weight)}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(s.sale_date)} · {fmtMoney(s.price_per_kg)}/كجم</p>
                  </div>
                  <div className="text-left">
                    <p className="num font-bold">{fmtMoney(s.total_price)}</p>
                    <PaymentBadge status={s.payment_status} />
                  </div>
                </div>
              ))}
            </GlassCard>
          )}
        </>
      )}

      <SectionTitle>سجل الارتباط بالماشية</SectionTitle>
      {history.length === 0 ? <EmptyState title="لا يوجد سجل" /> : (
        <GlassCard className="divide-y divide-border/60 p-0">
          {history.map((h) => (
            <div key={h.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="flex-1">
                <p className="font-bold">حيوان <Link to="/animals/$id" params={{ id: h.animal_id }} className="num text-brand">{h.animal?.tag_number}</Link></p>
                <p className="text-xs text-muted-foreground">{fmtDate(h.changed_at)}</p>
              </div>
              <StatusBadge status={h.status} />
            </div>
          ))}
        </GlassCard>
      )}

      <CustomerDialog open={dlg === "edit"} onOpenChange={(o) => !o && setDlg(null)} initial={customer} />
      <AnimalDialog open={dlg === "add"} onOpenChange={(o) => !o && setDlg(null)} defaultCustomerId={customer.id} />
      <ConfirmDialog
        open={dlg === "delete"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`حذف العميل ${customer.name}؟`}
        description="سيتم فك ارتباط ماشيته وسجلاته به. لا يمكن التراجع."
        pending={del.isPending}
        onConfirm={async () => {
          await del.mutateAsync({ table: "customers", id: customer.id });
          navigate({ to: "/customers", replace: true });
        }}
      />
    </div>
  );
}
