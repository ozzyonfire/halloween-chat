import { SpeechClient } from "@google-cloud/speech";

// Initialize Google Cloud client
const client = new SpeechClient();

// Convert the MP3 to WAV before sending it
export async function transcribePhonemes(audioFile: Uint8Array) {
  const results = await client.recognize({
    audio: {
      content: audioFile,
    },
    config: {
      encoding: "LINEAR16",
      sampleRateHertz: 16000,
      languageCode: "en-US",
      enableWordTimeOffsets: true,
      model: "default",
    },
  });

  console.log(results[0].results);

  //   const transcription = results[0].results?
  //     .map((result) => result.alternatives[0].transcript)
  //     .join("\n");

  //   const phonemes = response.results.map((result) => {
  //     return result.alternatives[0].words.map((word) => {
  //       return {
  //         word: word.word,
  //         startTime: word.startTime.seconds + word.startTime.nanos * 1e-9,
  //         endTime: word.endTime.seconds + word.endTime.nanos * 1e-9,
  //       };
  //     });
  //   });

  //   console.log("Transcription:", transcription);
  //   console.log("Phoneme-level transcription:", phonemes);
  // }
}

if (import.meta.main) {
  const audioFile = Deno.readFileSync("audio.mp3");
  transcribePhonemes(audioFile);
}
