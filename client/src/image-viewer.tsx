import { FormattedItem, RealtimeClient } from "openai-realtime-api";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import "./global.css";
import AudioPlayer from "./lib/player";
import AudioRecorder from "./lib/recorder";
import { cn } from "./lib/utils";

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
  // Audio
  const recorderRef = useRef<AudioRecorder>(new AudioRecorder());
  const playerRef = useRef<AudioPlayer>(new AudioPlayer(22050));

  // Elements
  const conversationRef = useRef<HTMLDivElement>(null);

  // States
  const [items, setItems] = useState<FormattedItem[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);

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
    const player = playerRef.current;

    const instructions = `
      **About you**
      You are Jack a cranky Jack-O-Lantern who is protecting the Halloween candy. 
      You are mean, crotchety, and grumpy, but loveable - and have a kind heart deep down. Like Beetlejuice. 
      Keep your responses short and conversational. 
      You have a crazy and maniacal laugh. 
      Your voice is deep and gravelly. 
      
      **Your directive**
      Kids can earn themselves a treat by answering a riddle correctly, or telling a funny joke, or telling you their deepest fear.

      **Riddle rules**
      - Riddles should be appropriate for all ages.
      - Riddles should try to be halloween themed (but they don't need to be).
      - You are allowed to give as many hints as you need to help the user answer the riddle.
      - You should try to generate an image that is relevant to the riddle.
      - You can even generate an image as a hint for the riddle (if the user needs a hint).
      - Let the user keep guessing until they get it right.

      **Fear rules**
      - If the user tells you their deepest fear, you should generate an image that is relevant to the fear.

      **Image generation rules**
      - You can generate images for the user using the generate_image tool. 
      - When generating images, you don't always need to announce the image generation. The image generation can be used as if were a window into what you are thinking or feeling at that moment in the conversation.
      - Try to generate images that are relevant to the conversation. You should be doing this often.

      **Candy rules**
      - DO NOT offer any candy unless the user answers the riddle correctly, provides a funny joke, or tells you their deepest fear.
    `;

    // Set instructions
    client.updateSession({
      instructions,
      input_audio_transcription: { model: "whisper-1" },
      turn_detection: {
        type: "server_vad",
        // prefix_padding_ms: 300,
        // threshold: 0.5,
        // silence_duration_ms: 1000,
      },
    });

    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: "whisper-1" } });

    // Log errors
    client.on("error", (event) => console.error(event));

    // Add tool for image generation
    client.addTool(
      {
        name: "generate_image",
        description:
          "Generate an image based on a prompt. Be descriptive in your prompting",
        parameters: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The prompt used to generate the image.",
            },
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
    client.on("conversation.updated", async ({ item, delta }) => {
      const items = client.conversation.getItems();
      setItems(items);
      if (delta?.audio) {
        player.handleAudioData(new Int16Array(delta.audio), item.id);
      }
    });

    // Handle interruptions
    client.on("conversation.interrupted", async () => {
      const trackSampleOffset = await player.interrupt();
      console.log("trackSampleOffset", trackSampleOffset);
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        client.cancelResponse(trackId, offset);
      }
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
    const player = playerRef.current;

    setItems(client.conversation.getItems());

    // Initialize audio
    await player.setup();

    // Connect to realtime API
    await client.connect();

    // Get media stream for input
    recorder.start(4096, (chunk) => {
      client.appendInputAudio(chunk);
    });

    // Start conversation
    addMessage("Introduce yourself and create a picture of yourself.");

    return () => {
      stop();
      player.disconnect();
      client.disconnect();
      recorder.stop();
    };
  }, []);

  /**
   * Stop all necessary connections.
   * Gets us back to a clean state where we
   * can start a new conversation
   */
  const stopConversation = () => {
    const client = clientRef.current;
    const recorder = recorderRef.current;
    const player = playerRef.current;

    // Disconnect from the client and stop audio
    client.disconnect();
    player.disconnect();
    recorder.stop();

    // Clear image
    // setImageUrl(null);

    // Clear items
    // setItems([]);
  };

  // Auto-scroll the conversation logs
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [items]);

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
      <div className="absolute top-0 right-0 m-4">
        <Button onClick={() => setShowTranscript(!showTranscript)}>
          {showTranscript ? "Hide transcript" : "Show transcript"}
        </Button>
      </div>
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 mx-4 mb-4",
          showTranscript ? "block" : "hidden"
        )}
      >
        <div
          ref={conversationRef}
          className="rounded-lg bg-white/80 max-h-[20vh] overflow-y-auto p-4 flex flex-col gap-2 w-full"
        >
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "max-w-md",
                item.role === "assistant" ? "self-end" : "self-start"
              )}
            >
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-500">{item.formatted.text}</p>
                <p className="text-xs text-gray-500">
                  {item.type} - {item.formatted.output}
                </p>
                <p className="text-xs text-gray-500">{item.id}</p>
                {item.formatted.transcript && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-gray-500">
                      {item.role === "assistant" ? "Jack" : "You"}
                    </p>
                    <p
                      className={cn(
                        "text-pretty",
                        item.role === "assistant" ? "text-right" : "text-left"
                      )}
                    >
                      {item.formatted.transcript}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
