const { exec } = require("child_process"),
  Discord = require("discord.js");

/**
 * Runs a prompt using the binary.
 * @async
 * @param {string} prompt - The prompt to run.
 * @param {Discord.Message} reply - To do token-by-token
 */
async function runPrompt(prompt, reply) {
  return new Promise((resolve, reject) => {
    const runner = exec(
      `llama.cpp/build/bin/main -m models/7bq/ggml-model-q4_0-ggjt.bin -p "${prompt}" -c 2048 --top_p 0.7 --repeat_penalty 1.1 -n 128 -b 128`
    );
    let res = "";

    runner.stdout.on("data", async (data) => {
      if (data.split(" ").length > 2) {
        if (data.includes("\n")) {
          runner.kill();
          resolve(res);
        }
        res += data;
        await reply.edit({ content: res });
      }
    });

    runner.on("exit", () => {
      resolve(res);
    });
  });
}

module.exports = { runPrompt };
