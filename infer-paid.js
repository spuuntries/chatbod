const Replicate = require("replicate"),
  dotenv = require("dotenv");

dotenv.config();
const procenv = process.env,
  replicate = new Replicate({
    auth: procenv.REPTOKEN,
  });

async function generate(prompt) {
  return (
    await replicate.run(
      "mistralai/mixtral-8x7b-instruct-v0.1:2b56576fcfbe32fa0526897d8385dd3fb3d36ba6fd0dbe033c72886b81ade93e",
      {
        input: {
          top_k: 50,
          top_p: 0.9,
          prompt: prompt,
          temperature: 0.6,
          max_new_tokens: 256,
          prompt_template: "<s>{prompt}",
          presence_penalty: 0,
          frequency_penalty: 0,
        },
      }
    )
  ).join("");
}

module.exports = { generate };
