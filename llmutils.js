require("dotenv").config();
const { exec } = require("child_process"),
  axios = require("axios"),
  Discord = require("discord.js");

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
 * @param {Discord.Message} message - To display typing.
 * @returns {Promise<string>} The output of the command.
 */
async function runPrompt(prompt, message) {
  var typing;
  function type() {
    message.channel.sendTyping().then(() => {
      typing = setTimeout(() => {
        type();
      }, 5000);
    });
  }
  type();

  const res = await runCommand(
    `llama.cpp/build/bin/main -m models/7bq/ggml-model-q4_0-ggjt.bin -p "${prompt}" -n 32 -b 64 -c 1024 --top_p 0.7 --temp 0.75`
  );
  clearTimeout(typing);
  return res;
}

async function getTopMatchingGif(query) {
  const url = `https://tenor.googleapis.com/v2/search?q=${query}&key=${process.env.TENOR_API_KEY}&client_key=kekbot&limit=1`;

  try {
    const response = await axios.get(url);

    if (response.data.results.length > 0) {
      const topResult = response.data.results[0];
      const gifUrl = topResult.itemurl;
      const gifResponse = await axios.get(gifUrl, {
        responseType: "arraybuffer",
      });
      return gifResponse.data;
    } else {
      throw new Error(`No GIFs found for query "${query}"`);
    }
  } catch (error) {
    console.error(`Error querying Tenor API: ${error}`);
    throw error;
  }
}

module.exports = { runCommand, runPrompt, getTopMatchingGif };
