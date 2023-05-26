// We make sure the model is always warm with this worker.
require("dotenv").config();

const logger = (m) => console.log(`[${new Date()}] ${m}`),
  { HfInference } = require("@huggingface/inference"),
  hf = new HfInference(process.env.HF_TOKEN),
  niceware = require("niceware");

setInterval(async () => {
  var stage = 0;
  try {
    const query = (
      await hf.textGeneration({
        model: "distilgpt2",
        inputs:
          "My name is " + niceware.generatePassphrase(4).join(" ") + " and I",
      })
    ).generated_text;

    stage++;
    await hf.textGeneration(
      {
        model: "knkarthick/TOPIC-DIALOGSUM",
        inputs: query,
      },
      { wait_for_model: true }
    );

    stage++;
    const image = await hf.textToImage(
      {
        model: "gsdf/Counterfeit-V2.5",
        inputs: query,
        parameters: { num_inference_steps: 10 },
      },
      { wait_for_model: true }
    );

    stage++;
    await hf.imageToText(
      {
        model: "Salesforce/blip-image-captioning-large",
        data: image,
      },
      { wait_for_model: true }
    );

    stage = 0;
  } catch (e) {
    logger(
      `Failed to warm up models, (${e.message}) [${
        ["distilgpt2", "dialogsum", "counterfeit", "blip"][stage]
      }]`
    );
  }
}, 5000);

logger("Warmer worker is running...");
