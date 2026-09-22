import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Plus, Receipt, Pencil, Trash2, FileText } from "lucide-react";
import { salesQuery, type Sale } from "@/lib/queries";
import { fmtMoney, fmtWeight, fmtDate, fmtNum, invoiceTotal } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, EmptyState, GlassCard, PaymentBadge, StatTile } from "@/components/farm/ui";
import { SaleDialog, useDeleteRow } from "@/components/farm/forms";
import { ConfirmDialog } from "@/components/farm/FormDialog";
import { InvoiceDialog, invoiceFromSale, type InvoiceData } from "@/components/farm/Invoice";

export const Route = createFileRoute("/_authenticated/sales/")({
  head: () => ({
    meta: [
      { title: "المبيعات — Elemam Farm" },
      { name: "description", content: "سجل مبيعات الماشية وحالة الدفع والفواتير في Elemam Farm." },
      { property: "og:title", content: "المبيعات — Elemam Farm" },
      { property: "og:description", content: "سجل المبيعات والفواتير." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  const auth = useAuth();
  const { data, isLoading } = useQuery(salesQuery);
  const [edit, setEdit] = useState<Sale | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const del = useDeleteRow();

  if (!auth.can("sales.read")) return <EmptyState title="ليس لديك صلاحية عرض المبيعات" />;

  const total = (data ?? []).reduce((s, x) => s + invoiceTotal(x.total_price, x.worker_tip, x.transportation, x.slaughtering), 0);
  const outstanding = (data ?? []).reduce((s, x) => {
    const finalTotal = invoiceTotal(x.total_price, x.worker_tip, x.transportation, x.slaughtering);
    return s + (x.payment_status === "paid" ? 0 : finalTotal - Number(x.paid_amount ?? 0));
  }, 0);

  return (
    <div>
      <PageHeader
        title="المبيعات"
        subtitle={`${fmtNum(data?.length ?? 0)} عملية بيع`}
        action={auth.can("sales.write") && <Button asChild><Link to="/sales/new"><Plus /> بيع / حجز</Link></Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-2">
        <StatTile label="إجمالي المبيعات" value={fmtMoney(total)} />
        <StatTile label="مبالغ متبقية" value={fmtMoney(outstanding)} tone={outstanding > 0 ? "amber" : "muted"} />
      </div>
      {isLoading ? <Loading /> : !data?.length ? (
        <EmptyState
          icon={<Receipt />}
          title="لا توجد مبيعات بعد"
          action={auth.can("sales.write") ? <Button asChild><Link to="/sales/new"><CalendarCheck /> بيع / حجز</Link></Button> : undefined}
        />
      ) : (
        <div className="space-y-2">
          {data.map((s) => {
            const finalTotal = invoiceTotal(s.total_price, s.worker_tip, s.transportation, s.slaughtering);
            return (
            <GlassCard key={s.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-bold">
                  حيوان <Link to="/animals/$id" params={{ id: s.animal_id }} className="num text-brand">{s.animal?.tag_number}</Link>
                  {s.customer && <> ← <Link to="/customers/$id" params={{ id: s.customer.id }} className="text-brand">{s.customer.name}</Link></>}
                </p>
                <p className="num text-xs text-muted-foreground">{s.invoice_number ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{fmtWeight(s.weight)} × {fmtMoney(s.price_per_kg)} · {fmtDate(s.sale_date)}{s.payment_method ? ` · ${s.payment_method}` : ""}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="num text-lg font-bold text-brand">{fmtMoney(finalTotal)}</span>
                  <PaymentBadge status={s.payment_status} />
                </div>
                <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => setInvoice(invoiceFromSale(s))}>
                  <FileText /> عرض الفاتورة
                </Button>
              </div>
              <div className="flex flex-col gap-1">
                {auth.can("sales.write") && <Button variant="ghost" size="icon" onClick={() => setEdit(s)} aria-label="تعديل"><Pencil /></Button>}
                {auth.can("sales.delete") && <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDelId(s.id)} aria-label="حذف"><Trash2 /></Button>}
              </div>
            </GlassCard>
          );
          })}
        </div>
      )}
      <SaleDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} initial={edit} />
      <InvoiceDialog open={!!invoice} onOpenChange={(o) => !o && setInvoice(null)} data={invoice} />
      <ConfirmDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)} title="حذف عملية البيع؟" description="لا يمكن التراجع عن الحذف." pending={del.isPending}
        onConfirm={async () => { if (delId) await del.mutateAsync({ table: "sales", id: delId }); setDelId(null); }} />
    </div>
  );
}
