export async function setupPlayer(sampleRate: number = 44100) {
  const audioContext = new AudioContext({ sampleRate });

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  try {
    await audioContext.audioWorklet.addModule("audio-stream-processor.js");
  } catch (error) {
    console.error("Failed to load audio-stream-processor.js", error);
    throw error;
  }

  const streamNode = new AudioWorkletNode(
    audioContext,
    "audio-stream-processor"
  );

  streamNode.connect(audioContext.destination);

  const handleAudioData = (
    arrayBuffer: ArrayBuffer | Int16Array,
    trackId: string = "default"
  ): Int16Array => {
    if (typeof trackId !== "string") {
      throw new Error(`trackId must be a string`);
    }

    let buffer: Int16Array;
    if (arrayBuffer instanceof Int16Array) {
      buffer = arrayBuffer;
    } else if (arrayBuffer instanceof ArrayBuffer) {
      buffer = new Int16Array(arrayBuffer);
    } else {
      throw new Error(`argument must be Int16Array or ArrayBuffer`);
    }

    streamNode.port.postMessage({
      type: "audio-data",
      audioData: buffer,
      trackId,
    });

    return buffer;
  };

  const disconnect = () => {
    streamNode.disconnect();
    audioContext.close();
  };

  return { audioContext, streamNode, disconnect, handleAudioData };
}
