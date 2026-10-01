import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Wallet, Beef, Phone } from "lucide-react";
import { animalsQuery, suppliersQuery, supplierPaymentsQuery, supplierStats, calfRemaining } from "@/lib/queries";
import { fmtDate, fmtMoney, fmtNum, fmtWeight } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, EmptyState, GlassCard, StatTile, StatusBadge, SectionTitle } from "@/components/farm/ui";
import { AnimalDialog, SupplierDialog, SupplierPaymentDialog } from "@/components/farm/forms";

export const Route = createFileRoute("/_authenticated/suppliers/$id")({
  head: () => ({
    meta: [
      { title: "ملف المورد — Elemam Farm" },
      { name: "description", content: "العجول الموردة والمدفوعات والمتبقي للمورد." },
      { property: "og:title", content: "ملف المورد — Elemam Farm" },
      { property: "og:description", content: "تفاصيل المورد ومدفوعاته." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplierPage,
});

function SupplierPage() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const { data: suppliers, isLoading } = useQuery(suppliersQuery);
  const animals = useQuery(animalsQuery).data ?? [];
  const payments = useQuery(supplierPaymentsQuery).data ?? [];
  const [edit, setEdit] = useState(false);
  const [addCalf, setAddCalf] = useState(false);
  const [pay, setPay] = useState(false);

  if (isLoading) return <Loading />;
  const s = suppliers?.find((x) => x.id === id);
  if (!s) return <EmptyState title="المورد غير موجود" action={<Button asChild variant="outline"><Link to="/suppliers">العودة للموردين</Link></Button>} />;

  const calves = animals.filter((a) => a.supplier_id === id);
  const pays = payments.filter((p) => p.supplier_id === id);
  const st = supplierStats(id, animals, payments);
  const tagOf = (aid: string | null) => animals.find((a) => a.id === aid)?.tag_number;

  return (
    <div className="space-y-5">
      <PageHeader
        title={s.name}
        subtitle={[s.phone, s.address].filter(Boolean).join(" · ") || "مورد"}
        action={
          <div className="flex flex-wrap gap-2">
            {auth.can("suppliers.write") && <Button variant="outline" onClick={() => setEdit(true)}><Pencil /> تعديل</Button>}
            {auth.can("animals.write") && <Button variant="outline" onClick={() => setAddCalf(true)}><Plus /> إضافة عجل للمورد</Button>}
            {auth.can("supplierPayments.write") && <Button onClick={() => setPay(true)}><Wallet /> تسجيل دفعة</Button>}
          </div>
        }
      />
      {s.notes && <GlassCard className="text-sm">{s.notes}</GlassCard>}

      <div>
        <SectionTitle>الإجمالي الكلي</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="إجمالي العجول الموردة" value={fmtNum(st.count)} />
          <StatTile label="إجمالي قيمة العجول" value={fmtMoney(st.value)} />
          <StatTile label="إجمالي المدفوع" value={fmtMoney(st.paid)} tone="muted" />
          <StatTile label="المتبقي للمورد" value={fmtMoney(st.remaining)} tone="amber" />
        </div>
      </div>
      <div>
        <SectionTitle>هذا الشهر</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="عجول مستلمة هذا الشهر" value={fmtNum(st.monthCount)} />
          <StatTile label="قيمة عجول الشهر" value={fmtMoney(st.monthValue)} />
          <StatTile label="المدفوع هذا الشهر" value={fmtMoney(st.monthPaid)} tone="muted" />
          <StatTile label="المتبقي هذا الشهر" value={fmtMoney(st.monthRemaining)} tone="amber" />
        </div>
      </div>

      <div>
        <SectionTitle>العجول الموردة ({fmtNum(calves.length)})</SectionTitle>
        {calves.length === 0 ? <EmptyState icon={<Beef />} title="لا توجد عجول لهذا المورد" /> : (
          <div className="glass overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
                {["رقم العجل", "تاريخ الاستلام", "وزن الاستلام", "وزن المزرعة", "الخسية", "الوزن الحالي", "اللون", "الحظيرة", "سعر الشراء", "مصروفات", "إجمالي التكلفة", "المدفوع", "المتبقي", "الحالة"].map((h) => <th key={h} className="p-3 text-start font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {calves.map((a) => {
                  const r = calfRemaining(a, payments);
                  return (
                    <tr key={a.id} className="border-b border-border/50 last:border-0">
                      <td className="p-3 font-bold"><Link to="/animals/$id" params={{ id: a.id }} className="num text-brand underline-offset-2 hover:underline">{a.tag_number}</Link></td>
                      <td className="num p-3">{fmtDate(a.entry_date)}</td>
                      <td className="num p-3">{fmtWeight(a.receive_weight)}</td>
                      <td className="num p-3">{fmtWeight(a.farm_weight)}</td>
                      <td className="num p-3">{a.receive_weight != null && a.farm_weight != null ? fmtWeight(Number(a.receive_weight) - Number(a.farm_weight)) : "—"}</td>
                      <td className="num p-3">{fmtWeight(a.current_weight)}</td>
                      <td className="p-3">{a.color ?? "—"}</td>
                      <td className="p-3">{a.barn?.name ?? "—"}</td>
                      <td className="num p-3">{fmtMoney(a.purchase_price_per_kg)}</td>
                      <td className="num p-3">{fmtMoney(a.expenses)}</td>
                      <td className="num p-3">{a.supplier_cost == null ? "—" : fmtMoney(a.supplier_cost)}</td>
                      <td className="num p-3">{fmtMoney(r.paid)}</td>
                      <td className="num p-3 font-bold">{fmtMoney(r.remaining)}</td>
                      <td className="p-3"><StatusBadge status={a.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <SectionTitle action={auth.can("supplierPayments.write") && <Button size="sm" onClick={() => setPay(true)}><Plus /> دفعة</Button>}>المدفوعات</SectionTitle>
        {pays.length === 0 ? <EmptyState icon={<Wallet />} title="لا توجد مدفوعات مسجلة" /> : (
          <div className="space-y-2">
            {pays.map((p) => (
              <GlassCard key={p.id} className="flex flex-wrap items-center gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="num text-lg font-bold">{fmtMoney(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="num">{fmtDate(p.payment_date)}</span> · {p.animal_id ? `للعجل ${tagOf(p.animal_id) ?? ""}` : "دفعة عامة"} · سجّلها: {p.recorded_by_name || "—"}
                  </p>
                  {p.notes && <p className="mt-1 text-xs">{p.notes}</p>}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {s.phone && <a href={`tel:${s.phone}`} className="sr-only"><Phone /></a>}
      <SupplierDialog open={edit} onOpenChange={setEdit} initial={s} />
      <AnimalDialog open={addCalf} onOpenChange={setAddCalf} defaultSupplierId={id} />
      <SupplierPaymentDialog open={pay} onOpenChange={setPay} supplierId={id} calves={calves} />
    </div>
  );
}
