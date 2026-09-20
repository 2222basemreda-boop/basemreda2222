import { Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate, fmtMoney, fmtWeight } from "@/lib/format";
import { PAYMENT_LABELS, type PaymentStatus } from "@/lib/labels";

export const FARM_NAME = "مزرعة الإمام";

export type InvoiceData = {
  invoice_number: string;
  sale_date: string;
  payment_status: PaymentStatus;
  payment_method: string | null;
  customer: { name: string; code: string | null; phone: string | null; address: string | null } | null;
  animal: { tag_number: string; color: string | null } | null;
  weight: number;
  price_per_kg: number;
  total: number;
  paid: number;
  remaining: number;
  notes: string | null;
};

type SaleLike = {
  invoice_number: string | null;
  sale_date: string;
  payment_status: PaymentStatus;
  payment_method: string | null;
  weight: number | string;
  price_per_kg: number | string;
  total_price: number | string | null;
  paid_amount: number | string | null;
  notes: string | null;
  animal?: { tag_number: string; color?: string | null } | null;
  customer?: { name: string; code?: string | null; phone?: string | null; address?: string | null } | null;
};

export function invoiceFromSale(s: SaleLike): InvoiceData {
  const weight = Number(s.weight ?? 0);
  const price = Number(s.price_per_kg ?? 0);
  const total = Number(s.total_price ?? weight * price);
  const paid = s.payment_status === "paid" ? total : Number(s.paid_amount ?? 0);
  return {
    invoice_number: s.invoice_number ?? "—",
    sale_date: s.sale_date,
    payment_status: s.payment_status,
    payment_method: s.payment_method ?? null,
    customer: s.customer
      ? { name: s.customer.name, code: s.customer.code ?? null, phone: s.customer.phone ?? null, address: s.customer.address ?? null }
      : null,
    animal: s.animal ? { tag_number: s.animal.tag_number, color: s.animal.color ?? null } : null,
    weight,
    price_per_kg: price,
    total,
    paid,
    remaining: Math.max(total - paid, 0),
    notes: s.notes ?? null,
  };
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "num text-base font-bold" : "num font-bold"}>{value}</span>
    </div>
  );
}

export function InvoiceView({ data }: { data: InvoiceData }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-brand/10 p-4 text-center">
        <p className="font-display text-xl text-brand">{FARM_NAME}</p>
        <p className="text-xs text-muted-foreground">فاتورة بيع ماشية</p>
        <p className="num mt-1 text-sm font-bold">{data.invoice_number}</p>
        <p className="text-xs text-muted-foreground">{fmtDate(data.sale_date)}</p>
      </div>

      <div className="rounded-2xl border border-border/60 p-3">
        <p className="mb-1 text-xs font-bold text-brand">بيانات العميل</p>
        <Row label="الاسم" value={data.customer?.name ?? "—"} />
        <Row label="كود العميل" value={data.customer?.code ?? "—"} />
        <Row label="الهاتف" value={data.customer?.phone ?? "—"} />
        <Row label="العنوان" value={data.customer?.address ?? "—"} />
      </div>

      <div className="rounded-2xl border border-border/60 p-3">
        <p className="mb-1 text-xs font-bold text-brand">بيانات العجل</p>
        <Row label="رقم العجل" value={data.animal?.tag_number ?? "—"} />
        <Row label="اللون" value={data.animal?.color ?? "—"} />
        <Row label="الوزن" value={fmtWeight(data.weight)} />
        <Row label="سعر الكيلو" value={fmtMoney(data.price_per_kg)} />
      </div>

      <div className="rounded-2xl border border-border/60 p-3">
        <p className="mb-1 text-xs font-bold text-brand">الحساب</p>
        <Row label="إجمالي البيع" value={fmtMoney(data.total)} strong />
        <Row label="المدفوع" value={fmtMoney(data.paid)} />
        <Row label="المتبقي" value={fmtMoney(data.remaining)} strong />
        <Row label="حالة الدفع" value={PAYMENT_LABELS[data.payment_status]} />
        <Row label="طريقة الدفع" value={data.payment_method ?? "—"} />
      </div>

      {data.notes && (
        <div className="rounded-2xl border border-border/60 p-3 text-sm">
          <span className="font-bold">ملاحظات: </span>
          {data.notes}
        </div>
      )}
    </div>
  );
}

/* ---------- printable HTML ---------- */

