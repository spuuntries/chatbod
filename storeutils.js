// NOTE: This util is only for embeddings/vecstore, the actual sentences embedded will need to be implemented elsewhere

const createKDTree = require("static-kdtree"),
  logger = (m) => console.log(`[${new Date()}] ${m}`),
  { QuickDB } = require("quick.db"),
  db = new QuickDB(),
  { exec } = require("child_process");

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
 * Get embedding of string.
 * @param {string} string - String to embed.
 * @returns {Promise<string[]>} Embeddings of the string
 */
async function getEmbeddings(string) {
  const res = (
    await runCommand(
      `llama.cpp/build/bin/embedding -m models/7bq/ggml-model-q4_0-ggjt.bin -p "${string}"`
    )
  ).split(" ");
  res.pop();
  return res;
}

/**
 * Creates a new vector store.
 * @param {number[][]} [embeddings=[]] - An optional array of initial embeddings.
 * @returns {number[][]}
 */
async function createStore(embeddings = []) {
  if (!(await db.has("vecstore"))) await db.set(embeddings ? embeddings : []);

  return await db.get("vecstore");
}

/**
 * Stores embeddings in the vector store.
 * @param {number[]} embeddings - The embeddings to store.
 * @returns {number[][]}
 */
async function storeEmbeddings(embeddings) {
  if (!(await db.has("vecstore")))
    logger(`[WARN] vecstore not created when storing, creating one`);

  return await db.push("vecstore", embeddings);
}

/**
 * Searches for the nearest neighbors of query embeddings.
 * @param {number[]} query - The queried embeddings.
 * @param {number} [distance=4] - Max distance of neighbors, default is 4.
 * @param {number} [max] - Max number of neighbors, default 2.
 * @returns {number[][]}
 */
async function searchEmbeddings(query, distance, max) {
  if (!distance) var distance = 4;
  if (!max) var max = 2;
  const vecstore = await db.get("vecstore"),
    tree = createKDTree(vecstore);

  return tree.knn(query, max, distance);
}

module.exports = {
  getEmbeddings,
  createStore,
  storeEmbeddings,
  searchEmbeddings,
};
