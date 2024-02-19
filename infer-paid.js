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

// https://stackoverflow.com/a/53624454
function jsonFriendlyErrorReplacer(key, value) {
  if (value instanceof Error) {
    return {
      // Pull all enumerable properties, supporting properties on custom Errors
      ...value,
      // Explicitly pull Error's non-enumerable properties
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  return value;
}

/**
 * @param {string} prompt
 * @param {number} count
 * @param {{backend: string}} additional_conf
 * @returns {Promise<string>}
 */
async function generate(
  prompt,
  count = 0,
  additional_conf = { backend: "replicate" }
) {
  const generationConfig = toml.parse(
    fs.readFileSync(procenv.LLMCONFIG).toString()
  );
  try {
    if (additional_conf && additional_conf?.backend) {
      switch (additional_conf.backend) {
        case "replicate":
          return (
            await replicate.run(
              "spuuntries/miqumaid-v2-2x70b-dpo-gguf:30698eb03a6b2b2b9b569eb9633fd0e71f9a74ea690ca61de2a81a66e33c7be6",
              {
                input: {
                  prompt: prompt,
                  max_new_tokens: 256,
                  prompt_template: "{prompt}",
                  seed: Math.floor(Math.random() * 1000000),
                  ...(generationConfig?.paid
                    ? { ...generationConfig.paid }
                    : {}),
                  ...(additional_conf ? { ...additional_conf } : {}),
                },
              }
            )
          ).join("");

        case "openrouter":
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
                  ...(generationConfig?.paid
                    ? { ...generationConfig.paid }
                    : {}),
                  ...(additional_conf ? { ...additional_conf } : {}),
                }),
              })
            ).json()
          ).choices[0].text;

        default:
          return (
            await replicate.run(
              "spuuntries/miqumaid-v2-2x70b-dpo-gguf:30698eb03a6b2b2b9b569eb9633fd0e71f9a74ea690ca61de2a81a66e33c7be6",
              {
                input: {
                  prompt: prompt,
                  max_new_tokens: 256,
                  prompt_template: "{prompt}",
                  seed: Math.floor(Math.random() * 1000000),
                  ...(generationConfig?.paid
                    ? { ...generationConfig.paid }
                    : {}),
                  ...(additional_conf ? { ...additional_conf } : {}),
                },
              }
            )
          ).join("");
      }
    } else {
      return (
        await replicate.run(
          "spuuntries/miqumaid-v2-2x70b-dpo-gguf:30698eb03a6b2b2b9b569eb9633fd0e71f9a74ea690ca61de2a81a66e33c7be6",
          {
            input: {
              prompt: prompt,
              max_new_tokens: 256,
              prompt_template: "{prompt}",
              seed: Math.floor(Math.random() * 1000000),
              ...(generationConfig?.paid ? { ...generationConfig.paid } : {}),
              ...(additional_conf ? { ...additional_conf } : {}),
            },
          }
        )
      ).join("");
    }
  } catch (e) {
    if (count > 3) return "";
    console.log(
      `[${new Date()}] backend host failed [${e}...], retrying (${count + 1})`
    );
    if (
      JSON.stringify(e, jsonFriendlyErrorReplacer)
        .toLowerCase()
        .includes("replicate") &&
      JSON.stringify(e, jsonFriendlyErrorReplacer)
        .toLowerCase()
        .includes("limit")
    ) {
      console.log(
        `[${new Date()}] caught replicate limiter! Retrying with openrouter...`
      );
      additional_conf["backend"] = "openrouter";
      return await generate(prompt, 0, additional_conf);
    }
    await sleep(5000);
    return await generate(prompt, count + 1, additional_conf);
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
