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
 * @returns {Promise<number[]>} Embeddings of the string
 */
async function getEmbeddings(string) {
  const res = (
    await runCommand(
      `llama.cpp/build/bin/embedding -m models/13bpq/pyg.bin -p "${string}"`
    )
  ).split(" ");
  res.pop();
  return res;
}

/**
 * Stores string as an embeddings pair in the vector store.
 * @param {string} string - The string to store.
 * @returns {Promise<{
 *  embed: number[]
 *  string: string;
 * }[]>}
 */
async function storeString(string) {
  if (!(await db.has("vecstore")))
    logger(`[WARN] vecstore not created when storing, creating one`);

  const embed = await getEmbeddings(string);
  return await db.push("vecstore", { embed: embed, string: string });
}

/**
 * Creates a new vector store.
 * @param {object[]} [embeddings=[]] - An optional array of initial embeddings pairs.
 * @returns {Promise<number[][]>}
 */
async function createStore(embeddings = []) {
  if (!(await db.has("vecstore")))
    await db.set("vecstore", embeddings ? embeddings : []);

  return await db.get("vecstore");
}

/**
 * Searches for the nearest neighbors of query embeddings.
 * @param {number[]} query - The queried embeddings.
 * @param {number} [max] - Max number of neighbors, default 5.
 */
async function searchEmbeddings(query, max) {
  if (!max) var max = 5;

  /** @type {{
   *  embed: number[]
   *  string: string;
   * }[]>}
   */
  const vecstore = await db.get("vecstore"),
    tree = createKDTree(vecstore.map((e) => e["embed"]));

  return tree
    .knn(query, max)
    .map((e) => vecstore.map((e) => e["string"])[e])
    .slice(0, max - 1);
}

module.exports = {
  getEmbeddings,
  createStore,
  storeString,
  searchEmbeddings,
};
