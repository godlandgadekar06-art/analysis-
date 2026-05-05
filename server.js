const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const SESSION_COOKIE = "analysis_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_BODY_SIZE = 8 * 1024 * 1024;
const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const STATIC_FILES = new Set([
  "index.html",
  "public.html",
  "styles.css",
  "app.js",
  "public.js",
]);

const sessions = new Map();

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(
      STORE_PATH,
      JSON.stringify({ users: [], entries: [] }, null, 2),
      "utf8",
    );
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(body);
}

function text(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(payload);
}

function notFound(res) {
  json(res, 404, { error: "Not found." });
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const divider = trimmed.indexOf("=");
    const key = divider >= 0 ? trimmed.slice(0, divider).trim() : trimmed;
    const value = divider >= 0 ? trimmed.slice(divider + 1).trim() : "";
    cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    userId,
  });
  return token;
}

function destroySession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (token) {
    sessions.delete(token);
  }
}

function pruneSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(
      SESSION_TTL_MS / 1000,
    )}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
  );
}

function sanitizeUser(user) {
  return {
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    username: user.username,
  };
}

function getAuthUser(req, store) {
  pruneSessions();
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return null;
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return store.users.find((user) => user.id === session.userId) || null;
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!/^[a-z0-9_-]{3,24}$/.test(username)) {
    throw new Error(
      "Username must be 3 to 24 characters and use only letters, numbers, hyphens, or underscores.",
    );
  }
  return username;
}

function validateEmail(value) {
  const email = normalizeEmail(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  return password;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

function verifyPassword(password, hashedPassword) {
  const [salt, digest] = String(hashedPassword || "").split(":");
  if (!salt || !digest) {
    return false;
  }

  const attempted = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  if (attempted.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(attempted, expected);
}

function safeText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeLongText(value, maxLength) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function normalizeVisibility(value) {
  return value === "public" ? "public" : "private";
}

function sanitizeImage(image) {
  if (!image) {
    return null;
  }

  const dataUrl = String(image.dataUrl || "").trim();
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("Screenshot must be an image.");
  }

  if (dataUrl.length > 3_500_000) {
    throw new Error("Screenshot is too large after upload. Try a smaller image.");
  }

  return {
    dataUrl,
    height: Number(image.height) || 0,
    name: safeText(image.name || "screenshot", 120),
    type: safeText(image.type || "image/jpeg", 40),
    width: Number(image.width) || 0,
  };
}

function sanitizeEntryPayload(body) {
  const title = safeText(body.title, 140);
  if (!title) {
    throw new Error("Title is required.");
  }

  const date = safeText(body.date, 24);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Pick a valid date.");
  }

  return {
    bads: safeLongText(body.bads, 6000),
    date,
    goods: safeLongText(body.goods, 6000),
    image: sanitizeImage(body.image),
    title,
    visibility: normalizeVisibility(body.visibility),
  };
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const dateDiff = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(new Error("Request body must be valid JSON."));
      }
    });

    req.on("error", reject);
  });
}

function publicProfile(store, username) {
  const user = store.users.find((candidate) => candidate.username === username);
  if (!user) {
    return null;
  }

  const entries = sortEntries(
    store.entries.filter(
      (entry) => entry.userId === user.id && entry.visibility === "public",
    ),
  );

  return {
    entries,
    profile: {
      publicEntryCount: entries.length,
      username: user.username,
    },
  };
}

function serveFile(fileName, res) {
  if (!STATIC_FILES.has(fileName)) {
    notFound(res);
    return;
  }

  const absolutePath = path.join(__dirname, fileName);
  const extension = path.extname(fileName).toLowerCase();
  const contentType = CONTENT_TYPES[extension] || "application/octet-stream";

  try {
    const body = fs.readFileSync(absolutePath);
    res.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": body.length,
      "Content-Type": contentType,
    });
    res.end(body);
  } catch (error) {
    console.error(error);
    notFound(res);
  }
}

