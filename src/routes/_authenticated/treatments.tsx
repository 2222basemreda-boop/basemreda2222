import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Stethoscope, Pencil, Trash2, ShieldPlus } from "lucide-react";
import { treatmentsQuery, type Treatment } from "@/lib/queries";
import { fmtNum, fmtDate } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, EmptyState, GlassCard } from "@/components/farm/ui";
import { TreatmentDialog, useDeleteRow } from "@/components/farm/forms";
import { ConfirmDialog } from "@/components/farm/FormDialog";

export const Route = createFileRoute("/_authenticated/treatments")({
  head: () => ({ meta: [{ title: "العلاج والتحصين — Elemam Farm" }, { name: "description", content: "سجل العلاج والتحصين وجرعات كل حيوان." }, { property: "og:title", content: "العلاج والتحصين — Elemam Farm" }, { property: "og:description", content: "سجل العلاج والتحصين وجرعات كل حيوان." }] }),
  component: TreatmentsPage,
});

function TreatmentsPage() {
  const auth = useAuth();
  const { data, isLoading } = useQuery(treatmentsQuery);
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<Treatment | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const del = useDeleteRow();
  return (
    <div>
      <PageHeader title="العلاج والتحصين" subtitle={`${fmtNum(data?.length ?? 0)} سجل صحي`} action={auth.can("treatments.write") && <Button onClick={() => setAddOpen(true)}><Plus /> إضافة سجل صحي</Button>} />
      {isLoading ? <Loading /> : !data?.length ? <EmptyState icon={<Stethoscope />} title="لا توجد سجلات علاج أو تحصين" /> : (
        <div className="space-y-2">
          {data.map((t) => (
            <GlassCard key={t.id} className="flex items-center gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold">{t.record_type === "vaccination" ? <ShieldPlus className="size-4 text-brand" /> : <Stethoscope className="size-4 text-brand" />} <span>{t.record_type === "vaccination" ? "تحصين" : "علاج"} · حيوان <Link to="/animals/$id" params={{ id: t.animal_id }} className="num text-brand">{t.animal?.tag_number}</Link> · {t.diagnosis}</span></p>
                <p className="text-xs text-muted-foreground">{t.record_type === "vaccination" ? `الجرعة الأولى: ${fmtDate(t.first_dose_date ?? t.treatment_date)}${t.second_dose_date ? ` · الجرعة الثانية: ${fmtDate(t.second_dose_date)}` : ""}` : `${fmtDate(t.treatment_date)}${t.medicine ? ` · ${t.medicine}` : ""}${t.dose ? ` — ${t.dose}` : ""}`}</p>
              </div>
              {auth.can("treatments.write") && <Button variant="ghost" size="icon" onClick={() => setEdit(t)} aria-label="تعديل"><Pencil /></Button>}
              {auth.can("treatments.delete") && <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDelId(t.id)} aria-label="حذف"><Trash2 /></Button>}
            </GlassCard>
          ))}
        </div>
      )}
      <TreatmentDialog open={addOpen} onOpenChange={setAddOpen} />
      <TreatmentDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} initial={edit} />
      <ConfirmDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)} title="حذف السجل الصحي؟" pending={del.isPending} onConfirm={async () => { if (delId) await del.mutateAsync({ table: "treatments", id: delId }); setDelId(null); }} />
    </div>
  );
}
