import type { Enums } from "@/integrations/supabase/types";

export type AnimalStatus = Enums<"animal_status">;
export type PaymentStatus = Enums<"payment_status">;
export type AppRole = Enums<"app_role">;

export const STATUS_LABELS: Record<AnimalStatus, string> = {
  available: "متاح",
  reserved: "محجوز",
  sold: "مباع",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid: "مدفوع",
  partial: "مدفوع جزئياً",
  unpaid: "غير مدفوع",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير النظام",
  manager: "مدير المزرعة",
  worker: "عامل",
  accountant: "محاسب",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "صلاحيات كاملة بما فيها الحذف وإدارة المستخدمين",
  manager: "عرض وتعديل جميع بيانات المزرعة",
  worker: "إضافة الأوزان والبيانات الأساسية للمواشي",
  accountant: "الوصول إلى المبيعات والبيانات المالية",
};

export const ACTION_LABELS: Record<string, string> = {
  created: "أضاف",
  updated: "عدّل",
  deleted: "حذف",
  moved: "نقل",
  reserved: "حجز",
  cancelled: "ألغى",
};

export const ENTITY_LABELS: Record<string, string> = {
  animals: "حيوان",
  barns: "حظيرة",
  customers: "عميل",
  sales: "عملية بيع",
  feed_records: "سجل تغذية",
  treatments: "علاج",
  weight_records: "وزن",
};
