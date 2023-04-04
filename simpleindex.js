require("dotenv").config();
const procenv = process.env,
  psTree = require("ps-tree"),
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
          `${
            m.author.id != placeholder
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

  const response = await runPrompt(prefix, message);
  psTree(response[1], function (err, children) {
    cp.spawn(
      "kill",
      ["-9"].concat(
        children.map(function (p) {
          return p.PID;
        })
      )
    );
  });

  response[0] = response[0].split("\n")[0];
  await message.reply({
    content: response[0],
    allowedMentions: { repliedUser: false },
  });

  logger(response[0]);
});

client.on("ready", () => logger("ready"));

client.login(procenv.TOKEN);
