# Mobile Email Reference

Use this reference when the mobile app needs transactional email such as welcome emails, receipts, alerts, password resets, or contact/support flows.

All email sending belongs in `packages/api`. The Expo client in `packages/app` should call an API route; it must never send email directly or hold server secrets.

<preflight>
Before wiring email, state your assumptions about:

- what emails need to be sent (welcome, password reset, receipts, alerts, contact form)
- what event triggers each email (sign-up, form submission, scheduled job, etc.)
- who the recipients are (the user, an admin, a support inbox)
- whether HTML templates are needed or plain text is sufficient

The user will correct what's wrong.
</preflight>

<design_thinking>
Transactional emails are a trust signal. They should be branded, readable on mobile, and clear about why the recipient got them. Keep email sending on the server side only; never expose secrets to the Expo client.
</design_thinking>

## 1. Import

Use `sendEmail` from `@runablehq/website-runtime/server`:

```ts
import { sendEmail } from "@runablehq/website-runtime/server";
```

Install if not present in `packages/api`:

```bash
cd packages/api
bun add @runablehq/website-runtime
```

## 2. Environment Variable

`RUNABLE_URL` should be set as a Cloudflare Workers secret or in `.dev.vars` for local development. Access it via:

```ts
import { env } from "cloudflare:workers";
// use env.RUNABLE_URL
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

From the Expo app, call that API route instead of sending mail directly from the device:

```ts
import { api } from "../lib/api";

const res = await api.api.contact.$post({
  json: { name, email, message },
});
```

## 9. Common Mobile Email Flows

When implementing email for mobile apps, these are the typical patterns:

- **Welcome email on sign-up**: trigger from the auth flow or a post-sign-up webhook/hook. Send a branded welcome with next steps.
- **Password reset**: Better Auth handles the reset flow, but you may need a custom email template. See Better Auth docs for `sendResetPassword` configuration.
- **Receipts / confirmations**: send after a successful purchase or action. Include a summary and a link back to the app via the app's URL scheme.
- **Alerts / notifications**: triggered by backend events (cron, queue, webhook). Keep the subject line actionable.
- **Contact / support form**: the Expo app submits a form to an API route; the API sends the email to a support inbox with the user's reply-to address.

In all cases, the Expo client calls an API route and the API route sends the email. The client never touches `RUNABLE_URL` or any email credentials.

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
  /** Base64-encoded file content */
  content: string;
  contentType?: string;
}
```

Constraints:

- Either `body` or `html` is required.
- Maximum 10 attachments, 25MB total size.
- `url` should be `env.RUNABLE_URL` from the Cloudflare Workers environment.

## Testing

After implementing an email flow:

1. Run `bun build` — no type or build errors.
2. Start dev servers with `bun dev`.
3. Use `mb` (browser tool) or `curl` to trigger the API route that sends email:
   - Verify the API responds with a success status.
   - If there's a UI form in the Expo web preview, use `mb` to fill it out and submit.
   - Verify the UI shows the correct success/error state after submission.
4. Check the API logs for any email delivery errors.
5. For production verification, confirm the email arrives in the recipient's inbox with correct content, formatting, and reply-to.
