import {
  PortAudio,
  StreamFlags,
  SampleFormat,
} from "https://deno.land/x/portaudio/mod.ts";

export class AudioPlayer {
  private static SAMPLE_RATE = 24000;
  private static FRAMES_PER_BUFFER = 6000;

  private stream: Deno.PointerValue;
  private audioQueue: Array<{ trackId: string; audio: Int16Array }> = [];
  private isProcessing = false;
  private currentTrackId: string | null = null;
  private currentOffset = 0;

  constructor() {
    PortAudio.initialize();
    const outputDevice = PortAudio.getDefaultOutputDevice();
    this.stream = PortAudio.openStream(
      null,
      {
        device: outputDevice,
        channelCount: 1,
        sampleFormat: SampleFormat.int16,
        suggestedLatency:
          PortAudio.getDeviceInfo(outputDevice).defaultLowOutputLatency,
      },
      AudioPlayer.SAMPLE_RATE,
      AudioPlayer.FRAMES_PER_BUFFER,
      StreamFlags.clipOff
    );
    PortAudio.startStream(this.stream);
  }

  public addAudioToQueue(trackId: string, int16Array: Int16Array) {
    this.audioQueue.push({ trackId, audio: int16Array });
    if (!this.isProcessing) {
      this.processAudioQueue();
    }
  }

  private processAudioQueue() {
    this.isProcessing = true;
    while (this.audioQueue.length > 0) {
      const audioData = this.audioQueue.shift();
      if (audioData) {
        try {
          this.currentTrackId = audioData.trackId;
          this.currentOffset = 0;
          // Process audio data in smaller chunks
          for (
            let i = 0;
            i < audioData.audio.length;
            i += AudioPlayer.FRAMES_PER_BUFFER
          ) {
            const chunk = audioData.audio.subarray(
              i,
              i + AudioPlayer.FRAMES_PER_BUFFER
            );
            PortAudio.writeStream(this.stream, chunk, chunk.length);
            this.currentOffset += chunk.length;
          }
        } catch (error) {
          console.error("Error writing to stream:", error);
        }
      }
    }
    this.isProcessing = false;
    this.currentTrackId = null;
    this.currentOffset = 0;
  }

  public interrupt(): { trackId: string; offset: number } | null {
    if (this.currentTrackId) {
      const result = {
        trackId: this.currentTrackId,
        offset: this.currentOffset,
      };
      this.audioQueue = []; // Clear the queue
      this.isProcessing = false;
      this.currentTrackId = null;
      this.currentOffset = 0;
      PortAudio.abortStream(this.stream); // Stop the current playback
      return result;
    }
    return null;
  }

  public closeStream() {
    PortAudio.stopStream(this.stream);
    PortAudio.closeStream(this.stream);
    PortAudio.terminate();
  }
}
