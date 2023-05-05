const { IndexFlatL2 } = require("faiss-node"),
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
async function getEmbedding(string) {
  const res = (
    await runCommand(
      `llama.cpp/build/bin/embedding -m models/7bq/ggml-model-q4_0-ggjt.bin -p "${prompt}"`
    )
  ).split(" ");
  res.pop();
  return res;
}

/**
 * Creates a new Faiss index store with the given dimension.
 * @param {number} dimension - The dimension of the embeddings.
 * @param {number[][]} [embeddings=[]] - An optional array of initial embeddings.
 * @returns {IndexFlatL2} The created Faiss index store.
 */
function createStore(dimension, embeddings = []) {
  const index = new IndexFlatL2(dimension);

  // Add embeddings to the index
  for (const embedding of embeddings) {
    index.add(embedding);
  }

  return index;
}

/**
 * Stores an embedding in the given Faiss index store.
 * @param {number[]} embedding - The embedding to store.
 * @param {IndexFlatL2} index - The Faiss index store.
 */
function storeEmbedding(embedding, index) {
  // Insert the embedding into the index
  index.add(embedding);
}

/**
 * Searches for the nearest neighbors of a query embedding in the given Faiss index store.
 * @param {number[]} query - The query embedding.
 * @param {IndexFlatL2} index - The Faiss index store.
 * @param {number} [k=4] - The number of nearest neighbors to search for.
 * @returns {Object} An object containing the indices (labels) and distances of the nearest neighbors.
 */
function searchEmbedding(query, index, k = 4) {
  // Search for the nearest neighbors of the query in the index
  const results = index.search(query, k);

  return {
    labels: results.labels,
    distances: results.distances,
  };
}

module.exports = {
  getEmbedding,
  createStore,
  storeEmbedding,
  searchEmbedding,
};
