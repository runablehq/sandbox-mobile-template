---
name: mobile
description: Use for any mobile app creation task — planning, designing, implementing screens, components, API routes, and delivering. Includes authentication, email, and AI agent capabilities as optional modules.
---

# Mobile App

## Stack

- **App**: Expo (React Native) — iOS, Android, Web
- **API**: Cloudflare Workers with Hono + Vite (deployed separately)
- **Database**: Cloudflare D1 (SQLite) via Drizzle ORM
- **Data Fetching**: Hono RPC Client + React Query
- **Styling**: React Native StyleSheet or NativeWind (Tailwind for RN)

## Preflight

1. Ask questions: purpose, target platforms (iOS/Android/both), need templates (MUST confirm — assume YES if unclear), style, screens, features.
2. If templates wanted, call `show_templates` with relevant `query` and `type: mobile`. This must be its own standalone call.
3. Form a plan. State assumptions as decisions — the user corrects what's wrong. Include: what's being built, screens needed, navigation structure, API endpoints, visual direction. Prepare a detailed outline covering the app and design guidelines for consistent theming.

Do not start implementation until the user approves or adjusts the plan.

## Design Guidelines

Document design direction in `design.md` inside the project root before writing UI code. Reference it throughout for consistency.

- **Typography**: system fonts for performance, or load custom fonts via `expo-font`. Clear hierarchy through size/weight: title (28/700), heading (20/600), body (16/400), caption (14/400). Minimum 16px body, 14px captions. Consider Dynamic Type / font scaling accessibility.
- **Color**: semantic colors — primary, secondary, background, surface, text, textSecondary, error. Support light and dark modes from the start using `useColorScheme()`. Ensure WCAG AA contrast. Define both palettes upfront.
- **Spacing**: consistent scale (4, 8, 12, 16, 24, 32, 48). Generous padding in containers (16–24px horizontal). Adequate spacing between list items (12–16px). Safe area awareness for notches and home indicators.
- **Touch Targets**: minimum 44x44pt (Apple HIG). Adequate spacing between interactive elements. Visual feedback on press (opacity, scale, or color change).
- **Layout**: `SafeAreaView` for screen containers. Flexbox for all layouts. `ScrollView` or `FlatList` for scrollable content. `KeyboardAvoidingView` for forms. Respect platform conventions (iOS vs Android).
- **Animation**: use `react-native-reanimated` for complex animations. Keep animations subtle and purposeful (200–300ms). Respect reduced motion preferences. Layout animations for list changes.
- **Platform**: use `Platform.select()` for platform-specific styles (iOS shadows vs Android elevation). Test on both platforms regularly.
- **Anti-patterns** (will feel broken): tiny touch targets (< 44pt), text smaller than 14px, no dark mode support, ignoring safe areas, web-like designs that don't feel native, overloaded screens with too much content, missing loading and error states.

```ts
// Example color palette
const colors = {
  light: {
    primary: "#007AFF",
    background: "#FFFFFF",
    surface: "#F2F2F7",
    text: "#000000",
    textSecondary: "#8E8E93",
  },
  dark: {
    primary: "#0A84FF",
    background: "#000000",
    surface: "#1C1C1E",
    text: "#FFFFFF",
    textSecondary: "#8E8E93",
  },
};

// Example spacing scale
const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Example typography
const typography = {
  title: { fontSize: 28, fontWeight: "700" },
  heading: { fontSize: 20, fontWeight: "600" },
  body: { fontSize: 16, fontWeight: "400" },
  caption: { fontSize: 14, fontWeight: "400", color: "#666" },
};
```

## Workflow

