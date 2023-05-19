require("dotenv").config();
const procenv = process.env,
  Discord = require("discord.js"),
  client = new Discord.Client({
    intents: ["Guilds", "GuildMessages", "MessageContent"],
  }),
  logger = (m) => console.log(`[${new Date()}] ${m}`),
  placeholder = procenv.PLACEHOLDER,
  { Worker } = require("worker_threads");

const worker = new Worker("./worker.js");

client.on("messageCreate", async (message) => {
  worker.postMessage([message.channelId, message.id]);
});

client.once("ready", async () => {
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
    if (m == "ready") logger(`[v${require("./package.json").version}] ready`);
    else {
      if (m.length > 1) logger(`handled ${m[0]} by ${m[1]}`);
      else logger(m);
    }
  });
});

client.login(procenv.TOKEN);
