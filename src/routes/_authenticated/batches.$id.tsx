import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Scale, ShoppingCart, FileText, Ban } from "lucide-react";
import { batchQuery, batchRemaining } from "@/lib/queries";
import { fmtDate, fmtMoney, fmtNum, fmtWeight } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, EmptyState, GlassCard, StatTile, SectionTitle } from "@/components/farm/ui";
import { BatchWeighingDialog } from "@/components/farm/forms";

export const Route = createFileRoute("/_authenticated/batches/$id")({
  head: () => ({
    meta: [
      { title: "ملف الدفعة — Elemam Farm" },
      { name: "description", content: "تفاصيل دفعة العجول الحرة: المخزون، الأوزان، البيع والتكاليف." },
      { property: "og:title", content: "ملف الدفعة — Elemam Farm" },
      { property: "og:description", content: "تفاصيل دفعة العجول الحرة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BatchPage,
});

function BatchPage() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const { data, isLoading } = useQuery(batchQuery(id));
  const [weigh, setWeigh] = useState(false);

  if (isLoading) return <Loading />;
  if (!data) return <EmptyState title="الدفعة غير موجودة" action={<Button asChild variant="outline"><Link to="/batches">العودة للدفعات</Link></Button>} />;
  const { batch: b, weighings, sales } = data;
  const rem = batchRemaining(b);
  const shrink = b.purchase_weight != null ? Number(b.purchase_weight) - Number(b.receive_weight) : null;
  const shrinkPerCalf = shrink != null && b.quantity ? shrink / b.quantity : null;
  const depleted = b.remaining_quantity <= 0 || b.remaining_weight <= 0;

  // Weight gain between weighings, accounting for sales in between (sold weight is not loss).
  const asc = [...weighings].reverse();
  const rows = asc.map((w, i) => {
    const prev = i === 0 ? null : asc[i - 1];
    const startDate = prev ? prev.weighing_date : b.entry_date;
    const startWeight = prev ? Number(prev.total_weight) : Number(b.receive_weight);
    const sold = sales
      .filter((s) => !s.cancelled_at && s.sale_date > startDate && s.sale_date < w.weighing_date)
      .reduce((sum, s) => sum + Number(s.weight), 0);
    const expected = startWeight - sold;
    return { w, expected, diff: Number(w.total_weight) - expected, sold };
  });

  return (
    <div className="space-y-5">
      <Link to="/batches" className="inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowRight className="size-4" /> كل الدفعات</Link>
      <PageHeader
        title={b.supplier_name || "دفعة عجول حرة"}
        subtitle={[b.barn?.name, `استُلمت ${fmtDate(b.entry_date)}`, b.supplier?.name].filter(Boolean).join(" · ")}
        action={
          <div className="flex flex-wrap gap-2">
            {auth.can("animals.write") && <Button variant="outline" onClick={() => setWeigh(true)}><Scale /> تسجيل وزن للدفعة</Button>}
            {!depleted && auth.can("sales.write") && <Button asChild><Link to="/sales/new" search={{ batch: b.id }}><ShoppingCart /> بيع من الدفعة</Link></Button>}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="العجول المتبقية" value={`${fmtNum(b.remaining_quantity)} رأس`} hint={`من ${fmtNum(b.quantity)} رأس`} tone={depleted ? "muted" : undefined} />
        <StatTile label="الوزن المتبقي" value={fmtWeight(b.remaining_weight)} hint={`من ${fmtWeight(b.receive_weight)}`} tone={depleted ? "muted" : undefined} />
        <StatTile label="إجمالي الخسية" value={shrink != null ? fmtWeight(shrink) : "—"} hint={shrinkPerCalf != null ? `خسية العجل الواحد ${shrinkPerCalf.toFixed(2)} كجم` : undefined} />
        <StatTile label="سعر الشراء" value={fmtMoney(b.purchase_price_per_kg)} hint="ج.م / كجم" />
        <StatTile label="وزن الشراء" value={fmtWeight(b.purchase_weight)} tone="muted" />
        <StatTile label="تكلفة الدفعة" value={fmtMoney(b.total_cost)} tone="muted" hint="سعر الشراء × وزن الاستلام + المصروفات" />
        <StatTile label="المصروفات" value={fmtMoney(b.expenses)} tone="muted" />
        <StatTile label="المدفوع للمورد" value={fmtMoney(rem.paid)} tone="muted" />
        <StatTile label="المتبقي للمورد" value={fmtMoney(rem.remaining)} tone="amber" />
        <StatTile label="الحالة" value={depleted ? "نفدت الدفعة" : "متاحة للبيع"} tone={depleted ? "muted" : "amber"} />
      </div>

      {b.notes && <GlassCard className="text-sm">{b.notes}</GlassCard>}

      <div>
        <SectionTitle>سجل أوزان الدفعة</SectionTitle>
        {rows.length === 0 ? (
          <EmptyState icon={<Scale />} title="لا توجد أوزان مسجلة بعد" hint="سجّل وزناً إجمالياً للعجول المتبقية متى ما وزنتها." />
        ) : (
          <div className="glass overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
                {["التاريخ", "عدد العجول", "الوزن المسجل", "الوزن المتوقع بعد البيع", "الفرق (زيادة/نقصان)", "الوزن المباع بين الوزنين", "ملاحظات"].map((h) => <th key={h} className="p-3 text-start font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map(({ w, expected, diff, sold }) => (
                  <tr key={w.id} className="border-b border-border/50 last:border-0">
                    <td className="num p-3">{fmtDate(w.weighing_date)}</td>
                    <td className="num p-3">{w.calf_count != null ? fmtNum(w.calf_count) : "—"}</td>
                    <td className="num p-3 font-bold">{fmtWeight(w.total_weight)}</td>
                    <td className="num p-3">{fmtWeight(expected)}</td>
                    <td className={`num p-3 font-bold ${diff > 0 ? "text-available" : diff < 0 ? "text-destructive" : ""}`} dir="ltr">{diff > 0 ? "+" : ""}{diff.toFixed(1)} كجم</td>
                    <td className="num p-3">{fmtWeight(sold)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{w.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">«الوزن المتوقع بعد البيع» يطرح ما بِع بين الوزنين من الدفعة، فلا تُحسب العجول المباعة كخسية أو نقص في الزيادة.</p>
      </div>

      <div>
        <SectionTitle action={auth.can("sales.write") && <Button asChild size="sm" variant="outline"><Link to="/sales/new" search={{ batch: b.id }}><ShoppingCart /> بيع من الدفعة</Link></Button>}>مبيعات الدفعة ({fmtNum(sales.length)})</SectionTitle>
        {sales.length === 0 ? <EmptyState icon={<ShoppingCart />} title="لم يُبَع من هذه الدفعة بعد" /> : (
          <div className="glass overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
                {["التاريخ", "العميل", "عدد العجول", "الوزن", "سعر الكيلو", "الإجمالي", "الفاتورة", "الحالة"].map((h) => <th key={h} className="p-3 text-start font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 last:border-0">
                    <td className="num p-3">{fmtDate(s.sale_date)}</td>
                    <td className="p-3">{s.customer ? <Link to="/customers/$id" params={{ id: s.customer.id }} className="text-brand">{s.customer.name}</Link> : "—"}</td>
                    <td className="num p-3">{fmtNum(s.quantity)} رأس</td>
                    <td className="num p-3">{fmtWeight(s.weight)}</td>
                    <td className="num p-3">{fmtMoney(s.price_per_kg)}</td>
                    <td className={`num p-3 font-bold ${s.cancelled_at ? "text-muted-foreground line-through" : "text-brand"}`}>{fmtMoney(s.total_price)}</td>
                    <td className="num p-3 text-xs">{s.invoice_number ?? "—"}</td>
                    <td className="p-3">{s.cancelled_at ? <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive"><Ban className="mb-0.5 inline size-3" /> بيع ملغي</span> : <span className="rounded-full bg-available/15 px-3 py-1 text-xs font-bold text-available">مكتمل</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass flex items-center gap-2 rounded-2xl p-3 text-sm text-muted-foreground">
        <FileText className="size-4" /> تُخصم الكمية والوزن من مخزون الدفعة تلقائياً عند كل بيع، وتُعاد عند إلغاء البيع أو حذفه.
      </div>
      <BatchWeighingDialog open={weigh} onOpenChange={setWeigh} batchId={b.id} />
    </div>
  );
}
