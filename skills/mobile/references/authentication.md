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

Create `packages/api/src/auth.ts`:

```ts
import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expo } from "@better-auth/expo";
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
      if (origin) return ["myapp://", origin];
      return ["myapp://"];
    },
  });
}

// Static export for CLI schema generation
export const auth = createAuth("http://localhost:8787");
```

Key points:
- `BETTER_AUTH_SECRET` comes from Cloudflare Workers secrets (set via `wrangler secret put BETTER_AUTH_SECRET`).
- `trustedOrigins` must include the app scheme (e.g. `myapp://`) so the Expo client can authenticate across origins.
- The scheme in `trustedOrigins` must match the scheme in `app.json` and the Expo client config.

Keep the generated Better Auth schema in `packages/api/src/database/auth-schema.ts` and re-export it from `schema.ts`.

## 2. Generate Auth Schema

Run from `packages/api`:

```bash
bun x @better-auth/cli@latest generate --config=./src/auth.ts --output=./src/database/auth-schema.ts -y
```

Then ensure `packages/api/src/database/schema.ts` re-exports it:

```ts
export * from "./auth-schema";
```

## 3. Middleware

Create `packages/api/src/middleware/authentication.ts`:

```ts
import { createMiddleware } from "hono/factory";
import { createAuth } from "../auth";

function getBaseURL(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

// Attaches session and user to the Hono context if authenticated.
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

// Use this middleware to protect routes — only authenticated users can access them.
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

function getBaseURL(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

const app = new Hono<{ Bindings: Bindings }>().basePath("api");

app.use(cors({ origin: "*" }));

app.on(["POST", "GET"], "/auth/**", (c) => {
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

The `scheme` must match `packages/app/app.json` and the `trustedOrigins` in `auth.ts`.

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
import { Button, TextInput, View, Text, ActivityIndicator } from "react-native";
import { authClient } from "../lib/auth";

export function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await authClient.signIn.email({ email, password });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
      {error && <Text style={{ color: "red" }}>{error}</Text>}
      {loading ? <ActivityIndicator /> : <Button title="Sign in" onPress={handleSubmit} />}
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

Design requirements:
- Do not ship barebones forms. Match the app's visual language.
- Include loading, error, and success states.
- Use `KeyboardAvoidingView` for form screens.
- Handle keyboard dismiss on tap outside.

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

## 9. Session-Aware Navigation

Wrap your root navigator to redirect unauthenticated users:

```tsx
import { authClient } from "./src/lib/auth";

function App() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <LoadingScreen />;

  return (
    <NavigationContainer>
      {session ? <AuthenticatedStack /> : <UnauthenticatedStack />}
    </NavigationContainer>
  );
}
```

## Testing

After implementing authentication, verify it works end-to-end:

1. Run `bun build` — no type or build errors.
2. Start dev servers with `bun dev`.
3. Use `mb` (browser tool) to open the Expo web preview:
   - Navigate to sign-up screen, create an account, verify redirect to authenticated home.
   - Sign out, verify redirect to sign-in screen.
   - Sign in with the created account, verify session persists across navigation.
   - Attempt to visit a protected screen while signed out — verify redirect/401.
4. For native-only flows (SecureStore, deep-link return), note in delivery that these need on-device testing via Expo Go.
