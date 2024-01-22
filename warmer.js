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
    }),
    petals = await client("https://spuun-petals.hf.space/", {
      hf_token: process.env.HF_TOKEN,
    }),
    summarizer = await client("https://spuun-summarizer.hf.space/", {
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
    if (!(await petals.predict("/predict", [query])).data)
      throw new Error("petals failed");

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

    stage++;
    if (!(await summarizer.predict("/predict", [query])).data)
      throw new Error("summarizer failed");

    stage = 0;
  } catch (e) {
    logger(
      `Failed to warm up models, (${e.message}) [${
        ["gpt2", "petals", "dialogsum", "counterfeit", "blip", "summarizer"][
          stage
        ]
      }]`
    );
  }
}, 1800000);

logger("Warmer worker is running...");
