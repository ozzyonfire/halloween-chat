import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { stream, streamSSE } from "@hono/hono/streaming";
import type { ChatCompletionMessage } from "./chat.ts";
import { chat } from "./chat.ts";
import { chatEvents } from "./chat-events.ts";
import { kv } from "./kv.ts";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "http://localhost:5173",
  })
);

app.post("/chat", async (c) => {
  const { id, message } = await c.req.json<{
    id: string;
    message: string;
  }>();

  const conversation = await kv.get<ChatCompletionMessage[]>([
    "conversation",
    id,
  ]);

  console.log("conversation", conversation);

  return stream(c, async (streamCb) => {
    const audioResponse = await chat(id, conversation.value || [], message);
    if (audioResponse) {
      await streamCb.pipe(audioResponse);
    }
  });
});

app.get("/sse/:id", (c) => {
  return streamSSE(c, async (streamCb) => {
    chatEvents.onChatCompleted(c.req.param("id"), async (e) => {
      await streamCb.writeSSE({
        data: e.content,
        event: "chatCompleted",
        id: Date.now().toString(),
      });
    });

    const updates = kv.watch<[ChatCompletionMessage[]]>([
      ["conversation", c.req.param("id")],
    ]);
    for await (const entries of updates) {
      if (entries[0].value) {
        streamCb.writeSSE({
          data: JSON.stringify(entries[0].value),
          event: "conversation",
          id: Date.now().toString(),
        });
      }
    }
  });
});

Deno.serve(app.fetch);
