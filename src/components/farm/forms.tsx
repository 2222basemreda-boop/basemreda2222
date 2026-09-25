import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "./ui";
import { FormDialog } from "./FormDialog";
import { SearchSelect } from "./SearchSelect";
import { animalsQuery, barnsQuery, customersQuery, suppliersQuery, type Supplier, type Animal, type Barn, type Customer, type FeedRecord, type Sale, type Treatment, type WeightRecord } from "@/lib/queries";
import { STATUS_LABELS, PAYMENT_LABELS, type AnimalStatus, type PaymentStatus } from "@/lib/labels";
import { fmtMoney, invoiceTotal, today, toNum } from "@/lib/format";

/* ---------- helpers ---------- */

function useSave<TVars>(fn: (v: TVars) => Promise<void>, onDone: () => void, success = "تم الحفظ بنجاح") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await qc.invalidateQueries();
      toast.success(success);
      onDone();
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });
}

function friendly(msg: string) {
  if (/ANIMAL_NOT_AVAILABLE|ANIMAL_ALREADY_SOLD/.test(msg)) return "هذا العجل محجوز أو مباع بالفعل ولا يمكن بيعه مرة أخرى.";
  if (/ANIMAL_NOT_FOUND/.test(msg)) return "الحيوان غير موجود";
  if (/NOT_RESERVED/.test(msg)) return "هذا الحيوان غير محجوز حالياً";
  if (/SALE_ALREADY_CANCELLED/.test(msg)) return "تم إلغاء هذا البيع مسبقاً";
  if (/SALE_NOT_FOUND/.test(msg)) return "عملية البيع غير موجودة";
  if (/NOT_AUTHORIZED/.test(msg)) return "ليس لديك صلاحية لتنفيذ هذا الإجراء";
  if (/duplicate key/.test(msg) && /tag_number/.test(msg)) return "رقم الحيوان مستخدم من قبل";
  if (/duplicate key/.test(msg) && /code/.test(msg)) return "كود العميل مستخدم من قبل";
  if (/duplicate key/.test(msg) && /barns_name/.test(msg)) return "اسم الحظيرة مستخدم من قبل";
  if (/row-level security/.test(msg)) return "ليس لديك صلاحية لتنفيذ هذا الإجراء";
  return msg;
}


function firstIssue(res: z.SafeParseReturnType<unknown, unknown>) {
  if (res.success) return null;
  return res.error.issues[0]?.message ?? "بيانات غير صحيحة";
}

const numField = (label: string, min = 0) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number({ invalid_type_error: `${label} يجب أن يكون رقماً` }).min(min, `${label} غير صحيح`));

const optNum = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).nullable());
const optText = (max = 500) => z.string().trim().max(max, "النص طويل جداً").transform((s) => (s === "" ? null : s));

function useAnimalOptions(filter?: (a: Animal) => boolean) {
  const { data } = useQuery(animalsQuery);
  return useMemo(
    () =>
      (data ?? [])
        .filter((a) => (filter ? filter(a) : true))
        .map((a) => ({ value: a.id, label: a.tag_number, sub: `${a.color ?? ""} ${a.barn?.name ? "· " + a.barn.name : ""}`.trim(), keywords: `${a.customer?.name ?? ""} ${a.customer?.code ?? ""}` })),
    [data, filter],
  );
}

function useCustomerOptions() {
  const { data } = useQuery(customersQuery);
  return useMemo(() => (data ?? []).map((c) => ({ value: c.id, label: c.name, sub: c.code, keywords: c.phone ?? "" })), [data]);
}

function useBarns() {
  return useQuery(barnsQuery).data ?? [];
}

type DialogProps = { open: boolean; onOpenChange: (o: boolean) => void };

/* ---------- Animal ---------- */

const animalSchema = z.object({
  tag_number: z.string().trim().min(1, "رقم الحيوان مطلوب").max(40, "رقم الحيوان طويل جداً"),
  color: optText(60),
  current_weight: optNum,
  entry_date: z.string().min(1, "التاريخ مطلوب"),
  barn_id: z.string().nullable(),
  customer_id: z.string().nullable(),
  supplier_name: optText(120),
  supplier_id: z.string().nullable(),
  supplier_cost: optNum,
  supplier_paid: optNum,
  status: z.enum(["available", "reserved"]),
  notes: optText(1000),
});

