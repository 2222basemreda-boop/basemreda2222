import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Wheat, Pencil, Trash2 } from "lucide-react";
import { feedQuery, barnsQuery, type FeedRecord } from "@/lib/queries";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Loading, EmptyState, GlassCard, Field, NativeSelect } from "@/components/farm/ui";
import { FeedDialog, useDeleteRow } from "@/components/farm/forms";
import { ConfirmDialog } from "@/components/farm/FormDialog";

export const Route = createFileRoute("/_authenticated/feeding")({
  head: () => ({ meta: [{ title: "استهلاك العلف — Elemam Farm" }, { name: "description", content: "سجل يومي لاستهلاك العلف ومتوسط استهلاك العجل." }, { property: "og:title", content: "استهلاك العلف — Elemam Farm" }, { property: "og:description", content: "سجل يومي لاستهلاك العلف ومتوسط استهلاك العجل." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: FeedingPage,
});

function FeedingPage() {
  const auth = useAuth();
  const { data, isLoading } = useQuery(feedQuery);
  const { data: barns } = useQuery(barnsQuery);
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<FeedRecord | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [barn, setBarn] = useState("");
  const del = useDeleteRow();

  const rows = useMemo(() => (data ?? []).filter((r) =>
    (!from || r.feed_date >= from) && (!to || r.feed_date <= to) && (!barn || (barn === "none" ? !r.barn_id : r.barn_id === barn))), [data, from, to, barn]);
  const totalQty = rows.reduce((s, r) => s + Number(r.quantity), 0);
  const calfDays = rows.reduce((s, r) => s + (r.animal_count ?? 0), 0);

  return (
    <div>
      <PageHeader title="استهلاك العلف" subtitle={`${fmtNum(rows.length)} سجل يومي`} action={auth.can("feed.write") && <Button onClick={() => setAddOpen(true)}><Plus /> تسجيل استهلاك</Button>} />
      <GlassCard className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="من تاريخ"><Input type="date" className="num" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="إلى تاريخ"><Input type="date" className="num" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="الحظيرة">
          <NativeSelect value={barn} onChange={(e) => setBarn(e.target.value)}>
            <option value="">الكل</option>
            <option value="none">عام / كل الحظائر</option>
            {(barns ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Field>
      </GlassCard>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="tile-brand rounded-3xl p-4"><p className="text-xs opacity-90">إجمالي العلف المستهلك</p><p className="num mt-1 text-2xl">{fmtNum(totalQty)} كجم</p></div>
        <GlassCard><p className="text-xs text-muted-foreground">متوسط العجل / يوم</p><p className="num mt-1 text-2xl text-brand">{calfDays ? `${(totalQty / calfDays).toFixed(2)} كجم` : "—"}</p></GlassCard>
      </div>
      {isLoading ? <Loading /> : !rows.length ? <EmptyState icon={<Wheat />} title="لا توجد سجلات استهلاك" /> : (
        <div className="space-y-2">
          {rows.map((r) => {
            const avg = r.animal_count ? Number(r.quantity) / r.animal_count : null;
            return (
              <GlassCard key={r.id} className="flex items-center gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{r.feed_type} · <span className="num">{fmtNum(r.quantity)} {r.unit}</span></p>
                  <p className="text-xs text-muted-foreground">{r.barn?.name ?? "عام"} · {fmtDate(r.feed_date)} · <span className="num">{fmtNum(r.animal_count ?? 0)}</span> عجل{r.notes ? ` · ${r.notes}` : ""}</p>
                  <p className="mt-1 text-xs font-bold text-brand">متوسط العجل: <span className="num">{avg != null ? `${avg.toFixed(2)} ${r.unit}/يوم` : "—"}</span></p>
                </div>
                {Number(r.cost) > 0 && <span className="num font-bold text-muted-foreground">{fmtMoney(r.cost)}</span>}
                {auth.can("feed.write") && <Button variant="ghost" size="icon" onClick={() => setEdit(r)} aria-label="تعديل"><Pencil /></Button>}
                {auth.can("feed.delete") && <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDelId(r.id)} aria-label="حذف"><Trash2 /></Button>}
              </GlassCard>
            );
          })}
        </div>
      )}
      <FeedDialog open={addOpen} onOpenChange={setAddOpen} />
      <FeedDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} initial={edit} />
      <ConfirmDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)} title="حذف سجل التغذية؟" pending={del.isPending} onConfirm={async () => { if (delId) await del.mutateAsync({ table: "feed_records", id: delId }); setDelId(null); }} />
    </div>
  );
}
