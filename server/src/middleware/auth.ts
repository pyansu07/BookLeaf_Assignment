import type { NextFunction, Request, Response } from "express";
import { verifyToken, type AuthTokenPayload } from "../lib/jwt";
import { Errors } from "../lib/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw Errors.unauthorized();
  }
  const token = header.slice("Bearer ".length);
  try {
    req.auth = verifyToken(token);
  } catch {
    throw Errors.unauthorized("Invalid or expired token");
  }
  next();
}

export function requireRole(...roles: Array<"AUTHOR" | "ADMIN">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      throw Errors.forbidden();
    }
    next();
  };
}
