require("dotenv").config();
const procenv = process.env,
  cp = require("child_process"),
  Discord = require("discord.js"),
  client = new Discord.Client({
    intents: ["Guilds", "GuildMessages", "MessageContent"],
  }),
  { python } = require("pythonia"),
  { runPrompt, getTopMatchingGif, getCaption } = require("./llmutils"),
  logger = (m) => console.log(`[${new Date()}] ${m}`),
  placeholder = procenv.PLACEHOLDER,
  { Worker } = require("worker_threads");

/**
 * @param {string} str To extract from
 */
function extractEmotes(str) {
  const regex = /<.*:(.+?):\d+>/g;
  return str.replace(regex, (match, p1, p2) => {
    if (p1) {
      return `:${p1}:`;
    } else if (p2) {
      return `:${p2}:`;
    }
  });
}

const worker = new Worker("./worker.js", {
  workerData: {
    client,
    placeholder,
    runPrompt,
    getCaption,
    getTopMatchingGif,
    extractEmotes,
  },
});

client.on("messageCreate", async (message) => {
  worker.postMessage(message);
});

// Listen for results from the worker
worker.on("message", (event) => {
  logger(`handled ${event}`);
});

client.on("ready", async () => {
  client.user.setPresence({
    status: "idle",
    activities: [
      {
        name: "waiting for a dead channel...",
        type: Discord.ActivityType.Watching,
      },
    ],
  });
  logger(`[v${require("./package.json").version}] ready`);
});

client.login(procenv.TOKEN);