export function AnimalDialog({ open, onOpenChange, initial, defaultBarnId, defaultCustomerId, defaultSupplierId }: DialogProps & { initial?: Animal | null; defaultBarnId?: string | null; defaultCustomerId?: string | null; defaultSupplierId?: string | null }) {
  const blank = () => ({
    tag_number: "", color: "", current_weight: "", entry_date: today(),
    barn_id: defaultBarnId ?? null, customer_id: defaultCustomerId ?? null, supplier_name: "", supplier_id: defaultSupplierId ?? null, supplier_cost: "", supplier_paid: "", status: defaultCustomerId ? "reserved" as AnimalStatus : "available" as AnimalStatus, notes: "",
  });
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setF(
      initial
        ? {
            tag_number: initial.tag_number, color: initial.color ?? "", current_weight: String(initial.current_weight ?? ""),
            entry_date: initial.entry_date, barn_id: initial.barn_id, customer_id: initial.customer_id, supplier_name: initial.supplier_name ?? "", supplier_id: initial.supplier_id, supplier_cost: initial.supplier_cost == null ? "" : String(initial.supplier_cost), supplier_paid: initial.supplier_paid ? String(initial.supplier_paid) : "",
            status: initial.status, notes: initial.notes ?? "",
          }
        : blank(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const barns = useBarns();
  const suppliers = useQuery(suppliersQuery).data ?? [];
  const isSold = initial?.status === "sold";

  const save = useSave(async () => {
    const parsed = animalSchema.safeParse({ ...f, status: isSold ? "available" : f.status });
    const err = firstIssue(parsed);
    if (err || !parsed.success) throw new Error(err ?? "");
    const d = parsed.data;
    if (d.status === "reserved" && !d.customer_id) throw new Error("استخدم خيار حجز من المبيعات لحجز الحيوان لعميل");
    if ((d.supplier_paid ?? 0) > 0 && d.supplier_cost == null) throw new Error("أدخل تكلفة المورد أولاً");
    if (d.supplier_cost != null && (d.supplier_paid ?? 0) > d.supplier_cost) throw new Error("المدفوع أكبر من تكلفة المورد");
    const sup = suppliers.find((x) => x.id === d.supplier_id);
    const payload = {
      tag_number: d.tag_number, color: d.color, entry_date: d.entry_date, barn_id: d.barn_id,
      customer_id: d.customer_id, supplier_name: sup ? sup.name : d.supplier_name, notes: d.notes,
      supplier_id: d.supplier_id, supplier_cost: d.supplier_cost, supplier_paid: d.supplier_paid ?? 0,
      ...(isSold ? {} : { status: d.status }),
    };
    if (initial) {
      const { error } = await supabase.from("animals").update(payload).eq("id", initial.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("animals").insert({ ...payload, current_weight: d.current_weight, created_by: u.user?.id ?? null });
      if (error) throw new Error(error.message);
    }
  }, () => onOpenChange(false), initial ? "تم تحديث بيانات الحيوان" : "تمت إضافة الحيوان");

  const set = (k: keyof typeof f) => (v: string | null) => setF((s) => ({ ...s, [k]: v }));

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={initial ? `تعديل الحيوان ${initial.tag_number}` : "إضافة حيوان جديد"} onSubmit={() => save.mutate(undefined)} submitting={save.isPending}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="رقم الحيوان" required>
          <Input value={f.tag_number} onChange={(e) => set("tag_number")(e.target.value)} inputMode="numeric" placeholder="مثال: 1042" className="num" autoFocus />
        </Field>
        <Field label="اللون">
          <Input value={f.color} onChange={(e) => set("color")(e.target.value)} placeholder="مثال: أحمر" />
        </Field>
        {!initial && (
          <Field label="الوزن الحالي (كجم)">
            <Input value={f.current_weight} onChange={(e) => set("current_weight")(e.target.value)} type="number" inputMode="decimal" step="0.5" min={0} placeholder="0" className="num" />
          </Field>
        )}
        <Field label="تاريخ الدخول" required>
          <Input value={f.entry_date} onChange={(e) => set("entry_date")(e.target.value)} type="date" className="num" />
        </Field>
      </div>
      <Field label="الحظيرة">
        <NativeSelect value={f.barn_id ?? ""} onChange={(e) => set("barn_id")(e.target.value || null)}>
          <option value="">بدون حظيرة</option>
          {barns.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </NativeSelect>
      </Field>
      <Field label="المورد" {...(!f.supplier_id && f.supplier_name ? { hint: `اسم المورد المسجل: ${f.supplier_name}` } : {})}>
        <NativeSelect value={f.supplier_id ?? ""} onChange={(e) => set("supplier_id")(e.target.value || null)}>
          <option value="">بدون مورد</option>
          {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="تكلفة المورد (ج.م)">
          <Input value={f.supplier_cost} onChange={(e) => set("supplier_cost")(e.target.value)} type="number" inputMode="decimal" min={0} className="num" placeholder="0" />
        </Field>
        <Field label="المدفوع للعجل">
          <Input value={f.supplier_paid} onChange={(e) => set("supplier_paid")(e.target.value)} type="number" inputMode="decimal" min={0} className="num" placeholder="0" />
        </Field>
        <Field label="المتبقي">
          <div className="num flex h-12 items-center rounded-2xl bg-muted px-3 font-bold">{fmtMoney((toNum(f.supplier_cost) ?? 0) - (toNum(f.supplier_paid) ?? 0))}</div>
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">تكلفة المورد منفصلة تماماً عن سعر البيع.</p>
      {!isSold && (
        <Field label="الحالة">
          <div className="grid grid-cols-2 gap-2">
            {(["available", "reserved"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("status")(s)}
                className={`tap rounded-2xl border text-sm font-bold transition-colors ${f.status === s ? (s === "available" ? "border-brand bg-brand text-primary-foreground" : "border-amber bg-amber text-accent-foreground") : "glass border-transparent"}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label="ملاحظات">
        <Textarea value={f.notes} onChange={(e) => set("notes")(e.target.value)} rows={2} />
      </Field>
      {initial && <p className="text-xs text-muted-foreground">لتسجيل وزن جديد استخدم زر «تسجيل وزن» من صفحة الحيوان.</p>}
    </FormDialog>
  );
}

/* ---------- Weight ---------- */

const weightSchema = z.object({
  animal_id: z.string().min(1, "اختر الحيوان"),
  weight: numField("الوزن", 0.1),
  recorded_at: z.string().min(1, "التاريخ مطلوب"),
  notes: optText(500),
});

export function WeightDialog({ open, onOpenChange, animalId, initial }: DialogProps & { animalId?: string; initial?: WeightRecord | null }) {
  const [f, setF] = useState({ animal_id: animalId ?? "", weight: "", recorded_at: today(), notes: "" });
  useEffect(() => {
    if (!open) return;
    setF(initial ? { animal_id: initial.animal_id, weight: String(initial.weight), recorded_at: initial.recorded_at.slice(0, 10), notes: initial.notes ?? "" } : { animal_id: animalId ?? "", weight: "", recorded_at: today(), notes: "" });
  }, [open, animalId, initial]);
  const animals = useAnimalOptions();

  const save = useSave(async () => {
    const parsed = weightSchema.safeParse(f);
    const err = firstIssue(parsed);
    if (err || !parsed.success) throw new Error(err ?? "");
    const d = parsed.data;
    if (initial) {
      const { error } = await supabase.from("weight_records").update({ weight: d.weight, recorded_at: d.recorded_at, notes: d.notes }).eq("id", initial.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("weight_records").insert({ animal_id: d.animal_id, weight: d.weight, recorded_at: d.recorded_at, notes: d.notes, recorded_by: u.user?.id ?? null });
      if (error) throw new Error(error.message);
    }
  }, () => onOpenChange(false), "تم تسجيل الوزن");

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={initial ? "تعديل سجل الوزن" : "تسجيل وزن جديد"} onSubmit={() => save.mutate(undefined)} submitting={save.isPending}>
      {!animalId && !initial && (
        <Field label="الحيوان" required>
          <SearchSelect options={animals} value={f.animal_id || null} onChange={(v) => setF((s) => ({ ...s, animal_id: v ?? "" }))} placeholder="اختر رقم الحيوان" allowClear={false} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="الوزن (كجم)" required>
          <Input value={f.weight} onChange={(e) => setF((s) => ({ ...s, weight: e.target.value }))} type="number" inputMode="decimal" step="0.5" min={0} className="num text-xl" autoFocus />
        </Field>
        <Field label="تاريخ الوزن" required>
          <Input value={f.recorded_at} onChange={(e) => setF((s) => ({ ...s, recorded_at: e.target.value }))} type="date" className="num" />
        </Field>
      </div>
      <Field label="ملاحظات">
        <Textarea value={f.notes} onChange={(e) => setF((s) => ({ ...s, notes: e.target.value }))} rows={2} />
      </Field>
    </FormDialog>
  );
}

/* ---------- Move barn ---------- */

export function MoveBarnDialog({ open, onOpenChange, animal }: DialogProps & { animal: Animal | null }) {
  const [to, setTo] = useState<string>("");
  useEffect(() => { if (open) setTo(""); }, [open]);
  const barns = useBarns();

  const save = useSave(async () => {
    if (!animal) return;
    const target = to || null;
    if (target === animal.barn_id) throw new Error("اختر حظيرة مختلفة عن الحالية");
    const { error } = await supabase.from("animals").update({ barn_id: target }).eq("id", animal.id);
    if (error) throw new Error(error.message);
  }, () => onOpenChange(false), "تم نقل الحيوان");

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`نقل الحيوان ${animal?.tag_number ?? ""}`} description="سيتم تسجيل حركة النقل في سجل الحيوان." onSubmit={() => save.mutate(undefined)} submitting={save.isPending} submitLabel="نقل">
      <Field label="إلى الحظيرة" required>
        <div className="grid grid-cols-2 gap-2">
          {barns.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={b.id === animal?.barn_id}
              onClick={() => setTo(b.id)}
              className={`tap rounded-2xl border px-3 text-sm font-bold transition-colors disabled:opacity-40 ${to === b.id ? "border-brand bg-brand text-primary-foreground" : "glass border-transparent"}`}
            >
              {b.name}
              {b.id === animal?.barn_id && <span className="block text-[10px] font-normal opacity-80">الحالية</span>}
            </button>
          ))}
          {animal?.barn_id && (
            <button type="button" onClick={() => setTo("")} className={`tap rounded-2xl border px-3 text-sm font-bold ${to === "" ? "border-brand bg-brand text-primary-foreground" : "glass border-transparent"}`}>
              بدون حظيرة
            </button>
          )}
        </div>
      </Field>
    </FormDialog>
  );
}

/* ---------- Treatment ---------- */

const treatmentSchema = z.object({
  record_type: z.enum(["treatment", "vaccination"]),
  animal_id: z.string().min(1, "اختر الحيوان"),
  treatment_date: z.string().min(1, "التاريخ مطلوب"),
  second_dose_date: z.string().nullable(),
  diagnosis: z.string().trim().min(1, "المشكلة / التشخيص مطلوب").max(300),
  medicine: optText(200),
  dose: optText(100),
  notes: optText(1000),
});

export function TreatmentDialog({ open, onOpenChange, animalId, initial }: DialogProps & { animalId?: string; initial?: Treatment | null }) {
  const blank = () => ({ record_type: "treatment" as "treatment" | "vaccination", animal_id: animalId ?? "", treatment_date: today(), second_dose_date: "", diagnosis: "", medicine: "", dose: "", notes: "" });
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setF(initial ? { record_type: initial.record_type === "vaccination" ? "vaccination" : "treatment", animal_id: initial.animal_id, treatment_date: initial.first_dose_date ?? initial.treatment_date, second_dose_date: initial.second_dose_date ?? "", diagnosis: initial.diagnosis, medicine: initial.medicine ?? "", dose: initial.dose ?? "", notes: initial.notes ?? "" } : blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, animalId, initial?.id]);
  const animals = useAnimalOptions();
  const up = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = useSave(async () => {
    const parsed = treatmentSchema.safeParse(f);
    const err = firstIssue(parsed);
    if (err || !parsed.success) throw new Error(err ?? "");
    const d = parsed.data;
    const payload = { ...d, first_dose_date: d.record_type === "vaccination" ? d.treatment_date : null, second_dose_date: d.record_type === "vaccination" ? d.second_dose_date || null : null };
    if (initial) {
      const { error } = await supabase.from("treatments").update(payload).eq("id", initial.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("treatments").insert({ ...payload, created_by: u.user?.id ?? null });
      if (error) throw new Error(error.message);
    }
  }, () => onOpenChange(false), f.record_type === "vaccination" ? "تم حفظ التحصين" : "تم حفظ العلاج");

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={initial ? `تعديل ${f.record_type === "vaccination" ? "التحصين" : "العلاج"}` : `تسجيل ${f.record_type === "vaccination" ? "تحصين" : "علاج"}`} onSubmit={() => save.mutate(undefined)} submitting={save.isPending}>
      <Field label="نوع السجل" required>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => up("record_type")("treatment")} className={`tap rounded-2xl border text-sm font-bold ${f.record_type === "treatment" ? "border-brand bg-brand text-primary-foreground" : "glass border-transparent"}`}>علاج</button>
          <button type="button" onClick={() => up("record_type")("vaccination")} className={`tap rounded-2xl border text-sm font-bold ${f.record_type === "vaccination" ? "border-brand bg-brand text-primary-foreground" : "glass border-transparent"}`}>تحصين</button>
        </div>
      </Field>
      {!animalId && !initial && (
        <Field label="الحيوان" required>
          <SearchSelect options={animals} value={f.animal_id || null} onChange={(v) => up("animal_id")(v ?? "")} placeholder="اختر رقم الحيوان" allowClear={false} />
        </Field>
      )}
      <Field label={f.record_type === "vaccination" ? "تاريخ الجرعة الأولى" : "تاريخ العلاج"} required>
        <Input value={f.treatment_date} onChange={(e) => up("treatment_date")(e.target.value)} type="date" className="num" />
      </Field>
      {f.record_type === "vaccination" && <Field label="تاريخ الجرعة الثانية">
        <Input value={f.second_dose_date} onChange={(e) => up("second_dose_date")(e.target.value)} type="date" className="num" min={f.treatment_date} />
      </Field>}
      <Field label={f.record_type === "vaccination" ? "اسم التحصين" : "المشكلة / التشخيص"} required>
        <Input value={f.diagnosis} onChange={(e) => up("diagnosis")(e.target.value)} placeholder={f.record_type === "vaccination" ? "مثال: الحمى القلاعية" : "مثال: ارتفاع حرارة"} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={f.record_type === "vaccination" ? "اللقاح" : "الدواء"}>
          <Input value={f.medicine} onChange={(e) => up("medicine")(e.target.value)} />
        </Field>
        <Field label="الجرعة">
          <Input value={f.dose} onChange={(e) => up("dose")(e.target.value)} placeholder="مثال: 10 مل" />
        </Field>
      </div>
      <Field label="ملاحظات">
        <Textarea value={f.notes} onChange={(e) => up("notes")(e.target.value)} rows={2} />
      </Field>
    </FormDialog>
  );
}

/* ---------- Sale ---------- */

const saleSchema = z.object({
  animal_id: z.string().min(1, "اختر الحيوان"),
  customer_id: z.string().nullable(),
  weight: numField("الوزن", 0.1),
  price_per_kg: numField("سعر الكيلو", 0.01),
  sale_date: z.string().min(1, "التاريخ مطلوب"),
  payment_status: z.enum(["paid", "partial", "unpaid"]),
  paid_amount: optNum,
  worker_tip: optNum,
  transportation: optNum,
  slaughtering: optNum,
  notes: optText(1000),
});

export function SaleDialog({ open, onOpenChange, animal, initial }: DialogProps & { animal?: Animal | null; initial?: Sale | null }) {
  const blank = () => ({
    animal_id: animal?.id ?? "", customer_id: animal?.customer_id ?? null, weight: animal?.current_weight ? String(animal.current_weight) : "",
    price_per_kg: "", sale_date: today(), payment_status: "unpaid" as PaymentStatus, paid_amount: "", worker_tip: "", transportation: "", slaughtering: "", notes: "",
  });
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setF(
      initial
        ? { animal_id: initial.animal_id, customer_id: initial.customer_id, weight: String(initial.weight), price_per_kg: String(initial.price_per_kg), sale_date: initial.sale_date, payment_status: initial.payment_status, paid_amount: String(initial.paid_amount ?? ""), worker_tip: String(initial.worker_tip ?? ""), transportation: String(initial.transportation ?? ""), slaughtering: String(initial.slaughtering ?? ""), notes: initial.notes ?? "" }
        : blank(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, animal?.id, initial?.id]);

  const { data: allAnimals } = useQuery(animalsQuery);
  const animals = useAnimalOptions((a) => a.status === "available");
  const customers = useCustomerOptions();
  const up = (k: keyof typeof f) => (v: string | null) => setF((s) => ({ ...s, [k]: v }));
  const baseTotal = (toNum(f.weight) ?? 0) * (toNum(f.price_per_kg) ?? 0);
  const total = invoiceTotal(baseTotal, f.worker_tip, f.transportation, f.slaughtering);

  // When the user picks an animal from the list, propose its current weight and linked customer (real data, editable).
  const pickAnimal = (id: string | null) => {
    const a = allAnimals?.find((x) => x.id === id);
    setF((s) => ({ ...s, animal_id: id ?? "", weight: a?.current_weight ? String(a.current_weight) : s.weight, customer_id: a?.customer_id ?? s.customer_id }));
  };

  const save = useSave(async () => {
    const parsed = saleSchema.safeParse(f);
    const err = firstIssue(parsed);
    if (err || !parsed.success) throw new Error(err ?? "");
    const d = parsed.data;
    if (!d.customer_id) throw new Error("اختر العميل المشتري");
    const paid = d.payment_status === "paid" ? total : d.payment_status === "unpaid" ? 0 : (d.paid_amount ?? 0);
    if (d.payment_status === "partial" && paid <= 0) throw new Error("أدخل المبلغ المدفوع");
    const payload = { animal_id: d.animal_id, customer_id: d.customer_id, weight: d.weight, price_per_kg: d.price_per_kg, worker_tip: d.worker_tip ?? 0, transportation: d.transportation ?? 0, slaughtering: d.slaughtering ?? 0, sale_date: d.sale_date, payment_status: d.payment_status, paid_amount: paid, notes: d.notes };
    if (initial) {
      const { error } = await supabase.from("sales").update(payload).eq("id", initial.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("sales").insert({ ...payload, created_by: u.user?.id ?? null });
      if (error) throw new Error(error.message);
    }
  }, () => onOpenChange(false), initial ? "تم تحديث عملية البيع" : "تم تسجيل البيع");

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={initial ? "تعديل عملية بيع" : animal ? `بيع الحيوان ${animal.tag_number}` : "تسجيل عملية بيع"} onSubmit={() => save.mutate(undefined)} submitting={save.isPending} submitLabel={initial ? "حفظ" : "تأكيد البيع"}>
      {!animal && !initial && (
        <Field label="الحيوان" required>
          <SearchSelect options={animals} value={f.animal_id || null} onChange={pickAnimal} placeholder="اختر رقم الحيوان" allowClear={false} />
        </Field>
      )}
      <Field label="العميل المشتري" required>
        <SearchSelect options={customers} value={f.customer_id} onChange={up("customer_id")} placeholder="اختر العميل" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الوزن (كجم)" required>
          <Input value={f.weight} onChange={(e) => up("weight")(e.target.value)} type="number" inputMode="decimal" step="0.5" min={0} className="num" />
        </Field>
        <Field label="سعر الكيلو (ج.م)" required>
          <Input value={f.price_per_kg} onChange={(e) => up("price_per_kg")(e.target.value)} type="number" inputMode="decimal" step="0.5" min={0} className="num" autoFocus={!!animal} />
        </Field>
      </div>
      <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
        <span className="text-sm text-muted-foreground">إجمالي الوزن والسعر</span>
        <span className="num text-xl text-brand">{fmtMoney(baseTotal)}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="إكرامية عمال">
          <Input value={f.worker_tip} onChange={(e) => up("worker_tip")(e.target.value)} type="number" inputMode="decimal" min={0} className="num" />
        </Field>
        <Field label="نقل">
          <Input value={f.transportation} onChange={(e) => up("transportation")(e.target.value)} type="number" inputMode="decimal" min={0} className="num" />
        </Field>
        <Field label="دبح">
          <Input value={f.slaughtering} onChange={(e) => up("slaughtering")(e.target.value)} type="number" inputMode="decimal" min={0} className="num" />
        </Field>
      </div>
      <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
        <span className="text-sm text-muted-foreground">الإجمالي النهائي</span>
        <span className="num text-xl text-brand">{fmtMoney(total)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="تاريخ البيع" required>
          <Input value={f.sale_date} onChange={(e) => up("sale_date")(e.target.value)} type="date" className="num" />
        </Field>
        <Field label="حالة الدفع">
          <NativeSelect value={f.payment_status} onChange={(e) => up("payment_status")(e.target.value)}>
            {(Object.keys(PAYMENT_LABELS) as PaymentStatus[]).map((k) => <option key={k} value={k}>{PAYMENT_LABELS[k]}</option>)}
          </NativeSelect>
        </Field>
      </div>
      {f.payment_status === "partial" && (
        <Field label="المبلغ المدفوع (ج.م)" required>
          <Input value={f.paid_amount} onChange={(e) => up("paid_amount")(e.target.value)} type="number" inputMode="decimal" min={0} className="num" />
        </Field>
      )}
      <Field label="ملاحظات">
        <Textarea value={f.notes} onChange={(e) => up("notes")(e.target.value)} rows={2} />
      </Field>
    </FormDialog>
  );
}

/* ---------- Feed ---------- */

function FeedPerCalfPreview({ barnId, day, quantity, unit }: { barnId: string | null; day: string; quantity: string; unit: string }) {
  const { data: count } = useQuery({
    queryKey: ["animals_in_barn_on", barnId, day],
    enabled: !!day,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("animals_in_barn_on", { _barn_id: barnId as string, _day: day });
      if (error) throw new Error(error.message);
      return data as number;
    },
  });
  const q = Number(quantity) || 0;
  const avg = count && q ? q / count : null;
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-brand/10 p-3 text-sm">
      <div><p className="text-xs text-muted-foreground">عدد العجول في ذلك اليوم</p><p className="num text-lg font-bold">{count ?? "—"}</p></div>
      <div><p className="text-xs text-muted-foreground">متوسط استهلاك العجل / يوم</p><p className="num text-lg font-bold text-brand">{avg != null ? `${avg.toFixed(2)} ${unit}` : "—"}</p></div>
    </div>
  );
}

const feedSchema = z.object({
  barn_id: z.string().nullable(),
  feed_date: z.string().min(1, "التاريخ مطلوب"),
  feed_type: z.string().trim().min(1, "نوع العلف مطلوب").max(100),
  quantity: numField("الكمية", 0.01),
  unit: z.string().trim().min(1).max(20),
  cost: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().min(0, "التكلفة غير صحيحة")),
  notes: optText(500),
});

export function FeedDialog({ open, onOpenChange, initial, defaultBarnId }: DialogProps & { initial?: FeedRecord | null; defaultBarnId?: string | null }) {
  const blank = () => ({ barn_id: defaultBarnId ?? null, feed_date: today(), feed_type: "", quantity: "", unit: "كجم", cost: "", notes: "" });
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setF(initial ? { barn_id: initial.barn_id, feed_date: initial.feed_date, feed_type: initial.feed_type, quantity: String(initial.quantity), unit: initial.unit, cost: String(initial.cost), notes: initial.notes ?? "" } : blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);
  const barns = useBarns();
  const up = (k: keyof typeof f) => (v: string | null) => setF((s) => ({ ...s, [k]: v }));

  const save = useSave(async () => {
    const parsed = feedSchema.safeParse(f);
    const err = firstIssue(parsed);
    if (err || !parsed.success) throw new Error(err ?? "");
    const d = parsed.data;
    if (initial) {
      const { error } = await supabase.from("feed_records").update(d).eq("id", initial.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("feed_records").insert({ ...d, created_by: u.user?.id ?? null });
      if (error) throw new Error(error.message);
    }
  }, () => onOpenChange(false), "تم حفظ سجل التغذية");

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={initial ? "تعديل سجل تغذية" : "تسجيل تغذية"} onSubmit={() => save.mutate(undefined)} submitting={save.isPending}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الحظيرة">
          <NativeSelect value={f.barn_id ?? ""} onChange={(e) => up("barn_id")(e.target.value || null)}>
            <option value="">عام / كل الحظائر</option>
            {barns.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="التاريخ" required>
          <Input value={f.feed_date} onChange={(e) => up("feed_date")(e.target.value)} type="date" className="num" />
        </Field>
      </div>
      <Field label="نوع العلف" required>
        <Input value={f.feed_type} onChange={(e) => up("feed_type")(e.target.value)} placeholder="مثال: علف مركز، برسيم، تبن" autoFocus />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="الكمية" required>
          <Input value={f.quantity} onChange={(e) => up("quantity")(e.target.value)} type="number" inputMode="decimal" step="0.5" min={0} className="num" />
        </Field>
        <Field label="الوحدة">
          <Input value={f.unit} onChange={(e) => up("unit")(e.target.value)} />
        </Field>
        <Field label="التكلفة (ج.م)">
          <Input value={f.cost} onChange={(e) => up("cost")(e.target.value)} type="number" inputMode="decimal" min={0} className="num" />
        </Field>
      </div>
      <FeedPerCalfPreview barnId={f.barn_id} day={f.feed_date} quantity={f.quantity} unit={f.unit} />
      <Field label="ملاحظات">
        <Textarea value={f.notes} onChange={(e) => up("notes")(e.target.value)} rows={2} />
      </Field>
    </FormDialog>
  );
}

/* ---------- Customer ---------- */

const customerSchema = z.object({
  name: z.string().trim().min(1, "اسم العميل مطلوب").max(120),
  phone: optText(30),
  address: optText(300),
  code: z.string().trim().min(1, "كود العميل مطلوب").max(30),
  notes: optText(1000),
});

export function CustomerDialog({ open, onOpenChange, initial }: DialogProps & { initial?: Customer | null }) {
  const [f, setF] = useState({ name: "", phone: "", address: "", code: "", notes: "" });
  useEffect(() => {
    if (!open) return;
    setF(initial ? { name: initial.name, phone: initial.phone ?? "", address: initial.address ?? "", code: initial.code, notes: initial.notes ?? "" } : { name: "", phone: "", address: "", code: "", notes: "" });
  }, [open, initial]);
  const up = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = useSave(async () => {
    const parsed = customerSchema.safeParse(f);
    const err = firstIssue(parsed);
    if (err || !parsed.success) throw new Error(err ?? "");
    const d = parsed.data;
    const res = initial ? await supabase.from("customers").update(d).eq("id", initial.id) : await supabase.from("customers").insert(d);
    if (res.error) throw new Error(res.error.message);
  }, () => onOpenChange(false), initial ? "تم تحديث العميل" : "تمت إضافة العميل");

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={initial ? "تعديل بيانات العميل" : "إضافة عميل"} onSubmit={() => save.mutate(undefined)} submitting={save.isPending}>
      <Field label="اسم العميل" required>
        <Input value={f.name} onChange={(e) => up("name")(e.target.value)} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="كود العميل" required>
          <Input value={f.code} onChange={(e) => up("code")(e.target.value)} placeholder="مثال: C-105" className="num" />
        </Field>
        <Field label="رقم الهاتف">
          <Input value={f.phone} onChange={(e) => up("phone")(e.target.value)} type="tel" inputMode="tel" className="num" dir="ltr" />
        </Field>
      </div>
      <Field label="العنوان">
        <Input value={f.address} onChange={(e) => up("address")(e.target.value)} placeholder="المدينة / القرية / الشارع" />
      </Field>
      <Field label="ملاحظات">
        <Textarea value={f.notes} onChange={(e) => up("notes")(e.target.value)} rows={2} />
      </Field>
    </FormDialog>
  );
}


/* ---------- Barn ---------- */

const barnSchema = z.object({
  name: z.string().trim().min(1, "اسم الحظيرة مطلوب").max(80),
  capacity: optNum,
  notes: optText(500),
});

export function BarnDialog({ open, onOpenChange, initial }: DialogProps & { initial?: Barn | null }) {
  const [f, setF] = useState({ name: "", capacity: "", notes: "" });
  useEffect(() => {
    if (!open) return;
    setF(initial ? { name: initial.name, capacity: String(initial.capacity ?? ""), notes: initial.notes ?? "" } : { name: "", capacity: "", notes: "" });
  }, [open, initial]);
  const up = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = useSave(async () => {
    const parsed = barnSchema.safeParse(f);
    const err = firstIssue(parsed);
    if (err || !parsed.success) throw new Error(err ?? "");
    const d = parsed.data;
    const res = initial ? await supabase.from("barns").update(d).eq("id", initial.id) : await supabase.from("barns").insert(d);
    if (res.error) throw new Error(res.error.message);
  }, () => onOpenChange(false), initial ? "تم تحديث الحظيرة" : "تمت إضافة الحظيرة");

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={initial ? "تعديل الحظيرة" : "إضافة حظيرة"} onSubmit={() => save.mutate(undefined)} submitting={save.isPending}>
      <Field label="اسم الحظيرة" required>
        <Input value={f.name} onChange={(e) => up("name")(e.target.value)} placeholder="مثال: حظيرة 1" autoFocus />
      </Field>
      <Field label="السعة (اختياري)">
        <Input value={f.capacity} onChange={(e) => up("capacity")(e.target.value)} type="number" inputMode="numeric" min={0} className="num" />
      </Field>
      <Field label="ملاحظات">
        <Textarea value={f.notes} onChange={(e) => up("notes")(e.target.value)} rows={2} />
      </Field>
    </FormDialog>
  );
}

/* ---------- Delete ---------- */

export function useDeleteRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ table, id }: { table: "animals" | "barns" | "customers" | "sales" | "feed_records" | "treatments" | "weight_records"; id: string }) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });
}

/* ---------- Cancel reservation (never deletes the animal) ---------- */

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ animalId, reason }: { animalId: string; reason?: string | null }) => {
      const { error } = await supabase.rpc("cancel_reservation", reason ? { _animal_id: animalId, _reason: reason } : { _animal_id: animalId });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      toast.success("تم إلغاء الحجز — الحيوان متاح الآن");
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });
}

/* ---------- Cancel sale (never deletes the animal or its data) ---------- */

export function useCancelSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ saleId, reason }: { saleId: string; reason?: string | null }) => {
      const { error } = await supabase.rpc("cancel_sale", reason ? { _sale_id: saleId, _reason: reason } : { _sale_id: saleId });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      toast.success("تم إلغاء البيع — العجل متاح الآن");
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });
}

/* ---------- Suppliers ---------- */

const supplierSchema = z.object({
  name: z.string().trim().min(2, "اسم المورد مطلوب").max(120, "الاسم طويل جداً"),
  phone: optText(30),
  address: optText(300),
  notes: optText(1000),
});

export function SupplierDialog({ open, onOpenChange, initial }: DialogProps & { initial?: Supplier | null }) {
  const [f, setF] = useState({ name: "", phone: "", address: "", notes: "" });
  useEffect(() => {
    if (!open) return;
    setF(initial ? { name: initial.name, phone: initial.phone ?? "", address: initial.address ?? "", notes: initial.notes ?? "" } : { name: "", phone: "", address: "", notes: "" });
  }, [open, initial]);
  const save = useSave(async () => {
    const parsed = supplierSchema.safeParse(f);
    const err = firstIssue(parsed);
    if (err || !parsed.success) throw new Error(err ?? "");
    if (initial) {
      const { error } = await supabase.from("suppliers").update(parsed.data).eq("id", initial.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("suppliers").insert({ ...parsed.data, created_by: u.user?.id ?? null });
      if (error) throw new Error(error.message);
    }
  }, () => onOpenChange(false), initial ? "تم تحديث بيانات المورد" : "تمت إضافة المورد");
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={initial ? "تعديل المورد" : "إضافة مورد جديد"} onSubmit={() => save.mutate(undefined)} submitting={save.isPending}>
      <Field label="اسم المورد" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
      <Field label="رقم الهاتف"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} type="tel" dir="ltr" className="num" /></Field>
      <Field label="العنوان"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
      <Field label="ملاحظات"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} /></Field>
    </FormDialog>
  );
}

const supplierPaymentSchema = z.object({
  amount: numField("المبلغ", 0.01),
  payment_date: z.string().min(1, "التاريخ مطلوب"),
  animal_id: z.string().nullable(),
  notes: optText(500),
});

export function SupplierPaymentDialog({ open, onOpenChange, supplierId, calves }: DialogProps & { supplierId: string; calves: Animal[] }) {
  const [f, setF] = useState({ amount: "", payment_date: today(), animal_id: null as string | null, notes: "" });
  useEffect(() => { if (open) setF({ amount: "", payment_date: today(), animal_id: null, notes: "" }); }, [open]);
  const save = useSave(async () => {
    const parsed = supplierPaymentSchema.safeParse(f);
    const err = firstIssue(parsed);
    if (err || !parsed.success) throw new Error(err ?? "");
    const { error } = await supabase.from("supplier_payments").insert({ ...parsed.data, supplier_id: supplierId });
    if (error) throw new Error(error.message);
  }, () => onOpenChange(false), "تم تسجيل الدفعة");
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="تسجيل دفعة للمورد" onSubmit={() => save.mutate(undefined)} submitting={save.isPending}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="المبلغ (ج.م)" required><Input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} type="number" inputMode="decimal" min={0} className="num text-xl" autoFocus /></Field>
        <Field label="تاريخ الدفع" required><Input value={f.payment_date} onChange={(e) => setF({ ...f, payment_date: e.target.value })} type="date" className="num" /></Field>
      </div>
      <Field label="ربط بعجل محدد" hint="اتركه فارغاً لتسجيلها دفعة عامة للمورد">
        <NativeSelect value={f.animal_id ?? ""} onChange={(e) => setF({ ...f, animal_id: e.target.value || null })}>
          <option value="">دفعة عامة (بدون عجل)</option>
          {calves.map((a) => <option key={a.id} value={a.id}>{a.tag_number}</option>)}
        </NativeSelect>
      </Field>
      <Field label="ملاحظات"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} /></Field>
    </FormDialog>
  );
}