function esc(v: string | null | undefined) {
  return String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

export function buildInvoiceHtml(data: InvoiceData) {
  const rows = (items: [string, string][]) =>
    items.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<title>${esc(data.invoice_number)} — ${FARM_NAME}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Tajawal:wght@400;700&display=swap" rel="stylesheet" />
<style>
*{box-sizing:border-box}
body{font-family:Tajawal,system-ui,sans-serif;color:#1d2b24;margin:0;padding:24px;background:#fff}
.sheet{max-width:780px;margin:0 auto}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2E7D5B;padding-bottom:12px;margin-bottom:18px}
.farm{font-family:Cairo,sans-serif;font-size:26px;font-weight:700;color:#2E7D5B;margin:0}
.sub{color:#5c6b63;font-size:13px;margin:2px 0 0}
.inv{text-align:left}
.inv b{display:block;font-size:18px}
h2{font-family:Cairo,sans-serif;font-size:15px;color:#2E7D5B;margin:18px 0 6px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{border:1px solid #d7e2db;padding:8px 10px;text-align:right}
th{background:#f1f7f3;width:38%;font-weight:700}
.totals th{background:#eaf4ee}
.grand td{font-size:17px;font-weight:700;color:#2E7D5B}
.notes{margin-top:14px;font-size:13px;border:1px dashed #cdd9d2;padding:10px;border-radius:8px}
.signs{display:flex;justify-content:space-between;margin-top:42px;font-size:13px;color:#5c6b63}
@media print{body{padding:0}.noprint{display:none}}
</style></head><body><div class="sheet">
<div class="head">
  <div><p class="farm">${FARM_NAME}</p><p class="sub">فاتورة بيع ماشية</p></div>
  <div class="inv"><span class="sub">رقم الفاتورة</span><b>${esc(data.invoice_number)}</b><span class="sub">${esc(fmtDate(data.sale_date))}</span></div>
</div>
<h2>بيانات العميل</h2>
<table>${rows([
    ["الاسم", data.customer?.name ?? "—"],
    ["كود العميل", data.customer?.code ?? "—"],
    ["الهاتف", data.customer?.phone ?? "—"],
    ["العنوان", data.customer?.address ?? "—"],
  ])}</table>
<h2>بيانات العجل</h2>
<table>${rows([
    ["رقم العجل", data.animal?.tag_number ?? "—"],
    ["اللون", data.animal?.color ?? "—"],
    ["الوزن", fmtWeight(data.weight)],
    ["سعر الكيلو", fmtMoney(data.price_per_kg)],
  ])}</table>
<h2>الحساب</h2>
<table class="totals">
  <tr class="grand"><th>إجمالي البيع</th><td>${esc(fmtMoney(data.total))}</td></tr>
  ${rows([
    ["المبلغ المدفوع", fmtMoney(data.paid)],
    ["المبلغ المتبقي", fmtMoney(data.remaining)],
    ["حالة الدفع", PAYMENT_LABELS[data.payment_status]],
    ["طريقة الدفع", data.payment_method ?? "—"],
  ])}
</table>
${data.notes ? `<div class="notes"><b>ملاحظات:</b> ${esc(data.notes)}</div>` : ""}
<div class="signs"><span>توقيع المستلم: ............................</span><span>توقيع المزرعة: ............................</span></div>
</div></body></html>`;
}

export function printInvoice(data: InvoiceData) {
  const html = buildInvoiceHtml(data);
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}

export function downloadInvoice(data: InvoiceData) {
  const blob = new Blob([buildInvoiceHtml(data)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.invoice_number}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function InvoiceActions({ data }: { data: InvoiceData }) {
  return (
    <div className="flex gap-2">
      <Button type="button" className="flex-1" size="lg" onClick={() => printInvoice(data)}>
        <Printer /> طباعة الفاتورة
      </Button>
      <Button type="button" variant="outline" size="lg" onClick={() => downloadInvoice(data)}>
        <Download /> حفظ الفاتورة
      </Button>
    </div>
  );
}

export function InvoiceDialog({ open, onOpenChange, data }: { open: boolean; onOpenChange: (o: boolean) => void; data: InvoiceData | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle className="font-display text-xl">الفاتورة</DialogTitle>
          <DialogDescription className="sr-only">تفاصيل الفاتورة</DialogDescription>
        </DialogHeader>
        {data && (
          <div className="space-y-4">
            <InvoiceView data={data} />
            <InvoiceActions data={data} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
