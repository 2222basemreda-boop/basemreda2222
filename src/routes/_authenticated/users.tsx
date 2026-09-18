import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { staffQuery } from "@/lib/queries";
import { createStaffUser, updateStaffRole, setStaffActive } from "@/lib/users.functions";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type AppRole } from "@/lib/labels";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Loading, EmptyState, GlassCard, Field, NativeSelect } from "@/components/farm/ui";
import { FormDialog } from "@/components/farm/FormDialog";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "المستخدمون — مزرعة الإمام" }, { name: "description", content: "إدارة حسابات فريق المزرعة وصلاحياتهم." }, { property: "og:title", content: "المستخدمون — مزرعة الإمام" }, { property: "og:description", content: "إدارة حسابات فريق المزرعة وصلاحياتهم." }] }),
  component: UsersPage,
});

const ROLES = Object.keys(ROLE_LABELS) as AppRole[];

function UsersPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(staffQuery);
  const create = useServerFn(createStaffUser);
  const setRole = useServerFn(updateStaffRole);
  const setActive = useServerFn(setStaffActive);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ fullName: "", email: "", password: "", role: "worker" as AppRole });

  if (!auth.can("users.manage")) return <EmptyState title="هذه الصفحة لمدير النظام فقط" />;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); await qc.invalidateQueries({ queryKey: ["staff"] }); toast.success(ok); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "حدث خطأ"); return false; }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="المستخدمون" subtitle="الحسابات تُنشأ من هنا فقط" action={<Button onClick={() => { setF({ fullName: "", email: "", password: "", role: "worker" }); setOpen(true); }}><Plus /> مستخدم جديد</Button>} />
      {isLoading ? <Loading /> : !data?.length ? <EmptyState icon={<ShieldCheck />} title="لا يوجد مستخدمون" /> : (
        <div className="space-y-2">
          {data.map((u) => (
            <GlassCard key={u.id} className="flex flex-wrap items-center gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{u.full_name}{u.id === auth.user.id && <span className="mr-2 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] text-brand">أنت</span>}{!u.is_active && <span className="mr-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">معطّل</span>}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">{u.email}</p>
              </div>
              <NativeSelect className="w-40" value={u.role ?? ""} disabled={busy || u.id === auth.user.id} onChange={(e) => run(() => setRole({ data: { userId: u.id, role: e.target.value as AppRole } }), "تم تحديث الصلاحية")}>
                {!u.role && <option value="">بدون صلاحية</option>}
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </NativeSelect>
              {u.id !== auth.user.id && (
                <Button variant={u.is_active ? "outline" : "secondary"} size="sm" disabled={busy} onClick={() => run(() => setActive({ data: { userId: u.id, active: !u.is_active } }), u.is_active ? "تم تعطيل الحساب" : "تم تفعيل الحساب")}>
                  {u.is_active ? "تعطيل" : "تفعيل"}
                </Button>
              )}
            </GlassCard>
          ))}
        </div>
      )}
      <FormDialog open={open} onOpenChange={setOpen} title="إنشاء مستخدم جديد" submitting={busy} submitLabel="إنشاء"
        onSubmit={async () => { if (await run(() => create({ data: f }), "تم إنشاء الحساب")) setOpen(false); }}>
        <Field label="الاسم الكامل" required><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} autoFocus /></Field>
        <Field label="البريد الإلكتروني" required><Input type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="كلمة المرور" required hint="6 أحرف على الأقل"><Input type="password" dir="ltr" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="الصلاحية" hint={ROLE_DESCRIPTIONS[f.role]}>
          <NativeSelect value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as AppRole })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</NativeSelect>
        </Field>
      </FormDialog>
    </div>
  );
}
