import Replicate, { type FileOutput } from "replicate";

const replicate = new Replicate({ useFileOutput: true });

export async function generateReplicateImage(prompt: string) {
  const model = "black-forest-labs/flux-schnell";
  // const model = "black-forest-labs/flux-dev";
  const response = (await replicate.run(model, {
    input: {
      prompt,
      output_quality: 80,
      aspect_ratio: "16:9",
      disable_safety_checker: true,
    },
  })) as FileOutput[];
  console.log("response", response);
  return response[0].url();
}

if (import.meta.main) {
  const image = await generateReplicateImage(
    "A beautiful landscape with a river and mountains"
  );
  console.log("image", image.toString());
}
