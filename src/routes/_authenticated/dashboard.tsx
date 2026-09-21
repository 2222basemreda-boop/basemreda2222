import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Scale, Warehouse, Receipt, ArrowLeft, History } from "lucide-react";
import { dashboardQuery } from "@/lib/queries";
import { fmtNum, fmtWeight, fmtMoney, fmtRelative } from "@/lib/format";
import { ACTION_LABELS, ENTITY_LABELS } from "@/lib/labels";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, StatTile, SectionTitle, GlassCard, Loading, EmptyState, StatusBadge, TagChip } from "@/components/farm/ui";
import { AnimalDialog, WeightDialog } from "@/components/farm/forms";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "الرئيسية — Elemam Farm" },
      { name: "description", content: "نظرة عامة على الماشية، الحظائر، الأوزان والمبيعات في Elemam Farm." },
      { property: "og:title", content: "الرئيسية — Elemam Farm" },
      { property: "og:description", content: "لوحة متابعة Elemam Farm." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const auth = useAuth();
  const { data, isLoading } = useQuery(dashboardQuery);
  const [addOpen, setAddOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);

  const greeting = new Date().getHours() < 12 ? "صباح الخير" : "مساء الخير";

  return (
    <div>
      <PageHeader title={`${greeting}${auth.profile ? "، " + auth.profile.full_name.split(" ")[0] : ""}`} subtitle="نظرة عامة على المزرعة اليوم" />

      {auth.can("animals.write") && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button size="lg" onClick={() => setAddOpen(true)}><Plus /> إضافة حيوان</Button>
          <Button size="lg" variant="secondary" onClick={() => setWeightOpen(true)}><Scale /> تسجيل وزن</Button>
          <Button size="lg" variant="outline" asChild><Link to="/barns"><Warehouse /> الحظائر</Link></Button>
          {auth.can("sales.read") && <Button size="lg" variant="amber" asChild><Link to="/sales"><Receipt /> المبيعات</Link></Button>}
        </div>
      )}

      {isLoading || !data ? (
        <Loading rows={5} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="إجمالي الماشية" value={fmtNum(data.total)} />
            <StatTile label="متاح" value={fmtNum(data.available)} />
            <StatTile label="محجوز" value={fmtNum(data.reserved)} tone="amber" />
            <StatTile label="مباع" value={fmtNum(data.sold)} tone="muted" />
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="tile-brand rounded-3xl p-5">
              <p className="text-sm opacity-90">إجمالي الوزن الحي (غير المباع)</p>
              <p className="num mt-1 text-4xl">{fmtWeight(data.totalWeight)}</p>
              <p className="mt-1 text-xs opacity-80">{fmtNum(data.available + data.reserved)} رأس في المزرعة</p>
            </div>
            {data.sales ? (
              <GlassCard className="flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">مبيعات هذا الشهر</p>
                  <Link to="/sales" className="text-xs font-bold text-brand">التفاصيل</Link>
                </div>
                <p className="num mt-1 text-3xl text-brand">{fmtMoney(data.sales.total)}</p>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{fmtNum(data.sales.count)} عملية بيع</span>
                  <span>محصّل: <span className="num">{fmtMoney(data.sales.paid)}</span></span>
                </div>
              </GlassCard>
            ) : (
              <GlassCard className="flex items-center justify-center text-sm text-muted-foreground">بيانات المبيعات متاحة للمحاسب والإدارة</GlassCard>
            )}
          </div>

          <SectionTitle action={<Link to="/barns" className="text-xs font-bold text-brand">إدارة الحظائر</Link>}>الحظائر</SectionTitle>
          {data.perBarn.length === 0 ? (
            <EmptyState icon={<Warehouse />} title="لا توجد حظائر بعد" hint="أنشئ الحظائر أولاً لتوزيع الماشية عليها." action={<Button asChild><Link to="/barns">إنشاء حظيرة</Link></Button>} />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {data.perBarn.map((b) => (
                <Link key={b.id} to="/barns/$id" params={{ id: b.id }} className="glass rounded-2xl p-3 transition-colors hover:bg-popover/80">
                  <p className="truncate text-sm font-bold">{b.name}</p>
                  <p className="num mt-1 text-2xl text-brand">{fmtNum(b.count)}</p>
                  <p className="text-[11px] text-muted-foreground">رأس{b.capacity ? ` من ${fmtNum(b.capacity)}` : ""}</p>
                </Link>
              ))}
              {data.unassigned > 0 && (
                <div className="glass rounded-2xl border-dashed p-3">
                  <p className="text-sm font-bold">بدون حظيرة</p>
                  <p className="num mt-1 text-2xl text-amber">{fmtNum(data.unassigned)}</p>
                  <p className="text-[11px] text-muted-foreground">رأس</p>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <SectionTitle action={<Link to="/animals" className="text-xs font-bold text-brand">عرض الكل</Link>}>أحدث الماشية</SectionTitle>
              {data.recentAnimals.length === 0 ? (
                <EmptyState title="لا توجد ماشية مسجلة" hint="ابدأ بإضافة أول حيوان." />
              ) : (
                <div className="space-y-2">
                  {data.recentAnimals.map((a) => (
                    <Link key={a.id} to="/animals/$id" params={{ id: a.id }} className="glass flex items-center gap-3 rounded-2xl p-3 hover:bg-popover/80">
                      <TagChip tag={a.tag_number} status={a.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{a.color || "بدون لون"} · {fmtWeight(a.current_weight)}</p>
                        <p className="text-xs text-muted-foreground">{a.barn?.name ?? "بدون حظيرة"} · {fmtRelative(a.created_at)}</p>
                      </div>
                      <StatusBadge status={a.status} />
                      <ArrowLeft className="size-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div>
              <SectionTitle action={auth.can("logs.read") ? <Link to="/activity" className="text-xs font-bold text-brand">السجل الكامل</Link> : undefined}>آخر النشاطات</SectionTitle>
              {data.logs.length === 0 ? (
                <EmptyState icon={<History />} title="لا يوجد نشاط بعد" />
              ) : (
                <GlassCard className="divide-y divide-border/60 p-0">
                  {data.logs.map((l) => (
                    <div key={l.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="mt-0.5 size-2 shrink-0 rounded-full bg-brand" />
                      <div className="min-w-0 flex-1 text-sm">
                        <span className="font-bold">{l.user_name ?? "النظام"}</span>{" "}
                        <span className="text-muted-foreground">{ACTION_LABELS[l.action] ?? l.action}</span>{" "}
                        <span>{ENTITY_LABELS[l.entity_type] ?? l.entity_type}</span>
                        {l.entity_label && <span className="num font-bold"> {l.entity_label}</span>}
                        <p className="text-[11px] text-muted-foreground">{fmtRelative(l.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </GlassCard>
              )}
            </div>
          </div>
        </>
      )}

      <AnimalDialog open={addOpen} onOpenChange={setAddOpen} />
      <WeightDialog open={weightOpen} onOpenChange={setWeightOpen} />
    </div>
  );
}
