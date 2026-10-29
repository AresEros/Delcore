import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import db from "./db.js";
import { createSessionCookie, clearSessionCookie, requireAuth } from "./auth.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 ||
    process.env.JWT_SECRET === "replace-this-with-a-long-random-secret-before-running") {
  console.error("Set JWT_SECRET in backend/.env to a unique random string of at least 32 characters.");
  process.exit(1);
}

const app = express();
const port = Number(process.env.PORT || 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait a few minutes and try again." }
});

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72)
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(72)
});

const publicUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  createdAt: row.created_at
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/auth/register", authLimiter, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message || "Please check your details."
      });
    }

    const name = parsed.data.name;
    const email = parsed.data.email.toLowerCase();
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const result = db.prepare(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
    ).run(name, email, passwordHash);

    const user = db.prepare(
      "SELECT id, name, email, created_at FROM users WHERE id = ?"
    ).get(Number(result.lastInsertRowid));

    createSessionCookie(res, user.id);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    next(error);
  }
});

app.post("/api/auth/login", authLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message || "Enter your email and password."
      });
    }

    const email = parsed.data.email.toLowerCase();
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    const passwordMatches = user
      ? await bcrypt.compare(parsed.data.password, user.password_hash)
      : false;

    if (!user || !passwordMatches) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }

    createSessionCookie(res, user.id);
    return res.json({
      user: publicUser({
        id: user.id, name: user.name, email: user.email, created_at: user.created_at
      })
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = db.prepare(
    "SELECT id, name, email, created_at FROM users WHERE id = ?"
  ).get(req.userId);

  if (!user) {
    clearSessionCookie(res);
    return res.status(401).json({ message: "Account not found. Please sign in again." });
  }

  res.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(200).json({ message: "You have been signed out." });
});

app.use((err, _req, res, _next) => {
  console.error("API error:", err?.message || "Unknown error");
  res.status(500).json({ message: "Something went wrong. Please try again." });
});

app.listen(port, () => {
  console.log(`Ares Auth API listening at http://localhost:${port}`);
});
