import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  // Add your bindings here (D1, R2, KV, etc.)
};

const app = new Hono<{ Bindings: Bindings }>()
  .use("*", cors())
  .get("/", (c) => {
    return c.json({ message: "Hello from Cloudflare Workers!" });
  })
  .get("/api/health", (c) => {
    return c.json({ status: "ok", timestamp: Date.now() });
  });

export type AppType = typeof app;
export default app;
