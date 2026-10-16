import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../middleware/errorHandler";
import { loginSchema } from "./auth.schema";
import { login } from "./auth.service";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many login attempts. Try again later." } },
});

authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await login(input);
    res.json(result);
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      include: { authorProfile: true },
    });
    if (!user) throw Errors.notFound("User not found");
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      authorProfileId: user.authorProfile?.id ?? null,
    });
  })
);
