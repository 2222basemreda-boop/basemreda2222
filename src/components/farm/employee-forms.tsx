import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/farm/ui";
import { FormDialog } from "@/components/farm/FormDialog";
import { today } from "@/lib/format";
import type { Employee } from "@/lib/employees";

function friendly(msg: string) {
  if (msg.includes("LEAVE_BALANCE_EXCEEDED")) return "الأيام المطلوبة أكبر من رصيد الإجازات المتاح";
  if (msg.includes("LEAVE_BALANCE_NEGATIVE")) return "لا يمكن هذا التعديل لأنه سيجعل رصيد الإجازات بالسالب";
  if (msg.includes("EMPLOYEE_NOT_EMPLOYED_ON_DATE")) return "الموظف ليس على رأس العمل في هذا التاريخ";
  if (msg.includes("LAST_DATE_BEFORE_START")) return "آخر يوم عمل قبل تاريخ بدء الفترة الحالية";
  if (msg.includes("NEW_START_BEFORE_END")) return "تاريخ البدء الجديد يجب أن يكون بعد آخر يوم عمل سابق";
  if (msg.includes("EMPLOYEE_ALREADY_LEFT")) return "الموظف منتهي الخدمة بالفعل";
  if (msg.includes("EMPLOYEE_ALREADY_ACTIVE")) return "الموظف على رأس العمل بالفعل";
  if (msg.includes("row-level security")) return "ليست لديك صلاحية لهذه العملية";
  return msg;
}

function useSave(fn: () => Promise<void>, done: () => void, ok: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => { await qc.invalidateQueries(); toast.success(ok); done(); },
    onError: (e) => toast.error(friendly(e instanceof Error ? e.message : "حدث خطأ")),
  });
}

export function EmployeeDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: Employee | null }) {
  const blank = { name: "", phone: "", job_title: "", start_date: today(), notes: "", is_active: true, prev_leave: "", prev_cash: "", wage: "" };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setF(initial ? { name: initial.name, phone: initial.phone ?? "", job_title: initial.job_title ?? "", start_date: initial.start_date, notes: initial.notes ?? "", is_active: initial.is_active, prev_leave: String(initial.prev_leave_days || ""), prev_cash: String(initial.prev_cash_days || ""), wage: initial.daily_wage != null ? String(initial.daily_wage) : "" } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const save = useSave(async () => {
    const name = f.name.trim();
    if (name.length < 2) throw new Error("أدخل اسم الموظف");
    if (!f.start_date) throw new Error("أدخل تاريخ بدء العمل");
    if (!/^\d*$/.test(f.prev_leave.trim()) || !/^\d*$/.test(f.prev_cash.trim())) throw new Error("أدخل أعداداً صحيحة للأيام السابقة");
    if (f.start_date > today()) throw new Error("تاريخ بدء العمل لا يمكن أن يكون في المستقبل");
    if (f.wage.trim() && !(Number(f.wage) >= 0)) throw new Error("أدخل أجراً يومياً صحيحاً");
    const payload = { daily_wage: f.wage.trim() ? Number(f.wage) : null, prev_leave_days: Number(f.prev_leave) || 0, prev_cash_days: Number(f.prev_cash) || 0, name, phone: f.phone.trim() || null, job_title: f.job_title.trim() || null, start_date: f.start_date, notes: f.notes.trim() || null };
    if (initial) {
      const { error } = await supabase.from("employees").update(payload).eq("id", initial.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("employees").insert({ ...payload, created_by: u.user?.id ?? null });
      if (error) throw new Error(error.message);
    }
  }, () => onOpenChange(false), initial ? "تم تحديث بيانات الموظف" : "تمت إضافة الموظف");

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={initial ? "تعديل بيانات الموظف" : "إضافة موظف جديد"} onSubmit={() => save.mutate()} submitting={save.isPending}>
      <Field label="اسم الموظف" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="رقم الهاتف"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" dir="ltr" className="num" /></Field>
        <Field label="الوظيفة"><Input value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} placeholder="مثال: عامل حظيرة" /></Field>
      </div>
      <Field label="تاريخ بدء العمل الفعلي في المزرعة" required><Input type="date" value={f.start_date} max={today()} onChange={(e) => setF({ ...f, start_date: e.target.value })} className="num" /></Field>
      <p className="-mt-2 text-xs text-muted-foreground">الأيام من تاريخ البدء حتى يوم الإضافة للتطبيق تُحسب أيام عمل تلقائياً، وبعدها يُعتمد الحضور اليومي.</p>
      <Field label="الأجر اليومي (ج.م)"><Input value={f.wage} onChange={(e) => setF({ ...f, wage: e.target.value })} type="number" inputMode="decimal" min={0} className="num" placeholder="يُستخدم لحساب التعويض النقدي" /></Field>
      <div className="rounded-2xl border border-border p-3 space-y-3">
        <p className="text-sm font-bold">الإجازات والتسويات السابقة</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="إجازات أُخذت سابقاً (يوم)"><Input value={f.prev_leave} onChange={(e) => setF({ ...f, prev_leave: e.target.value })} type="number" inputMode="numeric" min={0} step={1} className="num" placeholder="0" /></Field>
          <Field label="تعويض نقدي سابق (يوم)"><Input value={f.prev_cash} onChange={(e) => setF({ ...f, prev_cash: e.target.value })} type="number" inputMode="numeric" min={0} step={1} className="num" placeholder="0" /></Field>
        </div>
      </div>
      <Field label="ملاحظات"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </FormDialog>
  );
}

