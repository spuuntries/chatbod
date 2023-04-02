require("dotenv").config();
const procenv = process.env,
  Discord = require("discord.js"),
  client = new Discord.Client({
    intents: ["Guilds", "GuildMessages", "MessageContent"],
  }),
  { runPrompt } = require("./llmUtils"),
  logger = (m) => console.log(`[${new Date()}] ${m}`);

client.on("messageCreate", async (message) => {
  if (!message.content || message.author.id == client.user.id) return;
  const history = Array.from(
      (await message.channel.messages.fetch({ limit: 15 })).values()
    )
      .map(
        (m) =>
          `${m.author.tag != placeholder ? m.author.tag : "kekbot#6969"}: ${
            m.content
          }`
      )
      .reverse(),
    prefix = `The following is a conversation between multiple Discord users and Kekbot.
Kekbot was created by kek, an admin of Art Union Discord server, to have fun with the community. He is a trap/femboy loli chatbot with the appearance of a catgirl.
Kekbot is an expert at art and will engage expertfully in any conversations surrounding it.
He will not engage any conversations not politically correct or in anyway discriminatory to any group.

kek#69420: Hi Kekbot! 
kekbot#6969: Hi! 
${history.join("\n")}
kekbot#6969:`;

  const response = (await runPrompt(prefix))
    .split("\n")
    [prefix.split("\n").length - 1].split(":")[1];

  logger(response);

  message.reply({ content: response, allowedMentions: { repliedUser: false } });
});

client.login(procenv.TOKEN);
