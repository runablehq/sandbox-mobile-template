# Mobile AI Agent Reference

We use [AI SDK](https://v6.ai-sdk.dev) with OpenAI-compatible endpoints for AI agents. The agent backend lives in `packages/api`; the chat UI lives in `packages/app`.

<preflight>
Before wiring, state your assumptions about:

- the agent's persona and system prompt
- which model to use (see supported models below)
- what tools the agent needs (search, calculate, database lookup, etc.)
- where the chat UI lives in the app (dedicated screen, bottom sheet, home section)
- whether tool results need custom mobile renderers

The user will correct what's wrong.
</preflight>

<design_thinking>
The chat UI should feel native to the mobile app, not a bolted-on widget. Tool results should be rendered visually — not raw JSON dumps. Streaming should feel responsive; an empty screen with a spinner is worse than incremental text. Model choice is a cost/quality tradeoff — default to haiku for speed, escalate to sonnet when the task needs it.
</design_thinking>

## Supported Models

- `anthropic/claude-sonnet-4.5`
- `anthropic/claude-haiku-4.5`
- `anthropic/claude-opus-4.5`
- `openai/gpt-5.2`
- `openai/gpt-5-nano`
- `openai/gpt-5-mini`
- `google/gemini-3-pro-preview`
- `google/gemini-3-pro-image`
- `google/gemini-2.5-flash-image`

## 1. Install Dependencies

In `packages/api`:

```bash
cd packages/api
bun add ai @ai-sdk/openai dedent
```

In `packages/app`:

```bash
cd packages/app
bun add @ai-sdk/react ai
```

## 2. Agent Config

Create `packages/api/src/agent/index.ts`:

```ts
import { stepCountIs, SystemModelMessage, ToolLoopAgent } from "ai";
import dedent from "dedent";
import { env } from "cloudflare:workers";
import { createOpenAI } from "@ai-sdk/openai";
import { calculate } from "./calculate-tool";

type WorkerEnv = {
  AI_GATEWAY_BASE_URL: string;
  AI_GATEWAY_API_KEY: string;
};

const workerEnv = env as unknown as WorkerEnv;

const openai = createOpenAI({
  baseURL: workerEnv.AI_GATEWAY_BASE_URL,
  apiKey: workerEnv.AI_GATEWAY_API_KEY,
});

const INSTRUCTIONS: SystemModelMessage[] = [
  {
    role: "system",
    content: dedent`You are a helpful assistant. Your job is to support the user.`,
  },
];

export const agent = new ToolLoopAgent({
  model: openai.chat("anthropic/claude-haiku-4.5"),
  instructions: INSTRUCTIONS,
  tools: {
    calculate,
  },
  stopWhen: [stepCountIs(100)],
});
```

Environment variables:
- `AI_GATEWAY_BASE_URL` — the OpenAI-compatible gateway URL (set via `wrangler secret put` or `.dev.vars`)
- `AI_GATEWAY_API_KEY` — the gateway API key

## 3. Add Tools

Create tools under `packages/api/src/agent/`.

Example tool `packages/api/src/agent/calculate-tool.ts`:

```ts
import z from "zod";
import { evaluate } from "mathjs";
import { tool, UIToolInvocation } from "ai";

export const calculate = tool({
  description: "Calculate a mathematical expression.",
  inputSchema: z.object({
    expression: z.string().describe("The mathematical expression to calculate."),
  }),
  async execute({ expression }) {
    try {
      const result = evaluate(expression);
      return result;
    } catch (error) {
      return String(error);
    }
  },
});

export type CalculateToolResult = UIToolInvocation<typeof calculate>;
```

When adding new tools:
- Define tool file in `packages/api/src/agent/`.
- Export result type via `UIToolInvocation<typeof myTool>`.
- Register tool in agent `tools` object.
- Add mobile renderer in the chat screen for `part.type === "tool-{toolName}"`.

## 4. API Routes

In `packages/api/src/index.ts`:

```ts
import { agentRoutes } from "./routes/agent";

app.route("/agent", agentRoutes);
```

Create `packages/api/src/routes/agent.ts`:

```ts
import { Hono } from "hono";
import { createAgentUIStreamResponse } from "ai";
import { agent } from "../agent";

export const agentRoutes = new Hono();

agentRoutes.post("/messages", async (c) => {
  const { messages } = await c.req.json();
  return createAgentUIStreamResponse({
    agent,
    messages,
  });
});
```

## 5. Mobile Chat Screen

Create `packages/app/src/screens/chat.tsx`:

```tsx
import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <Text key={i} style={isUser ? styles.userText : styles.assistantText}>
              {part.text}
            </Text>
          );
        }
        // Add custom tool renderers here:
        // if (part.type === "tool-calculate") { ... }
        return null;
      })}
    </View>
  );
}

export function ChatScreen() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${API_URL}/api/agent/messages`,
    }),
  });
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const isLoading = status === "streaming" || status === "submitted";

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask something..."
          editable={!isLoading}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable
          style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  messageList: { padding: 16, paddingBottom: 8 },
  bubble: { maxWidth: "80%", padding: 12, borderRadius: 16, marginBottom: 8 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#007AFF" },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: "#F2F2F7" },
  userText: { color: "#fff", fontSize: 16 },
  assistantText: { color: "#000", fontSize: 16 },
  inputRow: { flexDirection: "row", padding: 12, borderTopWidth: 1, borderTopColor: "#E5E5EA", alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderColor: "#E5E5EA", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, marginRight: 8 },
  sendButton: { backgroundColor: "#007AFF", borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
```

### Mobile-Specific Considerations

- **Transport**: The `DefaultChatTransport` API URL must be the full absolute URL to the API (not a relative path like on web). Use `EXPO_PUBLIC_API_URL`.
- **Streaming**: AI SDK streaming works over fetch, which works on both web and native. No special polyfills needed.
- **Keyboard**: Wrap the chat screen in `KeyboardAvoidingView` with platform-specific behavior.
- **Scroll**: Use `FlatList` with auto-scroll to bottom on new messages, not `ScrollView`.
- **Authenticated chat**: If the agent route is protected, pass the auth cookie in the transport's custom `fetch`:

```ts
import { authClient } from "../lib/auth";

const transport = new DefaultChatTransport({
  api: `${API_URL}/api/agent/messages`,
  fetch: (input, init) => {
    const cookie = authClient.getCookie();
    return fetch(input, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
  },
});
```

## 6. Tool Renderers

For each tool, add a mobile-native renderer in the chat screen. Example for the calculate tool:

```tsx
import type { CalculateToolResult } from "@sandbox/api/src/agent/calculate-tool";

function CalculateTool({ tool }: { tool: CalculateToolResult }) {
  if (tool.state !== "output-available") {
    return <ActivityIndicator />;
  }
  return (
    <View style={{ backgroundColor: "#F2F2F7", padding: 12, borderRadius: 12 }}>
      <Text style={{ fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 16 }}>
        {tool.output}
      </Text>
    </View>
  );
}
```

Then in `MessageBubble`, add:

```tsx
if (part.type === "tool-calculate") {
  return <CalculateTool key={i} tool={part as unknown as CalculateToolResult} />;
}
```

## Testing

After implementing the AI agent:

1. Run `bun build` — no type or build errors.
2. Start dev servers with `bun dev`.
3. Use `mb` (browser tool) to open the Expo web preview:
   - Navigate to the chat screen.
   - Send a simple text prompt. Verify streaming text appears incrementally.
   - If tools are configured, send a prompt that triggers a tool call (e.g. "what is 2 + 2?"). Verify the tool result renders with the custom renderer.
   - Verify error states: send a request with the API stopped — the UI should show an error, not hang.
4. For native-only testing (keyboard behavior, scroll physics), note in delivery that these need Expo Go on a physical device.
