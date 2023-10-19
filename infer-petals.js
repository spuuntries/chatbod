const { WebSocket } = require("ws"),
  { performance } = require("perf_hooks");

async function generate(prompt, v, model) {
  performance.mark("start");
  const ws = new WebSocket(`wss://chat.petals.dev/api/v2/generate`);

  return new Promise((resolve) => {
    ws.once("open", () => {
      ws.send(
        JSON.stringify({
          type: "open_inference_session",
          model: model ? model : "stabilityai/StableBeluga2",
          max_length: 8192,
        })
      );

      ws.once("message", (message) => {
        if (v) console.log("Generating");

        ws.send(
          JSON.stringify({
            type: "generate",
            inputs: prompt,
            do_sample: 1,
            temperature: 0.9,
            stop_sequence: "</s>",
            max_new_tokens: 80,
          })
        );

        ws.once("message", async (message) => {
          const response = JSON.parse(message);
          performance.mark("end");
          if (v)
            console.log(
              performance.measure("gen_perf", "start", "end").duration + "ms"
            );

          ws.close();
          if (!response.outputs) resolve(await generate(prompt, v));

          try {
            resolve(response.outputs.replaceAll("</s>", ""));
          } catch (error) {
            resolve(await generate(prompt, v));
          }
        });
      });
    });
  });
}

module.exports = {
  generate,
};
