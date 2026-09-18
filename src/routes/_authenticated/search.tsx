import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { animalsQuery, barnsQuery } from "@/lib/queries";
import { STATUS_LABELS, type AnimalStatus } from "@/lib/labels";
import { fmtNum } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { PageHeader, Loading, EmptyState, AnimalCard, NativeSelect } from "@/components/farm/ui";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "البحث — مزرعة الإمام" }, { name: "description", content: "بحث سريع في الماشية برقم الحيوان أو العميل أو الكود أو الحظيرة." }, { property: "og:title", content: "البحث — مزرعة الإمام" }, { property: "og:description", content: "بحث سريع في الماشية برقم الحيوان أو العميل أو الكود أو الحظيرة." }] }),
  component: SearchPage,
});

function SearchPage() {
  const { data, isLoading } = useQuery(animalsQuery);
  const { data: barns } = useQuery(barnsQuery);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<AnimalStatus | "all">("all");
  const [barn, setBarn] = useState("all");
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((a) =>
      (status === "all" || a.status === status) &&
      (barn === "all" || a.barn_id === barn) &&
      (!t || [a.tag_number, a.color, a.customer?.name, a.customer?.code, a.barn?.name, a.notes].some((v) => (v ?? "").toLowerCase().includes(t))),
    );
  }, [data, q, status, barn]);
  return (
    <div>
      <PageHeader title="البحث" subtitle="برقم الحيوان، اسم العميل، كود العميل، الحظيرة أو الحالة" />
      <div className="relative mb-3">
        <SearchIcon className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="اكتب للبحث…" className="h-14 pr-12 text-lg" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as AnimalStatus | "all")}>
          <option value="all">كل الحالات</option>
          {(Object.keys(STATUS_LABELS) as AnimalStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </NativeSelect>
        <NativeSelect value={barn} onChange={(e) => setBarn(e.target.value)}>
          <option value="all">كل الحظائر</option>
          {barns?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </NativeSelect>
      </div>
      {isLoading ? <Loading /> : results.length === 0 ? <EmptyState icon={<SearchIcon />} title="لا توجد نتائج" /> : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">{fmtNum(results.length)} نتيجة</p>
          <div className="grid gap-2 lg:grid-cols-2">{results.map((a) => <AnimalCard key={a.id} animal={a} />)}</div>
        </>
      )}
    </div>
  );
}
