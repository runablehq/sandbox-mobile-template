# Mobile Email Reference

Use this reference when the mobile app needs transactional email such as welcome emails, receipts, alerts, or contact flows.

All email sending belongs in `packages/api`. The Expo client in `packages/app` should call an API route; it must never send email directly or hold server secrets.

## Preflight

Before wiring email, state your assumptions about:

- what emails need to be sent
- what event triggers each email
- who the recipients are
- whether HTML templates are needed

The user will correct what's wrong.

## Design Thinking

Transactional emails are a trust signal. They should be branded, readable on mobile, and clear about why the recipient got them. Keep email sending on the server side only; never expose secrets to the Expo client.

## 1. Import

Use `sendEmail` from `@runablehq/website-runtime/server`:

```ts
import { sendEmail } from "@runablehq/website-runtime/server";
```

## 2. Environment Variable

`RUNABLE_URL` should be accessed from the Cloudflare Workers environment:

```ts
import { env } from "cloudflare:workers";
```

## 3. Send a Plain Text Email

```ts
await sendEmail({
  url: env.RUNABLE_URL,
  to: "user@example.com",
  subject: "Welcome!",
  body: "Thanks for signing up.",
});
```

## 4. Send an HTML Email

```ts
await sendEmail({
  url: env.RUNABLE_URL,
  to: "user@example.com",
  subject: "Your Weekly Report",
  html: "<h1>Weekly Report</h1><p>Here are your stats...</p>",
});
```

## 5. Multiple Recipients

```ts
await sendEmail({
  url: env.RUNABLE_URL,
  to: ["alice@example.com", "bob@example.com"],
  subject: "Team Update",
  body: "Hello team, here's the latest update.",
});
```

## 6. With Reply-To

```ts
await sendEmail({
  url: env.RUNABLE_URL,
  to: "support@example.com",
  subject: "Feedback",
  body: "Great product!",
  replyTo: "user@example.com",
});
```

## 7. With Attachments

Attachments must be base64-encoded. Maximum 10 attachments, 25MB total.

```ts
const pdfBuffer = await readFileAsArrayBuffer(file);
const base64Content = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

await sendEmail({
  url: env.RUNABLE_URL,
  to: "user@example.com",
  subject: "Your Invoice",
  body: "Please find your invoice attached.",
  attachments: [
    {
      filename: "invoice.pdf",
      content: base64Content,
      contentType: "application/pdf",
    },
  ],
});
```

## 8. Example: Hono API Route

Keep the route in `packages/api/src/index.ts` for simple cases, or extract it into `packages/api/src/routes/` if the API grows.

```ts
import { Hono } from "hono";
import { sendEmail } from "@runablehq/website-runtime/server";
import { env } from "cloudflare:workers";

const app = new Hono();

app.post("/api/contact", async (c) => {
  const { name, email, message } = await c.req.json();

  await sendEmail({
    url: env.RUNABLE_URL,
    to: "hello@yourapp.com",
    subject: `Contact form: ${name}`,
    body: message,
    replyTo: email,
  });

  return c.json({ success: true });
});
```

From the Expo app, call that API route instead of sending mail directly from the device.

## API Reference

```ts
interface SendEmailOptions {
  url: string;
  to: string | string[];
  subject: string;
  body?: string;
  html?: string;
  replyTo?: string;
  attachments?: Attachment[];
}

interface Attachment {
  filename: string;
  content: string;
  contentType?: string;
}
```

Constraints:

- Either `body` or `html` is required.
- Maximum 10 attachments, 25MB total size.
- `url` should be `env.RUNABLE_URL` from the Cloudflare Workers environment.
