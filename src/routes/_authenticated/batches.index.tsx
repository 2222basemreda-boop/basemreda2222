import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Boxes, Search } from "lucide-react";
import { batchesQuery, batchRemainingCost } from "@/lib/queries";
import { fmtDate, fmtMoney, fmtNum, fmtWeight } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Loading, EmptyState } from "@/components/farm/ui";
import { AnimalDialog } from "@/components/farm/forms";

export const Route = createFileRoute("/_authenticated/batches/")({
  head: () => ({
    meta: [
      { title: "العجول الحرة — Elemam Farm" },
      { name: "description", content: "دفعات العجول الحرة: المخزون المتبقي والأوزان والتكاليف." },
      { property: "og:title", content: "العجول الحرة — Elemam Farm" },
      { property: "og:description", content: "دفعات العجول الحرة ومخزونها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BatchesPage,
});

function BatchesPage() {
  const auth = useAuth();
  const { data, isLoading } = useQuery(batchesQuery);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter(
      (b) => !t || (b.supplier_name ?? "").toLowerCase().includes(t) || (b.barn?.name ?? "").toLowerCase().includes(t),
    );
  }, [data, q]);

  return (
    <div>
      <PageHeader
        title="العجول الحرة"
        subtitle={`${fmtNum(data?.length ?? 0)} دفعة`}
        action={auth.can("animals.write") && <Button onClick={() => setOpen(true)}><Plus /> إضافة دفعة</Button>}
      />
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="المورد أو الحظيرة…" className="pr-12" />
      </div>
      {isLoading ? <Loading /> : list.length === 0 ? (
        <EmptyState
          icon={<Boxes />}
          title={data?.length ? "لا توجد نتائج مطابقة" : "لا توجد دفعات بعد"}
          hint={data?.length ? undefined : "سجّل دفعة عجول حرة لتبع مخزونها وأوزانها وبيعها بالجملة."}
          action={!data?.length && auth.can("animals.write") ? <Button onClick={() => setOpen(true)}><Plus /> إضافة دفعة</Button> : undefined}
        />
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {list.map((b) => {
            const depleted = b.remaining_quantity <= 0 || b.remaining_weight <= 0;
            const remCost = batchRemainingCost(b);
            return (
              <Link key={b.id} to="/batches/$id" params={{ id: b.id }} className="glass tap block rounded-2xl p-3 hover:bg-popover/80">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/15 font-display text-lg font-extrabold text-brand">
                    <Boxes className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{b.supplier_name || "دفعة عجول حرة"}</p>
                    <p className="num text-xs text-muted-foreground">{b.barn?.name ?? "بدون حظيرة"} · {fmtDate(b.entry_date)}</p>
                  </div>
                  {depleted && <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">نفدت</span>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <Mini label="العجول المتبقية" v={`${fmtNum(b.remaining_quantity)} / ${fmtNum(b.quantity)}`} />
                  <Mini label="الوزن المتبقي" v={fmtWeight(b.remaining_weight)} />
                  <Mini label="الخسية" v={b.purchase_weight != null ? fmtWeight(Number(b.purchase_weight) - Number(b.receive_weight)) : "—"} />
                  <Mini label="التكلفة المتبقية" v={remCost != null ? fmtMoney(remCost) : "—"} strong />
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <AnimalDialog open={open} onOpenChange={setOpen} defaultKind="loose" />
    </div>
  );
}

function Mini({ label, v, strong }: { label: string; v: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl px-1 py-1.5 text-center ${strong ? "bg-amber/20" : "bg-muted/60"}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="num font-bold">{v}</p>
    </div>
  );
}
