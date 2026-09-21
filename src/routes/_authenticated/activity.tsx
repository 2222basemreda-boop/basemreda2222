import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { activityQuery } from "@/lib/queries";
import { ACTION_LABELS, ENTITY_LABELS } from "@/lib/labels";
import { fmtRelative } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, Loading, EmptyState, GlassCard } from "@/components/farm/ui";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "سجل النشاط — Elemam Farm" }, { name: "description", content: "من أضاف أو عدّل أو نقل أو حذف السجلات في Elemam Farm." }, { property: "og:title", content: "سجل النشاط — Elemam Farm" }, { property: "og:description", content: "من أضاف أو عدّل أو نقل أو حذف السجلات في Elemam Farm." }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const auth = useAuth();
  const { data, isLoading } = useQuery(activityQuery(200));
  if (!auth.can("logs.read")) return <EmptyState title="ليس لديك صلاحية عرض السجل" />;
  return (
    <div>
      <PageHeader title="سجل النشاط" subtitle="آخر 200 عملية" />
      {isLoading ? <Loading /> : !data?.length ? <EmptyState icon={<History />} title="لا يوجد نشاط بعد" /> : (
        <GlassCard className="divide-y divide-border/60 p-0">
          {data.map((l) => (
            <div key={l.id} className="flex items-start gap-3 px-4 py-3 text-sm">
              <div className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
              <div className="min-w-0 flex-1">
                <span className="font-bold">{l.user_name ?? "النظام"}</span> <span className="text-muted-foreground">{ACTION_LABELS[l.action] ?? l.action}</span> <span>{ENTITY_LABELS[l.entity_type] ?? l.entity_type}</span>
                {l.entity_label && <span className="num font-bold"> {l.entity_label}</span>}
                <p className="text-[11px] text-muted-foreground">{fmtRelative(l.created_at)}</p>
              </div>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}
