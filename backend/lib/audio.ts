import {
  PortAudio,
  StreamFlags,
  SampleFormat,
} from "https://deno.land/x/portaudio/mod.ts";

// 24 kHz sample rate
const SAMPLE_RATE = 24000;
const FRAMES_PER_BUFFER = 6000;

PortAudio.initialize(); // Initialize the module

const outputDevice = PortAudio.getDefaultOutputDevice();
const stream = PortAudio.openStream(
  null,
  {
    device: outputDevice,
    channelCount: 1,
    sampleFormat: SampleFormat.int16,
    suggestedLatency:
      PortAudio.getDeviceInfo(outputDevice).defaultLowOutputLatency,
  },
  SAMPLE_RATE,
  FRAMES_PER_BUFFER,
  StreamFlags.clipOff
);

PortAudio.startStream(stream);

// Queue to buffer incoming audio data
const audioQueue: Int16Array[] = [];

// Function to play audio data
export function playAudio(int16Array: Int16Array) {
  audioQueue.push(int16Array);
}

// Function to process and play audio data from the queue
async function processAudioQueue() {
  while (true) {
    if (audioQueue.length > 0) {
      const audioData = audioQueue.shift();
      if (audioData) {
        console.log(audioData.length);
        try {
          PortAudio.writeStream(stream, audioData, FRAMES_PER_BUFFER);
        } catch (error) {
          console.error("Error writing to stream:", error);
        }
      }
    } else {
      // Wait for a short period before checking the queue again
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

// Start processing the audio queue
processAudioQueue();

export function closeStream() {
  PortAudio.stopStream(stream);
  PortAudio.closeStream(stream);
  PortAudio.terminate();
}
