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
- **App**: Expo dev server with QR code for Expo Go

## Preview

1. **Web**: Open the web preview URL in browser
2. **Mobile**: Scan QR code with [Expo Go](https://expo.dev/go) app on your phone

## Commands

```bash
bun dev          # Start both app and API
bun dev --api    # API only
bun dev --app    # App only  
bun build        # Build both (verify no errors)
```

## Deployment

```bash
# Deploy API to Cloudflare Workers
cd packages/api && bun run deploy
```

For app store builds, use [EAS Build](https://docs.expo.dev/build/introduction/).
