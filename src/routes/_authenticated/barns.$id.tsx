import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Pencil, Trash2, Plus, ArrowLeftRight, Wheat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { animalsQuery, barnsQuery } from "@/lib/queries";
import { fmtNum, fmtWeight, fmtDate } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, EmptyState, AnimalCard, GlassCard, SectionTitle } from "@/components/farm/ui";
import { BarnDialog, AnimalDialog, FeedDialog, useDeleteRow } from "@/components/farm/forms";
import { ConfirmDialog } from "@/components/farm/FormDialog";

export const Route = createFileRoute("/_authenticated/barns/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل الحظيرة — Elemam Farm" },
      { name: "description", content: "الماشية داخل الحظيرة وسجل الحركات والتغذية." },
      { property: "og:title", content: "تفاصيل الحظيرة — Elemam Farm" },
      { property: "og:description", content: "تفاصيل الحظيرة." },
    ],
  }),
  component: BarnDetail,
});

function BarnDetail() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const { data: barns, isLoading } = useQuery(barnsQuery);
  const { data: animals } = useQuery(animalsQuery);
  const { data: moves } = useQuery({
    queryKey: ["barn_movements", "barn", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barn_movements")
        .select("*, animal:animals(id,tag_number), from_barn:barns!barn_movements_from_barn_id_fkey(id,name), to_barn:barns!barn_movements_to_barn_id_fkey(id,name)")
        .or(`from_barn_id.eq.${id},to_barn_id.eq.${id}`)
        .order("moved_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const [dlg, setDlg] = useState<null | "edit" | "add" | "feed" | "delete">(null);
  const del = useDeleteRow();

  if (isLoading) return <Loading />;
  const barn = barns?.find((b) => b.id === id);
  if (!barn) return <EmptyState title="الحظيرة غير موجودة" action={<Button asChild variant="outline"><Link to="/barns">العودة</Link></Button>} />;

  const inside = (animals ?? []).filter((a) => a.barn_id === id && a.status !== "sold");
  const weight = inside.reduce((s, a) => s + Number(a.current_weight ?? 0), 0);

  return (
    <div>
      <Link to="/barns" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowRight className="size-4" /> كل الحظائر</Link>
      <PageHeader
        title={barn.name}
        subtitle={barn.notes ?? undefined}
        action={
          <div className="flex gap-1">
            {auth.can("barns.write") && <Button variant="ghost" size="icon" onClick={() => setDlg("edit")} aria-label="تعديل"><Pencil /></Button>}
            {auth.can("barns.delete") && <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDlg("delete")} aria-label="حذف"><Trash2 /></Button>}
          </div>
        }
      />
      <div className="grid grid-cols-3 gap-2">
        <div className="tile-brand rounded-3xl p-4"><p className="text-xs opacity-90">عدد الرؤوس</p><p className="num mt-1 text-3xl">{fmtNum(inside.length)}</p></div>
        <GlassCard><p className="text-xs text-muted-foreground">الوزن الحي</p><p className="num mt-1 text-2xl text-brand">{fmtWeight(weight)}</p></GlassCard>
        <GlassCard><p className="text-xs text-muted-foreground">السعة</p><p className="num mt-1 text-2xl">{barn.capacity ? fmtNum(barn.capacity) : "—"}</p></GlassCard>
      </div>

      {auth.can("animals.write") && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="lg" onClick={() => setDlg("add")}><Plus /> إضافة حيوان هنا</Button>
          <Button size="lg" variant="secondary" onClick={() => setDlg("feed")}><Wheat /> تسجيل تغذية</Button>
        </div>
      )}

      <SectionTitle>الماشية داخل الحظيرة</SectionTitle>
      {inside.length === 0 ? <EmptyState title="الحظيرة فارغة" hint="انقل حيوانات إليها من صفحة الحيوان." /> : (
        <div className="grid gap-2 lg:grid-cols-2">{inside.map((a) => <AnimalCard key={a.id} animal={a} />)}</div>
      )}

      <SectionTitle>سجل الحركات</SectionTitle>
      {!moves?.length ? <EmptyState title="لا توجد حركات بعد" /> : (
        <GlassCard className="divide-y divide-border/60 p-0">
          {moves.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <ArrowLeftRight className="size-4 text-brand" />
              <div className="flex-1">
                <p><Link to="/animals/$id" params={{ id: m.animal_id }} className="num font-bold text-brand">{m.animal?.tag_number}</Link> : {m.from_barn?.name ?? "بدون حظيرة"} ← {m.to_barn?.name ?? "بدون حظيرة"}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(m.moved_at)}</p>
              </div>
            </div>
          ))}
        </GlassCard>
      )}

      <BarnDialog open={dlg === "edit"} onOpenChange={(o) => !o && setDlg(null)} initial={barn} />
      <AnimalDialog open={dlg === "add"} onOpenChange={(o) => !o && setDlg(null)} defaultBarnId={barn.id} />
      <FeedDialog open={dlg === "feed"} onOpenChange={(o) => !o && setDlg(null)} defaultBarnId={barn.id} />
      <ConfirmDialog
        open={dlg === "delete"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`حذف الحظيرة ${barn.name}؟`}
        description="الحيوانات داخلها ستصبح بدون حظيرة. لا يمكن التراجع."
        pending={del.isPending}
        onConfirm={async () => {
          await del.mutateAsync({ table: "barns", id: barn.id });
          navigate({ to: "/barns", replace: true });
        }}
      />
    </div>
  );
}
