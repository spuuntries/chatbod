const { performance } = require("perf_hooks");

async function generate(prompt, v) {
  performance.mark("start");
  const { client } = await import("@gradio/client"),
    petals = await client("https://spuun-petals.hf.space/", {
      hf_token: process.env.HF_TOKEN,
    }),
    res = (await petals.predict("/predict", [prompt])).data[0];

  if (v)
    console.log(
      performance.measure("gen_perf", "start", "end").duration + "ms"
    );

  return res;
}

module.exports = {
  generate,
};
