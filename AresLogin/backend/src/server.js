
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const db = require("./db");

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (
  !SESSION_SECRET ||
  SESSION_SECRET === "replace_this_with_a_random_secret" ||
  SESSION_SECRET.length < 32
) {
  throw new Error(
    "Set SESSION_SECRET in backend/.env to a random secret of at least 32 characters."
  );
}

const isProduction = process.env.NODE_ENV === "production";

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many attempts. Please wait 15 minutes and try again.",
  },
});

const COOKIE_NAME = "ares_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
  };
}

function createSession(user, res) {
  const token = jwt.sign(
    { sub: String(user.id) },
    SESSION_SECRET,
    { expiresIn: "7d", issuer: "ares-auth" }
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS,
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ message: "Please sign in." });
  }

  try {
    const payload = jwt.verify(token, SESSION_SECRET, {
      issuer: "ares-auth",
    });

    const user = db
      .prepare(
        "SELECT id, name, email, created_at FROM users WHERE id = ?"
      )
      .get(Number(payload.sub));

    if (!user) {
      return res.status(401).json({ message: "Session is no longer valid." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
}

app.get("/", (req, res) => {
  res.json({
    name: "Ares Auth API",
    status: "online",
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/register", authLimiter, async (req, res, next) => {
  try {
    const name =
      typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({
        message: "Name must be between 2 and 80 characters.",
      });
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({
        message: "Enter a valid email address.",
      });
    }

    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        message: "Password must be at least 8 characters and no more than 72 bytes.",
      });
    }

    const existingUser = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = db
      .prepare(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
      )
      .run(name, email, passwordHash);

    const user = db
      .prepare(
        "SELECT id, name, email, created_at FROM users WHERE id = ?"
      )
      .get(result.lastInsertRowid);

    createSession(user, res);

    return res.status(201).json({
      message: "Account created successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    next(error);
  }
});

app.post("/api/auth/login", authLimiter, async (req, res, next) => {
  try {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    createSession(user, res);

    return res.json({
      message: "Signed in successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });

  res.json({ message: "Signed out successfully." });
});

app.use((err, req, res, next) => {
  // Do not log request bodies, passwords, cookies, or authentication tokens.
  console.error("Request failed:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    message: "An unexpected server error occurred.",
  });
});

app.listen(PORT, () => {
  console.log(`Ares Auth API listening at http://localhost:${PORT}`);
});