export function LeaveSettlementDialog({ open, onOpenChange, employee, remaining }: { open: boolean; onOpenChange: (o: boolean) => void; employee: Employee; remaining: number }) {
  const [f, setF] = useState({ leave: "", cash: "", date: today(), notes: "" });
  useEffect(() => { if (open) setF({ leave: "", cash: "", date: today(), notes: "" }); }, [open]);
  const leave = Math.max(0, Math.floor(Number(f.leave) || 0));
  const cash = Math.max(0, Math.floor(Number(f.cash) || 0));
  const after = remaining - leave - cash;

  const save = useSave(async () => {
    if (!/^\d*$/.test(f.leave.trim()) || !/^\d*$/.test(f.cash.trim())) throw new Error("أدخل أعداداً صحيحة للأيام");
    if (leave + cash <= 0) throw new Error("أدخل أيام إجازة فعلية أو أيام تعويض نقدي");
    const { error } = await supabase.from("leave_settlements").insert({ employee_id: employee.id, leave_days: leave, cash_days: cash, settlement_date: f.date, notes: f.notes.trim() || null });
    if (error) throw new Error(error.message);
  }, () => onOpenChange(false), "تم تسجيل تسوية الإجازة");

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`تسوية إجازة — ${employee.name}`} description={`الرصيد المتاح: ${remaining} يوم`} onSubmit={() => save.mutate()} submitting={save.isPending}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="أيام إجازة فعلية"><Input value={f.leave} onChange={(e) => setF({ ...f, leave: e.target.value })} type="number" inputMode="numeric" min={0} step={1} className="num" placeholder="0" /></Field>
        <Field label="أيام تعويض نقدي"><Input value={f.cash} onChange={(e) => setF({ ...f, cash: e.target.value })} type="number" inputMode="numeric" min={0} step={1} className="num" placeholder="0" /></Field>
      </div>
      <Field label="الرصيد بعد التسوية">
        <div className={`num flex h-12 items-center rounded-2xl px-3 font-bold ${after < 0 ? "bg-amber-500/10" : "bg-muted"}`}>{after} يوم{after < 0 && " (إجازة مقدّمة تُخصم من الاستحقاق القادم)"}</div>
      </Field>
      <Field label="التاريخ" required><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="num" /></Field>
      <Field label="ملاحظات"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </FormDialog>
  );
}

