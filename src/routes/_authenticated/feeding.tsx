import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Wheat, Pencil, Trash2 } from "lucide-react";
import { feedQuery, type FeedRecord } from "@/lib/queries";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, EmptyState, GlassCard } from "@/components/farm/ui";
import { FeedDialog, useDeleteRow } from "@/components/farm/forms";
import { ConfirmDialog } from "@/components/farm/FormDialog";

export const Route = createFileRoute("/_authenticated/feeding")({
  head: () => ({ meta: [{ title: "التغذية — مزرعة الإمام" }, { name: "description", content: "سجل استهلاك الأعلاف حسب الحظيرة والتاريخ." }, { property: "og:title", content: "التغذية — مزرعة الإمام" }, { property: "og:description", content: "سجل استهلاك الأعلاف حسب الحظيرة والتاريخ." }] }),
  component: FeedingPage,
});

function FeedingPage() {
  const auth = useAuth();
  const { data, isLoading } = useQuery(feedQuery);
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<FeedRecord | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const del = useDeleteRow();
  return (
    <div>
      <PageHeader title="التغذية" subtitle={`${fmtNum(data?.length ?? 0)} سجل`} action={auth.can("feed.write") && <Button onClick={() => setAddOpen(true)}><Plus /> تسجيل تغذية</Button>} />
      {isLoading ? <Loading /> : !data?.length ? <EmptyState icon={<Wheat />} title="لا توجد سجلات تغذية" /> : (
        <div className="space-y-2">
          {data.map((r) => (
            <GlassCard key={r.id} className="flex items-center gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{r.feed_type} · <span className="num">{fmtNum(r.quantity)} {r.unit}</span></p>
                <p className="text-xs text-muted-foreground">{r.barn?.name ?? "عام"} · {fmtDate(r.feed_date)}{r.notes ? ` · ${r.notes}` : ""}</p>
              </div>
              <span className="num font-bold text-brand">{fmtMoney(r.cost)}</span>
              {auth.can("feed.write") && <Button variant="ghost" size="icon" onClick={() => setEdit(r)} aria-label="تعديل"><Pencil /></Button>}
              {auth.can("feed.delete") && <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDelId(r.id)} aria-label="حذف"><Trash2 /></Button>}
            </GlassCard>
          ))}
        </div>
      )}
      <FeedDialog open={addOpen} onOpenChange={setAddOpen} />
      <FeedDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} initial={edit} />
      <ConfirmDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)} title="حذف سجل التغذية؟" pending={del.isPending} onConfirm={async () => { if (delId) await del.mutateAsync({ table: "feed_records", id: delId }); setDelId(null); }} />
    </div>
  );
}
