class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private streamNode: AudioWorkletNode | null = null;
  private trackSampleOffsets: Map<
    string,
    {
      offset: number;
      trackId: string;
    }
  > = new Map();
  private sampleRate: number;

  constructor(sampleRate: number = 22050) {
    this.sampleRate = sampleRate;
  }

  async setup() {
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    try {
      await this.audioContext.audioWorklet.addModule(
        "audio-stream-processor.js"
      );
    } catch (error) {
      console.error("Failed to load audio-stream-processor.js", error);
      throw error;
    }

    this.streamNode = new AudioWorkletNode(
      this.audioContext,
      "audio-stream-processor"
    );

    this.streamNode.connect(this.audioContext.destination);

    this.streamNode.port.onmessage = (event) => {
      if (event.data.type === "interruptAck") {
        console.log("Interrupt acknowledged:", event.data);
      } else if (event.data.type === "interrupt") {
        const { trackId, offset, requestId } = event.data;
        this.trackSampleOffsets.set(requestId, { offset, trackId });
      }
    };
  }

  handleAudioData(
    arrayBuffer: ArrayBuffer | Int16Array,
    trackId: string = "default"
  ): Int16Array {
    if (typeof trackId !== "string") {
      throw new Error(`trackId must be a string`);
    }
    if (!this.streamNode) {
      throw new Error("AudioPlayer not initialized");
    }

    let buffer: Int16Array;
    if (arrayBuffer instanceof Int16Array) {
      buffer = arrayBuffer;
    } else if (arrayBuffer instanceof ArrayBuffer) {
      buffer = new Int16Array(arrayBuffer);
    } else {
      throw new Error(`argument must be Int16Array or ArrayBuffer`);
    }

    this.streamNode.port.postMessage({
      type: "audio-data",
      audioData: buffer,
      trackId,
    });

    return buffer;
  }

  async interrupt(): Promise<{ trackId: string; offset: number }> {
    const requestId = crypto.randomUUID();
    if (!this.streamNode) {
      throw new Error("AudioPlayer not initialized");
    }
    this.streamNode.port.postMessage({ type: "interrupt", requestId });

    let trackSampleOffset: { offset: number; trackId: string } | undefined;
    while (!trackSampleOffset) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      trackSampleOffset = this.trackSampleOffsets.get(requestId);
    }

    return trackSampleOffset;
  }

  disconnect() {
    if (this.streamNode) {
      this.streamNode.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

export default AudioPlayer;
