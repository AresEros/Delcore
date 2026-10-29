import jwt from "jsonwebtoken";

const COOKIE_NAME = "ares_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function createSessionCookie(res, userId) {
  const token = jwt.sign(
    { sub: String(userId) },
    process.env.JWT_SECRET,
    { expiresIn: "7d", issuer: "ares-auth", audience: "ares-client" }
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/"
  });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ message: "Please sign in to continue." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "ares-auth",
      audience: "ares-client"
    });
    req.userId = Number(payload.sub);
    if (!Number.isSafeInteger(req.userId) || req.userId < 1) {
      return res.status(401).json({ message: "Your session is invalid. Please sign in again." });
    }
    next();
  } catch {
    clearSessionCookie(res);
    return res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
}
