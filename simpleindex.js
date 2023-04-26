const { default: axios } = require("axios");

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
  placeholder = procenv.PLACEHOLDER;

var llm,
  responding = false,
  typing;

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

client.on("messageCreate", async (message) => {
  if (procenv.CHANNELS) {
    if (!procenv.CHANNELS.split("|").includes(message.channelId)) return;
  }

  if (
    !message.content ||
    message.author.id == client.user.id ||
    responding ||
    message.channel.type == Discord.ChannelType.DM
  )
    return;

  client.user.setPresence({
    status: "dnd",
    activities: [
      { name: `response to ${message.id}`, type: Discord.ActivityType.Playing },
    ],
  });

  clearTimeout(typing);

  function type() {
    message.channel.sendTyping().then(() => {
      typing = setTimeout(() => {
        type();
      }, 6000);
    });
  }
  type();

  responding = true;
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
        async (m) =>
          `${
            m.author.id != placeholder ? m.author.username : "kekbot"
          }: ${extractEmotes(m.content)}${
            m.attachments.some((a) => a.contentType.includes("gif"))
              ? " [gif]"
              : ""
          }${
            m.attachments.some((a) =>
              ["png", "jpeg", "jpg"].includes(a.contentType.split("/")[1])
            )
              ? ` (an image, ${await getCaption(m.attachments.at(0).url)})`
              : ""
          }`
      )
      .reverse(),
    prefix =
      `The following is a chat log between multiple Discord users and Kekbot. Kekbot can respond with a GIF when indicated with the special keyword "[gif]". Emotes are indicated by colons, e.g. ":pepega:". Image attachments are indicated by parentheses with their captions in them, e.g. "(an image, a gun on a table)". Kekbot was created by kek (@kkekkyea), an admin of Art Union Discord server, Kekbot is not kek. Kekbot was created to help and have fun with the community. Kekbot is a loli chatbot with the appearance of a catgirl. Kekbot is an expert in all forms of art will always try to help when asked to. Kekbot will never send an empty reply. Kekbot is friendly to everyone.\n\nRed: Hi Kekbot!\nkekbot: Enlo ther! [gif]\nBlue: How u doin? :thinking:\nkekbot: I'm gud, ty for asking!\nRed: Who are you?\nkekbot: Me am a smol chatbot made by kek!${
        history.length ? "\n" + (await Promise.all(history)).join("\n") : ""
      }\nkekbot:`.replaceAll('"', '\\"');

  logger(prefix);

  // NOTE: Scrapped for the moment to see if native is faster.
  //function type() {
  //  message.channel.sendTyping().then(() => {
  //    typing = setTimeout(() => {
  //      type();
  //    }, 15000);
  //  });
  //}
  //type();
  //
  //var response = await llm.generate$(prefix, { $timeout: 125000 }),
  //  index = response.search(/^[\w]+:/m); // Find the end of the response
  //if (index >= 0)
  //  response = response
  //    .substring(0, index)
  //    .replaceAll("<turn>", "")
  //    .replace(/\n$/, ""); // Gets the response and removes newline if found at the end.
  //
  //clearTimeout(typing);

  /** var responses = (await runPrompt(prefix, message)).split("<turn>"),
    response = responses
      .slice(responses.length - 1)
      .filter((msg) => msg.toLowerCase().startsWith("\nkekbot:"))
      .shift()
      .split(":")[1];*/
  /** 
    response = concatUntilNextPrefix(
      responses,
      responses[prefix.split("\n").length - 1]
    ).split(":")[1];
    */

  var responses = await runPrompt(prefix, message),
    splitResponses = Array.from(
      responses.slice(prefix.length - 9).matchAll(/^[\w]+:/gim)
    ),
    response = responses
      .slice(prefix.length - 9)
      .slice(
        splitResponses[0].index,
        splitResponses[1] ? splitResponses[1].index : undefined
      )
      .split(":")[1];

  logger(responses);

  var gif, responseRaw;
  if (response.includes("[gif]")) {
    gif = await getTopMatchingGif(response);
    responseRaw = response;
    response = responseRaw.replaceAll("[gif]", "");
  }

  logger(response, responseRaw, gif);
  if (response.length < 2) {
    response = "yep";
    gif = await getTopMatchingGif("Yep");
  }
  await message.reply({
    content: response,
    files: gif
      ? [
          new Discord.AttachmentBuilder(Buffer.from(gif), {
            name: `${response.replaceAll(" ", "_")}.gif`,
          }),
        ]
      : undefined,
    allowedMentions: { repliedUser: false },
  });

  client.user.setPresence({
    status: "idle",
    activities: [
      {
        name: "waiting for a dead channel...",
        type: Discord.ActivityType.Watching,
      },
    ],
  });

  responding = false;
  clearTimeout(typing);
});

client.on("ready", async () => {
  //llm = await python("./infer-bindings.py");
  client.user.setPresence({
    status: "idle",
    activities: [
      {
        name: "waiting for a dead channel...",
        type: Discord.ActivityType.Watching,
      },
    ],
  });
  logger("ready");
});

client.login(procenv.TOKEN);
