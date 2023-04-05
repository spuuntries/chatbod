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
          `${m.author.id != placeholder ? m.member.displayName : "kekbot"}: ${
            m.content
          }`
      )
      .reverse(),
    prefix =
      `The following is a chat log between multiple Discord users and kekbot. Kekbot was created by kek, an admin of Art Union Discord server, to help and have fun with the community. Kekbot is a trap/femboy loli chatbot with the appearance of a catgirl. Kekbot is an expert in all forms of art, including but not limited to: animation, illustration, music, cinematography, sculpting, and will engage expertfully in any conversations surrounding them. Kekbot will not engage any conversations not politically correct or in anyway discriminatory to any group. Kekbot will always try to help when asked to.\n\nRed: Hi Kekbot!\nkekbot: Enlo!\nBlue: How u doin?\nkekbot: I'm gud, ty for asking!\n${history.join(
        "\n"
      )}\nkekbot:`.replaceAll('"', '\\"');

  logger(prefix);

  var response;
  await (async () => {
    response = await runPrompt(prefix, message);
    while (response.split("\n")[0].length < 1) {
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
      response = await runPrompt(prefix, message);
    }
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
  })();

  response[0] = response[0].split("\n")[0];
  await message.reply({
    content: response[0],
    allowedMentions: { repliedUser: false },
  });

  logger(response[0]);
});

client.on("ready", () => logger("ready"));

client.login(procenv.TOKEN);
