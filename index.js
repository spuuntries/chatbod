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
  queue = [];

var isProcessingQueue = false;

client.on("messageCreate", (message) => {
  if (procenv.CHANNELS) {
    if (!procenv.CHANNELS.split("|").includes(message.channelId)) return;
  }
  if (
    !message.cleanContent ||
    !message.author.id ||
    message.author.id == client.user.id ||
    message.cleanContent.trim().includes("!hig") ||
    message.cleanContent.trim().startsWith("!ig") ||
    message.channel.type == Discord.ChannelType.DM
  )
    return;

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
