import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import config from "../config/index.ts";
import prisma from "../config/database.ts";
import { sendSuccess, sendError } from "../utils/response.ts";
import { registerSchema, loginSchema } from "../validators/index.ts";

function setTokenCookie(res: Response, token: string): void {
  res.cookie("token", token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const data = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    sendError(res, "DUPLICATE_EMAIL", "Email already registered", 409);
    return;
  }

  const passwordHash = await bcrypt.hash(data.password, config.bcryptRounds);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role as any,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const token = jwt.sign({ userId: user.id, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  });

  setTokenCookie(res, token);

  await prisma.activityLog.create({
    data: { userId: user.id, action: "USER_REGISTERED", entity: "User", entityId: user.id },
  });

  sendSuccess(res, { user }, "Registered successfully", 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    sendError(res, "INVALID_CREDENTIALS", "Invalid email or password", 401);
    return;
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    sendError(res, "INVALID_CREDENTIALS", "Invalid email or password", 401);
    return;
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  });

  setTokenCookie(res, token);

  await prisma.activityLog.create({
    data: { userId: user.id, action: "USER_LOGIN", entity: "User", entityId: user.id },
  });

  sendSuccess(res, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    },
  }, "Logged in successfully");
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie("token", { httpOnly: true, secure: config.isProduction, sameSite: config.isProduction ? "none" : "lax", path: "/" });
  sendSuccess(res, null, "Logged out successfully");
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    sendError(res, "UNAUTHORIZED", "Not authenticated", 401);
    return;
  }
  sendSuccess(res, { user: req.user });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    sendError(res, "UNAUTHORIZED", "Not authenticated", 401);
    return;
  }

  const token = jwt.sign({ userId: req.user.id, role: req.user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  });

  setTokenCookie(res, token);
  sendSuccess(res, { user: req.user });
}
