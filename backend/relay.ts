// @deno-types="npm:@types/ws"
import { WebSocketServer, WebSocket } from "ws";
import { RealtimeClient } from "./lib/openai-realtime-api-beta/index.js";
import type { IncomingMessage } from "node:http";
import Mic from "node-microphone";
import { record } from "./lib/mic.ts";
import { closeStream, playAudio } from "./lib/audio.ts";

export class RealtimeRelay {
  apiKey: string;
  sockets: WeakMap<WebSocket, RealtimeClient>;
  wss: WebSocketServer | null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.sockets = new WeakMap();
    this.wss = null;
  }

  listen(port: number) {
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", this.connectionHandler.bind(this));
    this.log(`Listening on ws://localhost:${port}`);
  }

  async connectionHandler(ws: WebSocket, req: IncomingMessage) {
    if (!req.url) {
      this.log("No URL provided, closing connection.");
      ws.close();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname !== "/") {
      this.log(`Invalid pathname: "${pathname}"`);
      ws.close();
      return;
    }

    // Instantiate new client
    this.log(`Connecting with key "${this.apiKey.slice(0, 3)}..."`);
    const client = new RealtimeClient({ apiKey: this.apiKey });

    // Relay: OpenAI Realtime API Event -> Browser Event
    client.realtime.on("server.*", (event: Event) => {
      this.log(`Relaying "${event.type}" to Client`);
      ws.send(JSON.stringify(event));
    });
    client.realtime.on("close", () => ws.close());

    // Relay: Browser Event -> OpenAI Realtime API Event
    // We need to queue data waiting for the OpenAI connection
    const messageQueue: string[] = [];
    const messageHandler = (data: string) => {
      try {
        const event = JSON.parse(data);
        this.log(`Relaying "${event.type}" to OpenAI`);
        client.realtime.send(event.type, event);
      } catch (e) {
        if (e instanceof Error) {
          console.error(e.message);
          this.log(`Error parsing event from client: ${data}`);
        }
      }
    };

    ws.on("message", (data: string) => {
      if (!client.isConnected()) {
        messageQueue.push(data);
      } else {
        messageHandler(data);
      }
    });

    ws.on("close", () => client.disconnect());

    // Connect to OpenAI Realtime API
    try {
      this.log(`Connecting to OpenAI...`);
      await client.connect();
    } catch (e) {
      if (e instanceof Error) {
        this.log(`Error connecting to OpenAI: ${e.message}`);
      }
      ws.close();
      return;
    }
    this.log(`Connected to OpenAI successfully!`);
    while (messageQueue.length) {
      const nextMessage = messageQueue.shift();
      if (!nextMessage) continue;
      messageHandler(nextMessage);
    }
  }

  // deno-lint-ignore no-explicit-any
  log(...args: any[]) {
    console.log(`[RealtimeRelay]`, ...args);
  }
}

if (import.meta.main) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    throw new Error("Open AI API Key is required.");
  }
  // const relay = new RealtimeRelay(key);
  // relay.listen(8001);

  const client = new RealtimeClient({ apiKey: key, debug: false });

  Deno.addSignalListener("SIGINT", () => {
    console.log("interrupted!");
    closeStream();
    client.disconnect();
    Deno.exit();
  });

  await client.connect();

  // const recordingBuffer = await record({
  //   channels: 1,
  //   bitwidth: "16",
  //   encoding: "signed-integer",
  //   rate: "16000",
  // });

  // client.appendInputAudio(recordingBuffer);

  client.on("error", (event: any) => {
    console.log("ERROR:");
    console.error(event);
  });

  client.on("conversation.updated", (data) => {
    if (data.item.status === "in_progress" && data.item.role === "assistant") {
      if (data.delta && data.delta.audio && data.delta.audio.length > 0) {
        console.log(data.delta.audio);
        // console.log(data);
        playAudio(data.delta.audio);
      }
    }
  });

  client.sendUserMessageContent([
    {
      type: `input_text`,
      // text: `Hello!`,
      text: `For testing purposes, I want you to list ten car brands. Number each item, e.g. "one (or whatever number you are one): the item name".`,
    },
  ]);
}
