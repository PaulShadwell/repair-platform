import type { NextFunction, Response } from "express";
import type { RoleKey } from "@prisma/client";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { AuthenticatedRequest } from "../types.js";

type JwtPayload = {
  sub: string;
  username: string;
  fullName: string;
  roles: string[];
};

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing bearer token" });
    return;
  }

  const token = authHeader.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = {
      id: payload.sub,
      username: payload.username,
      fullName: payload.fullName,
      roles: payload.roles as RoleKey[],
    };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
