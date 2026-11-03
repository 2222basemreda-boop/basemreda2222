import { Printer, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate, fmtMoney, fmtNum, fmtWeight, invoiceTotal } from "@/lib/format";
import { PAYMENT_LABELS, type PaymentStatus } from "@/lib/labels";

export const FARM_NAME = "Elemam Farm";
export const FARM_NAME_AR = "مزرعة الإمام";
const LOGO = "/invoice-logo.png";

export type InvoiceData = {
  invoice_number: string;
  sale_date: string;
  payment_status: PaymentStatus;
  payment_method: string | null;
  customer: { name: string; code: string | null; phone: string | null; address: string | null } | null;
  animal: { tag_number: string; color: string | null } | null;
  batch: { label: string; quantity: number } | null;
  weight: number;
  price_per_kg: number;
  base_total: number;
  worker_tip: number;
  transportation: number;
  slaughtering: number;
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
  quantity?: number | string | null;
  worker_tip?: number | string | null;
  transportation?: number | string | null;
  slaughtering?: number | string | null;
  paid_amount: number | string | null;
  notes: string | null;
  animal?: { tag_number: string; color?: string | null } | null;
  batch?: { supplier_name: string | null } | null;
  customer?: { name: string; code?: string | null; phone?: string | null; address?: string | null } | null;
};

