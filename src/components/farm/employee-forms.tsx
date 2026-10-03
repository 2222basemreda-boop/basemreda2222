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
  const blank = { name: "", phone: "", job_title: "", start_date: today(), notes: "", is_active: true };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setF(initial ? { name: initial.name, phone: initial.phone ?? "", job_title: initial.job_title ?? "", start_date: initial.start_date, notes: initial.notes ?? "", is_active: initial.is_active } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const save = useSave(async () => {
    const name = f.name.trim();
    if (name.length < 2) throw new Error("أدخل اسم الموظف");
    if (!f.start_date) throw new Error("أدخل تاريخ بدء العمل");
    const payload = { name, phone: f.phone.trim() || null, job_title: f.job_title.trim() || null, start_date: f.start_date, notes: f.notes.trim() || null, is_active: f.is_active };
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
      <Field label="تاريخ بدء العمل" required><Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} className="num" /></Field>
      {initial && (
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
          موظف حالي (يظهر في الحضور اليومي)
        </label>
      )}
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
    if (after < 0) throw new Error("الأيام المطلوبة أكبر من رصيد الإجازات المتاح");
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
        <div className={`num flex h-12 items-center rounded-2xl px-3 font-bold ${after < 0 ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>{after} يوم</div>
      </Field>
      <Field label="التاريخ" required><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="num" /></Field>
      <Field label="ملاحظات"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </FormDialog>
  );
}
