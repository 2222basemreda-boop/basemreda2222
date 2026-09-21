import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Beef, Search } from "lucide-react";
import { animalsQuery, barnsQuery } from "@/lib/queries";
import { STATUS_LABELS, type AnimalStatus } from "@/lib/labels";
import { fmtNum } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Loading, EmptyState, AnimalCard, NativeSelect } from "@/components/farm/ui";
import { AnimalDialog } from "@/components/farm/forms";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/animals/")({
  head: () => ({
    meta: [
      { title: "الماشية — Elemam Farm" },
      { name: "description", content: "قائمة كل الماشية في Elemam Farm مع الحالة والوزن والحظيرة." },
      { property: "og:title", content: "الماشية — Elemam Farm" },
      { property: "og:description", content: "قائمة الماشية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnimalsPage,
});

function AnimalsPage() {
  const auth = useAuth();
  const { data, isLoading } = useQuery(animalsQuery);
  const { data: barns } = useQuery(barnsQuery);
  const [status, setStatus] = useState<AnimalStatus | "all">("all");
  const [barn, setBarn] = useState("all");
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter(
      (a) =>
        (status === "all" || a.status === status) &&
        (barn === "all" || (barn === "none" ? !a.barn_id : a.barn_id === barn)) &&
        (!t || a.tag_number.toLowerCase().includes(t) || (a.color ?? "").toLowerCase().includes(t) || (a.customer?.name ?? "").toLowerCase().includes(t)),
    );
  }, [data, status, barn, q]);

  const counts = useMemo(() => {
    const c = { all: data?.length ?? 0, available: 0, reserved: 0, sold: 0 };
    data?.forEach((a) => c[a.status]++);
    return c;
  }, [data]);

  return (
    <div>
      <PageHeader
        title="الماشية"
        subtitle={`${fmtNum(counts.all)} رأس مسجل`}
        action={auth.can("animals.write") && <Button onClick={() => setAddOpen(true)}><Plus /> إضافة</Button>}
      />

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="رقم الحيوان، اللون، العميل…" className="pr-12" />
        </div>
        <NativeSelect value={barn} onChange={(e) => setBarn(e.target.value)} className="w-40">
          <option value="all">كل الحظائر</option>
          <option value="none">بدون حظيرة</option>
          {barns?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </NativeSelect>
      </div>

      <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto pb-1">
        {(["all", "available", "reserved", "sold"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn("tap shrink-0 rounded-2xl px-4 text-sm font-bold transition-colors", status === s ? "bg-brand text-primary-foreground shadow-float" : "glass text-foreground/80")}
          >
            {s === "all" ? "الكل" : STATUS_LABELS[s]} <span className="num opacity-80">{fmtNum(counts[s])}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading rows={6} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Beef />}
          title={data?.length ? "لا توجد نتائج مطابقة" : "لا توجد ماشية مسجلة بعد"}
          hint={data?.length ? "جرّب تغيير الفلاتر أو كلمة البحث." : "أضف أول حيوان لبدء المتابعة."}
          action={!data?.length && auth.can("animals.write") ? <Button onClick={() => setAddOpen(true)}><Plus /> إضافة حيوان</Button> : undefined}
        />
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {list.map((a) => <AnimalCard key={a.id} animal={a} />)}
        </div>
      )}

      <AnimalDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
