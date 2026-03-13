import type { Request } from "express";
import type { RoleKey } from "@prisma/client";

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  roles: RoleKey[];
};

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
