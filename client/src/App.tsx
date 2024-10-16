import { useCallback, useEffect, useRef, useState } from "react";
import "./global.css";
import { useSSE } from "./hooks/useSSE";
import { MessageBox } from "./message-box";
import { RealtimeClient } from "@openai/realtime-api-beta";
import { Button } from "./components/ui/button";

const API_URL = "http://localhost:8000";
const REALTIME_API_URL = "http://localhost:8001";

/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: "client" | "server";
  count?: number;
  event: { [key: string]: string };
}

function App() {
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient({ url: REALTIME_API_URL })
  );

  // States
  const [items, setItems] = useState<any[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [conversationId, setConversationId] = useState<string>("");
  const [showConvo, setShowConvo] = useState(false);
  const { addListener } = useSSE(
    conversationId && `http://localhost:8000/sse/${conversationId}`
  );
  const [conversation, setConversation] = useState<
    {
      role: "user" | "assistant";
      content: string;
    }[]
  >([]);

  useEffect(() => {
    const conversationId = window.localStorage.getItem("conversationId");
    if (!conversationId) {
      // create a new one
      const id = crypto.randomUUID();
      setConversationId(id);
      window.localStorage.setItem("conversationId", id);
    } else {
      setConversationId(conversationId);
    }
  }, []);

  useEffect(() => {
    addListener("chatCompleted", (data) => {
      console.log("Chat completed", data);
      setConversation((prevConversation) => [
        ...prevConversation,
        {
          role: "assistant",
          content: data,
        },
      ]);
    });

    addListener("conversation", (data) => {
      console.log("Conversation updated", data);
      setConversation(JSON.parse(data));
    });
  }, [addListener]);

  const handleMessageAdded = async (message: string) => {
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: conversationId,
        message: message,
      }),
    });

    setConversation((prevConversation) => [
      ...prevConversation,
      {
        role: "user",
        content: message,
      },
    ]);

    if (!response.ok) {
      console.error("Failed to send message");
      return;
    }

    if (!response.body) {
      console.error("No response body");
      return;
    }

    const reader = response.body.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const audioBlob = new Blob(chunks, { type: "audio/wav" });
    const audioUrl = URL.createObjectURL(audioBlob);

    const audio = new Audio(audioUrl);
    audio.play();
    audio.onended = () => {
      console.log("Audio playback ended");
    };
  };

  const handleRealtimeMessageAdded = async (message: string) => {};

  /**
   * Connect to conversation:
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;

    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    // Connect to microphone
    // await wavRecorder.begin();

    // // Connect to audio output
    // await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`,
        // text: `For testing purposes, I want you to list ten car brands. Number each item, e.g. "one (or whatever number you are one): the item name".`
      },
    ]);

    // if (client.getTurnDetectionType() === "server_vad") {
    //   await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    // }
  }, []);

  // Setup the client
  useEffect(() => {
    const client = clientRef.current;

    // Set instructions
    client.updateSession({ instructions: "You are a funny guy." });

    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: "whisper-1" } });

    // handle realtime events from client + server for event logging
    client.on("realtime.event", (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          // if we receive multiple events in a row, aggregate them for display purposes
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });

    client.on("error", (event: any) => console.error(event));

    client.on("conversation.interrupted", async () => {
      // const trackSampleOffset = await wavStreamPlayer.interrupt();
      // if (trackSampleOffset?.trackId) {
      //   const { trackId, offset } = trackSampleOffset;
      //   await client.cancelResponse(trackId, offset);
      // }

      console.log("interrupted");
    });

    client.on("conversation.updated", async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      // if (delta?.audio) {
      //   wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      // }
      // if (item.status === "completed" && item.formatted.audio?.length) {
      //   const wavFile = await WavRecorder.decode(
      //     item.formatted.audio,
      //     24000,
      //     24000
      //   );
      //   item.formatted.file = wavFile;
      // }
      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, []);

  console.log("items", items);
  console.log("realtime events", realtimeEvents);

  return (
    <div className="flex flex-col h-screen">
      <main className="flex-1 flex items-center justify-center">
        {showConvo && (
          <div className="w-full max-w-md p-4">
            {conversation.map((message, index) => (
              <div
                key={index}
                className={`${
                  message.role === "user" ? "text-right" : "text-left"
                } mb-4`}
              >
                <div className="bg-gray-100 p-2 rounded-md inline-block">
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="text-lg">events</div>
        <div className="content-block-body">
          {!realtimeEvents.length && `awaiting connection...`}
          {realtimeEvents.map((realtimeEvent, i) => {
            const count = realtimeEvent.count;
            const event = { ...realtimeEvent.event };
            if (event.type === "input_audio_buffer.append") {
              event.audio = `[trimmed: ${event.audio.length} bytes]`;
            } else if (event.type === "response.audio.delta") {
              event.delta = `[trimmed: ${event.delta.length} bytes]`;
            }
            return (
              <div className="event" key={event.event_id}>
                <div className="event-timestamp">{realtimeEvent.time}</div>
                <div className="event-details">
                  <div className="event-summary">
                    <div
                      className={`event-source ${
                        event.type === "error" ? "error" : realtimeEvent.source
                      }`}
                    >
                      <span>
                        {event.type === "error"
                          ? "error!"
                          : realtimeEvent.source}
                      </span>
                    </div>
                    <div className="event-type">
                      {event.type}
                      {count && ` (${count})`}
                    </div>
                  </div>
                  {
                    <div className="event-payload">
                      {JSON.stringify(event, null, 2)}
                    </div>
                  }
                </div>
              </div>
            );
          })}
        </div>
        <div className="w-full max-w-md p-4">
          <Button onClick={connectConversation}>Connect</Button>
          <MessageBox onMessageAdded={handleRealtimeMessageAdded} />
        </div>
      </main>
    </div>
  );
}

export default App;
