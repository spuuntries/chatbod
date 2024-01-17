require("dotenv").config();
const Replicate = require("replicate"),
  toml = require("toml"),
  axios = require("axios").default,
  fs = require("fs");

const procenv = process.env,
  replicate = new Replicate({
    auth: procenv.REPTOKEN,
  });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generate(prompt, count = 0, additional_conf = {}) {
  const generationConfig = toml.parse(
    fs.readFileSync(procenv.LLMCONFIG).toString()
  );
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
            prompt: prompt,
            max_tokens: 256,
            top_k: 100,
            top_p: 0.7,
            frequency_penalty: 1.5,
            presence_penalty: 1,
            temperature: 0.6,
            ...(generationConfig?.paid ? { ...generationConfig.paid } : {}),
            ...(additional_conf ? { ...additional_conf } : {}),
          }),
        })
      ).json()
    ).choices[0].text;
    // return (
    //   await replicate.run(
    //     "spuuntries/flatdolphinmaid-8x7b-gguf:0e6e20d4e3fbdbdc5f00a03129dbcacc55c84b572e4916e34e8ae02ae2a3e2ba",
    //     {
    //       input: {
    //         prompt: prompt,
    //         max_new_tokens: 256,
    //         prompt_template: "{prompt}",
    //         mirostat_mode: "Mirostat 2.0",
    //         ...(generationConfig?.paid ? { ...generationConfig.paid } : {}),
    //         ...(additional_conf ? { ...additional_conf } : {}),
    //       },
    //     }
    //   )
    // ).join("");
  } catch (e) {
    if (count > 3) return "";
    console.log(
      `[${new Date()}] backend host failed [${e}...], retrying (${count + 1})`
    );
    await sleep(5000);
    return await generate(prompt, count + 1);
  }
}

async function generateImage(prompt, neg) {
  return Buffer.from(
    (
      await axios.get(
        (
          await replicate.run(
            "lucataco/dreamshaper-xl-turbo:0a1710e0187b01a255302738ca0158ff02a22f4638679533e111082f9dd1b615",
            {
              input: {
                prompt: prompt,
                negative_prompt: neg,
                num_inference_steps: 8,
                guidance_scale: 7,
                disable_safety_checker: true,
              },
            }
          )
        )[0],
        {
          headers: { "Content-Type": "application/octet-stream" },
          responseType: "arraybuffer",
        }
      )
    ).data
  );
}

module.exports = { generate, generateImage };
