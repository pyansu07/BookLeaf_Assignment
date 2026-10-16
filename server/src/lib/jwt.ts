import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { Role } from "@prisma/client";

export interface AuthTokenPayload {
  userId: string;
  role: Role;
  authorProfileId?: string;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "12h" });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}
