// We make sure the model is always warm with this worker.
require("dotenv").config();

const logger = (m) => console.log(`[${new Date()}] ${m}`),
  { HfInference } = require("@huggingface/inference"),
  hf = new HfInference(process.env.HF_TOKEN),
  niceware = require("niceware");

setInterval(async () => {
  var stage = 0;
  const { client } = await import("@gradio/client"),
    dialogsum = await client("https://spuun-dialogsum.hf.space/", {
      hf_token: process.env.HF_TOKEN,
    }),
    blip = await client("https://spuun-blip-api.hf.space/", {
      hf_token: process.env.HF_TOKEN,
    });
  try {
    const query = (
      await hf.textGeneration({
        model: "gpt2",
        inputs:
          "My name is " + niceware.generatePassphrase(4).join(" ") + " and I",
      })
    ).generated_text;

    stage++;
    if (!(await dialogsum.predict("/predict", [query])).data)
      throw new Error("dialogsum failed");

    stage++;
    const image = await hf.textToImage(
      {
        model: "iZELX1/Anything-V3-X",
        inputs: query,
        parameters: { num_inference_steps: 10 },
      },
      { wait_for_model: true }
    );

    stage++;
    if (!(await blip.predict("/predict", [image])).data)
      throw new Error("blip failed");

    image.stage = 0;
  } catch (e) {
    logger(
      `Failed to warm up models, (${e.message}) [${
        ["gpt2", "dialogsum", "counterfeit", "blip"][stage]
      }]`
    );
  }
}, 1800000);

logger("Warmer worker is running...");