export function invoiceFromSale(s: SaleLike): InvoiceData {
  const weight = Number(s.weight ?? 0);
  const price = Number(s.price_per_kg ?? 0);
  const baseTotal = Number(s.total_price ?? weight * price);
  const workerTip = Number(s.worker_tip ?? 0);
  const transportation = Number(s.transportation ?? 0);
  const slaughtering = Number(s.slaughtering ?? 0);
  const total = invoiceTotal(baseTotal, workerTip, transportation, slaughtering);
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
    batch: s.batch
      ? {
          label: `عجول حرة${s.batch.supplier_name ? ` — ${s.batch.supplier_name}` : ""}`,
          quantity: Number(s.quantity ?? 1),
        }
      : null,
    weight,
    price_per_kg: price,
    base_total: baseTotal,
    worker_tip: workerTip,
    transportation,
    slaughtering,
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
    <div className="relative space-y-3 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center opacity-[0.05]">
        <img src={LOGO} alt="" className="w-2/3 max-w-xs" />
        <p className="font-display text-3xl text-brand">{FARM_NAME_AR}</p>
      </div>
      <div className="relative flex items-center justify-between gap-3 rounded-2xl border-b-4 border-amber bg-brand-deep p-4 text-primary-foreground">
        <div className="flex items-center gap-3">
          <img src={LOGO} alt="Elemam Farm" className="size-14 rounded-full bg-primary-foreground p-1 ring-2 ring-amber" />
          <div>
            <p className="font-display text-xl leading-tight" dir="ltr">{FARM_NAME}</p>
            <p className="font-display text-sm text-amber">{FARM_NAME_AR}</p>
          </div>
        </div>
        <div className="text-left text-xs">
          <p className="opacity-80">فاتورة بيع ماشية</p>
          <p className="num text-sm">{data.invoice_number}</p>
          <p className="opacity-80">{fmtDate(data.sale_date)}</p>
        </div>
      </div>

      <div className="relative rounded-2xl border border-border/60 p-3">
        <p className="mb-1 text-xs font-bold text-brand">بيانات العميل</p>
        <Row label="الاسم" value={data.customer?.name ?? "—"} />
        <Row label="كود العميل" value={data.customer?.code ?? "—"} />
        <Row label="الهاتف" value={data.customer?.phone ?? "—"} />
      </div>

      <div className="relative rounded-2xl border border-border/60 p-3">
        <p className="mb-1 text-xs font-bold text-brand">{data.batch ? "بيانات الدفعة" : "بيانات العجل"}</p>
        {data.batch ? (
          <>
            <Row label="الصنف" value={data.batch.label} />
            <Row label="عدد العجول" value={fmtNum(data.batch.quantity)} />
            {data.batch.quantity > 1 && <Row label="متوسط وزن العجل" value={fmtWeight(data.weight / data.batch.quantity)} />}
          </>
        ) : (
          <>
            <Row label="رقم العجل" value={data.animal?.tag_number ?? "—"} />
            <Row label="اللون" value={data.animal?.color ?? "—"} />
          </>
        )}
        <Row label="الوزن" value={fmtWeight(data.weight)} />
        <Row label="سعر الكيلو" value={fmtMoney(data.price_per_kg)} />
      </div>

      <div className="relative rounded-2xl border border-border/60 p-3">
        <p className="mb-1 text-xs font-bold text-brand">الحساب</p>
        <Row label="الإجمالي" value={fmtMoney(data.base_total)} />
        <Row label="إكرامية عمال" value={fmtMoney(data.worker_tip)} />
        <Row label="نقل" value={fmtMoney(data.transportation)} />
        <Row label="دبح" value={fmtMoney(data.slaughtering)} />
        <Row label="الإجمالي النهائي" value={fmtMoney(data.total)} strong />
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
body{font-family:Tajawal,system-ui,sans-serif;color:#1d2b24;margin:0;padding:24px;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{max-width:780px;margin:0 auto;position:relative}
.wm{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:.05;pointer-events:none;z-index:0}
.wm img{width:60%}.wm p{font-family:Cairo,sans-serif;font-size:44px;font-weight:700;color:#1B4D32;margin:0}
.sheet>*:not(.wm){position:relative;z-index:1}
.head{display:flex;justify-content:space-between;align-items:center;background:#1B4D32;color:#fff;border-bottom:4px solid #C9A34A;border-radius:12px;padding:14px 18px;margin-bottom:18px}
.brand{display:flex;align-items:center;gap:12px}.brand img{width:64px;height:64px;background:#fff;border-radius:50%;padding:4px;border:2px solid #C9A34A}
.farm{font-family:Cairo,sans-serif;font-size:26px;font-weight:700;color:#fff;margin:0}.farm-ar{font-family:Cairo,sans-serif;color:#C9A34A;font-size:16px;font-weight:700;margin:0}
.head .sub{color:#dfe9e3}
.sub{color:#5c6b63;font-size:13px;margin:2px 0 0}
.inv{text-align:left}
.inv b{display:block;font-size:18px}
h2{font-family:Cairo,sans-serif;font-size:15px;color:#1B4D32;border-right:4px solid #C9A34A;padding-right:8px;margin:18px 0 6px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{border:1px solid #d7e2db;padding:8px 10px;text-align:right}
th{background:rgba(241,247,243,.85);width:38%;font-weight:700}
.totals th{background:#eaf4ee}
.grand th,.grand td{font-size:17px;font-weight:700;color:#fff;background:#1B4D32}
.notes{margin-top:14px;font-size:13px;border:1px dashed #cdd9d2;padding:10px;border-radius:8px}
.signs{display:flex;justify-content:space-between;margin-top:42px;font-size:13px;color:#5c6b63}
@media print{body{padding:0}.noprint{display:none}}
</style></head><body><div class="sheet">
<div class="wm"><img src="${location.origin}${LOGO}" alt="" /><p>${FARM_NAME_AR}</p></div>
<div class="head">
  <div class="brand"><img src="${location.origin}${LOGO}" alt="" /><div><p class="farm" dir="ltr">${FARM_NAME}</p><p class="farm-ar">${FARM_NAME_AR}</p><p class="sub">فاتورة بيع ماشية</p></div></div>
  <div class="inv"><span class="sub">رقم الفاتورة</span><b>${esc(data.invoice_number)}</b><span class="sub">${esc(fmtDate(data.sale_date))}</span></div>
</div>
<h2>بيانات العميل</h2>
<table>${rows([
    ["الاسم", data.customer?.name ?? "—"],
    ["كود العميل", data.customer?.code ?? "—"],
    ["الهاتف", data.customer?.phone ?? "—"],
  ])}</table>
<h2>${esc(data.batch ? "بيانات الدفعة" : "بيانات العجل")}</h2>
<table>${rows([
    ...(data.batch
      ? [
          ["الصنف", data.batch.label],
          ["عدد العجول", fmtNum(data.batch.quantity)],
          ...(data.batch.quantity > 1 ? [["متوسط وزن العجل", fmtWeight(data.weight / data.batch.quantity)] as [string, string]] : []),
        ]
      : [
          ["رقم العجل", data.animal?.tag_number ?? "—"],
          ["اللون", data.animal?.color ?? "—"],
        ]),
    ["الوزن", fmtWeight(data.weight)],
    ["سعر الكيلو", fmtMoney(data.price_per_kg)],
  ])}</table>
<h2>الحساب</h2>
<table class="totals">
  ${rows([
    ["الإجمالي", fmtMoney(data.base_total)],
    ["إكرامية عمال", fmtMoney(data.worker_tip)],
    ["نقل", fmtMoney(data.transportation)],
    ["دبح", fmtMoney(data.slaughtering)],
  ])}
  <tr class="grand"><th>الإجمالي النهائي</th><td>${esc(fmtMoney(data.total))}</td></tr>
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

const CANVAS_WIDTH = 1000;

function canvasRows(data: InvoiceData): [string, string][] {
  return [
    ["اسم العميل", data.customer?.name ?? "—"],
    ["كود العميل", data.customer?.code ?? "—"],
    ["الهاتف", data.customer?.phone ?? "—"],
    ...(data.batch
      ? [
          ["الصنف", data.batch.label],
          ["عدد العجول", fmtNum(data.batch.quantity)],
          ...(data.batch.quantity > 1 ? [["متوسط وزن العجل", fmtWeight(data.weight / data.batch.quantity)] as [string, string]] : []),
        ]
      : [
          ["رقم العجل", data.animal?.tag_number ?? "—"],
          ["اللون", data.animal?.color ?? "—"],
        ]),
    ["الوزن", fmtWeight(data.weight)],
    ["سعر الكيلو", fmtMoney(data.price_per_kg)],
    ["الإجمالي", fmtMoney(data.base_total)],
    ["إكرامية عمال", fmtMoney(data.worker_tip)],
    ["نقل", fmtMoney(data.transportation)],
    ["دبح", fmtMoney(data.slaughtering)],
    ["الإجمالي النهائي", fmtMoney(data.total)],
    ["المبلغ المدفوع", fmtMoney(data.paid)],
    ["المبلغ المتبقي", fmtMoney(data.remaining)],
    ["حالة الدفع", PAYMENT_LABELS[data.payment_status]],
    ["طريقة الدفع", data.payment_method ?? "—"],
  ];
}

function loadImg(src: string) {
  return new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

export async function downloadInvoice(data: InvoiceData) {
  const logo = await loadImg(LOGO);
  const rows = canvasRows(data);
  const noteLines = data.notes ? Math.ceil(data.notes.length / 60) : 0;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = 340 + rows.length * 54 + (noteLines ? 90 + noteLines * 28 : 0);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.direction = "rtl";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1B4D32";
  ctx.fillRect(0, 0, canvas.width, 230);
  ctx.fillStyle = "#C9A34A";
  ctx.fillRect(0, 230, canvas.width, 8);
  if (logo) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(845, 115, 75, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#C9A34A"; ctx.lineWidth = 4; ctx.stroke();
    ctx.drawImage(logo, 780, 50, 130, 130);
  }
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 40px Cairo, Tajawal, sans-serif";
  ctx.fillText(FARM_NAME, 745, 95);
  ctx.fillStyle = "#C9A34A";
  ctx.font = "700 28px Cairo, Tajawal, sans-serif";
  ctx.fillText(FARM_NAME_AR, 745, 135);
  ctx.fillStyle = "#dfe9e3";
  ctx.font = "400 20px Tajawal, sans-serif";
  ctx.fillText("فاتورة بيع ماشية", 745, 170);
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 22px Tajawal, sans-serif";
  ctx.fillText(`رقم الفاتورة: ${data.invoice_number}`, 80, 105);
  ctx.font = "400 20px Tajawal, sans-serif";
  ctx.fillText(`التاريخ: ${fmtDate(data.sale_date)}`, 80, 140);
  ctx.textAlign = "right";

  let y = 290;
  rows.forEach(([label, value], index) => {
    ctx.fillStyle = index % 2 === 0 ? "#f1f7f3" : "#ffffff";
    ctx.fillRect(80, y - 34, 840, 52);
    ctx.strokeStyle = "#d7e2db";
    ctx.lineWidth = 1;
    ctx.strokeRect(80, y - 34, 840, 52);
    const grand = label === "الإجمالي النهائي";
    if (grand) { ctx.fillStyle = "#1B4D32"; ctx.fillRect(80, y - 34, 840, 52); }
    const strong = grand || label === "المبلغ المتبقي";
    ctx.fillStyle = grand ? "#ffffff" : strong ? "#1B4D32" : "#1d2b24";
    ctx.font = `${strong ? "700" : "400"} 21px Tajawal, sans-serif`;
    ctx.fillText(label, 880, y);
    ctx.textAlign = "left";
    ctx.font = `700 22px Tajawal, sans-serif`;
    ctx.fillText(value, 120, y);
    ctx.textAlign = "right";
    y += 54;
  });

  if (data.notes) {
    y += 16;
    ctx.fillStyle = "#1d2b24";
    ctx.font = "700 21px Tajawal, sans-serif";
    ctx.fillText("ملاحظات", 920, y);
    ctx.font = "400 20px Tajawal, sans-serif";
    const words = data.notes.split(" ");
    let line = "";
    y += 34;
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > 760) {
        ctx.fillText(line, 920, y);
        y += 28;
        line = word;
      } else {
        line = next;
      }
    });
    if (line) ctx.fillText(line, 920, y);
  }

  // watermark (very subtle, drawn after table using low alpha)
  ctx.save();
  ctx.globalAlpha = 0.05;
  const cy = 290 + (y - 290) / 2;
  if (logo) ctx.drawImage(logo, 300, cy - 230, 400, 400);
  ctx.fillStyle = "#1B4D32";
  ctx.textAlign = "center";
  ctx.font = "700 56px Cairo, Tajawal, sans-serif";
  ctx.fillText(FARM_NAME_AR, 500, cy + 230);
  ctx.restore();
  ctx.textAlign = "right";

  ctx.font = "400 18px Tajawal, sans-serif";
  ctx.fillStyle = "#5c6b63";
  ctx.fillText("توقيع المستلم: ............................", 920, canvas.height - 46);
  ctx.textAlign = "left";
  ctx.fillText("توقيع المزرعة: ............................", 80, canvas.height - 46);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.invoice_number}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, "image/png");
}

export function InvoiceActions({ data }: { data: InvoiceData }) {
  return (
    <div className="flex gap-2">
      <Button type="button" className="flex-1" size="lg" onClick={() => printInvoice(data)}>
        <Printer /> طباعة الفاتورة
      </Button>
      <Button type="button" variant="outline" size="lg" onClick={() => void downloadInvoice(data)}>
        <ImageDown /> حفظ كصورة
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
