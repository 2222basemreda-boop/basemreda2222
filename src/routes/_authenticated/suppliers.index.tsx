import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Truck, Search, Phone } from "lucide-react";
import { animalsQuery, suppliersQuery, supplierPaymentsQuery, supplierStats } from "@/lib/queries";
import { fmtMoney, fmtNum } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Loading, EmptyState } from "@/components/farm/ui";
import { SupplierDialog } from "@/components/farm/forms";

export const Route = createFileRoute("/_authenticated/suppliers/")({
  head: () => ({
    meta: [
      { title: "الموردين — Elemam Farm" },
      { name: "description", content: "الموردين، العجول الموردة، المدفوعات والمتبقي لكل مورد." },
      { property: "og:title", content: "الموردين — Elemam Farm" },
      { property: "og:description", content: "إدارة الموردين ومستحقاتهم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const auth = useAuth();
  const { data, isLoading } = useQuery(suppliersQuery);
  const animals = useQuery(animalsQuery).data ?? [];
  const payments = useQuery(supplierPaymentsQuery).data ?? [];
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((s) => !t || s.name.toLowerCase().includes(t) || (s.phone ?? "").includes(t));
  }, [data, q]);

  return (
    <div>
      <PageHeader title="الموردين" subtitle={`${fmtNum(data?.length ?? 0)} مورد`} action={auth.can("suppliers.write") && <Button onClick={() => setOpen(true)}><Plus /> إضافة مورد جديد</Button>} />
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="الاسم أو الهاتف…" className="pr-12" />
      </div>
      {isLoading ? <Loading /> : list.length === 0 ? (
        <EmptyState icon={<Truck />} title={data?.length ? "لا توجد نتائج" : "لا يوجد موردين بعد"} action={!data?.length && auth.can("suppliers.write") ? <Button onClick={() => setOpen(true)}><Plus /> إضافة مورد جديد</Button> : undefined} />
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {list.map((s) => {
            const st = supplierStats(s.id, animals, payments);
            return (
              <Link key={s.id} to="/suppliers/$id" params={{ id: s.id }} className="glass tap block rounded-2xl p-3 hover:bg-popover/80">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/15 font-display text-lg font-extrabold text-brand">{s.name.slice(0, 1)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{s.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {s.phone && <><Phone className="size-3" /><span className="num" dir="ltr">{s.phone}</span> · </>}
                      {s.address ?? s.notes ?? ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
                  <Mini label="إجمالي العجول" v={fmtNum(st.count)} />
                  <Mini label="عجول الشهر" v={fmtNum(st.monthCount)} />
                  <Mini label="إجمالي القيمة" v={fmtMoney(st.value)} />
                  <Mini label="المدفوع" v={fmtMoney(st.paid)} />
                  <Mini label="المتبقي" v={fmtMoney(st.remaining)} strong />
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <SupplierDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function Mini({ label, v, strong }: { label: string; v: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl px-1 py-1.5 ${strong ? "bg-amber/20" : "bg-muted/60"}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="num font-bold">{v}</p>
    </div>
  );
}
