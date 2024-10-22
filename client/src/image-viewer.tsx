import { FormattedItem, RealtimeClient } from "openai-realtime-api";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import "./global.css";
import { setupPlayer } from "./lib/player";
import AudioRecorder from "./lib/recorder";

const API_URL = "http://localhost:8000";
const REALTIME_API_URL = "http://localhost:8001";

export function ImageViewer() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // const { addListener } = useSSE(`${API_URL}/sse/images`);
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient({
      url: REALTIME_API_URL,
    })
  );

  // States
  const [items, setItems] = useState<FormattedItem[]>([]);

  // Audio
  const recorderRef = useRef<AudioRecorder>(new AudioRecorder());

  /**
   * Add a message to the conversation
   * @param message - The message to add
   */
  const addMessage = (message: string) => {
    const client = clientRef.current;
    client.sendUserMessageContent([
      {
        type: "input_text",
        text: message,
      },
    ]);
  };

  // useEffect(() => {
  //   addListener("chatImageGenerated", (url) => {
  //     console.log("chatImageGenerated", url);
  //     setImageUrl(url);
  //   });
  // }, [addListener]);

  /**
   * Initialize the client and set up event listeners
   */
  useEffect(() => {
    const client = clientRef.current;

    const instructions = `
      You are Jack a cranky Jack-O-Lantern who is protecting the Halloween candy. You are mean, crotchety, and grumpy, but loveable - and have a kind heart deep down. Like Beetlejuice. Keep your responses short and conversational. You have a crazy and maniacal laugh and your voice is deep and gravelly. 
      
      Kids can earn themselves a treat by answering a riddle correctly, or telling a funny joke, or telling you their deepest fear. 
      
      You can generate images for the user using the generate_image tool. When generating images, you don't always need to announce the image generation. The image generation can be used as if were a window into what you are thinking or feeling at that moment in the conversation.

      Try to generate images that are relevant to the conversation. You should be doing this often.
    `;

    // Set instructions
    client.updateSession({
      instructions,
      input_audio_transcription: { model: "whisper-1" },
      turn_detection: {
        type: "server_vad",
        prefix_padding_ms: 300,
        threshold: 0.5,
        silence_duration_ms: 1000,
      },
    });

    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: "whisper-1" } });

    // Log errors
    client.on("error", (event) => console.error(event));

    // Handle interruptions
    client.on("conversation.interrupted", async () => {
      console.log("interrupted");
    });

    // Add tool for image generation
    client.addTool(
      {
        name: "generate_image",
        description:
          "Generate an image based on a prompt. Be descriptive in your prompting",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string" },
          },
          required: ["prompt"],
        },
      },
      async (input: { prompt: string }) => {
        const response = await fetch(`${API_URL}/generate-image`, {
          method: "POST",
          body: JSON.stringify({ prompt: input.prompt }),
        });
        const url = await response.text();
        setImageUrl(url);
      }
    );

    // Handle updates to the conversation
    client.on("conversation.updated", async () => {
      const items = client.conversation.getItems();
      setItems(items);
    });

    // Set initial items
    setItems(client.conversation.getItems());

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, []);

  /**
   * Connect to conversation:
   * input and output audio, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const recorder = recorderRef.current;

    setItems(client.conversation.getItems());

    // Initialize audio
    const { disconnect, handleAudioData } = await setupPlayer(22000);

    // Connect to realtime API
    await client.connect();

    // Get media stream for input

    recorder.start(4096, (chunk) => {
      client.appendInputAudio(chunk);
    });

    // Handle incoming audio data
    client.on("conversation.updated", async ({ delta }) => {
      if (delta?.audio) {
        handleAudioData(new Int16Array(delta.audio), "user");
      }
    });

    addMessage("Introduce yourself and create a picture of yourself.");

    return () => {
      stop();
      disconnect();
      client.disconnect();
      recorder.stop();
    };
  }, []);

  const stopConversation = () => {
    const client = clientRef.current;
    const recorder = recorderRef.current;

    client.disconnect();
    recorder.stop();
  };

  return (
    <div>
      <div className="flex justify-center items-center h-screen w-screen">
        {imageUrl && (
          <img className="h-full object-cover" src={imageUrl} alt="Generated" />
        )}
      </div>
      <div className="absolute top-0 left-0 flex flex-col gap-2 m-4">
        <Button onClick={connectConversation}>Connect conversation</Button>
        <Button onClick={stopConversation}>Stop conversation</Button>
      </div>
      <div className="absolute bottom-0 left-0 flex flex-col">
        <h2>Items</h2>
        {items.map((item) => (
          <div key={item.id}>
            {item.formatted.text && <p>{item.formatted.text}</p>}
            {item.formatted.transcript && <p>{item.formatted.transcript}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
