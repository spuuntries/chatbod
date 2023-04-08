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
  var typing;
  function type() {
    message.channel.sendTyping().then(() => {
      typing = setTimeout(() => {
        type();
      }, 10000);
    });
  }
  type();

  const res = await runCommand(
    `llama.cpp/build/bin/main -m models/7bq/ggml-model-q4_0-ggjt.bin -p "${prompt}" -n 72`,
    message
  );
  clearTimeout(typing);
  return res;
}

module.exports = { runCommand, runPrompt };
