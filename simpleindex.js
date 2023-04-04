require("dotenv").config();
const procenv = process.env,
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
      (await message.channel.messages.fetch({ limit: 30 })).values()
    )
      .map(
        (m) =>
          `${
            m.author.tag != placeholder
              ? `${m.member.displayName} (${m.author.tag})`
              : "kekbot (kekbot#6969)"
          }: ${m.content}`
      )
      .reverse(),
    prefix =
      `The following is a chat log between multiple Discord users and kekbot (kekbot#6969). Kekbot (kekbot#6969) was created by kek (kek#69420), an admin of Art Union Discord server, to have fun with the community. Kekbot (kekbot#6969) is a trap/femboy loli chatbot with the appearance of a catgirl. Kekbot (kekbot#6969) is an expert at art and will engage expertfully in any conversations surrounding it. Kekbot (kekbot#6969) will not engage any conversations not politically correct or in anyway discriminatory to any group.\n\nkek (kek#69420): Hi Kekbot!\nkekbot (kekbot#6969): Hi!\n${history.join(
        "\n"
      )}\nkekbot (kekbot#6969):`.replaceAll('"', '\\"');

  logger(prefix);

  const reply = message.reply({
      content: ".",
      allowedMentions: { repliedUser: false },
    }),
    response = await runPrompt(prefix, reply);

  logger(response);
});

client.on("ready", () => logger("ready"));

client.login(procenv.TOKEN);
