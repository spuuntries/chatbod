const { IndexFlatL2 } = require("faiss-node"),
  { exec } = require("child_process"),
  index = new IndexFlatL2(4096);

/**
 * Runs a command and returns its output.
 * @param {string} command - The command to run.
 * @returns {Promise<string>} The output of the command.
 */
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Get embeddings of string.
 * @param {string} string - String to embed.
 * @returns {Promise<string[]>} Embeddings of the string
 */
async function getEmbeddings(string) {
  const res = (
    await runCommand(
      `llama.cpp/build/bin/embedding -m models/7bq/ggml-model-q4_0-ggjt.bin -p "${prompt}"`
    )
  ).split(" ");
  res.pop();
  return res;
}

async function add(string) {
  index.add(await getEmbeddings(string));
}

async function get(string, n) {
  index;
}
