require("dotenv").config();
const procenv = process.env,
  Discord = require("discord.js"),
  client = new Discord.Client({
    intents: ["Guilds", "GuildMessages", "MessageContent"],
  }),
  logger = (m) => console.log(`[${new Date()}] ${m}`),
  { Worker } = require("worker_threads"),
  workers = Array.from({ length: Number.parseInt(procenv.NUMWORKER) ?? 1 }).map(
    () => {
      return { flag: false, worker: new Worker("./worker.js") };
    }
  ),
  warmer = new Worker("./warmer.js"),
  { QuickDB } = require("quick.db"),
  db = new QuickDB(),
  queue = [],
  lastUserMessage = {},
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

client.on("messageCreate", async (message) => {
  if (procenv.CHANNELS) {
    if (!procenv.CHANNELS.split("|").includes(message.channelId)) return;
  }

  let lastTrigger = (await db.has(`lastTrigger.${message.channelId}`))
      ? await db.get(`lastTrigger.${message.channelId}`)
      : 0,
    referenced = message.reference
      ? await message.fetchReference()
      : { author: { id: false } },
    lastMessageTime = lastUserMessage[message.author.id],
    now = Date.now();

  if (
    message.cleanContent.trim().includes("!kig") &&
    message.createdTimestamp - lastTrigger <= procenv.TRIGTIME
  ) {
    await db.set(`lastTrigger.${message.channelId}`, 0);
    let kRep = await message.reply({
      content: "Detected kill keyword. Alrighty then, bye!",
    });
    setTimeout(async () => {
      if (message.deletable()) await message.delete();
      if (kRep.deletable()) await kRep.delete();
    }, 2000);
    return;
  }

  if (
    !message.cleanContent ||
    !message.author.id ||
    message.author.id == client.user.id ||
    message.cleanContent.trim().includes("!hig") ||
    message.cleanContent.trim().startsWith("!ig") ||
    message.channel.type == Discord.ChannelType.DM ||
    (lastMessageTime && now - lastMessageTime < procenv.WAITTIME) ||
    !(message.createdTimestamp - lastTrigger > procenv.COOLTIME) ||
    // NOTE: This checks for triggers.
    (!(message.createdTimestamp - lastTrigger <= procenv.TRIGTIME) && // Check for time between triggers
      !triggers.some((t) =>
        removeRepeatedChars(message.cleanContent)
          .toLowerCase()
          .split(/ +/g)
          .some(
            (k) => k.toLowerCase().includes(t) // Look for triggers
          )
      ) &&
      !message.mentions.users.find((u) => u.id == client.user.id) && // Check if bot is mentioned
      referenced.author.id != client.user.id) // Check for reply target trigger
  )
    return;

  lastUserMessage[message.author.id] = now;
  await db.set(`lastTrigger.${message.channelId}`, message.createdTimestamp);

  queue.push([message.channelId, message.id]);
  logger(queue.toString());
});

setInterval(() => {
  let workerObj = workers.filter((w) => !w["flag"])[0],
    worker = workerObj["worker"];
  if (workerObj["flag"] || queue.length == 0) return;

  worker.postMessage(queue.shift());
  workerObj["flag"] = true;
}, 500);

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

  workers.map((worker, i) =>
    worker["worker"].on("message", (m) => {
      if (m == "ready") {
        logger(`[v${require("./package.json").version}] Worker #${i} ready`);

        process.on("SIGTERM", async () => await warmer.terminate());
        process.on("SIGINT", async () => await warmer.terminate());
      } else {
        if (m.length > 1) {
          logger(`handled ${m[0]} by ${m[1]}`);
          worker["flag"] = false;
        } else logger(m);
      }
    })
  );
});

client.login(procenv.TOKEN);
