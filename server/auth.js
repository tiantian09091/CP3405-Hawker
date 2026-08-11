import crypto from "node:crypto";

const SESSION_AGE = 14 * 24 * 60 * 60;

const cleanEmail = (value) => String(value ?? "").trim().toLowerCase().slice(0, 160);

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return `${salt}:${crypto.scryptSync(String(password), salt, 64).toString("hex")}`;
}

function matchesPassword(password, stored) {
  const [salt, expectedHex] = String(stored ?? "").split(":");
  if (!salt || !expectedHex) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const safeUser = (user) => user ? ({ id: user.id, name: user.name, email: user.email, role: user.role, stall: user.stall ?? null }) : null;

function readCookie(request, name) {
  for (const item of String(request.headers.cookie ?? "").split(";")) {
    const [key, ...parts] = item.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return null;
}

function makeSessionCookie(token, request) {
  const secure = process.env.NODE_ENV === "production" || request.headers["x-forwarded-proto"] === "https";
  return [`hf_session=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${SESSION_AGE}`, secure ? "Secure" : null].filter(Boolean).join("; ");
}

export async function ensureAccounts(store) {
  const state = await store.getState();
  let changed = false;
  if (!Array.isArray(state.users)) { state.users = []; changed = true; }
  if (!Array.isArray(state.sessions)) { state.sessions = []; changed = true; }
  const email = cleanEmail(process.env.DEMO_HAWKER_EMAIL || "hawker@hawkerforecast.sg");
  const configuredPassword = process.env.DEMO_HAWKER_PASSWORD || "Hawker2026!";
  const existingHawker = state.users.find((user) => user.email === email);
  if (!existingHawker) {
    state.users.push({
      id: crypto.randomUUID(), name: "Ahmad Bin Ismail", email,
      passwordHash: hashPassword(configuredPassword),
      role: "hawker", stall: "Laksa & More · Stall 02-45", createdAt: new Date().toISOString(),
    });
    changed = true;
  } else if (process.env.DEMO_HAWKER_PASSWORD) {
    existingHawker.passwordHash = hashPassword(configuredPassword);
    changed = true;
  }
  const active = state.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now());
  if (active.length !== state.sessions.length) { state.sessions = active; changed = true; }
  if (changed) await store.setState(state);
}

export function authMiddleware(store) {
  return async (request, response, next) => {
    const token = readCookie(request, "hf_session");
    if (token) {
      const state = await store.getState();
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const session = state.sessions.find((item) => item.tokenHash === tokenHash && new Date(item.expiresAt).getTime() > Date.now());
      request.user = safeUser(state.users.find((user) => user.id === session?.userId));
    }
    next();
  };
}

export function requireHawker(request, response, next) {
  if (!request.user) return response.status(401).json({ error: "Please sign in as a hawker to continue." });
  if (request.user.role !== "hawker") return response.status(403).json({ error: "This account cannot access hawker planning." });
  next();
}

export function installAuthRoutes(app, store, asyncRoute, saveMutation) {
  app.get("/api/auth/me", (request, response) => response.json({ user: request.user ?? null }));

  app.post("/api/auth/register", asyncRoute(async (request, response) => {
    const name = String(request.body.name ?? "").trim().slice(0, 80);
    const email = cleanEmail(request.body.email);
    const password = String(request.body.password ?? "");
    if (name.length < 2 || !email.includes("@") || password.length < 8) {
      return response.status(400).json({ error: "Enter your name, a valid email and a password with at least 8 characters." });
    }
    let user;
    await saveMutation((state) => {
      if (state.users.some((item) => item.email === email)) throw Object.assign(new Error("This email is already registered."), { status: 409 });
      user = { id: crypto.randomUUID(), name, email, passwordHash: hashPassword(password), role: "customer", createdAt: new Date().toISOString() };
      state.users.push(user);
    });
    response.status(201).json({ user: safeUser(user) });
  }));

  app.post("/api/auth/login", asyncRoute(async (request, response) => {
    const state = await store.getState();
    const user = state.users.find((item) => item.email === cleanEmail(request.body.email));
    if (!user || !matchesPassword(request.body.password, user.passwordHash)) return response.status(401).json({ error: "Email or password is incorrect." });
    const token = crypto.randomBytes(32).toString("base64url");
    await saveMutation((draft) => draft.sessions.push({
      id: crypto.randomUUID(), userId: user.id,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + SESSION_AGE * 1000).toISOString(),
    }));
    response.setHeader("Set-Cookie", makeSessionCookie(token, request));
    response.json({ user: safeUser(user) });
  }));

  app.post("/api/auth/logout", asyncRoute(async (request, response) => {
    const token = readCookie(request, "hf_session");
    if (token) {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await saveMutation((state) => { state.sessions = state.sessions.filter((item) => item.tokenHash !== tokenHash); });
    }
    response.setHeader("Set-Cookie", "hf_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    response.json({ ok: true });
  }));
}
