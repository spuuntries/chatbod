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

/**
 * Finds the string between the specified start delimiter and the next prefix in the array.
 * @param {string[]} messages - The array of strings to search.
 * @param {string} startDelimiter - The start delimiter to search for.
 * @returns {string|null} The concatenated string or null if the start delimiter was not found.
 */
function concatUntilNextPrefix(messages, startDelimiter) {
  const startIndex = messages.indexOf(startDelimiter);

  if (startIndex !== -1) {
    let endIndex = messages.length;

    // Find the index of the next prefix
    for (let i = startIndex + 1; i < messages.length; i++) {
      if (/^[\w-]+:/.test(messages[i])) {
        endIndex = i;
        break;
      }
    }

    const inBetween = messages.slice(startIndex + 1, endIndex).join("");
    return messages[startIndex] + inBetween;
  } else {
    return null;
  }
}

client.on("messageCreate", async (message) => {
  if (!message.content || message.author.id == client.user.id) return;
  const history = Array.from(
      (
        await message.channel.messages.fetch({
          limit: Number.parseInt(procenv.CTXWIN),
        })
      ).values()
    )
      .filter(
        (m) => m.createdTimestamp > Date.now() - procenv.TLIMIT * 60 * 1000
      )
      .map(
        (m) =>
          `${m.author.id != placeholder ? m.author.username : "kekbot"}: ${
            m.content
          }`
      )
      .reverse(),
    prefix =
      `The following is a chat log between multiple Discord users and kekbot, each dialog turn is delimited by <turn>. Kekbot was created by kek, an admin of Art Union Discord server, kekbot is not kek. Kekbot was created to help and have fun with the community. Kekbot is a trap/femboy loli chatbot with the appearance of a catgirl. Kekbot is an expert in all forms of art will always try to help when asked to. Kekbot is friendly to everyone.\n\nRed: Hi Kekbot!<turn>kekbot: Enlo!<turn>Blue: How u doin?<turn>kekbot: I'm gud, ty for asking!${
        history.length ? "<turn>" + history.join("<turn>") : ""
      }<turn>kekbot:`.replaceAll('"', '\\"');
  // NOTE: Scrapped for experimental prompt
  // `The following is a chat log between multiple Discord users and "kekbot". "Kekbot" was created by kek, an admin of Art Union Discord server, "kekbot" is not kek. "Kekbot" was created to help and have fun with the community. "Kekbot" is a trap/femboy loli chatbot with the appearance of a catgirl. "Kekbot" is an expert in all forms of art will always try to help when asked to. "Kekbot" is friendly to everyone.\n\nRed: Hi Kekbot!\nkekbot: Enlo!\nBlue: How u doin?\nkekbot: I'm gud, ty for asking!${
  //  history.length ? "\n" + history.join("\n") : ""
  //}\nkekbot:`.replaceAll('"', '\\"');

  logger(prefix);

  var responses = (await runPrompt(prefix, message)).split("<turn>"),
    response = responses
      .slice(
        prefix.split("<turn>").length - 1,
        responses.indexOf(
          responses
            .slice(prefix.split("<turn>").length)
            .filter((e) => e.includes("<turn>"))[0]
        ) - 1
      )
      .join("")
      .split(":")[1];

  // NOTE: Same with above
  //  var responses = (await runPrompt(prefix, message)).split("\n"),
  //    response = concatUntilNextPrefix(
  //      responses,
  //      responses[prefix.split("\n").length - 1]
  //    ).split(":")[1];

  await message.channel.send({
    content: response,
  });

  logger(response);
});

client.on("ready", () => logger("ready"));

client.login(procenv.TOKEN);
