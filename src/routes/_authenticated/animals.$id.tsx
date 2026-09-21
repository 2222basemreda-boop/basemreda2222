import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Scale, ArrowLeftRight, Stethoscope, Receipt, Pencil, Trash2, TrendingUp, TrendingDown, Minus, CalendarX } from "lucide-react";
import { animalQuery } from "@/lib/queries";
import { fmtWeight, fmtDate, fmtNum, fmtMoney } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/labels";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, EmptyState, StatusBadge, PaymentBadge, GlassCard } from "@/components/farm/ui";
import { AnimalDialog, WeightDialog, MoveBarnDialog, TreatmentDialog, SaleDialog, useDeleteRow, useCancelReservation } from "@/components/farm/forms";
import { ConfirmDialog } from "@/components/farm/FormDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/animals/$id")({
  head: () => ({
    meta: [
      { title: "بيانات الحيوان — Elemam Farm" },
      { name: "description", content: "بطاقة الحيوان الكاملة: الأوزان، الحركات بين الحظائر، العملاء والعلاجات." },
      { property: "og:title", content: "بيانات الحيوان — Elemam Farm" },
      { property: "og:description", content: "سجل الحيوان الكامل." },
    ],
  }),
  component: AnimalDetail,
});

type Tab = "weights" | "moves" | "customers" | "treatments" | "sales";