async function handleApi(req, res, url) {
  const store = readStore();

  if (req.method === "GET" && url.pathname === "/api/session") {
    const user = getAuthUser(req, store);
    json(res, 200, { user: user ? sanitizeUser(user) : null });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/signup") {
    const body = await readJsonBody(req);
    const username = validateUsername(body.username);
    const email = validateEmail(body.email);
    const password = validatePassword(body.password);

    if (store.users.some((user) => user.username === username)) {
      json(res, 409, { error: "That username is already taken." });
      return;
    }

    if (store.users.some((user) => user.email === email)) {
      json(res, 409, { error: "That email already has an account." });
      return;
    }

    const user = {
      createdAt: new Date().toISOString(),
      email,
      id: crypto.randomUUID(),
      passwordHash: hashPassword(password),
      username,
    };

    store.users.push(user);
    writeStore(store);

    const token = createSession(user.id);
    setSessionCookie(res, token);
    json(res, 201, { user: sanitizeUser(user) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readJsonBody(req);
    const identifier = String(body.identifier || "").trim().toLowerCase();
    const password = String(body.password || "");
    const user = store.users.find(
      (candidate) =>
        candidate.username === identifier || candidate.email === identifier,
    );

    if (!user || !verifyPassword(password, user.passwordHash)) {
      json(res, 401, { error: "Invalid username, email, or password." });
      return;
    }

    const token = createSession(user.id);
    setSessionCookie(res, token);
    json(res, 200, { user: sanitizeUser(user) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    destroySession(req);
    clearSessionCookie(res);
    json(res, 200, { ok: true });
    return;
  }

  const user = getAuthUser(req, store);

  if (req.method === "GET" && url.pathname.startsWith("/api/public/")) {
    const username = normalizeUsername(url.pathname.split("/").pop());
    const result = publicProfile(store, username);
    if (!result) {
      json(res, 404, { error: "Public profile not found." });
      return;
    }
    json(res, 200, result);
    return;
  }

  if (!user) {
    json(res, 401, { error: "Login required." });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/entries") {
    const entries = sortEntries(
      store.entries.filter((entry) => entry.userId === user.id),
    );
    json(res, 200, {
      entries,
      profile: {
        publicUrl: `/u/${user.username}`,
      },
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/entries") {
    const body = await readJsonBody(req);
    const payload = sanitizeEntryPayload(body);
    const now = new Date().toISOString();
    const entry = {
      ...payload,
      createdAt: now,
      id: crypto.randomUUID(),
      updatedAt: now,
      userId: user.id,
    };

    store.entries.push(entry);
    writeStore(store);
    json(res, 201, { entry });
    return;
  }

  const entryMatch = url.pathname.match(/^\/api\/entries\/([a-f0-9-]+)$/i);
  if (entryMatch) {
    const entryId = entryMatch[1];
    const entryIndex = store.entries.findIndex(
      (entry) => entry.id === entryId && entry.userId === user.id,
    );

    if (entryIndex === -1) {
      json(res, 404, { error: "Entry not found." });
      return;
    }

    if (req.method === "PUT") {
      const body = await readJsonBody(req);
      const payload = sanitizeEntryPayload(body);
      const existing = store.entries[entryIndex];
      const updated = {
        ...existing,
        ...payload,
        createdAt: existing.createdAt,
        id: existing.id,
        updatedAt: new Date().toISOString(),
        userId: existing.userId,
      };
      store.entries[entryIndex] = updated;
      writeStore(store);
      json(res, 200, { entry: updated });
      return;
    }

    if (req.method === "DELETE") {
      store.entries.splice(entryIndex, 1);
      writeStore(store);
      json(res, 200, { ok: true });
      return;
    }
  }

  notFound(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || `127.0.0.1:${PORT}`;
    const url = new URL(req.url || "/", `http://${host}`);

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      serveFile("index.html", res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/public.html") {
      serveFile("public.html", res);
      return;
    }

    if (req.method === "GET" && STATIC_FILES.has(url.pathname.slice(1))) {
      serveFile(url.pathname.slice(1), res);
      return;
    }

    if (req.method === "GET" && /^\/u\/[a-z0-9_-]{3,24}$/i.test(url.pathname)) {
      serveFile("public.html", res);
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    notFound(res);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: error.message || "Internal server error." });
  }
});

ensureStore();

server.listen(PORT, HOST, () => {
  console.log(
    `Analysis Journal running at http://127.0.0.1:${PORT} and bound to ${HOST}:${PORT}`,
  );
});
