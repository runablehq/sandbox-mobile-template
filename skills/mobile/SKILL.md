---
name: mobile
description: Use for any mobile app creation task — planning, designing, implementing screens, components, API routes, and delivering.
---

# Mobile App

## Stack

- **App**: Expo (React Native) — iOS, Android, Web
- **API**: Cloudflare Workers with Hono + Vite
- **Data Fetching**: Hono RPC Client + React Query
- **Styling**: React Native StyleSheet or NativeWind (Tailwind for RN)

## Preflight

1. Ask questions: purpose, target platforms (iOS/Android/both), need templates (MUST confirm — assume YES if unclear), style, screens, features.
2. If templates wanted, call `show_templates` with relevant `query` and `type: mobile`. This must be its own standalone call.
3. Form a plan. State assumptions as decisions — the user corrects what's wrong. Include: what's being built, screens needed, navigation structure, API endpoints, visual direction. Prepare a detailed outline covering the app and design guidelines for consistent theming.

Do not start implementation until the user approves or adjusts the plan.

## Workflow

1. Run preflight.
2. Read this project's `README.md` for structure reference.
3. Write `design.md` in the project root with the design direction from preflight (fonts, colors, spacing, style). See [design guidelines](./design.md). This file guides all UI code for consistency.
4. Build screens, components, API routes.
5. Verify with `bun build` to ensure no errors.
6. Call `deliver` with `type: mobile-app`, project folder path at index 0.

## Project Structure

```
packages/
├── app/                    # Expo mobile app
│   ├── App.tsx             # Root component
│   ├── app.json            # Expo config
│   ├── assets/             # Icons, splash screens
│   └── src/
│       ├── screens/        # Screen components
│       ├── components/     # Reusable components (providers.tsx)
│       ├── navigation/     # Navigation config
│       ├── hooks/          # Custom hooks
│       ├── lib/            # API client, utilities
│       └── constants/      # Colors, fonts, config
│
└── api/                    # Cloudflare Workers API
    └── src/
        └── index.ts        # Hono routes (exports AppType)
```

## Development

```bash
bun dev              # Start both app and API
bun dev --app        # App only (Expo on :8081)
bun dev --api        # API only (Vite on :8787)
bun build            # Build both (verify no errors)
```

## Preview & Testing

The sandbox provides two ways for users to preview the app:

1. **Web Preview**: Automatic browser preview at the sandbox URL
2. **Expo Go**: Users can scan the QR code with the Expo Go app on their phone to test on a real device

The Expo dev server provides a QR code for testing on physical devices with Expo Go.

## API Integration

The app uses Hono's type-safe RPC client with React Query for data fetching. The API package is installed as a workspace dependency for type sharing.

### API Routes (packages/api/src/index.ts)

Define routes using method chaining to preserve types:

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  // Add bindings here (D1, R2, KV, etc.)
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

// Export type for RPC client
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
      staleTime: 1000 * 60, // 1 minute
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

  // Fetch items
  const { data, isLoading } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const res = await api.api.items.$get();
      return res.json();
    },
  });

  // Create item
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

### App Root (App.tsx)

Wrap your app with Providers:

```tsx
import { Providers } from "./src/components/providers";

export default function App() {
  return (
    <Providers>
      <HomeScreen />
    </Providers>
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

For production, set to your deployed API URL.

## Design Guidelines

See [design.md](./design.md) for full design guidelines. Write a `design.md` in the project after setup to document fonts, colors, spacing, and style before writing UI code.

## Deployment

### API (Cloudflare Workers)

```bash
cd packages/api
bun run deploy
```

### App (EAS Build)

For production app store builds, users can run EAS Build from their local machine or CI:

```bash
cd packages/app
eas build --platform ios
eas build --platform android
```

## Testing

Before delivering, verify:
1. `bun build` passes with no errors
2. API endpoints respond correctly
3. React Query fetches data properly
4. No console errors or warnings
