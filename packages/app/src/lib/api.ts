import { hc } from "hono/client";
import type { AppType } from "@sandbox/api";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export const api = hc<AppType>(API_URL);
