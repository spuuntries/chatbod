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
          frequency_penalty: 1.1,
        },
      }
    )
  ).join("");
}

async function generateImage(prompt, neg) {
  return await fetch(
    await replicate.run(
      "playgroundai/playground-v2-1024px-aesthetic:42fe626e41cc811eaf02c94b892774839268ce1994ea778eba97103fe1ef51b8",
      {
        input: {
          prompt: prompt,
          negative_prompt: neg,
          num_inference_steps: 40,
          disable_safety_checker: true,
          guidance_scale: 6,
        },
      }
    )[0]
  );
}

module.exports = { generate, generateImage };
