import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Backend address and public key; falls back to the public build values so server calls work everywhere. */
export function backendUrl(): string {
  const v = process.env["SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"];
  if (!v) throw new Error("إعدادات الخادم غير مكتملة");
  return v;
}

export function publishableKey(): string {
  const v = process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!v) throw new Error("إعدادات الخادم غير مكتملة");
  return v;
}

export function keyFetch(key: string): typeof fetch {
  return (input, init) => {
    const h = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((v, k) => h.set(k, v));
    if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
    h.set("apikey", key);
    return fetch(input, { ...init, headers: h });
  };
}

export function adminClient() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("مفتاح الخادم غير متوفر، حاول مرة أخرى لاحقاً");
  return createClient<Database>(backendUrl(), key, {
    global: { fetch: keyFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(token: string) {
  const key = publishableKey();
  return createClient<Database>(backendUrl(), key, {
    global: { fetch: keyFetch(key), headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}
