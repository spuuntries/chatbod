const { exec } = require("child_process");

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
 * @param {string} prompt - The prompt to run.
 * @returns {Promise<string>} The output of the command.
 */
function runPrompt(prompt) {
  return runCommand(
    `llama.cpp/build/bin/main -m llama.cpp/models/7bq/ggml-model-q4_0-ggjt.bin -p "${prompt}" -n 32`
  );
}

module.exports = { runCommand, runPrompt };
