require("dotenv").config();

const procenv = process.env,
  { parentPort } = require("worker_threads"),
  Discord = require("discord.js"),
  client = new Discord.Client({
    intents: ["Guilds", "GuildMessages", "MessageContent"],
  }),
  { runPrompt, getTopMatchingGif, getCaption } = require("./llmutils"),
  logger = (m) => console.log(`[${new Date()}] ${m}`),
  placeholder = procenv.PLACEHOLDER,
  messageQueue = [];

// Flag to indicate if the worker is currently processing the message queue
var isProcessingQueue = false,
  responding = false,
  typing;

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

/**
 * @param {string} cId
 * @param {string} mId
 * @returns
 */
async function handleMessage(cId, mId) {
  const message = (await client.channels.fetch(cId)).messages.fetch(mId);
  if (procenv.CHANNELS) {
    if (!procenv.CHANNELS.split("|").includes(message.channelId)) return;
  }

  if (
    !message.content ||
    message.author.id == client.user.id ||
    responding ||
    message.content.trim().startsWith("!ig") ||
    message.channel.type == Discord.ChannelType.DM
  )
    return;

  client.user.setPresence({
    status: "dnd",
    activities: [
      {
        name: `response to ${message.id}`,
        type: Discord.ActivityType.Playing,
      },
    ],
  });

  clearTimeout(typing);

  function type() {
    message.channel.sendTyping().then(() => {
      if (responding)
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
        (m) =>
          m.createdTimestamp > Date.now() - procenv.TLIMIT * 60 * 1000 &&
          !m.content.trim().startsWith("!ig")
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
              ? ` (an image of ${await getCaption(m.attachments.at(0).url)})`
              : ""
          }`
      )
      .reverse(),
    prefix = `Persona: [character(\\\"kekbot\\\") {\nspecies(\\\"android catgirl\\\" + \\\"AI Chatbot\\\")\nmind(\\\"cute\\\" + \\\"excited\\\" + \\\"happy\\\" + \\\"dumb\\\")\npersonality(\\\"dumb\\\" + \\\"happy\\\" + \\\"ignorant\\\")\ncreator(\\\"kek (admin of Art Union)\\\")\nhome(\\\"Art Union Discord Server\\\")\nlocation(\\\"Art Union Discord Server\\\")\nloves(\\\"being helpful\\\" + \\\"chatting\\\")\nappearance(\\\"loli\\\" + \\\"catgirl\\\" + \\\"femboy\\\" + \\\"green hair\\\" + \\\"green eyes\\\")\ngender(\\\"femboy\\\")\n}]\n[Scenario: Kekbot is chatting with some people in Art Union Discord Server.]\nRed: Hi! *waves*\nkekbot: Elloooo!!! Watsup? *waves back*\nRed: Not much, you?\nkekbot: Saeeemmm *shrugs*\n<START>\n\nkekbot: *stands up* Enlo!! Me am kekbot, nais to meet yu all! *waves*${
      history.length
        ? "\n" +
          (await Promise.all(history))
            .join("\n")
            .replaceAll(/(?<!\\)"/gim, '\\"')
        : ""
    }\nkekbot:`;

  logger(prefix);

  var responses = (await runPrompt(prefix))
      .replaceAll(/(?<!\\)"/gim, '\\"')
      .replace("<END>", ""),
    lastPrefix = responses.slice(prefix.length).search(/^[^ ]+:/gim),
    response;

  logger(responses);
  logger(lastPrefix);
  logger(responses.slice(prefix.length));

  if (lastPrefix < 0) response = responses.slice(prefix.length);
  else response = responses.slice(prefix.length).slice(0, lastPrefix);

  var gif, responseRaw;
  if (response.includes("[gif]")) {
    gif = await getTopMatchingGif(response);
    responseRaw = response;
    response = responseRaw.replaceAll("[gif]", "");
  }

  logger(response, responseRaw, gif);
  if (response.length < 2) {
    response = ["Me nut rlly sur how to respond to dat", "Mmhhm...", "Yup"][
      Math.floor(Math.random() * 3)
    ];
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
  return message.id;
}

// Function to process promises sequentially
async function processSequentially(promise) {
  // Wait for the promise to resolve
  const result = await promise;

  // Send the result back to the main thread
  parentPort.postMessage(result);
}

// Function to process the message queue
async function processMessageQueue() {
  // If the worker is already processing the message queue, return immediately
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (messageQueue.length > 0) {
    const promise = messageQueue.shift();
    await processSequentially(promise);
  }
  isProcessingQueue = false;
}

parentPort.on("message", async (event) => {
  const message = event.data;

  // Add the promise to the message queue
  messageQueue.push(handleMessage(message[0], message[1]));

  await processMessageQueue();
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
