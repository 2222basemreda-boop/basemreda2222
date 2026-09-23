import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapAdmin } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/farm/ui";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — Elemam Farm" },
      { name: "description", content: "سجّل الدخول إلى نظام إدارة Elemam Farm." },
      { property: "og:title", content: "تسجيل الدخول — Elemam Farm" },
      { property: "og:description", content: "الدخول إلى نظام إدارة الماشية لElemam Farm." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { data: hasUsers, isLoading } = useQuery({
    queryKey: ["has_any_users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_any_users");
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
  });

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/elemam-farm-logo.png" alt="شعار Elemam Farm" width={1024} height={1024} className="size-20 rounded-3xl object-cover shadow-float" />
          <h1 className="mt-4 text-3xl">Elemam Farm</h1>
          <p className="mt-1 text-sm text-muted-foreground">نظام إدارة الماشية</p>
        </div>
        <div className="glass-strong rounded-3xl p-6">
          {isLoading ? (
            <div className="grid place-items-center py-10"><Loader2 className="size-6 animate-spin text-brand" /></div>
          ) : hasUsers === false ? (
            <SetupForm onDone={() => navigate({ to: "/dashboard", replace: true })} />
          ) : (
            <LoginForm onDone={() => navigate({ to: "/dashboard", replace: true })} />
          )}
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { toast.error("أدخل البريد الإلكتروني وكلمة المرور"); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error(/banned/i.test(error.message) ? "هذا الحساب معطّل. تواصل مع مدير النظام." : "بيانات الدخول غير صحيحة");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h2 className="text-lg">تسجيل الدخول</h2>
      <Field label="البريد الإلكتروني" required>
        <Input type="email" autoComplete="email" inputMode="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="كلمة المرور" required>
        <Input type="password" autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />}
        دخول
      </Button>
      <p className="text-center text-xs text-muted-foreground">الحسابات تُنشأ بواسطة مدير النظام فقط.</p>
    </form>
  );
}

function SetupForm({ onDone }: { onDone: () => void }) {
  const bootstrap = useServerFn(bootstrapAdmin);
  const [f, setF] = useState({ fullName: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.fullName.trim().length < 2) { toast.error("أدخل الاسم الكامل"); return; }
    if (!/.+@.+\..+/.test(f.email)) { toast.error("بريد إلكتروني غير صالح"); return; }
    if (f.password.length < 6) { toast.error("كلمة المرور 6 أحرف على الأقل"); return; }
    setBusy(true);
    try {
      await bootstrap({ data: { fullName: f.fullName.trim(), email: f.email.trim(), password: f.password } });
      const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
      if (error) throw new Error(error.message);
      toast.success("تم إنشاء حساب مدير النظام");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر إنشاء الحساب");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="flex items-center gap-2 rounded-2xl bg-amber/15 px-3 py-2 text-sm text-accent-foreground">
        <ShieldCheck className="size-5 shrink-0" />
        الإعداد الأول: أنشئ حساب مدير النظام
      </div>
      <Field label="الاسم الكامل" required>
        <Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} autoFocus />
      </Field>
      <Field label="البريد الإلكتروني" required>
        <Input type="email" dir="ltr" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </Field>
      <Field label="كلمة المرور" required hint="6 أحرف على الأقل">
        <Input type="password" dir="ltr" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />}
        إنشاء الحساب والدخول
      </Button>
    </form>
  );
}
