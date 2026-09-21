import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Elemam Farm — إدارة الماشية" },
      { name: "description", content: "نظام إدارة Elemam Farm: الماشية، الحظائر، العملاء، الأوزان، المبيعات، التغذية والعلاجات." },
      { property: "og:title", content: "Elemam Farm — إدارة الماشية" },
      { property: "og:description", content: "نظام متكامل لإدارة مزرعة الماشية بمزامنة مباشرة بين الهاتف والكمبيوتر." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/dashboard" : "/auth", replace: true });
  },
  component: () => null,
});
