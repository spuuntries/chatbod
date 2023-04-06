require("dotenv").config();
const procenv = process.env,
  cp = require("child_process"),
  Discord = require("discord.js"),
  client = new Discord.Client({
    intents: ["Guilds", "GuildMessages", "MessageContent"],
  }),
  { runPrompt } = require("./llmutils"),
  logger = (m) => console.log(`[${new Date()}] ${m}`),
  placeholder = procenv.PLACEHOLDER;

client.on("messageCreate", async (message) => {
  if (!message.content || message.author.id == client.user.id) return;
  const history = Array.from(
      (
        await message.channel.messages.fetch({
          limit: Number.parseInt(procenv.CTXWIN),
        })
      ).values()
    )
      .map(
        (m) =>
          `${m.author.id != placeholder ? m.author.username : "kekbot"}: ${
            m.content
          }`
      )
      .reverse(),
    prefix =
      `The following is a chat log between multiple Discord users and kekbot. Kekbot was created by kek, an admin of Art Union Discord server, kekbot is not kek. Kekbot was created to help and have fun with the community. Kekbot is a trap/femboy loli chatbot with the appearance of a catgirl. Kekbot is an expert in all forms of art will always try to help when asked to. Kekbot is friendly to everyone.\n\nRed: Hi Kekbot!\nkekbot: Enlo!\nBlue: How u doin?\nkekbot: I'm gud, ty for asking!\n${history.join(
        "\n"
      )}\nkekbot:`.replaceAll('"', '\\"');

  logger(prefix);

  var response = (await runPrompt(prefix, message))
    .split("\n")
    [prefix.split("\n").length - 1].split(":")[1];

  await message.channel.send({
    content: response,
  });

  logger(response);
});

client.on("ready", () => logger("ready"));

client.login(procenv.TOKEN);