function AnimalDetail() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(animalQuery(id));
  const [tab, setTab] = useState<Tab>("weights");
  const [dlg, setDlg] = useState<null | "edit" | "weight" | "move" | "treat" | "sale" | "delete" | "cancelBooking">(null);
  const del = useDeleteRow();
  const cancelBooking = useCancelReservation();

  if (isLoading) return <Loading rows={6} />;
  if (!data) return <EmptyState title="الحيوان غير موجود" action={<Button asChild variant="outline"><Link to="/animals">العودة للقائمة</Link></Button>} />;

  const { animal, weights, moves, customerHistory, treatments, sales } = data;
  const canWrite = auth.can("animals.write");
  const canSell = auth.can("sales.write") && animal.status !== "sold";

  const tabs: { key: Tab; label: string; count: number; show?: boolean }[] = [
    { key: "weights", label: "الأوزان", count: weights.length },
    { key: "moves", label: "الحركات", count: moves.length },
    { key: "customers", label: "العملاء", count: customerHistory.length },
    { key: "treatments", label: "العلاجات", count: treatments.length },
    { key: "sales", label: "البيع", count: sales.length, show: auth.can("sales.read") },
  ];

  return (
    <div>
      <Link to="/animals" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowRight className="size-4" /> كل الماشية</Link>
      <PageHeader
        title={`حيوان رقم ${animal.tag_number}`}
        subtitle={`${animal.color || "بدون لون"} · دخل المزرعة ${fmtDate(animal.entry_date)}`}
        action={<StatusBadge status={animal.status} className="px-3 py-1.5 text-xs" />}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="tile-brand col-span-2 rounded-3xl p-4 sm:col-span-1">
          <p className="text-xs opacity-90">الوزن الحالي</p>
          <p className="num mt-1 text-3xl">{fmtWeight(animal.current_weight)}</p>
        </div>
        <Info label="الحظيرة" value={animal.barn ? <Link to="/barns/$id" params={{ id: animal.barn.id }} className="text-brand">{animal.barn.name}</Link> : "بدون حظيرة"} />
        <Info label="العميل" value={animal.customer ? <Link to="/customers/$id" params={{ id: animal.customer.id }} className="text-brand">{animal.customer.name}</Link> : "—"} sub={animal.customer?.code} />
        <Info label="الحالة" value={STATUS_LABELS[animal.status]} />
      </div>
      {animal.notes && <GlassCard className="mt-2 text-sm"><span className="font-bold">ملاحظات: </span>{animal.notes}</GlassCard>}

      {(canWrite || canSell) && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {canWrite && <Button size="lg" onClick={() => setDlg("weight")}><Scale /> تسجيل وزن</Button>}
          {canWrite && <Button size="lg" variant="secondary" onClick={() => setDlg("move")}><ArrowLeftRight /> نقل حظيرة</Button>}
          {canWrite && <Button size="lg" variant="outline" onClick={() => setDlg("treat")}><Stethoscope /> تسجيل علاج</Button>}
          {canSell && <Button size="lg" variant="amber" onClick={() => setDlg("sale")}><Receipt /> بيع</Button>}
          {canWrite && animal.status === "reserved" && (
            <Button size="lg" variant="outline" className="col-span-2 border-destructive/40 text-destructive hover:bg-destructive/10 sm:col-span-2" onClick={() => setDlg("cancelBooking")}>
              <CalendarX /> إلغاء الحجز
            </Button>
          )}
        </div>
      )}
      {(canWrite || auth.can("animals.delete")) && (
        <div className="mt-2 flex gap-2">
          {canWrite && <Button variant="ghost" size="sm" onClick={() => setDlg("edit")}><Pencil /> تعديل البيانات</Button>}
          {auth.can("animals.delete") && <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDlg("delete")}><Trash2 /> حذف</Button>}
        </div>
      )}

      <div className="scrollbar-none mt-6 flex gap-2 overflow-x-auto pb-1">
        {tabs.filter((t) => t.show !== false).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("tap shrink-0 rounded-2xl px-4 text-sm font-bold", tab === t.key ? "bg-brand text-primary-foreground shadow-float" : "glass text-foreground/80")}>
            {t.label} <span className="num opacity-80">{fmtNum(t.count)}</span>
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "weights" && (
          weights.length === 0 ? <EmptyState title="لا توجد أوزان مسجلة" /> : (
            <GlassCard className="divide-y divide-border/60 p-0">
              {weights.map((w, i) => {
                const prev = weights[i + 1];
                const diff = prev ? Number(w.weight) - Number(prev.weight) : null;
                return (
                  <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
                      {diff === null || diff === 0 ? <Minus className="size-4" /> : diff > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4 text-destructive" />}
                    </div>
                    <div className="flex-1">
                      <p className="num text-lg font-bold">{fmtWeight(w.weight)}{diff !== null && diff !== 0 && <span className={cn("mr-2 text-xs", diff > 0 ? "text-available" : "text-destructive")}>{diff > 0 ? "+" : ""}{fmtNum(diff)}</span>}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(w.recorded_at)}{w.notes ? ` · ${w.notes}` : ""}</p>
                    </div>
                    {i === 0 && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">الحالي</span>}
                  </div>
                );
              })}
            </GlassCard>
          )
        )}
        {tab === "moves" && (
          moves.length === 0 ? <EmptyState title="لا توجد حركات نقل" /> : (
            <GlassCard className="divide-y divide-border/60 p-0">
              {moves.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <ArrowLeftRight className="size-4 text-brand" />
                  <div className="flex-1">
                    <p className="font-bold">{m.from_barn?.name ?? "بدون حظيرة"} ← {m.to_barn?.name ?? "بدون حظيرة"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(m.moved_at)}{m.notes ? ` · ${m.notes}` : ""}</p>
                  </div>
                </div>
              ))}
            </GlassCard>
          )
        )}
        {tab === "customers" && (
          customerHistory.length === 0 ? <EmptyState title="لم يُربط بأي عميل بعد" /> : (
            <GlassCard className="divide-y divide-border/60 p-0">
              {customerHistory.map((h) => (
                <div key={h.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="flex-1">
                    <p className="font-bold">{h.customer ? `${h.customer.name} (${h.customer.code})` : "بدون عميل"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(h.changed_at)}</p>
                  </div>
                  {h.event === "cancelled"
                    ? <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">حجز ملغي</span>
                    : <StatusBadge status={h.status} />}
                </div>
              ))}
            </GlassCard>
          )
        )}
        {tab === "treatments" && (
          treatments.length === 0 ? <EmptyState title="لا توجد علاجات مسجلة" /> : (
            <div className="space-y-2">
              {treatments.map((t) => (
                <GlassCard key={t.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{t.diagnosis}</p>
                    <span className="text-xs text-muted-foreground">{fmtDate(t.treatment_date)}</span>
                  </div>
                  {(t.medicine || t.dose) && <p className="mt-1 text-muted-foreground">{t.medicine}{t.dose ? ` — ${t.dose}` : ""}</p>}
                  {t.notes && <p className="mt-1 text-xs text-muted-foreground">{t.notes}</p>}
                </GlassCard>
              ))}
            </div>
          )
        )}
        {tab === "sales" && (
          sales.length === 0 ? <EmptyState title="لم يتم بيع هذا الحيوان" /> : (
            <div className="space-y-2">
              {sales.map((s) => (
                <GlassCard key={s.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{s.customer ? `${s.customer.name} (${s.customer.code})` : "—"}</p>
                    <PaymentBadge status={s.payment_status} />
                  </div>
                  <p className="num mt-1 text-lg text-brand">{fmtMoney(s.total_price)}</p>
                  <p className="text-xs text-muted-foreground">{fmtWeight(s.weight)} × {fmtMoney(s.price_per_kg)} · {fmtDate(s.sale_date)}</p>
                </GlassCard>
              ))}
            </div>
          )
        )}
      </div>


      <AnimalDialog open={dlg === "edit"} onOpenChange={(o) => !o && setDlg(null)} initial={animal} />
      <WeightDialog open={dlg === "weight"} onOpenChange={(o) => !o && setDlg(null)} animalId={animal.id} />
      <MoveBarnDialog open={dlg === "move"} onOpenChange={(o) => !o && setDlg(null)} animal={animal} />
      <TreatmentDialog open={dlg === "treat"} onOpenChange={(o) => !o && setDlg(null)} animalId={animal.id} />
      <SaleDialog open={dlg === "sale"} onOpenChange={(o) => !o && setDlg(null)} animal={animal} />
      <ConfirmDialog
        open={dlg === "delete"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`حذف الحيوان ${animal.tag_number}؟`}
        description="سيتم حذف كل سجلاته (الأوزان، الحركات، العلاجات، المبيعات). لا يمكن التراجع."
        pending={del.isPending}
        onConfirm={async () => {
          await del.mutateAsync({ table: "animals", id: animal.id });
          navigate({ to: "/animals", replace: true });
        }}
      />
      <ConfirmDialog
        open={dlg === "cancelBooking"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`إلغاء حجز الحيوان ${animal.tag_number}؟`}
        description="سيتم إلغاء الحجز فقط وتحويل الحالة إلى «متاح». لن يُحذف الحيوان ولا أي من بياناته، وسيظهر الحجز القديم في السجل كـ«حجز ملغي»."
        confirmLabel="تأكيد إلغاء الحجز"
        pending={cancelBooking.isPending}
        onConfirm={async () => {
          await cancelBooking.mutateAsync({ animalId: animal.id });
          setDlg(null);
        }}
      />
    </div>
  );
}

function Info({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string | null | undefined }) {
  return (
    <div className="glass rounded-3xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-bold">{value}</p>
      {sub && <p className="num text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
