import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import { Errors } from "../../lib/errors";
import type { LoginInput } from "./auth.schema";

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: { authorProfile: true },
  });

  if (!user) {
    throw Errors.unauthorized("Invalid email or password");
  }

  const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordValid) {
    throw Errors.unauthorized("Invalid email or password");
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    authorProfileId: user.authorProfile?.id,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      authorProfileId: user.authorProfile?.id ?? null,
    },
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
