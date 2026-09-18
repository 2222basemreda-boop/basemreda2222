import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtNum, fmtWeight, fmtDate } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, EmptyState, GlassCard } from "@/components/farm/ui";
import { WeightDialog } from "@/components/farm/forms";

export const Route = createFileRoute("/_authenticated/weights")({
  head: () => ({ meta: [{ title: "الأوزان — مزرعة الإمام" }, { name: "description", content: "آخر الأوزان المسجلة لكل الماشية." }, { property: "og:title", content: "الأوزان — مزرعة الإمام" }, { property: "og:description", content: "آخر الأوزان المسجلة لكل الماشية." }] }),
  component: WeightsPage,
});

function WeightsPage() {
  const auth = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["weight_records", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase.from("weight_records").select("*, animal:animals(id,tag_number,color)").order("recorded_at", { ascending: false }).order("created_at", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const [open, setOpen] = useState(false);
  return (
    <div>
      <PageHeader title="الأوزان" subtitle={`آخر ${fmtNum(data?.length ?? 0)} سجل`} action={auth.can("weights.write") && <Button onClick={() => setOpen(true)}><Plus /> تسجيل وزن</Button>} />
      {isLoading ? <Loading /> : !data?.length ? <EmptyState icon={<Scale />} title="لا توجد أوزان مسجلة" /> : (
        <GlassCard className="divide-y divide-border/60 p-0">
          {data.map((w) => (
            <div key={w.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Link to="/animals/$id" params={{ id: w.animal_id }} className="num grid size-11 place-items-center rounded-xl bg-brand/10 font-bold text-brand">{w.animal?.tag_number}</Link>
              <div className="flex-1">
                <p className="num text-lg font-bold">{fmtWeight(w.weight)}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(w.recorded_at)}{w.notes ? ` · ${w.notes}` : ""}</p>
              </div>
            </div>
          ))}
        </GlassCard>
      )}
      <WeightDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
