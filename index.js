require("dotenv").config();
const procenv = process.env,
  Discord = require("discord.js"),
  client = new Discord.Client({
    intents: ["Guilds", "GuildMessages", "MessageContent"],
  }),
  logger = (m) => console.log(`[${new Date()}] ${m}`),
  { Worker } = require("worker_threads"),
  worker = new Worker("./worker.js"),
  warmer = new Worker("./warmer.js"),
  { QuickDB } = require("quick.db"),
  db = new QuickDB(),
  queue = [],
  triggers = procenv.TRIGGERS.split("|");

/**
 *
 * @param {string} s
 * @returns {string}
 */
function removeRepeatedChars(s) {
  let words = s.split(/\s+/);
  let newWords = words.map((word) => word.replace(/(.)\1+/g, "$1"));
  return newWords.join(" ");
}

var isProcessingQueue = false;

client.on("messageCreate", async (message) => {
  if (procenv.CHANNELS) {
    if (!procenv.CHANNELS.split("|").includes(message.channelId)) return;
  }

  let lastTrigger = (await db.has(`lastTrigger.${message.channelId}`))
      ? await db.get(`lastTrigger.${message.channelId}`)
      : 0,
    referenced = message.reference
      ? await message.fetchReference()
      : { author: { id: false } };

  if (
    !message.cleanContent ||
    !message.author.id ||
    message.author.id == client.user.id ||
    message.cleanContent.trim().includes("!hig") ||
    message.cleanContent.trim().startsWith("!ig") ||
    message.channel.type == Discord.ChannelType.DM ||
    // NOTE: This checks for triggers.
    (!(message.createdTimestamp - lastTrigger <= procenv.TRIGTIME) && // Check for time between triggers
      !triggers.some(
        (t) =>
          removeRepeatedChars(message.cleanContent)
            .toLowerCase()
            .split(/ +/g)
            .includes(t) // Look for triggers
      ) &&
      !referenced.author.id == client.user.id) // Check for reply trigger
  )
    return;

  await db.set(`lastTrigger.${message.channelId}`, message.createdTimestamp);

  queue.push([message.channelId, message.id]);
  logger(queue.toString());
});

setInterval(() => {
  if (isProcessingQueue || queue.length == 0) return;

  worker.postMessage(queue.shift());
  isProcessingQueue = true;
}, 2000);

client.once("ready", () => {
  client.user.setPresence({
    status: "idle",
    activities: [
      {
        name: "waiting for a dead channel...",
        type: Discord.ActivityType.Watching,
      },
    ],
  });

  worker.on("message", (m) => {
    if (m == "ready") {
      logger(`[v${require("./package.json").version}] ready`);

      process.on("SIGTERM", async () => await warmer.terminate());
      process.on("SIGINT", async () => await warmer.terminate());
    } else {
      if (m.length > 1) {
        logger(`handled ${m[0]} by ${m[1]}`);
        isProcessingQueue = false;
      } else logger(m);
    }
  });
});

client.login(procenv.TOKEN);
