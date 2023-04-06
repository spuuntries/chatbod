const { exec } = require("child_process"),
  Discord = require("discord.js");

/**
 * Runs a command and returns its output.
 * @param {string} command - The command to run.
 * @param {Discord.Message} message - To do typing.
 * @returns {Promise<string>} The output of the command.
 */
function runCommand(command, message) {
  return new Promise((resolve, reject) => {
    const runner = exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    });
    runner.stdout.on("data", async () => {
      await message.channel.sendTyping();
    });
  });
}

/**
 * Runs a prompt using the binary.
 * @param {string} prompt - The prompt to run.
 * @param {Discord.Message} message - To display typing.
 * @returns {Promise<string>} The output of the command.
 */
function runPrompt(prompt, message) {
  return runCommand(
    `llama.cpp/build/bin/main -m models/7bq/ggml-model-q4_0-ggjt.bin -p "${prompt}" -t 3 -c 2048 -n 128 -b 512`,
    message
  );
}

module.exports = { runCommand, runPrompt };
