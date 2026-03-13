import type { RoleKey } from "@prisma/client";

type Permission =
  | "repairs:view_all"
  | "repairs:assign"
  | "repairs:update"
  | "repairs:print"
  | "repairs:create"
  | "repairs:edit_pos_fields"
  | "repairs:edit_repair_fields"
  | "users:manage";

const permissionMap: Record<RoleKey, Permission[]> = {
  ADMIN: [
    "repairs:view_all",
    "repairs:assign",
    "repairs:update",
    "repairs:print",
    "repairs:create",
    "repairs:edit_pos_fields",
    "repairs:edit_repair_fields",
    "users:manage",
  ],
  POS_USER: [
    "repairs:view_all",
    "repairs:assign",
    "repairs:print",
    "repairs:create",
    "repairs:edit_pos_fields",
  ],
  SUPERVISOR: [
    "repairs:view_all",
    "repairs:assign",
    "repairs:update",
    "repairs:print",
    "repairs:create",
    "repairs:edit_pos_fields",
    "repairs:edit_repair_fields",
    "users:manage",
  ],
  REPAIRER: [
    "repairs:view_all",
    "repairs:assign",
    "repairs:update",
    "repairs:print",
    "repairs:edit_repair_fields",
  ],
};

export function hasPermission(roles: RoleKey[], permission: Permission): boolean {
  return roles.some((role) => permissionMap[role]?.includes(permission));
}

export function isAdmin(roles: RoleKey[]): boolean {
  return roles.includes("ADMIN");
}
