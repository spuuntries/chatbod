require("dotenv").config();
const { exec } = require("child_process"),
  compromise = require("compromise"),
  /** @type {compromise.default} */
  nlp = require("compromise"),
  wtf = require("wtf_wikipedia"),
  { HfInference } = require("@huggingface/inference"),
  axios = require("axios"),
  { python } = require("pythonia"),
  { generate } = require("./infer-petals"),
  genPaid = require("./infer-paid").generate,
  imgPaid = require("./infer-paid").generateImage,
  _ = require("lodash"),
  { QuickDB } = require("quick.db"),
  db = new QuickDB(),
  hf = new HfInference(process.env.HF_TOKEN),
  { randomInt } = require("crypto");

var bindings, siginter;

/**
 * Set up bindings
 */
async function setBindings() {
  if (!bindings) bindings = await python("./infer_bindings.py");
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
 * @param {string} cid - Channel ID, for caching
 * @returns {Promise<string>} The output of the command.
 */
async function runPrompt(prompt, cid) {
  /**
  const binder = await setBindings(),
    res = await binder.generate$(prompt, { $timeout: Infinity });
  return res;
  */
  return await genPaid(prompt);
}

/**
 * Runs a prompt through the auxilliary provider, currently replicate-based API.
 * @async
 * @param {string} prompt - Prompt to run
 * @returns {Promise<string>} The output of the command.
 */
async function runAux(prompt) {
  /** 
  const res = await generate(prompt);
  return res;
  */
  return await genPaid(prompt);
}

async function getCaption(img) {
  const { client } = await import("@gradio/client");
  const blob = await (await fetch(img)).blob();
  const blip = await client("https://spuun-blip-api.hf.space/", {
    hf_token: process.env.HF_TOKEN,
  });
  const image = img.split("/").pop().split(".")[0];

  if (await db.has(image)) return await db.get(image);

  var res;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Request timed out"));
      }, 60000);
    });
    res = (
      await Promise.race([blip.predict("/predict", [blob]), timeoutPromise])
    ).data[0];
  } catch (e) {
    console.log(`[${new Date()}] blip: ${e}`);
    return "<ERROR: vision module failure>";
  }

  if (!res) return "<ERROR: vision module failure>";
  await db.set(image, res);
  return res;
}

async function keyword(input) {
  const prompt = `### System:
You are keyworder, a bot that summarizes a text into keywords delimited by commas.
### User:
${input}
### Assistant:
topics: [`;

  let res = (await runAux(prompt))
    .split("\n")[0]
    .trim()
    .split(",")
    .map((e) => {
      return e.replaceAll("[", "").replaceAll("]", "").trim();
    });

  return res;
}

/**
 *
 * @param {Buffer} image - buffer of image to check
 */
async function nsfwProcess(image) {
  const { client } = await import("@gradio/client"),
    blob = new Blob([image], { type: "image/png" }),
    nsfwdet = await client("https://spuun-nsfw-det.hf.space/", {
      hf_token: process.env.HF_TOKEN,
    });

  let retries = 3;
  while (retries > 0) {
    try {
      const res = (await nsfwdet.predict("/predict", [blob])).data[0];
      if (!res) {
        console.log(
          `[WARN] [${new Date()}] nsfw failed to return a value, defaulting to false.`
        );
        return false;
      }
      return JSON.parse(res.toLowerCase());
    } catch (e) {
      console.log(`[${new Date()}] nsfw: ${e}`);
      retries--;
      if (retries === 0) {
        console.log(
          `[${new Date()}] NSFW retry limit reached, returning fallback value`
        );
        return true;
      }
    }
  }
}

/**
 * Fetches the top matching GIF for a given query.
 * @param {string} query - The search query.
 * @returns {Promise<ArrayBuffer | undefined>} The GIF data as an ArrayBuffer or undefined.
 */
async function getTopMatchingGif(query) {
  const keywords = await keyword(query);
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
        inputs: query.slice(-128),
      })
    ).shift().label,
    /** @type {string[]} */
    keywords = await keyword(query);

  console.log(`[${new Date()}] ${keywords} | ${emotion}`);

  /*
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
  */

  const res = Buffer.from(
    await imgPaid(
      `${
        keywords
          ? `${keywords.map((s) =>
              s.toLowerCase().replaceAll("kekbot", "").replaceAll("kek", "")
            )},`
          : ""
      } ${emotion}, ${emotion}, ${emotion},${
        keywords?.includes("kekbot")
          ? " portrait, catgirl, cat_ears, green_hair, petite, petite, short, slim, small, oversized_shirt, oversized_clothes, vr, head-mounted_display, virtual_reality,"
          : ""
      } masterpiece, best_quality`,
      "nsfw, breasts, large_breast, boobs, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry"
    )
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

/**
 * @param {string} string - String to summarize
 * @returns {Promise<string|undefined>}
 */
async function getSummary(input) {
  const prompt = `### System:
You are summarizer, a bot that summarizes a text into a digestible third-person interpretation. This interpretation must be easy to understand and concise, like you're explaining it to someone else. If the text mentions people's names, refer to them by their names.
### User:
${input}
### Assistant:
Summary: `;

  let res = (await runAux(prompt)).trim();
  return res;
}

/**
 * Retrieval-Augmented Generation Mechanism
 * @param {string} string
 * @returns {Promise<string[]>}
 */
async function retrieval(string) {
  const input = nlp(string),
    topics = input
      .toLowerCase()
      .topics()
      .normalize({ possessives: true, plurals: true })
      .out("array")
      .map((t) => t.replaceAll(/[.?!;]$/g, "").replaceAll(/["']/g, "")),
    acros = input
      .json()[0]
      .terms.filter((t) => t.tags.includes("Acronym")) // For some reason .acronyms() doesn't really work (?) lmao so I do it a bit more... "manually"
      .map((t) => t.text),
    nouns = input
      .toLowerCase()
      .nouns()
      .normalize({ possessives: true, plurals: true })
      .out("array")
      .map((t) => t.replaceAll(/[.?!;]$/g, "").replaceAll(/["']/g, "")),
    docs =
      topics && acros
        ? // Fetches relevant wikipedia documents and parses them
          await wtf.fetch(
            _.uniq([...(topics ?? []), ...(acros ?? []), ...(nouns ?? [])])
              .filter((v) => !v.toLowerCase().includes("kek")) // Filter for kek, since injection success can get disrupted by this
              .map((v) => nlp(v).toTitleCase().text()) // Ensures in title casing to ensure hits on articles
          )
        : null,
    results = docs
      ? docs
          .filter((d) => d)
          .map((d) =>
            nlp(d.text())
              .sentences()
              .filter((t) => !t.has("may refer to")) // For disambiguation pages
              .slice(0, 5) // Disambiguation pages may provide multiple entries, so just to be safe, we can grab a few of the listed things then have user clarify
              .text()
              .replaceAll(/\n+/g, "\n")
          )
      : [];

  return results;
}

module.exports = {
  runPrompt,
  runAux,
  keyword,
  retrieval,
  getCaption,
  getTopMatchingGif,
  nsfwProcess,
  generateImage,
  getSummary,
  getClosestQA,
};
