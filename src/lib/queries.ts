import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Barn = Tables<"barns">;
export type Customer = Tables<"customers">;
export type Animal = Tables<"animals">;
export type Sale = Tables<"sales">;
export type FeedRecord = Tables<"feed_records">;
export type Treatment = Tables<"treatments">;
export type WeightRecord = Tables<"weight_records">;
export type ActivityLog = Tables<"activity_logs">;
export type Profile = Tables<"profiles">;

export type BarnRef = Pick<Barn, "id" | "name">;
export type CustomerRef = Pick<Customer, "id" | "name" | "code">;
export type AnimalRow = Animal & { barn: BarnRef | null; customer: CustomerRef | null };

const ANIMAL_SELECT = "*, barn:barns(id,name), customer:customers(id,name,code)";

function throwIf<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const barnsQuery = queryOptions({
  queryKey: ["barns"],
  queryFn: async () => throwIf(await supabase.from("barns").select("*").order("name")),
});

export const customersQuery = queryOptions({
  queryKey: ["customers"],
  queryFn: async () => throwIf(await supabase.from("customers").select("*").order("name")),
});

export const animalsQuery = queryOptions({
  queryKey: ["animals"],
  queryFn: async () =>
    throwIf(await supabase.from("animals").select(ANIMAL_SELECT).order("created_at", { ascending: false })) as AnimalRow[],
});

export const animalQuery = (id: string) =>
  queryOptions({
    queryKey: ["animals", id],
    queryFn: async () => {
      const [animal, weights, moves, custHist, treatments, sales] = await Promise.all([
        supabase.from("animals").select(ANIMAL_SELECT).eq("id", id).maybeSingle(),
        supabase.from("weight_records").select("*").eq("animal_id", id).order("recorded_at", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("barn_movements").select("*, from_barn:barns!barn_movements_from_barn_id_fkey(id,name), to_barn:barns!barn_movements_to_barn_id_fkey(id,name)").eq("animal_id", id).order("moved_at", { ascending: false }),
        supabase.from("animal_customer_history").select("*, customer:customers(id,name,code)").eq("animal_id", id).order("changed_at", { ascending: false }),
        supabase.from("treatments").select("*").eq("animal_id", id).order("treatment_date", { ascending: false }),
        supabase.from("sales").select("*, customer:customers(id,name,code)").eq("animal_id", id).order("sale_date", { ascending: false }),
      ]);
      const a = throwIf(animal) as AnimalRow | null;
      if (!a) return null;
      return {
        animal: a,
        weights: throwIf(weights),
        moves: throwIf(moves),
        customerHistory: throwIf(custHist),
        treatments: throwIf(treatments),
        sales: sales.error ? [] : sales.data,
      };
    },
  });

export const customerQuery = (id: string) =>
  queryOptions({
    queryKey: ["customers", id],
    queryFn: async () => {
      const [customer, animals, sales, history] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).maybeSingle(),
        supabase.from("animals").select(ANIMAL_SELECT).eq("customer_id", id).order("created_at", { ascending: false }),
        supabase.from("sales").select("*, animal:animals(id,tag_number)").eq("customer_id", id).order("sale_date", { ascending: false }),
        supabase.from("animal_customer_history").select("*, animal:animals(id,tag_number)").eq("customer_id", id).order("changed_at", { ascending: false }).limit(50),
      ]);
      const c = throwIf(customer);
      if (!c) return null;
      return {
        customer: c,
        animals: throwIf(animals) as AnimalRow[],
        sales: sales.error ? [] : sales.data,
        history: throwIf(history),
      };
    },
  });

export const salesQuery = queryOptions({
  queryKey: ["sales"],
  queryFn: async () =>
    throwIf(
      await supabase
        .from("sales")
        .select("*, animal:animals(id,tag_number,color), customer:customers(id,name,code)")
        .order("sale_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ),
});

export const feedQuery = queryOptions({
  queryKey: ["feed_records"],
  queryFn: async () =>
    throwIf(
      await supabase
        .from("feed_records")
        .select("*, barn:barns(id,name)")
        .order("feed_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ),
});

export const treatmentsQuery = queryOptions({
  queryKey: ["treatments"],
  queryFn: async () =>
    throwIf(
      await supabase
        .from("treatments")
        .select("*, animal:animals(id,tag_number,color)")
        .order("treatment_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ),
});

export const activityQuery = (limit = 100) =>
  queryOptions({
    queryKey: ["activity_logs", limit],
    queryFn: async () =>
      throwIf(await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(limit)),
  });

export const staffQuery = queryOptions({
  queryKey: ["staff"],
  queryFn: async () => {
    const [profiles, roles] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const p = throwIf(profiles);
    const r = throwIf(roles);
    return p.map((prof) => ({ ...prof, role: r.find((x) => x.user_id === prof.id)?.role ?? null }));
  },
});

export const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: async () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthISO = monthStart.toISOString().slice(0, 10);
    const [animals, barns, sales, logs] = await Promise.all([
      supabase.from("animals").select("id, status, current_weight, barn_id, tag_number, color, created_at, barn:barns(id,name)").order("created_at", { ascending: false }),
      supabase.from("barns").select("id, name, capacity").order("name"),
      supabase.from("sales").select("total_price, sale_date, payment_status, paid_amount").gte("sale_date", monthISO),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(8),
    ]);
    const a = throwIf(animals);
    const b = throwIf(barns);
    const s = sales.error ? null : sales.data; // accountant-only tables may be hidden for workers
    const l = throwIf(logs);

    const live = a.filter((x) => x.status !== "sold");
    const totalWeight = live.reduce((sum, x) => sum + Number(x.current_weight ?? 0), 0);
    const perBarn = b.map((barn) => ({
      ...barn,
      count: live.filter((x) => x.barn_id === barn.id).length,
    }));
    const unassigned = live.filter((x) => !x.barn_id).length;

    return {
      total: a.length,
      available: a.filter((x) => x.status === "available").length,
      reserved: a.filter((x) => x.status === "reserved").length,
      sold: a.filter((x) => x.status === "sold").length,
      totalWeight,
      perBarn,
      unassigned,
      recentAnimals: a.slice(0, 5),
      logs: l,
      sales: s
        ? {
            count: s.length,
            total: s.reduce((sum, x) => sum + Number(x.total_price ?? 0), 0),
            paid: s.reduce((sum, x) => sum + (x.payment_status === "paid" ? Number(x.total_price ?? 0) : Number(x.paid_amount ?? 0)), 0),
          }
        : null,
    };
  },
});
