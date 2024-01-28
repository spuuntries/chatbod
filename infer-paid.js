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

/**
 * @param {string} prompt
 * @param {number} count
 * @param {object} additional_conf
 * @returns {Promise<string>}
 */
async function generate(prompt, count = 0, additional_conf = {}) {
  const generationConfig = toml.parse(
    fs.readFileSync(procenv.LLMCONFIG).toString()
  );
  try {
    /*
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
    */
    return (
      await replicate.run(
        "spuuntries/flatdolphinmaid-8x7b-gguf:1510dd7e9dc7142cca0c8bb899b9eb2f339d686d9ded0e33720ecaeccdfb3146",
        {
          input: {
            prompt: prompt,
            max_new_tokens: 256,
            prompt_template: "{prompt}",
            ...(generationConfig?.paid ? { ...generationConfig.paid } : {}),
            ...(additional_conf ? { ...additional_conf } : {}),
          },
        }
      )
    ).join("");
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
            "fofr/latent-consistency-model:683d19dc312f7a9f0428b04429a9ccefd28dbf7785fef083ad5cf991b65f406f",
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
