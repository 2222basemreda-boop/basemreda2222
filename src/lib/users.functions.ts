import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleSchema = z.enum(["admin", "manager", "worker", "accountant"]);

const newUserSchema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صالح").max(255),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل").max(72),
  fullName: z.string().trim().min(2, "الاسم قصير جداً").max(100),
  role: roleSchema,
});

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("غير مصرح: هذه العملية تتطلب صلاحية مدير النظام");
}

/** Public: creates the very first admin account. Works only while no staff exists. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => newUserSchema.omit({ role: true }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new Error("تم إعداد النظام مسبقاً. سجّل الدخول بحسابك.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "تعذر إنشاء الحساب");

    await supabaseAdmin.from("profiles").insert({ id: created.user.id, full_name: data.fullName, email: data.email });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    return { ok: true as const };
  });

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => newUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "تعذر إنشاء الحساب");
    await supabaseAdmin.from("profiles").insert({ id: created.user.id, full_name: data.fullName, email: data.email });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    return { id: created.user.id };
  });

export const updateStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), role: roleSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("لا يمكنك إزالة صلاحية المدير عن حسابك");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("لا يمكنك تعطيل حسابك");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ is_active: data.active }).eq("id", data.userId);
    return { ok: true as const };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(6).max(72) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("لا يمكنك حذف حسابك");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
