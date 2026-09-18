import type { ReactNode, SelectHTMLAttributes } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, PAYMENT_LABELS, type AnimalStatus, type PaymentStatus } from "@/lib/labels";
import { fmtWeight, fmtDate } from "@/lib/format";
import type { AnimalRow } from "@/lib/queries";

export function GlassCard({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass rounded-3xl p-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between">
      <h2 className="text-sm font-bold text-foreground/80">{children}</h2>
      {action}
    </div>
  );
}

export function StatusBadge({ status, className }: { status: AnimalStatus; className?: string }) {
  const styles: Record<AnimalStatus, string> = {
    available: "bg-available/15 text-available",
    reserved: "bg-reserved/25 text-reserved-foreground",
    sold: "bg-sold/15 text-sold",
  };
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold", styles[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, string> = {
    paid: "bg-available/15 text-available",
    partial: "bg-reserved/25 text-reserved-foreground",
    unpaid: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold", styles[status])}>
      {PAYMENT_LABELS[status]}
    </span>
  );
}

export function StatTile({ label, value, tone = "brand", hint }: { label: string; value: ReactNode; tone?: "brand" | "amber" | "muted"; hint?: string }) {
  const tones = { brand: "text-brand", amber: "text-amber", muted: "text-foreground/60" };
  return (
    <div className="glass grid place-items-center rounded-3xl px-3 py-4 text-center">
      <div className={cn("num text-3xl leading-none", tones[tone])}>{value}</div>
      <p className="mt-1.5 text-[12px] text-muted-foreground">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="glass flex flex-col items-center justify-center rounded-3xl px-6 py-12 text-center">
      {icon && <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-brand/10 text-brand [&_svg]:size-7">{icon}</div>}
      <p className="font-display font-bold">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass h-16 animate-pulse rounded-2xl" />
      ))}
    </div>
  );
}

export function Field({ label, children, hint, required }: { label: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-foreground/80">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function NativeSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-12 w-full appearance-none rounded-2xl border border-border bg-input px-4 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23213A2D%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[position:left_1rem_center] bg-no-repeat pl-10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function TagChip({ tag, status }: { tag: string; status: AnimalStatus }) {
  const styles: Record<AnimalStatus, string> = {
    available: "bg-brand/10 text-brand",
    reserved: "bg-amber/20 text-accent-foreground",
    sold: "bg-sold/15 text-sold",
  };
  return (
    <div className={cn("num grid size-11 shrink-0 place-items-center rounded-xl text-sm", styles[status])}>{tag}</div>
  );
}

export function AnimalCard({ animal, compact }: { animal: AnimalRow; compact?: boolean }) {
  return (
    <Link
      to="/animals/$id"
      params={{ id: animal.id }}
      className="glass tap flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-popover/80"
    >
      <TagChip tag={animal.tag_number} status={animal.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold">
          {animal.color || "بدون لون"} · {fmtWeight(animal.current_weight)}
        </p>
        <p className="truncate text-[12px] text-muted-foreground">
          {animal.barn?.name ?? "بدون حظيرة"}
          {!compact && animal.customer ? ` · ${animal.customer.name} (${animal.customer.code})` : ""}
          {" · "}
          {fmtDate(animal.entry_date)}
        </p>
      </div>
      <StatusBadge status={animal.status} />
    </Link>
  );
}