1. Run preflight.
2. Read this project's `README.md` for structure reference.
3. Write `design.md` in the project root with the design direction from preflight (fonts, colors, spacing, style). This file guides all UI code for consistency.
4. Load any relevant feature reference from `./references/` before implementing specialized capabilities.
5. Build screens, components, API routes, database schema.
6. Verify with `bun build` to ensure no errors.
7. Test each implemented feature using `mb` (browser tool) against the Expo web preview. See [Testing](#testing).
8. Call `deliver` with `type: mobile-app`, project folder path at index 0.

## Optional Capabilities

For optional capabilities, consult the matching reference **before** implementation:

- Authentication: [references/authentication.md](references/authentication.md)
- Email: [references/email.md](references/email.md)
- AI agent flows: [references/ai-agent.md](references/ai-agent.md)

## Project Structure

```
packages/
├── app/                    # Expo mobile app
│   ├── App.tsx             # Root component
│   ├── app.json            # Expo config (scheme, icons, splash)
│   ├── index.ts            # Entry point
│   ├── assets/             # Icons, splash screens
│   └── src/
│       ├── screens/        # Screen components
│       ├── components/     # Reusable components (providers.tsx)
│       ├── navigation/     # Navigation config
│       ├── hooks/          # Custom hooks
│       ├── lib/            # API client, auth client, utilities
│       └── constants/      # Colors, fonts, config
│
└── api/                    # Cloudflare Workers API (deployed separately)
    ├── src/
    │   ├── index.ts        # Hono routes (exports AppType)
    │   ├── auth.ts         # Better Auth config
    │   ├── agent/          # AI agent config + tools
    │   ├── routes/         # Route modules
    │   ├── middleware/      # Auth middleware, etc.
    │   └── database/
    │       ├── schema.ts       # Drizzle schema (re-exports)
    │       ├── auth-schema.ts  # Generated Better Auth tables
    │       └── migrations/     # D1 migrations
    ├── wrangler.json       # Cloudflare config
    ├── vite.config.ts      # Vite + Cloudflare plugin
    └── drizzle.config.ts   # Drizzle Kit config
```

## Development

```bash
bun dev              # Start both app and API
bun dev --app        # App only (Expo on :8081)
bun dev --api        # API only (Vite on :8787)
bun build            # Build both (verify no errors)
```

## Preview

The sandbox provides two ways to preview the app:

1. **Web Preview**: Automatic browser preview at the sandbox URL (Expo web export)
2. **Expo Go**: Users scan the QR code with the Expo Go app on their phone

## API Integration

The app uses Hono's type-safe RPC client with React Query for data fetching. The API package is installed as a workspace dependency (`@sandbox/api`) for type sharing.

**Important**: The API is deployed separately from the app. The Expo client connects to the API via `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:8787` in dev).

### API Routes (packages/api/src/index.ts)

Define routes using method chaining to preserve types:

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>()
  .use("*", cors())
  .get("/api/health", (c) => {
    return c.json({ status: "ok", timestamp: Date.now() });
  })
  .get("/api/items", (c) => {
    return c.json({ items: [{ id: "1", name: "Item 1" }] });
  })
  .post("/api/items", async (c) => {
    const body = await c.req.json<{ name: string }>();
    return c.json({ id: crypto.randomUUID(), name: body.name });
  });

export type AppType = typeof app;
export default app;
```

### API Client (packages/app/src/lib/api.ts)

```ts
import { hc } from "hono/client";
import type { AppType } from "@sandbox/api";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export const api = hc<AppType>(API_URL);
```

### Providers (packages/app/src/components/providers.tsx)

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Using in Components

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

function ItemList() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const res = await api.api.items.$get();
      return res.json();
    },
  });

  const createItem = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.api.items.$post({ json: { name } });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  if (isLoading) return <ActivityIndicator />;

  return (
    <View>
      {data?.items.map((item) => (
        <Text key={item.id}>{item.name}</Text>
      ))}
      <Button title="Add Item" onPress={() => createItem.mutate("New Item")} />
    </View>
  );
}
```

## Navigation

Install React Navigation:

```bash
cd packages/app
bun add @react-navigation/native @react-navigation/native-stack
bun add react-native-screens react-native-safe-area-context
```

Setup in `App.tsx`:

```tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Providers } from "./src/components/providers";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <Providers>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Details" component={DetailsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </Providers>
  );
}
```

## Environment Variables

Create `.env` in `packages/app`:

```
EXPO_PUBLIC_API_URL=http://localhost:8787
```

For production, set this to your deployed API URL.

The API uses Cloudflare Workers environment bindings configured in `wrangler.json` (D1, secrets, etc.).

## Deployment

### API (Cloudflare Workers)

```bash
cd packages/api
bun run deploy
```

### App (EAS Build)

For production app store builds:

```bash
cd packages/app
eas build --platform ios
eas build --platform android
```

## Testing

Before delivering, **verify every implemented feature actually works**. Do not deliver untested code.

### 1. Build Validation

Run `bun build` from the project root. Fix all errors before proceeding.

### 2. API Smoke Test

Start the dev servers with `bun dev`. Use `curl` or the browser tool to hit API endpoints directly:

```bash
curl http://localhost:8787/api/health
```

### 3. Browser-Based Flow Testing

Use the `mb` (mini-browser) tool to exercise the Expo web preview for every user-facing feature:

- **Authentication**: Open the web preview, navigate to sign-up, create an account, sign out, sign back in. Verify protected screens redirect unauthenticated users. Verify session persists across navigation.
- **Email**: Trigger the flow that sends email (e.g. contact form, welcome on sign-up). Verify the API responds successfully and the UI shows the correct success/error state.
- **AI Agent**: Open the chat screen, send a prompt, verify streaming text appears. If tools are configured, trigger a tool call and verify the result renders.
- **General UI**: Navigate between screens. Verify loading states, error states, empty states. Check no console errors.

### 4. Native-Only Behaviors

Some features (push notifications, secure storage, biometrics) cannot be tested via web preview. For these:
- Verify the code compiles (`bun build`)
- Call out explicitly in your delivery notes which features need on-device testing
- Recommend the user test via Expo Go on a physical device

**Do not mark a feature as done until you have tested it.**
