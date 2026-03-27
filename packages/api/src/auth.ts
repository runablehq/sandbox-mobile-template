import { env } from "cloudflare:workers";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./database/schema";

type WorkerEnv = {
  BETTER_AUTH_SECRET: string;
  DB: D1Database;
};

const workerEnv = env as unknown as WorkerEnv;
const db = drizzle(workerEnv.DB, { schema });

export function createAuth(baseURL: string) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [expo()],
    secret: workerEnv.BETTER_AUTH_SECRET,
    baseURL,
    trustedOrigins: async (request) => {
      const origin = request?.headers.get("origin");
      if (origin) return ["sandboxmobile://", origin];
      return ["sandboxmobile://"];
    },
  });
}

export const auth = createAuth("http://localhost:8787");