export function EmployeeStatusDialog({ open, onOpenChange, employee, mode }: { open: boolean; onOpenChange: (o: boolean) => void; employee: Employee; mode: "leave" | "reactivate" }) {
  const [d, setD] = useState(today());
  useEffect(() => { if (open) setD(today()); }, [open]);
  const save = useSave(async () => {
    if (!d) throw new Error("أدخل التاريخ");
    const { error } = mode === "leave"
      ? await supabase.rpc("mark_employee_left", { _employee_id: employee.id, _last_date: d })
      : await supabase.rpc("reactivate_employee", { _employee_id: employee.id, _start_date: d });
    if (error) throw new Error(error.message);
  }, () => onOpenChange(false), mode === "leave" ? "تم تسجيل انتهاء الخدمة" : "تمت إعادة تفعيل الموظف");
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={mode === "leave" ? `إنهاء خدمة — ${employee.name}` : `إعادة تفعيل — ${employee.name}`}
      description={mode === "leave" ? "لن يُحذف أي سجل. يتوقف احتساب أيام العمل والإجازات بعد آخر يوم عمل." : "تبدأ فترة عمل جديدة مع الاحتفاظ بالفترات والسجلات السابقة."}
      onSubmit={() => save.mutate()} submitting={save.isPending}>
      <Field label={mode === "leave" ? "آخر يوم عمل" : "تاريخ بدء العمل الجديد"} required><Input type="date" value={d} onChange={(e) => setD(e.target.value)} className="num" /></Field>
    </FormDialog>
  );
}

export function CashLeaveDialog({ open, onOpenChange, employee, remaining }: { open: boolean; onOpenChange: (o: boolean) => void; employee: Employee; remaining: number }) {
  const wage = Number(employee.daily_wage ?? 0);
  const [f, setF] = useState({ days: "", amount: "", date: today(), notes: "" });
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (open) { setF({ days: "", amount: "", date: today(), notes: "" }); setTouched(false); } }, [open]);
  const days = Math.max(0, Math.floor(Number(f.days) || 0));
  const suggested = days * wage;
  const amount = touched ? f.amount : (wage ? String(suggested) : f.amount);
  const save = useSave(async () => {
    if (!/^\d+$/.test(f.days.trim()) || days <= 0) throw new Error("أدخل عدد أيام صحيحاً");
    const amt = Number(amount);
    if (!amount || !(amt >= 0)) throw new Error("أدخل المبلغ المدفوع");
    const { error } = await supabase.from("leave_settlements").insert({ employee_id: employee.id, leave_days: 0, cash_days: days, cash_amount: amt, settlement_date: f.date, notes: f.notes.trim() || null });
    if (error) throw new Error(error.message);
  }, () => onOpenChange(false), "تم تسجيل التعويض النقدي");
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`صرف نقدي بدل إجازة — ${employee.name}`} description={`الرصيد الحالي: ${remaining} يوم · الأجر اليومي: ${wage ? wage + " ج.م" : "غير محدد"}`} onSubmit={() => save.mutate()} submitting={save.isPending}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="عدد الأيام" required><Input value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} type="number" inputMode="numeric" min={1} step={1} className="num" /></Field>
        <Field label="المبلغ (ج.م)" required><Input value={amount} onChange={(e) => { setTouched(true); setF({ ...f, amount: e.target.value }); }} type="number" inputMode="decimal" min={0} className="num" /></Field>
      </div>
      {wage > 0 && <p className="-mt-2 text-xs text-muted-foreground">المقترح: {days} × {wage} = {suggested} ج.م — راجع المبلغ قبل الحفظ</p>}
      <Field label="الرصيد بعد الصرف"><div className="num flex h-12 items-center rounded-2xl bg-muted px-3 font-bold" dir="ltr">{remaining - days} يوم</div></Field>
      <Field label="تاريخ الصرف" required><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="num" /></Field>
      <Field label="ملاحظات"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </FormDialog>
  );
}
