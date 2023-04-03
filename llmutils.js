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
 * Infer a single token using the binary.
 * @param {string} prompt - The prompt to run.
 * @returns {Promise<string>} The output of the command.
 */
function runSingle(prompt) {
  return runCommand(
    `llama.cpp/build/bin/main -m models/7bq/ggml-model-q4_0-ggjt.bin -p "${prompt}" -c 2048 --top_p 0.7 --repeat_penalty 1.1 -n 1 -b 128`
  );
}

/**
 * Runs a prompt using the binary.
 * @async
 * @param {string} prompt - The prompt to run.
 * @param {Discord.TextChannel} [channel] - So we can send typing
 * @returns {Promise<string>} The output of the command.
 */
async function runPrompt(prompt, channel) {
  let result = "";
  const _ = async () => {
    while (result.split(" ").length < 128) {
      if (channel) channel.sendTyping();
      result += await runSingle(prompt);
    }
  };
  await _();
  return result;
}

module.exports = { runCommand, runPrompt };
