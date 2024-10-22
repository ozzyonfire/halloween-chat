class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.tracks = new Map();
    this.trackIndices = new Map();
    this.currentTime = 0;
    this.sampleRate = 44100; // Default sample rate, adjust if needed

    this.port.onmessage = (event) => {
      if (event.data.type === "audio-data") {
        this.handleAudioData(event.data.audioData, event.data.trackId);
      }
    };
  }

  handleAudioData(audioData, trackId = "default") {
    if (!this.tracks.has(trackId)) {
      this.tracks.set(trackId, []);
      this.trackIndices.set(trackId, 0);
    }

    const float32Data = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      float32Data[i] = audioData[i] / 0x8000;
    }

    this.tracks.get(trackId).push(float32Data);
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const outputChannel = output[0];

    for (let i = 0; i < outputChannel.length; i++) {
      let sample = 0;
      for (const [trackId, chunks] of this.tracks) {
        if (chunks.length > 0) {
          let index = this.trackIndices.get(trackId);
          const chunk = chunks[0];
          if (index < chunk.length) {
            sample += chunk[index];
            index++;
            this.trackIndices.set(trackId, index);
            if (index >= chunk.length) {
              chunks.shift();
              this.trackIndices.set(trackId, 0);
            }
          }
        }
      }
      outputChannel[i] = sample;
    }

    this.currentTime += outputChannel.length / this.sampleRate;

    return true;
  }
}

registerProcessor("audio-stream-processor", AudioStreamProcessor);
