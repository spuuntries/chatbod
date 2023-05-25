require("dotenv").config();
const { exec } = require("child_process"),
  { HfInference } = require("@huggingface/inference"),
  axios = require("axios"),
  hf = new HfInference(process.env.HF_TOKEN);

var captioned = {};

/**
 * Runs a command and returns its output.
 * @param {string} command - The command to run.
 * @returns {Promise<string>} The output of the command.
 */
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Runs a prompt using the binary.
 * @async
 * @param {string} prompt - The prompt to run.
 * @returns {Promise<string>} The output of the command.
 */
async function runPrompt(prompt) {
  const res = await runCommand(
    `llama.cpp/build/bin/main -m models/7bpq/pyg.bin -e -p "${prompt}" -n 64 -b 512 -c 2048 --top_p 0.7 --temp 0.7 --repeat_penalty 1.2 --repeat_last_n 128`
  );
  return res;
}

async function getCaption(image, maxRetries = 3) {
  const blob = await (await fetch(image)).blob();
  if (captioned[image]) return captioned[image];
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const res = (
        await hf.imageToText({
          model: "Salesforce/blip-image-captioning-large",
          data: blob,
        })
      ).generated_text;

      captioned[image] = res;
      return res;
    } catch (e) {
      retries++;
      console.log(
        `[${new Date()}] Attempt ${retries + 1} failed to get caption: ${
          e.message
        }`
      );
    }
  }
  return `failed to get the caption.`;
}

async function summarizeWithRetry(query) {
  const maxRetries = 5;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await hf.textGeneration({
        model: "knkarthick/TOPIC-DIALOGSUM",
        inputs: query,
      });
      return result.summary_text;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`Failed retrying ${maxRetries} times to get summary`);
      }

      console.log(
        `[${new Date()}] Attempt ${i + 1} failed to get caption: ${
          error.message
        }`
      );
    }
  }
}

async function getTopMatchingGif(query) {
  const keywords = await summarizeWithRetry(query),
    url = `https://tenor.googleapis.com/v2/search?q=${
      keywords
        ? keywords
        : ["I'm not sure", "This is a gif", "Jif or gif", "Ummm"][
            Math.floor(Math.random() * 4)
          ]
    }&key=${
      process.env.TENOR_API_KEY
    }&client_key=kekbot&limit=1&media_filter=gif`;

  console.log(`[${new Date()}] ${keywords}`);

  try {
    const response = await axios.get(url);

    if (response.data.results.length > 0) {
      const topResult =
        response.data.results[
          Math.floor(Math.random() * response.data.results.length)
        ];
      const gifUrl = topResult.media_formats.gif.url;
      const gifResponse = await axios.get(gifUrl, {
        responseType: "arraybuffer",
      });
      return gifResponse.data;
    }
    console.log(`[${new Date()}] No GIFs found for query "${query}"`);
  } catch (error) {
    console.log(`[${new Date()}] Error querying Tenor API: ${error}`);
  }
}

/**
 *
 * @param {string} query
 */
async function generateImage(query) {
  const lastMessage = query
      .split("\n")
      .pop()
      .replace(/^[^ \n]+:/gim, ""),
    emotion = (
      await hf.textClassification({
        model: "arpanghoshal/EmoRoBERTa",
        inputs: lastMessage,
      })
    ).shift().label,
    keywords = await summarizeWithRetry(query);

  console.log(`[${new Date()}] ${keywords} | ${emotion}`);

  const res = Buffer.from(
    await (
      await hf.textToImage({
        model: "andite/pastel-mix",
        inputs: `${
          keywords ? `${keywords},` : ""
        } ${emotion}, 1girl, green hair, loli, femboy, masterpiece, best quality, looking at viewer, cinematic`,
        parameters: { guidance_scale: 7 },
      })
    ).arrayBuffer()
  );
  return res;
}

module.exports = {
  runCommand,
  runPrompt,
  getCaption,
  getTopMatchingGif,
  generateImage,
};
