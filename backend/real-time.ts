import { chatEvents } from "./chat-events.ts";
import { generateReplicateImage } from "./image-generation.ts";
import { AudioPlayer } from "./lib/audio.ts";
import { AudioRecorder } from "./lib/mic.ts";
import { RealtimeClient } from "./lib/openai-realtime-api-beta/index.js";
import type { ItemType } from "./lib/openai-realtime-api-beta/lib/client.js";
import type { ItemContentDeltaType } from "./lib/openai-realtime-api-beta/lib/conversation.js";

export class RealTimeChat {
  private client: RealtimeClient;
  private player: AudioPlayer;
  private recorder: AudioRecorder;

  constructor() {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OpenAI API Key is required.");
    }

    this.player = new AudioPlayer();
    this.recorder = new AudioRecorder({
      channels: 1,
      bitwidth: "16",
      encoding: "signed-integer",
    });

    this.client = new RealtimeClient({ apiKey, debug: false });
  }

  async initialize() {
    await this.client.connect();
    await this.client.waitForSessionCreated();

    this.setupEventListeners();
    this.setupSignalListener();
    this.updateSessionSettings();
    this.setupImageGenerationTool();
  }

  private setupEventListeners() {
    this.client.on("error", (event: Error) => {
      console.log("ERROR:");
      console.error(event);
    });

    this.client.on(
      "conversation.updated",
      (data: { item: ItemType; delta: ItemContentDeltaType }) => {
        if (
          data.item.status === "in_progress" &&
          data.item.role === "assistant"
        ) {
          if (data.delta && data.delta.audio && data.delta.audio.length > 0) {
            this.player.addAudioToQueue(data.item.id, data.delta.audio);
          }
        }
        if (data.item.status === "completed") {
          console.log("conversation.completed", data);
        }
      }
    );

    this.client.on("conversation.interrupted", () => {
      console.log("conversation.interrupted");
    });
  }

  private setupSignalListener() {
    Deno.addSignalListener("SIGINT", () => {
      console.log("interrupted!");
      this.player.closeStream();
      this.client.disconnect();
    });
  }

  private updateSessionSettings() {
    const instructions =
      "You are Jack a cranky Jack-O-Lantern who is protecting the Halloween candy. You are mean, crotchety, and grumpy, but loveable - and have a kind heart deep down. Like Beetlejuice. Keep your responses short and conversational. You have a crazy and maniacal laugh and voice. Your voice is deep and gravelly. Kids can earn themselves a treat by answering a riddle correctly, or telling a funny joke, or telling you their deepest fear. You can generate images for the user using the generate_image tool.";

    this.client.updateSession({
      instructions,
      input_audio_transcription: {
        model: "whisper-1",
      },
      turn_detection: {
        type: "server_vad",
        silence_duration_ms: 1000,
        threshold: 0.9,
        prefix_padding_ms: 300,
      },
      voice: "echo",
    });
  }

  private setupImageGenerationTool() {
    this.client.addTool(
      {
        description:
          "Generate an image based on a prompt. Be descriptive in your prompting",
        name: "generate_image",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string" },
          },
          required: ["prompt"],
        },
      },
      async (input: { prompt: string }) => {
        console.log("input", input);
        const image = await generateReplicateImage(input.prompt);
        chatEvents.chatImageGenerated(image);
      }
    );
  }

  startRecording() {
    this.recorder.startRecording((audio) => {
      this.client.appendInputAudio(audio);
    });
  }

  sendMessage(text: string) {
    this.client.sendUserMessageContent([
      {
        type: "input_text",
        text: text,
      },
    ]);
  }

  disconnect() {
    this.player.closeStream();
    this.client.disconnect();
  }
}
