// const isMac = require('os').type() == 'Darwin';
// const isWin = require('os').type().indexOf('Windows') > -1;
// const spawn = require('child_process').spawn;
// const EventEmitter = require('events');

// export class Microphone extends EventEmitter {
//     constructor(options) {
//         super();
//         this.ps = null;

//         options = options || {};
//         this.endian = options.endian || 'little';
//         this.bitwidth = options.bitwidth || '16';
//         this.encoding = options.encoding || 'signed-integer';
//         this.rate = options.rate || '16000';
//         this.channels = options.channels || '1';
//         this.additionalParameters = options.additionalParameters || false;
//         this.useDataEmitter = !!options.useDataEmitter;
//         if (isWin) {
//             this.device = options.device || 'default';
//         }
//         if (!isWin && !isMac) {
//             this.device = options.device || 'plughw:1,0';
//             this.format = undefined;
//             this.formatEndian = undefined;
//             this.formatEncoding = undefined;

//             if (this.encoding === 'unsigned-integer') {
//                 this.formatEncoding = 'U';
//             } else {
//                 this.formatEncoding = 'S';
//             }
//             if (this.endian === 'big') {
//                 this.formatEndian = 'BE';
//             } else {
//                 this.formatEndian = 'LE';
//             }
//             this.format =
//                 this.formatEncoding + this.bitwidth + '_' + this.formatEndian;
//         }
//     }

//     // end on silence - default threshold 0.5
//     //'silence', '1', '0.1', options.threshold + '%',
//     //'1', '1.0', options.threshold + '%'

//     startRecording() {
//         let audioOptions;
//         if (this.ps === null) {
//             if (isWin) {
//                 audioOptions = [
//                     '-b',
//                     this.bitwidth,
//                     '--endian',
//                     this.endian,
//                     '-c',
//                     this.channels,
//                     '-r',
//                     this.rate,
//                     '-e',
//                     this.encoding,
//                     '-t',
//                     'waveaudio',
//                     this.device,
//                     '-p',
//                 ];
//                 if (this.additionalParameters) {
//                     audioOptions = audioOptions.concat(
//                         this.additionalParameters
//                     );
//                 }
//                 this.ps = spawn('sox', audioOptions);
//             } else if (isMac) {
//                 audioOptions = [
//                     '-q',
//                     '-b',
//                     this.bitwidth,
//                     '-c',
//                     this.channels,
//                     '-r',
//                     this.rate,
//                     '-e',
//                     this.encoding,
//                     '-t',
//                     'wav',
//                     '-',
//                 ];
//                 if (this.additionalParameters) {
//                     audioOptions = audioOptions.concat(
//                         this.additionalParameters
//                     );
//                 }
//                 this.ps = spawn('rec', audioOptions);
//             } else {
//                 audioOptions = [
//                     '-c',
//                     this.channels,
//                     '-r',
//                     this.rate,
//                     '-f',
//                     this.format,
//                     '-D',
//                     this.device,
//                 ];
//                 if (this.additionalParameters) {
//                     audioOptions = audioOptions.concat(
//                         this.additionalParameters
//                     );
//                 }
//                 this.ps = spawn('arecord', audioOptions);
//             }
//             this.ps.on('error', (error) => {
//                 this.emit('error', error);
//             });
//             this.ps.stderr.on('error', (error) => {
//                 this.emit('error', error);
//             });
//             this.ps.stderr.on('data', (info) => {
//                 this.emit('info', info);
//             });
//             if (this.useDataEmitter) {
//                 this.ps.stdout.on('data', (data) => {
//                     this.emit('data', data);
//                 });
//             }
//             return this.ps.stdout;
//         }
//     }

//     stopRecording() {
//         if (this.ps) {
//             this.ps.kill();
//             this.ps = null;
//         }
//     }
// }

interface RecordingOptions {
  endian?: "big" | "little" | "swap";
  bitwidth: "16";
  encoding: "signed-integer";
  rate: "16000";
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
  rate: "16000",
  channels: 1,
  useDefaultDevice: true,
  silenceDuration: 1,
  silenceThreshold: 0.5,
};

export async function record(options?: RecordingOptions) {
  options = { ...DEFAULT_OPTIONS, ...options };
  const args: string[] = [];

  if (options.useDefaultDevice) {
    args.push("--default-device");
  }

  if (options.endian) {
    args.push("--endian", options.endian);
  }

  args.push(
    "-q", // show no progress
    "-b",
    options.bitwidth,
    "-c",
    options.channels.toString(),
    "-r",
    options.rate,
    "-e",
    options.encoding,
    "-t",
    "raw", // output raw PCM data
    "-" // output to stdout
  );

  // Add silence effect to stop recording after a period of silence
  args.push(
    "silence",
    "1",
    "0.1",
    `${options.silenceThreshold}%`,
    "1",
    options.silenceDuration ? options.silenceDuration.toString() : "1",
    `${options.silenceThreshold}%`
  );

  const rec = new Deno.Command("rec", {
    args: args,
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout, stderr } = await rec.output();

  if (stderr.length > 0) {
    console.error(new TextDecoder().decode(stderr));
    throw new Error("Error occurred while recording");
  }

  // Convert the output buffer to Uint8Array
  const uint8Array = new Uint8Array(stdout.buffer);
  return base64EncodeAudio(uint8Array);
}

// Converts Float32Array of audio data to PCM16 ArrayBuffer
function _floatTo16BitPCM(float32Array: Float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

// Converts a Uint8Array to base64-encoded PCM16 data
function base64EncodeAudio(uint8Array: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000; // 32KB chunk size
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}
