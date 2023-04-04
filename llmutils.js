const { exec } = require("child_process"),
  Discord = require("discord.js");

/**
 * Runs a prompt using the binary.
 * @param {string} prompt - The prompt to run.
 * @param {Discord.Message} reply - To do token-by-token
 */
function runPrompt(prompt, reply) {
  const runner = exec(
    `llama.cpp/build/bin/main -m models/7bq/ggml-model-q4_0-ggjt.bin -p "${prompt}" -c 2048 --top_p 0.7 --repeat_penalty 1.1 -n 128 -b 128`
  );
  let res = "";

  runner.stdout.on("data", async (data) => {
    if (!(data.split(" ").length > 2)) {
      if (res.includes("\n")) {
        runner.kill();
        return res;
      }
      res += data;
      await reply.edit({ content: res });
    }
  });

  runner.on("exit", () => {
    return res;
  });
}

module.exports = { runPrompt };
