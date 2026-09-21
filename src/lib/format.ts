import { format, formatDistanceToNow, parseISO } from "date-fns";
import { arEG } from "date-fns/locale";

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function fmtNum(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(n)) return "—";
  return nf.format(n);
}

export function fmtMoney(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(n)) return "—";
  return `${money.format(n)} ج.م`;
}

export function fmtWeight(v: number | string | null | undefined): string {
  const s = fmtNum(v);
  return s === "—" ? s : `${s} كجم`;
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  try {
    return format(parseISO(v), "d MMM yyyy", { locale: arEG });
  } catch {
    return v;
  }
}

export function fmtRelative(v: string | null | undefined): string {
  if (!v) return "";
  try {
    return formatDistanceToNow(parseISO(v), { addSuffix: true, locale: arEG });
  } catch {
    return "";
  }
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function invoiceTotal(
  base: number | string | null | undefined,
  workerTip: number | string | null | undefined = 0,
  transportation: number | string | null | undefined = 0,
  slaughtering: number | string | null | undefined = 0,
): number {
  return (toNum(base) ?? 0) + (toNum(workerTip) ?? 0) + (toNum(transportation) ?? 0) + (toNum(slaughtering) ?? 0);
}
