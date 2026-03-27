import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

type WorkerEnv = {
  DB: D1Database;
};

const workerEnv = env as unknown as WorkerEnv;

export const database = drizzle(workerEnv.DB, { schema });
