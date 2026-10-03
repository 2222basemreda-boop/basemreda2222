import type { AppRole } from "./labels";

export type Action =
  | "animals.write"
  | "animals.delete"
  | "barns.write"
  | "barns.delete"
  | "customers.write"
  | "customers.delete"
  | "weights.write"
  | "weights.delete"
  | "sales.read"
  | "sales.write"
  | "sales.delete"
  | "feed.write"
  | "feed.delete"
  | "treatments.write"
  | "treatments.delete"
  | "users.manage"
  | "logs.read"
  | "suppliers.write"
  | "suppliers.delete"
  | "supplierPayments.write"
  | "employees.write";

const MATRIX: Record<Action, AppRole[]> = {
  "animals.write": ["admin", "manager", "worker"],
  "animals.delete": ["admin"],
  "barns.write": ["admin", "manager"],
  "barns.delete": ["admin"],
  "customers.write": ["admin", "manager", "worker", "accountant"],
  "customers.delete": ["admin"],
  "weights.write": ["admin", "manager", "worker"],
  "weights.delete": ["admin"],
  "sales.read": ["admin", "manager", "accountant"],
  "sales.write": ["admin", "manager", "accountant"],
  "sales.delete": ["admin"],
  "feed.write": ["admin", "manager", "worker"],
  "feed.delete": ["admin"],
  "treatments.write": ["admin", "manager", "worker"],
  "treatments.delete": ["admin"],
  "users.manage": ["admin"],
  "suppliers.write": ["admin", "manager", "accountant", "worker"],
  "suppliers.delete": ["admin"],
  "supplierPayments.write": ["admin", "manager", "accountant"],
  "employees.write": ["admin", "manager", "accountant"],
  "logs.read": ["admin", "manager", "accountant", "worker"],
};

export function can(role: AppRole | null | undefined, action: Action): boolean {
  if (!role) return false;
  return MATRIX[action].includes(role);
}
