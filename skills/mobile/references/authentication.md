# Mobile Authentication Reference

We use [Better Auth](https://www.better-auth.com) for authentication.

Reference docs: [Expo Integration](https://better-auth.com/docs/integrations/expo)

<preflight>
Before wiring, state your assumptions about which auth methods are needed (email/password, OAuth, magic link), which screens should be protected, where users land after sign-in, and whether sign-in/sign-up are separate screens or a single combined flow. The user will correct what's wrong.
</preflight>

<design_thinking>
Auth screens are the first impression for returning users. They should feel native to the mobile app, not like web forms dropped into React Native. Error states, loading states, keyboard handling, and deep-link return flows matter as much as the happy path.
</design_thinking>

## 1. Authentication Config
This uses the same Drizzle + D1 shape as the website template.

Create `packages/api/src/auth.ts`:

```ts
import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expo } from "@better-auth/expo";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./database/schema";

const db = drizzle(env.DB, { schema });

export const createAuth = (baseURL: string) =>
  betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [expo()],
    baseURL,
  });

// Static export for CLI schema generation
export const auth = createAuth("http://localhost:8787");
```

Keep the generated Better Auth schema in `packages/api/src/database/auth-schema.ts` and re-export it from `schema.ts`.

## 2. Generate Auth Schema

Run from `packages/api`:

```bash
bun x @better-auth/cli@latest generate --config=./src/auth.ts --output=./src/database/auth-schema.ts -y
```

## 3. Middleware

Create `packages/api/src/middleware/authentication.ts`:

```ts
import { createMiddleware } from "hono/factory";
import { createAuth } from "../auth";

const getBaseURL = (request: Request) => {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};

export const authMiddleware = createMiddleware(async (c, next) => {
  const auth = createAuth(getBaseURL(c.req.raw));
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    return next();
  }

  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});

export const authenticatedOnly = createMiddleware(async (c, next) => {
  const session = c.get("session");

  if (!session) {
    return c.json(
      {
        message: "You are not authenticated",
      },
      401,
    );
  }

  return next();
});
```

## 4. Auth Routes

Mount Better Auth in `packages/api/src/index.ts`:

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";

type Bindings = {
  DB: D1Database;
};

const getBaseURL = (request: Request) => {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};

const app = new Hono<{ Bindings: Bindings }>()
  .use("*", cors())
  .on(["POST", "GET"], "/api/auth/**", (c) => {
    const auth = createAuth(getBaseURL(c.req.raw));
    return auth.handler(c.req.raw);
  });

export type AppType = typeof app;
export default app;
```

## 5. Auth Client

Create `packages/app/src/lib/auth.ts`:

```ts
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  plugins: [
    expoClient({
      storage: SecureStore,
      scheme: "myapp",
      storagePrefix: "myapp",
    }),
  ],
});
```

Use the same scheme as `packages/app/app.json`.

## 6. Expo App Config

In `packages/app/app.json` add the app scheme:

```json
{
  "expo": {
    "scheme": "myapp"
  }
}
```

The scheme must match both the Better Auth trusted origin and the Expo client config.

## 7. Authentication Screens

Add sign-in and sign-up screens in `packages/app/src/screens/`.

Sign in:

```tsx
import { useState } from "react";
import { Button, TextInput, View } from "react-native";
import { authClient } from "../lib/auth";

export function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async () => {
    await authClient.signIn.email({
      email,
      password,
    });
  };

  return (
    <View>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
      <Button title="Sign in" onPress={handleSubmit} />
    </View>
  );
}
```

Sign up:

```tsx
await authClient.signUp.email({
  email,
  password,
  name,
});
```

## 8. Protected Requests From Expo

For authenticated requests from the mobile app to protected API routes, attach the Better Auth cookie from the Expo client.

Create a helper in `packages/app/src/lib/authenticated-fetch.ts`:

```ts
import { authClient } from "./auth";

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const cookie = authClient.getCookie();

  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
}
```

Use this helper when calling protected backend routes from the Expo app.
