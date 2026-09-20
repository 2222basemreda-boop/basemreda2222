import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Receipt, Pencil, Trash2 } from "lucide-react";
import { salesQuery, type Sale } from "@/lib/queries";
import { fmtMoney, fmtWeight, fmtDate, fmtNum } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, EmptyState, GlassCard, PaymentBadge, StatTile } from "@/components/farm/ui";
import { SaleDialog, useDeleteRow } from "@/components/farm/forms";
import { ConfirmDialog } from "@/components/farm/FormDialog";

export const Route = createFileRoute("/_authenticated/sales/")({
  head: () => ({
    meta: [
      { title: "المبيعات — مزرعة الإمام" },
      { name: "description", content: "سجل مبيعات الماشية وحالة الدفع في مزرعة الإمام." },
      { property: "og:title", content: "المبيعات — مزرعة الإمام" },
      { property: "og:description", content: "سجل المبيعات." },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  const auth = useAuth();
  const { data, isLoading } = useQuery(salesQuery);
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<Sale | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const del = useDeleteRow();

  if (!auth.can("sales.read")) return <EmptyState title="ليس لديك صلاحية عرض المبيعات" />;

  const total = (data ?? []).reduce((s, x) => s + Number(x.total_price ?? 0), 0);
  const outstanding = (data ?? []).reduce((s, x) => s + (x.payment_status === "paid" ? 0 : Number(x.total_price ?? 0) - Number(x.paid_amount ?? 0)), 0);

  return (
    <div>
      <PageHeader title="المبيعات" subtitle={`${fmtNum(data?.length ?? 0)} عملية بيع`} action={auth.can("sales.write") && <Button onClick={() => setAddOpen(true)}><Plus /> بيع جديد</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-2">
        <StatTile label="إجمالي المبيعات" value={fmtMoney(total)} />
        <StatTile label="مبالغ متبقية" value={fmtMoney(outstanding)} tone={outstanding > 0 ? "amber" : "muted"} />
      </div>
      {isLoading ? <Loading /> : !data?.length ? <EmptyState icon={<Receipt />} title="لا توجد مبيعات بعد" /> : (
        <div className="space-y-2">
          {data.map((s) => (
            <GlassCard key={s.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-bold">
                  حيوان <Link to="/animals/$id" params={{ id: s.animal_id }} className="num text-brand">{s.animal?.tag_number}</Link>
                  {s.customer && <> ← <Link to="/customers/$id" params={{ id: s.customer.id }} className="text-brand">{s.customer.name}</Link></>}
                </p>
                <p className="text-xs text-muted-foreground">{fmtWeight(s.weight)} × {fmtMoney(s.price_per_kg)} · {fmtDate(s.sale_date)}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="num text-lg font-bold text-brand">{fmtMoney(s.total_price)}</span>
                  <PaymentBadge status={s.payment_status} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {auth.can("sales.write") && <Button variant="ghost" size="icon" onClick={() => setEdit(s)} aria-label="تعديل"><Pencil /></Button>}
                {auth.can("sales.delete") && <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDelId(s.id)} aria-label="حذف"><Trash2 /></Button>}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
      <SaleDialog open={addOpen} onOpenChange={setAddOpen} />
      <SaleDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} initial={edit} />
      <ConfirmDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)} title="حذف عملية البيع؟" description="لا يمكن التراجع عن الحذف." pending={del.isPending}
        onConfirm={async () => { if (delId) await del.mutateAsync({ table: "sales", id: delId }); setDelId(null); }} />
    </div>
  );
}
