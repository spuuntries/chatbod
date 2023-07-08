const logger = (m) => console.log(`[${new Date()}] ${m}`),
  { QuickDB } = require("quick.db"),
  db = new QuickDB();
var bindings;

/**
 * Set up bindings
 */
async function setBindings() {
  if (!bindings) bindings = await python("./infer-bindings.py");
  process.on("SIGINT", () => {
    bindings.exit();
  });
  return bindings;
}

/**
 * Get embedding of string.
 * @param {string} string - String to embed.
 * @returns {Promise<number[]>} Embeddings of the string
 */
async function getEmbeddings(string) {
  const binder = await setBindings(),
    res = (await binder.embed$(string, { $timeout: Infinity })).split(" ");
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
