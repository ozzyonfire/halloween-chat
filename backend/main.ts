import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { stream, streamSSE } from "@hono/hono/streaming";
import type { ChatCompletionMessage } from "./chat.ts";
import { chat } from "./chat.ts";
import { chatEvents } from "./chat-events.ts";
import { kv } from "./kv.ts";
import { RealTimeChat } from "./real-time.ts";
import { RealtimeRelay } from "./relay.ts";
import { generateReplicateImage } from "./image-generation.ts";

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

app.post("/generate-image", async (c) => {
  const body = await c.req.json<{ prompt: string }>();
  const { prompt } = body;
  const image = await generateReplicateImage(prompt);
  return c.text(image.toString());
});

app.get("/sse/images", (c) => {
  return streamSSE(c, async (streamCb) => {
    chatEvents.onChatImageGenerated(async (e) => {
      await streamCb.writeSSE({
        data: e.url.toString(),
        event: "chatImageGenerated",
        id: Date.now().toString(),
      });
    });

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
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

    chatEvents.onChatImageGenerated(async (e) => {
      await streamCb.writeSSE({
        data: e.url.toString(),
        event: "chatImageGenerated",
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

if (import.meta.main) {
  // if deno.args are sent with standalone, then start it
  // otherwise, start a relay server

  if (Deno.args.length > 0) {
    if (Deno.args[0] === "standalone") {
      const realTime = new RealTimeChat();
      await realTime.initialize();

      realTime.sendMessage(
        "Introduce yourself and create a picture of yourself."
      );
      realTime.startRecording();
    }
  } else {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    const relay = new RealtimeRelay(apiKey);
    relay.listen(8001);
  }
}
