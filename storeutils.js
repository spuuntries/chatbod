require("dotenv").config();
const logger = (m) => console.log(`[${new Date()}] ${m}`),
  { QuickDB } = require("quick.db"),
  { python } = require("pythonia"),
  db = new QuickDB(),
  { HierarchicalNSW } = require("hnswlib-node"),
  _ = require("lodash");
var bindings, siginter;

function removeDates(str) {
  let results = chrono.parse(str);

  for (let i = 0; i < results.length; i++) {
    str = str.replace(results[i].text, "");
  }

  return str;
}

/**
 * Set up bindings
 */
async function setBindings() {
  if (!bindings) bindings = await python("./embed.py");
  if (!siginter)
    siginter = process.on("SIGINT", () => {
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
    res = await binder.embed$(string, { $timeout: Infinity });

  return JSON.parse(res);
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
  if (!(await db.has("vecstore"))) {
    logger(`[WARN] vecstore not created when storing, creating one`);
    await createStore();
  }

  try {
    string = removeDates(string);
  } catch (e) {
    logger(`Failed to sanitize dates on ${string.slice(0, 127)}`);
  }

  const embed = await getEmbeddings(string),
    vecstore = await db.get("vecstore");
  if (vecstore.filter((e) => e["string"] == string).length)
    return await db.get("vecstore"); // Deduping entries

  vecstore.push({
    embed: embed.length > 1 ? embed : embed[0],
    string: string.length > 1 ? string : string[0],
  });
  return await db.set("vecstore", vecstore);
}

/**
 * Creates a new vector store.
 * @param {{
 *  embed: number[]
 *  string: string;
 * }[]} [embeddings=[]] - An optional array of initial doc pairs.
 * @returns {Promise<{
 *  embed: number[]
 *  string: string;
 * }[]>}
 */
async function createStore(embeddings = []) {
  if (!(await db.has("vecstore")))
    await db.set("vecstore", embeddings ? embeddings : []);

  await setBindings();

  return await db.get("vecstore");
}

/**
 * Searches for the nearest neighbors of query embeddings.
 * **Clamping reduces to 5 regardless of `max`.**
 * @param {string} query - The queried string.
 * @param {number} [max] - Max number of neighbors in vecstore, default 10.
 */
async function searchEmbeddings(query, max) {
  if (!max) var max = 10;
  const binder = await setBindings();

  /** @type {{
   *  embed: number[]
   *  string: string;
   * }[]>}
   */
  const vecstore = await createStore(),
    index = new HierarchicalNSW("cosine", 384);
  index.initIndex(vecstore.length);

  for (let i = 0; i < vecstore.length; i++) {
    index.addPoint(vecstore[i]["embed"], i);
  }

  const unrefined = index
    .searchKnn(
      await getEmbeddings(query),
      max <= vecstore.length ? max : vecstore.length
    )
    ["neighbors"] // This goes through knn to get the closest neigbor indices
    .map((n) => index.getPoint(n)) // This maps to get the embedddings
    .map(
      (e) =>
        vecstore.find((v) =>
          _.isEqual(
            v["embed"].map((n) => n.toFixed(4)),
            e.map((n) => n.toFixed(4))
          )
        )?.string
    ); // This maps each embedding to the first hit of the string equivalent on the vecstore, ensuring deduplication even if dedup on previous instances didn't work

  const clamped = await binder.clamp$(query, unrefined, {
    $timeout: Infinity,
  }); // This clamps results to neighbors with p >= 0.5 similarity and down to the top 5

  return JSON.parse(clamped);
}

module.exports = {
  getEmbeddings,
  createStore,
  storeString,
  searchEmbeddings,
};
