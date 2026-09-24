import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { animalsQuery, barnsQuery } from "@/lib/queries";
import { fmtNum, fmtWeight, fmtDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { PageHeader, Loading, EmptyState, GlassCard, Field, NativeSelect } from "@/components/farm/ui";

export const Route = createFileRoute("/_authenticated/weight-report")({
  head: () => ({ meta: [{ title: "تقرير زيادة الوزن — Elemam Farm" }, { name: "description", content: "الزيادة اليومية في وزن العجول مرتبة من الأعلى للأقل." }, { property: "og:title", content: "تقرير زيادة الوزن — Elemam Farm" }, { property: "og:description", content: "الزيادة اليومية في وزن العجول." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: WeightReport,
});

const DAY = 86400000;
const days = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / DAY));

function WeightReport() {
  const { data: animals, isLoading } = useQuery(animalsQuery);
  const { data: barns } = useQuery(barnsQuery);
  const { data: weights } = useQuery({
    queryKey: ["weight_records", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("weight_records").select("animal_id, weight, recorded_at, created_at").order("recorded_at").order("created_at");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [barn, setBarn] = useState("");
  const [calf, setCalf] = useState("");

  const rows = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    return (animals ?? [])
      .filter((a) => (!barn || a.barn_id === barn) && (!calf || a.id === calf))
      .map((a) => {
        const w = (weights ?? []).filter((x) => x.animal_id === a.id && (!from || x.recorded_at >= from) && (!to || x.recorded_at <= to));
        if (!w.length) return null;
        const first = w[0], last = w[w.length - 1];
        const gain = Number(last.weight) - Number(first.weight);
        const span = days(first.recorded_at, last.recorded_at);
        return {
          a, start: Number(first.weight), current: Number(last.weight), gain, last: last.recorded_at,
          farmDays: days(a.entry_date, to && to < todayISO ? to : todayISO),
          adg: span > 0 ? gain / span : null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => !!r)
      .sort((x, y) => (y.adg ?? -Infinity) - (x.adg ?? -Infinity));
  }, [animals, weights, from, to, barn, calf]);

  const withAdg = rows.filter((r) => r.adg != null);
  const avgAdg = withAdg.length ? withAdg.reduce((s, r) => s + (r.adg ?? 0), 0) / withAdg.length : null;

  return (
    <div>
      <PageHeader title="تقرير زيادة الوزن" subtitle={`${fmtNum(rows.length)} عجل · مرتبة من الأعلى زيادة يومية`} />
      <GlassCard className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="من تاريخ"><Input type="date" className="num" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="إلى تاريخ"><Input type="date" className="num" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="الحظيرة">
          <NativeSelect value={barn} onChange={(e) => setBarn(e.target.value)}>
            <option value="">كل الحظائر</option>
            {(barns ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="العجل">
          <NativeSelect value={calf} onChange={(e) => setCalf(e.target.value)}>
            <option value="">كل العجول</option>
            {(animals ?? []).map((a) => <option key={a.id} value={a.id}>{a.tag_number}</option>)}
          </NativeSelect>
        </Field>
      </GlassCard>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="tile-brand rounded-3xl p-4"><p className="text-xs opacity-90">متوسط الزيادة اليومية</p><p className="num mt-1 text-2xl">{avgAdg != null ? `${avgAdg.toFixed(2)} كجم/يوم` : "—"}</p></div>
        <GlassCard><p className="text-xs text-muted-foreground">إجمالي الزيادة</p><p className="num mt-1 text-2xl text-brand">{fmtWeight(rows.reduce((s, r) => s + r.gain, 0))}</p></GlassCard>
      </div>
      {isLoading ? <Loading /> : !rows.length ? <EmptyState icon={<TrendingUp />} title="لا توجد أوزان في هذه الفترة" /> : (
        <GlassCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-brand/10 text-xs text-muted-foreground">
              <tr>{["#", "رقم العجل", "وزن البداية", "الوزن الحالي", "إجمالي الزيادة", "أيام في المزرعة", "الزيادة اليومية", "آخر وزن"].map((h) => <th key={h} className="px-3 py-2 text-start font-bold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((r, i) => (
                <tr key={r.a.id}>
                  <td className="num px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2"><Link to="/animals/$id" params={{ id: r.a.id }} className="num font-bold text-brand">{r.a.tag_number}</Link></td>
                  <td className="num px-3 py-2">{fmtWeight(r.start)}</td>
                  <td className="num px-3 py-2 font-bold">{fmtWeight(r.current)}</td>
                  <td className={`num px-3 py-2 font-bold ${r.gain < 0 ? "text-destructive" : "text-brand"}`}>{fmtWeight(r.gain)}</td>
                  <td className="num px-3 py-2">{fmtNum(r.farmDays)}</td>
                  <td className="num px-3 py-2 font-bold">{r.adg != null ? `${r.adg.toFixed(2)} كجم/يوم` : "—"}</td>
                  <td className="px-3 py-2">{fmtDate(r.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}
    </div>
  );
}
