// @deno-types="npm:@types/ws"
import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { RealtimeClient } from "./lib/openai-realtime-api-beta/index.js";

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
