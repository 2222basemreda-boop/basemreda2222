import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/** Verifies the signed-in user's token on the server (same checks as the standard auth guard). */
export const requireStaffAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { userClient } = await import("./supabase-env.server");
  const auth = getRequest()?.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = auth.slice(7);
  if (token.split(".").length !== 3) throw new Error("Unauthorized");
  const supabase = userClient(token);
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized");
  return next({ context: { supabase, userId: data.claims.sub as string } });
});
