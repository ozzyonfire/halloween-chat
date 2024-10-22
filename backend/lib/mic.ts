interface RecordingOptions {
  endian?: "big" | "little" | "swap";
  bitwidth: "16";
  encoding: "signed-integer";
  rate?: "24000";
  channels: 1 | 2;
  additionalParameters?: boolean;
  useDefaultDevice?: boolean;
  silenceDuration?: number;
  silenceThreshold?: number;
}

const DEFAULT_OPTIONS: RecordingOptions = {
  endian: "little",
  encoding: "signed-integer",
  bitwidth: "16",
  rate: "24000",
  channels: 1,
  useDefaultDevice: true,
  silenceDuration: 1,
  silenceThreshold: 0.5,
};

export class AudioRecorder {
  private options: RecordingOptions;
  private isRecording: boolean = false;
  private recProcess: Deno.ChildProcess | null = null;
  private chunkSize: number = 4096; // Adjust this value as needed

  constructor(options?: Partial<RecordingOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async startRecording(
    onAudioDetected: (audio: Int16Array | ArrayBuffer) => void
  ) {
    if (this.isRecording) {
      throw new Error("Recording is already in progress");
    }

    this.isRecording = true;
    const args = this.buildRecordingArgs();

    try {
      const rec = new Deno.Command("rec", {
        args: args,
        stdout: "piped",
        stderr: "piped",
      });

      this.recProcess = rec.spawn();

      // Process stdout
      this.processStdout(this.recProcess.stdout, onAudioDetected);

      // Process stderr
      this.processStderr(this.recProcess.stderr);

      // Wait for the process to finish
      await this.recProcess.status;
    } catch (error) {
      console.error("Recording error:", error);
    } finally {
      this.isRecording = false;
    }
  }

  stopRecording() {
    this.isRecording = false;
    if (this.recProcess) {
      this.recProcess.kill("SIGTERM");
      this.recProcess = null;
    }
  }

  private buildRecordingArgs(): string[] {
    const args: string[] = ["-q"];

    if (this.options.endian) {
      args.push("--endian", this.options.endian);
    }

    args.push(
      "-b",
      this.options.bitwidth,
      "-c",
      this.options.channels.toString(),
      "-r",
      this.options.rate || "24000",
      "-e",
      this.options.encoding,
      "-t",
      "raw", // output raw PCM data
      "-" // output to stdout
    );

    // Add silence effect to stop recording after a period of silence
    // args.push(
    //   "silence",
    //   "1",
    //   "0.1",
    //   `1%`,
    //   "1",
    //   this.options.silenceDuration
    //     ? this.options.silenceDuration.toString()
    //     : "1",
    //   `1%`
    // );

    // Add high-pass filter
    args.push("highpass", "200");

    // Add compressor
    args.push("compand", "0.3,1", "6:-70,-60,-20", "-5", "-90", "0.2");

    return args;
  }

  private base64EncodeAudio(uint8Array: Uint8Array): string {
    let binary = "";
    const chunkSize = 0x8000; // 32KB chunk size
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
  }

  private async processStdout(
    reader: ReadableStream<Uint8Array>,
    onAudioDetected: (audio: Int16Array | ArrayBuffer) => void
  ) {
    const buffer = new Uint8Array(this.chunkSize);
    let offset = 0;

    for await (const chunk of reader) {
      if (!this.isRecording) break;

      for (let i = 0; i < chunk.length; i++) {
        buffer[offset++] = chunk[i];
        if (offset === this.chunkSize) {
          // const int16Array = new Int16Array(buffer.buffer);
          onAudioDetected(buffer.buffer);
          offset = 0;
        }
      }
    }

    // Send any remaining data
    if (offset > 0) {
      const int16Array = new Int16Array(buffer.subarray(0, offset).buffer);
      onAudioDetected(int16Array);
    }
  }

  private async processStderr(reader: ReadableStream<Uint8Array>) {
    const decoder = new TextDecoder();
    for await (const chunk of reader) {
      if (!this.isRecording) break;
      console.error(decoder.decode(chunk));
    }
  }
}
