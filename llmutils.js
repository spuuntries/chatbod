require("dotenv").config();
const { exec } = require("child_process"),
  { HfInference } = require("@huggingface/inference"),
  axios = require("axios"),
  { python } = require("pythonia"),
  { QuickDB } = require("quick.db"),
  db = new QuickDB(),
  hf = new HfInference(process.env.HF_TOKEN),
  { randomInt } = require("crypto");
var bindings, siginter;

/**
 * Set up bindings
 */
async function setBindings() {
  if (!bindings) bindings = await python("./infer-bindings.py");
  if (!siginter)
    siginter = process.on("SIGINT", () => {
      bindings.exit();
    });
  return bindings;
}

/**
 * Runs a prompt using the binary.
 * @async
 * @param {string} prompt - The prompt to run.
 * @returns {Promise<string>} The output of the command.
 */
async function runPrompt(prompt) {
  const binder = await setBindings(),
    res = await binder.generate$(prompt, { $timeout: Infinity });
  return res;
}

async function getCaption(img) {
  const { client } = await import("@gradio/client"),
    blob = await (await fetch(img)).blob(),
    blip = await client("https://spuun-blip-api.hf.space/", {
      hf_token: process.env.HF_TOKEN,
    }),
    image = img.split("/").pop().split(".")[0];
  if (await db.has(image)) return await db.get(image);
  var res;
  try {
    res = (await blip.predict("/predict", [blob])).data[0];
  } catch (e) {
    console.log(`[${new Date()}] blip: ${e}`);
    return "failed to get caption.";
  }
  if (!res) return "failed to get caption.";
  await db.set(image, res);
  return res;
}

async function summarize(query) {
  const { client } = await import("@gradio/client"),
    dialogsum = await client("https://spuun-dialogsum.hf.space/", {
      hf_token: process.env.HF_TOKEN,
    }),
    res = (await dialogsum.predict("/predict", [query])).data;

  if (!res) {
    console.log(`[WARN] [${new Date()}] dialogsum failed to return a value.`);
    return undefined;
  }
  return res;
}

/**
 *
 * @param {Buffer} image - buffer of image to check
 */
async function nsfwProcess(image) {
  const { client } = await import("@gradio/client"),
    blob = new Blob([image]),
    nsfwdet = await client("https://spuun-nsfw-det.hf.space/", {
      hf_token: process.env.HF_TOKEN,
    }),
    res = (await nsfwdet.predict("/predict", [blob])).data[0];

  if (!res) {
    console.log(
      `[WARN] [${new Date()}] nsfw failed to return a value, defaulting to false.`
    );
    return false;
  }

  return JSON.parse(res.toLowerCase());
}

/**
 * Fetches the top matching GIF for a given query.
 * @param {string} query - The search query.
 * @returns {Promise<ArrayBuffer | undefined>} The GIF data as an ArrayBuffer or undefined.
 */
async function getTopMatchingGif(query) {
  const keywords = await summarize(query);
  if (!keywords) return undefined;

  const url = `https://tenor.googleapis.com/v2/search?q=${keywords}&key=${process.env.TENOR_API_KEY}&client_key=kekbot&limit=1&media_filter=gif`;

  console.log(`[${new Date()}] ${keywords}`);

  try {
    const response = await axios.get(url);

    if (response.data.results.length > 0) {
      const topResult =
        response.data.results.length - 1
          ? response.data.results[
              randomInt(0, response.data.results.length - 1)
            ]
          : response.data.results[0];
      const gifUrl = topResult.media_formats.gif.url;
      const gifResponse = await axios.get(gifUrl, {
        responseType: "arraybuffer",
      });
      return gifResponse.data;
    } else return undefined;
  } catch (error) {
    console.log(`[${new Date()}] Error querying Tenor API: ${error}`);
  }
}

/**
 *
 * @param {string} query
 */
async function generateImage(query) {
  const emotion = (
      await hf.textClassification({
        model: "arpanghoshal/EmoRoBERTa",
        inputs: query,
      })
    ).shift().label,
    keywords = await summarize(query);

  console.log(`[${new Date()}] ${keywords} | ${emotion}`);

  const res = Buffer.from(
    await (
      await hf.textToImage({
        model: "iZELX1/Anything-V3-X",
        inputs: `${
          keywords ? `${keywords},` : ""
        } ${emotion}, ${emotion}, ${emotion},${
          query.replaceAll(/^[^ \n]+:/gim, "").includes("kekbot")
            ? " catgirl, cat_ears, green_hair, loli, femboy, looking_at_viewer, crop_top,"
            : ""
        } masterpiece, best_quality`,
        parameters: {
          guidance_scale: 8,
          negative_prompt:
            "nsfw, breasts, large_breast, boobs, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
        },
      })
    ).arrayBuffer()
  );
  return res;
}

/**
 * Function to query a QA model to rank the arrSet for closest to query
 * @param {string} query
 * @param {string[]} arrSet
 */
async function getClosestQA(query, arrSet) {
  const { client } = await import("@gradio/client"),
    qa = await client("https://spuun-qa.hf.space/", {
      hf_token: process.env.HF_TOKEN,
    }),
    result = (
      await qa.predict("/predict", [query, arrSet.join("|")])
    ).data[0].split(",");

  return result
    .filter((e) => !isNaN(e))
    .map((e, i) => [arrSet[i], Number.parseFloat(e)])
    .sort((a, b) => b[1] - a[1])[0][0];
}

module.exports = {
  setBindings,
  runPrompt,
  getCaption,
  getTopMatchingGif,
  nsfwProcess,
  generateImage,
  getClosestQA,
};
