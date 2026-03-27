import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";

type Bindings = {
  DB: D1Database;
};

function getBaseURL(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

const app = new Hono<{ Bindings: Bindings }>().basePath("api");

app.use(
  cors({
    origin: "*",
  }),
);

app.on(["POST", "GET"], "/auth/**", (c) => {
  const auth = createAuth(getBaseURL(c.req.raw));
  return auth.handler(c.req.raw);
});

app.get("/ping", (c) => {
  return c.json({ message: `Pong! ${Date.now()}` });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: Date.now() });
});

app.get("/", (c) => {
  return c.json({ message: "Hello from Cloudflare Workers!" });
});

export type AppType = typeof app;
export default app;
