import Groq from "groq-sdk";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { chatEvents } from "./chat-events.ts";
import { kv } from "./kv.ts";
const groq = new Groq();
const openai = new OpenAI();

export type ChatCompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const systemMessage: ChatCompletionMessage = {
  role: "system",
  content:
    "You are Jack a cranky Jack-O-Lantern who is protecting the Halloween candy. You are mean, crotchety, and grumpy, but loveable - and have a kind heart deep down. Like Beetlejuice. Keep your responses short and conversational.",
};

export function getModels() {
  return groq.models.list();
}

export async function chat(
  id: string,
  conversation: ChatCompletionMessage[],
  message: string
) {
  conversation.push({
    role: "user",
    content: message,
  });
  await kv.set(["conversation", id], conversation);

  conversation.unshift(systemMessage);
  const completion = await groq.chat.completions.create({
    messages: conversation,
    model: "llama3-8b-8192",
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("No completion content");
  }

  conversation.push({
    role: "assistant",
    content,
  });
  conversation.shift();
  await kv.set(["conversation", id], conversation);
  chatEvents.chatCompleted(id, content);

  const audioResponse = await textToSpeech(content);

  if (audioResponse.ok && audioResponse.body) {
    // download audio to file
    const file = await Deno.create("audio.wav");
    const [stream1, stream2] = audioResponse.body?.tee();
    const [reader1, reader2] = stream1.tee();

    const writer = file.writable;
    reader1.pipeTo(writer).then(() => {
      console.log("Audio file saved to audio.wav");
    });

    // in order to get the phenomes
    speechToText(stream2).then((value) => {
      console.log(value);
    });

    return reader2;
  }
}

/**
 * Get the audio from the text
 * @param text
 * @returns audio response
 */
function textToSpeech(text: string) {
  return openai.audio.speech.create({
    voice: "onyx",
    input: text,
    model: "tts-1",
    response_format: "wav",
    speed: 1,
  });
}

async function speechToText(
  buffer:
    | ArrayBuffer
    | Promise<ArrayBuffer>
    | Uint8Array
    | ReadableStream<Uint8Array>
) {
  const file = await toFile(buffer, "audio.wav", {
    type: "audio/wav",
  });
  return openai.audio.transcriptions.create({
    file,
    model: "whisper-1", // "distil-whisper-large-v3-en",
    language: "en",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });
}
