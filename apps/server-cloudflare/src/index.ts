import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { authMiddleware } from "./middleware/auth";
import { auth } from "./routes/auth";
import { health } from "./routes/health";
import { schemas } from "./routes/schemas";
import { records } from "./routes/records";
import { logs } from "./routes/logs";

const app = new Hono<{ Bindings: Env }>();

// CORS — allow all origins for development
app.use("/*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Auth middleware for /api/* (excludes /health and /api/auth/login)
app.use("/api/*", authMiddleware);

// Routes
app.route("/health", health);
app.route("/api/auth", auth);
app.route("/api/schemas", schemas);
app.route("/api/records", records);
app.route("/api/logs", logs);

// 404 fallback
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message ?? "Internal server error" }, 500);
});

export default app;
