import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Warehouse } from "lucide-react";
import { animalsQuery, barnsQuery } from "@/lib/queries";
import { fmtNum, fmtWeight } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, EmptyState } from "@/components/farm/ui";
import { BarnDialog } from "@/components/farm/forms";

export const Route = createFileRoute("/_authenticated/barns/")({
  head: () => ({
    meta: [
      { title: "الحظائر — Elemam Farm" },
      { name: "description", content: "إدارة حظائر Elemam Farm وعدد الماشية في كل حظيرة." },
      { property: "og:title", content: "الحظائر — Elemam Farm" },
      { property: "og:description", content: "إدارة الحظائر." },
    ],
  }),
  component: BarnsPage,
});

function BarnsPage() {
  const auth = useAuth();
  const { data: barns, isLoading } = useQuery(barnsQuery);
  const { data: animals } = useQuery(animalsQuery);
  const [open, setOpen] = useState(false);

  const live = (animals ?? []).filter((a) => a.status !== "sold");

  return (
    <div>
      <PageHeader title="الحظائر" subtitle={`${fmtNum(barns?.length ?? 0)} حظيرة`} action={auth.can("barns.write") && <Button onClick={() => setOpen(true)}><Plus /> حظيرة جديدة</Button>} />
      {isLoading ? (
        <Loading />
      ) : !barns?.length ? (
        <EmptyState icon={<Warehouse />} title="لا توجد حظائر بعد" hint="أنشئ الحظائر لتوزيع الماشية عليها ومتابعة حركتها." action={auth.can("barns.write") ? <Button onClick={() => setOpen(true)}><Plus /> إنشاء حظيرة</Button> : undefined} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {barns.map((b) => {
            const inside = live.filter((a) => a.barn_id === b.id);
            const weight = inside.reduce((s, a) => s + Number(a.current_weight ?? 0), 0);
            const pct = b.capacity ? Math.min(100, Math.round((inside.length / b.capacity) * 100)) : null;
            return (
              <Link key={b.id} to="/barns/$id" params={{ id: b.id }} className="glass rounded-3xl p-4 transition-colors hover:bg-popover/80">
                <div className="flex items-start justify-between">
                  <div className="grid size-11 place-items-center rounded-2xl bg-brand/10 text-brand"><Warehouse className="size-5" /></div>
                  <span className="num text-3xl text-brand">{fmtNum(inside.length)}</span>
                </div>
                <p className="mt-3 text-lg font-bold">{b.name}</p>
                <p className="text-xs text-muted-foreground">{fmtWeight(weight)} وزن حي{b.capacity ? ` · السعة ${fmtNum(b.capacity)}` : ""}</p>
                {pct !== null && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand/10">
                    <div className={pct >= 100 ? "h-full bg-amber" : "h-full bg-brand"} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </Link>
            );
          })}
          {live.some((a) => !a.barn_id) && (
            <div className="glass rounded-3xl border-2 border-dashed p-4">
              <p className="num text-3xl text-amber">{fmtNum(live.filter((a) => !a.barn_id).length)}</p>
              <p className="mt-3 text-lg font-bold">بدون حظيرة</p>
              <p className="text-xs text-muted-foreground">حيوانات لم تُوزَّع بعد</p>
            </div>
          )}
        </div>
      )}
      <BarnDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
