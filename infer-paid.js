const Replicate = require("replicate"),
  dotenv = require("dotenv");

dotenv.config();
const procenv = process.env,
  replicate = new Replicate({
    auth: procenv.REPTOKEN,
  });

async function generate(prompt, count = 0) {
  try {
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
            top_k: 100,
            top_p: 0.7,
            frequency_penalty: 1.5,
            presence_penalty: 1,
            temperature: 0.85,
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
  } catch (e) {
    if (count > 3) return "";
    console.log(`[${new Date()}] backend host failed, retrying (${count + 1})`);
    return await generate(prompt, count + 1);
  }
}

async function generateImage(prompt, neg) {
  return await fetch(
    (
      await replicate.run(
        [
          "asiryan/blue-pencil-xl-v2:06db33e3cd56700e2b0de541e65e2fc377604bebc97eb87b40e1d190fafa7ef4",
          "asiryan/counterfeit-xl-v2:ecf81c8a283dee9629e20c782e1874f876be52cb0b207873cdde873209c4a172",
        ][new Date().getTime() % 2],
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
