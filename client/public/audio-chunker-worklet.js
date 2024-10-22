class AudioChunkerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.chunkSize = options.processorOptions.chunkSize;
    this.buffer = new Float32Array(this.chunkSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const channel = input[0];

    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.bufferIndex] = channel[i];
      this.bufferIndex++;

      if (this.bufferIndex === this.chunkSize) {
        // Convert to 16-bit PCM
        const pcmBuffer = this.floatTo16BitPCM(this.buffer);

        this.port.postMessage({
          type: "chunk",
          chunk: pcmBuffer,
        });
        this.buffer = new Float32Array(this.chunkSize);
        this.bufferIndex = 0;
      }
    }

    return true;
  }

  /**
   * Converts 32-bit float data to 16-bit integers
   */
  floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }
}

registerProcessor("audio-chunker-processor", AudioChunkerProcessor);
