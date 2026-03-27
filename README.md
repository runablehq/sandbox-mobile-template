# Sandbox Mobile Template

A monorepo template for building mobile apps with Expo and a Cloudflare Workers API.

## Structure

```
packages/
├── app/    # Expo mobile app (iOS, Android, Web)
└── api/    # Cloudflare Workers API with Hono
```

## Getting Started

```bash
bun install
bun dev
```

This starts both servers concurrently:
- **API**: http://localhost:8787
- **App**: Expo dev server (press `i` for iOS, `a` for Android, `w` for web)

## Individual Package Commands

```bash
# Mobile app
cd packages/app
bun run start         # Start Expo dev server
bun run ios           # Run on iOS simulator
bun run android       # Run on Android emulator
bun run web           # Run in browser

# API
cd packages/api
bun run dev           # Start dev server
bun run build         # Build for production
bun run deploy        # Deploy to Cloudflare Workers
```
