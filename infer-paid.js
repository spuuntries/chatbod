const Replicate = require("replicate"),
  dotenv = require("dotenv");

dotenv.config();
const procenv = process.env;
// replicate = new Replicate({
//   auth: procenv.REPTOKEN,
// });

async function generate(prompt) {
  return (
    await (
      await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${procenv.ORTOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistralai/mixtral-8x7b-instruct",
          prompt: prompt,
          max_tokens: 256,
          top_k: 50,
          top_p: 0.9,
          frequency_penalty: 1.1,
          temperature: 0.6,
        }),
      })
    ).json()
  ).choices[0].text;
  // return (
  //   await replicate.run(
  //     "mistralai/mistral-7b-instruct-v0.2:f5701ad84de5715051cb99d550539719f8a7fbcf65e0e62a3d1eb3f94720764e",
  //     {
  //       input: {
  //         top_k: 50,
  //         top_p: 0.9,
  //         prompt: prompt,
  //         temperature: 0.6,
  //         max_new_tokens: 256,
  //         prompt_template: "<s>{prompt}",
  //         presence_penalty: 0,
  //         frequency_penalty: 1.1,
  //       },
  //     }
  //   )
  // ).join("");
}

async function generateImage(prompt, neg) {
  return await fetch(
    (
      await replicate.run(
        "asiryan/blue-pencil-xl-v2:06db33e3cd56700e2b0de541e65e2fc377604bebc97eb87b40e1d190fafa7ef4",
        {
          input: {
            prompt: prompt,
            negative_prompt: neg,
            num_inference_steps: 40,
            guidance_scale: 7,
          },
        }
      )
    )[0]
  );
}

module.exports = { generate, generateImage };
