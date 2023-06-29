require("dotenv").config();

const procenv = process.env,
  { parentPort } = require("worker_threads"),
  Discord = require("discord.js"),
  client = new Discord.Client({
    intents: ["Guilds", "GuildMessages", "MessageContent"],
  }),
  logger = (m) => console.log(`[${new Date()}] ${m}`);

/** @type {Discord.Channel[] | []} */
var typingChannels = [];

client.once("ready", () => {
  parentPort.on("message", async (message) => {
    if (!message[0]) return;
    /** @type {Discord.Channel | null} */
    var targetChannel,
      targetId = message[0];

    try {
      targetChannel = await client.channels.fetch(targetId);
      if (!targetChannel) return;
    } catch (e) {
      logger(`[WARN] Failed to fetch for typer to ${targetId}, ${e}`);
      return;
    }

    if (!typingChannels.includes(targetChannel))
      typingChannels.push(targetChannel);
    else
      typingChannels = typingChannels.filter((c) => c.id != targetChannel.id);
  });

  setInterval(() => {
    typingChannels.forEach(async (channel) => {
      if (
        channel.type != Discord.ChannelType.GuildText &&
        channel.type != Discord.ChannelType.PublicThread &&
        channel.type != Discord.ChannelType.PrivateThread
      )
        return;

      await channel.sendTyping();
    });
  }, 3000);

  logger(`Typer worker ready.`);
});

client.login(procenv.TOKEN);
