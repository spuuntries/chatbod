const { exec } = require("child_process"),
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
  const typing = setInterval(async () => {
      await message.channel.sendTyping();
    }, 10000),
    res = await runCommand(
      `llama.cpp/build/bin/main -m models/7bq/ggml-model-q4_0-ggjt.bin -p "${prompt}" -t 3 -c 2048 -n 128 -b 512`,
      message
    );
  clearInterval(typing);
  return res;
}

module.exports = { runCommand, runPrompt };
