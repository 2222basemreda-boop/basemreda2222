import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, CalendarCheck, Loader2, Save, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { animalsQuery, customersQuery } from "@/lib/queries";
import { fmtMoney, invoiceTotal, today, toNum } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, EmptyState, GlassCard, Field, NativeSelect, SectionTitle } from "@/components/farm/ui";
import { SearchSelect } from "@/components/farm/SearchSelect";
import { InvoiceActions, InvoiceView, invoiceFromSale, type InvoiceData } from "@/components/farm/Invoice";

export const Route = createFileRoute("/_authenticated/sales/new")({
  head: () => ({
    meta: [
      { title: "بيع أو حجز — Elemam Farm" },
      { name: "description", content: "تسجيل بيع أو حجز كامل من شاشة واحدة في Elemam Farm." },
      { property: "og:title", content: "بيع أو حجز — Elemam Farm" },
      { property: "og:description", content: "بيع أو حجز من شاشة واحدة مع فاتورة جاهزة للطباعة عند البيع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewSalePage,
});

const PAYMENT_METHODS = ["نقدي", "تحويل بنكي", "محفظة إلكترونية", "شيك", "آجل"];
const BUSY_MSG = "هذا العجل محجوز أو مباع بالفعل ولا يمكن بيعه مرة أخرى.";

function NewSalePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: animals } = useQuery(animalsQuery);
  const { data: customers } = useQuery(customersQuery);

  const [flow, setFlow] = useState<"sale" | "reservation">("sale");
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [f, setF] = useState({
    customer_id: null as string | null,
    name: "",
    phone: "",
    address: "",
    code: "",
    animal_id: null as string | null,
    weight: "",
    price_per_kg: "",
    worker_tip: "",
    transportation: "",
    slaughtering: "",
    paid_amount: "",
    payment_method: PAYMENT_METHODS[0]!,
    sale_date: today(),
    notes: "",
  });
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const up = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const animalOptions = useMemo(
    () =>
      (animals ?? [])
        .filter((a) => a.status === "available")
        .map((a) => ({ value: a.id, label: a.tag_number, sub: `${a.color ?? ""} ${a.barn?.name ? "· " + a.barn.name : ""}`.trim(), keywords: a.color ?? "" })),
    [animals],
  );
  const customerOptions = useMemo(
    () => (customers ?? []).map((c) => ({ value: c.id, label: c.name, sub: c.code, keywords: `${c.phone ?? ""} ${c.address ?? ""}` })),
    [customers],
  );
  const animal = (animals ?? []).find((a) => a.id === f.animal_id) ?? null;

  const baseTotal = (toNum(f.weight) ?? 0) * (toNum(f.price_per_kg) ?? 0);
  const total = invoiceTotal(baseTotal, f.worker_tip, f.transportation, f.slaughtering);
  const paid = Math.min(toNum(f.paid_amount) ?? 0, total || Number.POSITIVE_INFINITY);
  const remaining = Math.max(total - paid, 0);
  const paymentStatus = total > 0 && paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";

  const pickAnimal = (id: string | null) => {
    const a = (animals ?? []).find((x) => x.id === id);
    if (a && a.status !== "available") {
      toast.error(BUSY_MSG);
      return;
    }
    setF((s) => ({ ...s, animal_id: id, weight: a?.current_weight ? String(a.current_weight) : s.weight }));
  };

  const nextCode = () => {
    const nums = (customers ?? []).map((c) => Number(String(c.code).replace(/\D/g, ""))).filter((n) => !Number.isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 100) + 1;
    return `C-${next}`;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!f.animal_id) throw new Error(flow === "sale" ? "اختر العجل المطلوب بيعه" : "اختر العجل المطلوب حجزه");
      const picked = (animals ?? []).find((a) => a.id === f.animal_id);
      if (picked && picked.status !== "available") throw new Error(BUSY_MSG);
      if (flow === "sale") {
        if ((toNum(f.weight) ?? 0) <= 0) throw new Error("أدخل وزن العجل");
        if ((toNum(f.price_per_kg) ?? 0) <= 0) throw new Error("أدخل سعر الكيلو");
        if (!f.sale_date) throw new Error("أدخل تاريخ البيع");
      }

      let customerId = f.customer_id;
      if (mode === "new") {
        if (!f.name.trim()) throw new Error("أدخل اسم العميل");
        const { data: created, error: cErr } = await supabase
          .from("customers")
          .insert({
            name: f.name.trim(),
            phone: f.phone.trim() || null,
            address: f.address.trim() || null,
            code: f.code.trim() || nextCode(),
          })
          .select("id")
          .single();
        if (cErr) throw new Error(cErr.message);
        customerId = created.id;
      } else if (!customerId) {
        throw new Error(flow === "sale" ? "اختر العميل المشتري" : "اختر العميل للحجز");
      }

      if (flow === "reservation") {
        const { error: reserveError } = await supabase.rpc("reserve_animal", {
          _animal_id: f.animal_id,
          _customer_id: customerId,
          _note: f.notes.trim() || null,
        });
        if (reserveError) throw new Error(reserveError.message);
        return null;
      }

      const { data: u } = await supabase.auth.getUser();
      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          animal_id: f.animal_id,
          customer_id: customerId,
          weight: toNum(f.weight)!,
          price_per_kg: toNum(f.price_per_kg)!,
          worker_tip: toNum(f.worker_tip) ?? 0,
          transportation: toNum(f.transportation) ?? 0,
          slaughtering: toNum(f.slaughtering) ?? 0,
          sale_date: f.sale_date,
          payment_status: paymentStatus,
          paid_amount: paid,
          payment_method: f.payment_method,
          notes: f.notes.trim() || null,
          created_by: u.user?.id ?? null,
        })
        .select("*, animal:animals(tag_number,color), customer:customers(name,code,phone,address)")
        .single();
      if (error) throw new Error(error.message);
      return sale;
    },
    onSuccess: async (sale) => {
      await qc.invalidateQueries();
      if (!sale) {
        toast.success("تم حجز العجل للعميل");
        navigate({ to: "/sales" });
        return;
      }
      toast.success(`تم تسجيل البيع — فاتورة ${sale.invoice_number ?? ""}`);
      setInvoice(invoiceFromSale(sale));
    },
    onError: (e: Error) => {
      const m = e.message;
      if (/ANIMAL_NOT_AVAILABLE|ANIMAL_ALREADY_SOLD/.test(m)) toast.error(BUSY_MSG);
      else if (/duplicate key/.test(m) && /code/.test(m)) toast.error("كود العميل مستخدم من قبل");
      else if (/row-level security/.test(m)) toast.error("ليس لديك صلاحية تسجيل المبيعات");
      else toast.error(m);
    },

  });

  if (!auth.can("sales.write")) return <EmptyState title="ليس لديك صلاحية تسجيل المبيعات" />;

  if (invoice) {
    return (
      <div>
        <PageHeader title="تمت عملية البيع" subtitle={`فاتورة رقم ${invoice.invoice_number}`} />
        <GlassCard>
          <InvoiceView data={invoice} />
          <div className="mt-4 space-y-2">
            <InvoiceActions data={invoice} />
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" className="flex-1" onClick={() => { setInvoice(null); setF((s) => ({ ...s, animal_id: null, weight: "", price_per_kg: "", worker_tip: "", transportation: "", slaughtering: "", paid_amount: "", notes: "", customer_id: null, name: "", phone: "", address: "", code: "" })); }}>
                بيع جديد
              </Button>
              <Button variant="outline" size="lg" className="flex-1" onClick={() => navigate({ to: "/sales" })}>
                سجل المبيعات
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div>
      <Link to="/sales" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowRight className="size-4" /> سجل المبيعات</Link>
      <PageHeader title="بيع أو حجز" subtitle="أكمل العملية من شاشة واحدة" />

      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="space-y-4 pb-24"
        noValidate
      >
        <GlassCard className="space-y-3">
          <SectionTitle className="mt-0">نوع العملية</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={flow === "sale" ? "default" : "outline"} size="lg" onClick={() => setFlow("sale")}>
              <Save /> Sale
            </Button>
            <Button type="button" variant={flow === "reservation" ? "default" : "outline"} size="lg" onClick={() => setFlow("reservation")}>
              <CalendarCheck /> Reservation
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="space-y-3">
          <SectionTitle className="mt-0">بيانات العميل</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={mode === "new" ? "default" : "outline"} size="lg" onClick={() => setMode("new")}>
              <UserPlus /> عميل جديد
            </Button>
            <Button type="button" variant={mode === "existing" ? "default" : "outline"} size="lg" onClick={() => setMode("existing")}>
              <Users /> عميل مسجل
            </Button>
          </div>
          {mode === "existing" ? (
            <Field label="اختر العميل" required>
              <SearchSelect options={customerOptions} value={f.customer_id} onChange={up("customer_id")} placeholder="ابحث بالاسم أو الكود أو الهاتف" />
            </Field>
          ) : (
            <>
              <Field label="اسم العميل" required>
                <Input value={f.name} onChange={(e) => up("name")(e.target.value)} placeholder="الاسم الكامل" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="رقم الهاتف">
                  <Input value={f.phone} onChange={(e) => up("phone")(e.target.value)} type="tel" inputMode="tel" className="num" dir="ltr" />
                </Field>
                <Field label="كود العميل" hint="يُنشأ تلقائياً إذا تُرك فارغاً">
                  <Input value={f.code} onChange={(e) => up("code")(e.target.value)} placeholder={nextCode()} className="num" />
                </Field>
              </div>
              <Field label="العنوان">
                <Input value={f.address} onChange={(e) => up("address")(e.target.value)} placeholder="المدينة / القرية / الشارع" />
              </Field>
            </>
          )}
        </GlassCard>

        <GlassCard className="space-y-3">
          <SectionTitle className="mt-0">بيانات العجل</SectionTitle>
          <Field label="اختر العجل (المتاح فقط)" required>
            <SearchSelect options={animalOptions} value={f.animal_id} onChange={pickAnimal} placeholder="ابحث برقم العجل" emptyText="لا توجد عجول متاحة" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="رقم العجل">
              <Input value={animal?.tag_number ?? ""} readOnly className="num" placeholder="—" />
            </Field>
            <Field label="اللون">
              <Input value={animal?.color ?? ""} readOnly placeholder="—" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الوزن (كجم)" required>
              <Input value={f.weight} onChange={(e) => up("weight")(e.target.value)} type="number" inputMode="decimal" step="0.5" min={0} className="num" />
            </Field>
            <Field label="سعر الكيلو (ج.م)" required>
              <Input value={f.price_per_kg} onChange={(e) => up("price_per_kg")(e.target.value)} type="number" inputMode="decimal" step="0.5" min={0} className="num" />
            </Field>
          </div>
        </GlassCard>

        {flow === "sale" && <GlassCard className="space-y-3">
          <SectionTitle className="mt-0">الدفع</SectionTitle>
          <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
            <span className="text-sm text-muted-foreground">إجمالي الوزن والسعر</span>
            <span className="num text-xl text-brand">{fmtMoney(baseTotal)}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Workers’ Tip">
              <Input value={f.worker_tip} onChange={(e) => up("worker_tip")(e.target.value)} type="number" inputMode="decimal" min={0} className="num" />
            </Field>
            <Field label="Transportation">
              <Input value={f.transportation} onChange={(e) => up("transportation")(e.target.value)} type="number" inputMode="decimal" min={0} className="num" />
            </Field>
            <Field label="Slaughtering">
              <Input value={f.slaughtering} onChange={(e) => up("slaughtering")(e.target.value)} type="number" inputMode="decimal" min={0} className="num" />
            </Field>
          </div>
          <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
            <span className="text-sm text-muted-foreground">الإجمالي النهائي</span>
            <span className="num text-xl text-brand">{fmtMoney(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="المبلغ المدفوع (ج.م)">
              <Input value={f.paid_amount} onChange={(e) => up("paid_amount")(e.target.value)} type="number" inputMode="decimal" min={0} className="num" />
            </Field>
            <Field label="طريقة الدفع">
              <NativeSelect value={f.payment_method} onChange={(e) => up("payment_method")(e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
            <span className="text-sm text-muted-foreground">المبلغ المتبقي</span>
            <span className="num text-xl text-amber">{fmtMoney(remaining)}</span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Field label="تاريخ البيع" required>
              <Input value={f.sale_date} onChange={(e) => up("sale_date")(e.target.value)} type="date" className="num" />
            </Field>
            <Field label="ملاحظات">
              <Textarea value={f.notes} onChange={(e) => up("notes")(e.target.value)} rows={2} />
            </Field>
          </div>
        </GlassCard>}

        {flow === "reservation" && (
          <GlassCard className="space-y-3">
            <SectionTitle className="mt-0">الحجز</SectionTitle>
            <Field label="تاريخ الحجز">
              <Input value={f.sale_date} onChange={(e) => up("sale_date")(e.target.value)} type="date" className="num" />
            </Field>
            <Field label="ملاحظات">
              <Textarea value={f.notes} onChange={(e) => up("notes")(e.target.value)} rows={2} />
            </Field>
          </GlassCard>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : flow === "sale" ? <Save /> : <CalendarCheck />} {flow === "sale" ? "حفظ البيع وإصدار الفاتورة" : "حفظ الحجز"}
        </Button>
      </form>
    </div>
  );
}
