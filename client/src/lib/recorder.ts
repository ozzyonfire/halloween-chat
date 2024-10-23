class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private chunkerNode: AudioWorkletNode | null = null;
  private sourceNode: AudioNode | null = null;

  async start(
    chunkSize: number = 4096,
    onChunk: (chunk: Int16Array | ArrayBuffer) => void
  ) {
    try {
      this.mediaStream = await this.getMediaStream();
      const { audioContext, merger } = this.getSingleChannelStream(
        this.mediaStream
      );
      this.audioContext = audioContext;
      this.sourceNode = merger;

      const chunker = await this.createAudioChunker(
        audioContext,
        merger,
        chunkSize
      );
      this.chunkerNode = chunker.chunkerNode;
      chunker.onAudioChunk(onChunk);
    } catch (error) {
      console.error("Failed to start audio recording", error);
      this.stop();
      throw error;
    }
  }

  stop() {
    if (this.chunkerNode) {
      this.chunkerNode.disconnect();
      this.chunkerNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.stopMediaStream(this.mediaStream);
      this.mediaStream = null;
    }
  }

  getSingleChannelStream(stream: MediaStream) {
    const audioContext = new AudioContext({ sampleRate: 22050 });
    const source = audioContext.createMediaStreamSource(stream);

    const splitter = audioContext.createChannelSplitter(2);
    source.connect(splitter);

    const merger = splitter.connect(audioContext.createChannelMerger(1));

    splitter.connect(merger, 0, 0);

    splitter.connect(merger, 1, 0);

    source.connect(merger);

    return { audioContext, merger };
  }

  private getMediaStream() {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  }

  private stopMediaStream(stream: MediaStream) {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }

  private async createAudioChunker(
    audioContext: AudioContext,
    sourceNode: AudioNode,
    chunkSize: number = 4096
  ) {
    try {
      await audioContext.audioWorklet.addModule("audio-chunker-worklet.js");
    } catch (error) {
      console.error("Failed to load audio-chunker-worklet.js", error);
      throw error;
    }

    const chunkerNode = new AudioWorkletNode(
      audioContext,
      "audio-chunker-processor",
      {
        processorOptions: {
          chunkSize: chunkSize,
        },
      }
    );

    sourceNode.connect(chunkerNode);
    chunkerNode.connect(audioContext.destination);

    return {
      chunkerNode,
      onAudioChunk: (callback: (chunk: Int16Array | ArrayBuffer) => void) => {
        chunkerNode.port.onmessage = (event) => {
          if (event.data.type === "chunk") {
            callback(event.data.chunk);
          } else if (event.data.type === "interruptAck") {
            // Handle interrupt acknowledgment if needed
            console.log("Interrupt acknowledged:", event.data);
          }
        };
      },
    };
  }
}

export default AudioRecorder;
