require("dotenv").config();
const procenv = process.env,
  Discord = require("discord.js"),
  client = new Discord.Client({ intents: ["MessageContent"] }),
  { runPrompt } = require("./llmutils"),
  { PouchWrapper } = require("./dbutils"),
  logger = (m) => console.log(`[${new Date()}] ${m}`);
const db = new PouchWrapper("chatdb");

/**
 * Checks if a Discord channel has been inactive for a specified number of minutes.
 * @async
 * @param {string} channelId - The ID of the Discord channel to check.
 * @param {number} minutes - The number of minutes to check for inactivity.
 * @returns {Promise<boolean>} `true` if the channel has been inactive for the specified number of minutes, `false` otherwise.
 */
async function checkDeadChannel(channelId, minutes) {
  /** @type {Discord.TextChannel} */
  const channel = await client.channels.fetch(channelId);
  if (!channel) throw new Error("Channel not found!");
  const messages = await channel.messages.fetch({ limit: 1 }),
    lastMessage = messages.first();
  if (!lastMessage) throw new Error("Channel empty!");
  const timeDiff = Date.now() - lastMessage.createdTimestamp,
    timeDiffInMinutes = Math.floor(timeDiff / 1000 / 60);
  if (timeDiffInMinutes > minutes) return true;
  else return false;
}

/**
 * Engages a Discord text channel by sending a message then adding to the engaged list.
 * @async
 * @param {Discord.TextChannel} channel - The Discord text channel to engage.
 */
async function engageChannel(channel) {
  let recorded = await db.get(channel.id);
  if (!recorded) recorded = await db.put(channel.id, []);

  const history = Array.from(
    (await channel.messages.fetch({ limit: 15 })).values()
  ).map((m) => m.content.replace("\\k", ""));

  var newHistory;

  if (history.length && recorded.length)
    /** @type {string[]} */
    newHistory = (
      await db.push(
        channel.id,
        history
          .filter((msg) => !recorded.includes(msg.content))
          .map((msg) => `${msg.author.tag}: ${msg.content}`)
      )
    ).value;
  else newHistory = [];

  const prefix = `The following is a conversation between multiple Discord users and Kekbot. \
Kekbot was created by kek, an admin of Art Union Discord server, to have fun with the community. He is a trap/femboy loli chatbot with the appearance of a catgirl. \
Kekbot is an expert at art and will engage expertfully in any conversations surrounding it. \
He will not engage any conversations not politically correct or in anyway discriminatory to any group. \
 \
kek#69420: Hi Kekbot! \
kekbot#6969: Hi! \
${newHistory.slice(-25).join(" \n")} \
kekbot#6969:`;
  const response = (await runPrompt(prefix))
    .split("\n")
    [prefix.split("\n").length - 1].split(":")[1];

  await channel.send({ content: response });
  await db.push(channel.id, `kekbot#6969: ${response}`);
  if (!(await db.get("engaging").includes(message.channelId)))
    await db.push("engaging", channel.id);
}

client.on("messageCreate", async (message) => {
  if (!(await db.get(message.channelId))) await db.put(message.channelId, []);

  if (
    !(
      message.member.permissions.has("ManageMessages") &&
      message.content.trim().startsWith("\\k")
    ) &&
    !(await db.get("engaging").includes(message.channelId))
  )
    return;

  await engageChannel(message.channel);
});

client.on("ready", async () => {
  logger(`${client.user.tag} ready.`);
  if (!(await db.get("engaging"))) await db.put("engaging", []);

  const channelToCheck = (
    await Promise.all(
      procenv.CHANNELS.split("|").map(
        async (c) => await client.channels.fetch(c)
      )
    )
  ).filter(Boolean);

  let countc = 0;
  setInterval(async () => {
    countc++;
    countc %= channelToCheck.length - 1;

    if (channelToCheck[countc]) {
      if (await checkDeadChannel(channelToCheck[countc].id, 5))
        engageChannel(channel);
    }
  }, 2000);
});

client.login(procenv.TOKEN);
