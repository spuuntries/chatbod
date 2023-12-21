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
      "mistralai/mistral-7b-instruct-v0.2:f5701ad84de5715051cb99d550539719f8a7fbcf65e0e62a3d1eb3f94720764e",
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
    (
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
      )
    )[0]
  );
}

module.exports = { generate, generateImage };
