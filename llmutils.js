require("dotenv").config();
const { exec } = require("child_process"),
  axios = require("axios");

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
    `llama.cpp/build/bin/main -m models/7bq/ggml-model-q4_0-ggjt.bin -p "${prompt}" -n 64 -b 64 -c 2048 --top_p 0.7 --temp 0.75 --repeat_penalty 1.2 --repeat_last_n 128`
  );
  return res;
}

async function getCaption(buffer) {
  const url = `https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large`;
  let retries = 0;
  const maxRetries = 10;

  while (retries < maxRetries) {
    try {
      const response = await axios.post(url, buffer);
      return response.data[0].generated_text;
    } catch (error) {
      console.log(`Error getting caption: ${error.message}`);
      retries++;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log(`Max retries (${maxRetries}) exceeded to get caption`);
}

async function getTopMatchingGif(query) {
  const url = `https://tenor.googleapis.com/v2/search?q=${query}&key=${process.env.TENOR_API_KEY}&client_key=kekbot&limit=1&media_filter=gif`;

  try {
    const response = await axios.get(url);

    if (response.data.results.length > 0) {
      const topResult = response.data.results[0];
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

module.exports = { runCommand, runPrompt, getCaption, getTopMatchingGif };
