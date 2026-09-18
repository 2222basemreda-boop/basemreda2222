import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, Search, Phone } from "lucide-react";
import { animalsQuery, customersQuery } from "@/lib/queries";
import { fmtNum } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Loading, EmptyState } from "@/components/farm/ui";
import { CustomerDialog } from "@/components/farm/forms";

export const Route = createFileRoute("/_authenticated/customers/")({
  head: () => ({
    meta: [
      { title: "العملاء — مزرعة الإمام" },
      { name: "description", content: "قائمة عملاء مزرعة الإمام وحجوزاتهم ومشترياتهم." },
      { property: "og:title", content: "العملاء — مزرعة الإمام" },
      { property: "og:description", content: "قائمة العملاء." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const auth = useAuth();
  const { data, isLoading } = useQuery(customersQuery);
  const { data: animals } = useQuery(animalsQuery);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((c) => !t || c.name.toLowerCase().includes(t) || c.code.toLowerCase().includes(t) || (c.phone ?? "").includes(t));
  }, [data, q]);

  return (
    <div>
      <PageHeader title="العملاء" subtitle={`${fmtNum(data?.length ?? 0)} عميل`} action={auth.can("customers.write") && <Button onClick={() => setOpen(true)}><Plus /> عميل جديد</Button>} />
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="الاسم، الكود أو الهاتف…" className="pr-12" />
      </div>
      {isLoading ? <Loading /> : list.length === 0 ? (
        <EmptyState icon={<Users />} title={data?.length ? "لا توجد نتائج" : "لا يوجد عملاء بعد"} action={!data?.length && auth.can("customers.write") ? <Button onClick={() => setOpen(true)}><Plus /> إضافة عميل</Button> : undefined} />
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {list.map((c) => {
            const mine = (animals ?? []).filter((a) => a.customer_id === c.id);
            const reserved = mine.filter((a) => a.status === "reserved").length;
            const sold = mine.filter((a) => a.status === "sold").length;
            return (
              <Link key={c.id} to="/customers/$id" params={{ id: c.id }} className="glass tap flex items-center gap-3 rounded-2xl p-3 hover:bg-popover/80">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber/20 font-display text-lg font-extrabold text-accent-foreground">{c.name.slice(0, 1)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{c.name} <span className="num text-xs font-normal text-muted-foreground">{c.code}</span></p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {c.phone && <><Phone className="size-3" /><span className="num" dir="ltr">{c.phone}</span> · </>}
                    {fmtNum(reserved)} محجوز · {fmtNum(sold)} مشترى
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <CustomerDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
