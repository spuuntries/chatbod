const { exec } = require("child_process"),
  Discord = require("discord.js");

/**
 * Runs a prompt using the binary.
 * @async
 * @param {string} prompt - The prompt to run.
 * @param {Discord.Message} reply - To do token-by-token
 * @returns
 */
async function runPrompt(prompt, reply) {
  const runner = exec(
    `llama.cpp/build/bin/main -m models/7bq/ggml-model-q4_0-ggjt.bin -p "${prompt}" -c 2048 --top_p 0.7 --repeat_penalty 1.1 -n 128 -b 128`
  );
  runner.stdout.on("data", (data) => {
    if (data.includes("\n")) runner.kill();
    reply.edit({ content: reply.content + data });
  });
}

module.exports = { runPrompt };
