const { exec } = require("child_process"),
  Discord = require("discord.js");

/**
 * Runs a prompt using the binary.
 * @param {string} prompt - The prompt to run.
 * @param {Discord.Message} message - Message to reply to.
 */
function runPrompt(prompt, message) {
  return new Promise(async (resolve, reject) => {
    const runner = exec(
      `llama.cpp/build/bin/main -m models/7bq/ggml-model-q4_0-ggjt.bin -p "${prompt}" -c 2048 --top_p 0.7 --repeat_penalty 1.1 -n 128 -b 128`
    );
    let reply,
      res = "";

    runner.stdout.on("data", async (data) => {
      if (!(data.split(" ").length > 2)) {
        if (res.includes("\n")) {
          runner.kill();
          resolve(res);
        }
        res += data;
        if (!reply)
          reply = await message.reply({
            content: res,
            allowedMentions: { repliedUser: false },
          });
        else await reply.edit({ content: res });
      }
    });

    runner.on("exit", () => {
      resolve(res);
    });
  });
}

module.exports = { runPrompt };
