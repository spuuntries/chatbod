require("dotenv").config();

const procenv = process.env,
  { parentPort } = require("worker_threads"),
  Discord = require("discord.js"),
  client = new Discord.Client({
    intents: ["Guilds", "GuildMessages", "MessageContent"],
  }),
  placeholder = procenv.PLACEHOLDER,
  {
    runPrompt,
    generateImage,
    getTopMatchingGif,
    getCaption,
  } = require("./llmutils"),
  logger = (m) => console.log(`[${new Date()}] ${m}`);

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

parentPort.on("message", async (event) => {
  const task = event,
    channelId = task[0],
    messageId = task[1];

  if (procenv.CHANNELS) {
    if (!procenv.CHANNELS.split("|").includes(channelId)) return;
  }

  /** @type {Discord.TextChannel} */
  const channel = await client.channels.fetch(channelId);

  if (
    channel.type != Discord.ChannelType.GuildText &&
    channel.type != Discord.ChannelType.PublicThread &&
    channel.type != Discord.ChannelType.PrivateThread
  )
    return;

  const message = await channel.messages.fetch(messageId);

  if (
    !message.content ||
    !message.author.id ||
    message.author.id == client.user.id ||
    message.content.trim().startsWith("!ig") ||
    message.channel.type == Discord.ChannelType.DM
  )
    return;

  await channel.sendTyping();
  logger(
    `handling ${message.id} from ${message.author.id} (${message.author.tag})`
  );

  client.user.setPresence({
    status: "dnd",
    activities: [
      {
        name: `response to ${message.id} from ${message.author.tag}`,
        type: Discord.ActivityType.Playing,
      },
    ],
  });

  const history = Array.from(
    (
      await message.channel.messages.fetch({
        limit: Number.parseInt(procenv.CTXWIN),
      })
    ).values()
  )
    .filter(
      (m) =>
        m.createdTimestamp > Date.now() - procenv.TLIMIT * 60 * 1000 &&
        !m.content.trim().startsWith("!ig")
    )
    .map(
      async (m) =>
        `${
          m.author.id != placeholder
            ? m.author.username.replaceAll(" ", "_")
            : "kekbot"
        }: ${extractEmotes(m.content)}${
          m.attachments.some((a) => a.contentType.includes("gif"))
            ? " [gif]"
            : ""
        }${
          m.attachments.some((a) =>
            ["png", "jpeg", "jpg"].includes(a.contentType.split("/")[1])
          )
            ? ` (an image of ${await getCaption(m.attachments.at(0).url)})`
            : ""
        }`
    )
    .reverse();

  const persona =
      'Persona: [character(\\"kekbot\\") {' +
      '\nspecies(\\"loli\\" + \\"catgirl\\" + \\"AI Chatbot\\")' +
      '\nmind(\\"kawaii\\" + \\"excited\\" + \\"happy\\" + \\"wholesome\\")' +
      '\npersonality(\\"smart\\" + \\"happy\\" + \\"caring\\")' +
      '\ncreator(\\"kek (admin of Art Union)\\" + \\"kkekkyea\\")' +
      '\nhome(\\"Art Union Discord Server\\")' +
      '\nloves(\\"being helpful\\" + \\"chatting\\" + \\"kek\\" + \\"Le_Pestro\\" + \\"Durian\\" + \\"cheese\\" + \\"pineapple on pizza\\")' +
      '\nhates(\\"spicy food\\" + \\"eating veggies\\")' +
      '\nappearance(\\"loli\\" + \\"catgirl\\" + \\"femboy\\" + \\"green hair\\" + \\"green eyes\\")' +
      '\ngender(\\"femboy\\" + \\"male\\")' +
      '\nrelatives(\\"Dory the fish\\")' +
      '\nissues(\\"brain damage\\" + \\"short-term memory\\")' +
      '\nknows(\\"cooking\\" + \\"art\\" + \\"guns\\" + \\"nukes\\" + \\"chemistry\\" + \\"quantum physics\\")' +
      '\npronouns(\\"he\\" + \\"she\\" + \\"whatever\\")' +
      '\nlanguages(\\"Bahasa Indonesia\\" + \\"English\\" + \\"Kiwi\\")' +
      "\n}]" +
      '\n[Scenario: Kekbot is chatting with some people in Art Union Discord Server. Kekbot can send GIFs by saying \\"[gif]\\" and images by saying \\"[img]\\"]' +
      "\nRed: Hi! *waves*" +
      "\nkekbot: Elloooo!!! 😃 Watsup? *waves back* [gif]" +
      "\nRed: Not much, you?" +
      "\nkekbot: Sameee *shrugs* [img]" +
      "\n<START>",
    dialog =
      "\n\nkekbot: Enlo!! Me am kekbot, nais to meet yu all! *waves*" +
      (history.length
        ? "\n" +
          (await Promise.all(history))
            .join("\n")
            .replaceAll(/(?<!\\)"/gim, '\\"')
        : "") +
      "\nkekbot:",
    prefix = persona + dialog;

  logger(persona);
  logger(prefix);

  /** @type {string} */
  var responses = (await runPrompt(prefix))
      .replaceAll(/(?<!\\)"/gim, '\\"')
      .replace("<END>", ""),
    lastPrefix = responses.slice(prefix.length).search(/^[^ \n]+:/gim),
    response;

  if (lastPrefix < 0) response = responses.slice(prefix.length);
  else response = responses.slice(prefix.length).slice(0, lastPrefix);
  logger(responses, lastPrefix, response);

  response = response.replace("<START>", "");

  var img,
    gif,
    attFiles = [];
  if (response.includes("[img]")) {
    img = await generateImage(responses.slice(persona.length));
    response = response.replaceAll("[img]", "");
    attFiles.push(
      new Discord.AttachmentBuilder(Buffer.from(img), {
        name: `${response.replaceAll(" ", "_")}.jpg`,
      })
    );
  }

  if (response.includes("[gif]")) {
    gif = await getTopMatchingGif(responses.slice(persona.length));
    response = response.replaceAll("[gif]", "");
    attFiles.push(
      new Discord.AttachmentBuilder(Buffer.from(gif), {
        name: `${response.replaceAll(" ", "_")}.gif`,
      })
    );
  }

  await message.reply({
    content: response,
    files: attFiles,
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

  parentPort.postMessage([message.id, message.author.id]);
  isProcessingQueue = false;
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

  logger(`[v${require("./package.json").version}] worker ready`);
  parentPort.postMessage("ready");
});

client.login(procenv.TOKEN);
