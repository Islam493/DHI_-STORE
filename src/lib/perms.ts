// الصلاحيات: المدير (admin) كلشي، الفريق (staff) الطلبيات والزبائن
export type Role = "admin" | "staff";
export const PERMS = {
  "orders.view": ["admin", "staff"],
  "orders.edit": ["admin", "staff"],
  "orders.ship": ["admin", "staff"],
  "orders.delete": ["admin"],
  "orders.export": ["admin"],
  "block": ["admin", "staff"],
  "customers.view": ["admin", "staff"],
  "customers.edit": ["admin", "staff"],
  "products.view": ["admin", "staff"],
  "products.edit": ["admin"],
  "inventory.edit": ["admin"],
  "reviews.edit": ["admin", "staff"],
  "stats.view": ["admin"],
  "shipping.edit": ["admin"],
  "settings.edit": ["admin"],
  "users.manage": ["admin"],
  "audit.view": ["admin"],
} as const satisfies Record<string, Role[]>;
export type Perm = keyof typeof PERMS;
export const can = (role: Role | undefined, perm: Perm) => !!role && (PERMS[perm] as readonly Role[]).includes(role);
export const roleLabel: Record<Role, string> = { admin: "مدير", staff: "موظف" };
