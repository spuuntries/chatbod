require("dotenv").config();

const procenv = process.env,
  { parentPort, Worker } = require("worker_threads"),
  Discord = require("discord.js"),
  client = new Discord.Client({
    intents: ["Guilds", "GuildMessages", "MessageContent", "GuildMembers"],
  }),
  placeholder = procenv.PLACEHOLDER,
  {
    runPrompt,
    generateImage,
    getTopMatchingGif,
    getCaption,
    getClosestQA,
    nsfwProcess,
  } = require("./llmutils"),
  {
    createStore,
    storeString,
    searchEmbeddings,
    getEmbeddings,
  } = require("./storeutils"),
  typer = new Worker("./typeworker.js"),
  logger = (m) => console.log(`[${new Date()}] ${m}`);

/**
 * @param {string} str To extract from
 */
function extractEmotes(str) {
  var mutate = str;
  const emoteRegex = /<(a?):(\w+):(\d+)>/gim,
    matchArray = Array.from(str.matchAll(emoteRegex));

  matchArray.forEach((m) => {
    const emoteName = m[2];
    mutate = mutate.replace(m[0], `:${emoteName}:`);
  });

  return mutate;
}

parentPort.on("message", async (event) => {
  // await createStore();
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

  typer.postMessage([message.channelId]);
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

  var history = Array.from(
    (
      await message.channel.messages.fetch({
        before: message.id,
        limit: Number.parseInt(procenv.CTXWIN),
      })
    ).values()
  ).filter(
    (m) =>
      m.createdTimestamp > Date.now() - procenv.TLIMIT * 60 * 1000 &&
      !m.content.trim().startsWith("!ig")
  );

  history = history
    .map(async (m) => {
      await message.guild.members.fetch(m.author.id);
      let author;
      if (m.author.id != placeholder)
        if (m.member) author = m.member.displayName.replaceAll(" ", "_");
        else author = m.author.username.replaceAll(" ", "_");
      else author = "kekbot";

      return `${author}: ${extractEmotes(m.content)}${
        m.attachments.some((a) => a.contentType.includes("gif")) ? " [gif]" : ""
      }${
        m.attachments.some((a) =>
          ["png", "jpeg", "jpg"].includes(a.contentType.split("/")[1])
        )
          ? ` [image] (an image of ${await getCaption(
              m.attachments.at(0).url
            )})`
          : ""
      }`;
    })
    .reverse();
  history = (await Promise.all(history)).join("\n");

  await message.guild.members.fetch(message.author.id);

  const persona = `kekbot's persona: Kekbot is a cheerful AI chatbot created by Kek, an admin of Art Union Discord server. Kek created kekbot as a clone of him to manage Art Union and engage with the community in meaningful ways. Kekbot has a petite, feminine body and appears like a loli catgirl, despite being male. Kekbot wears a simple crop top and shorts, and has green hair. He also wears a VR headset apparatus on his head, along with two sets of ears - cat ears on top and elf ears on the sides. Kekbot speaks kekspeek, a language that only he and kek speaks, it is informal, uses nonstandard grammar and vocabulary, and may be perceived as childish or unprofessional. Kekbot is sympathetic and understanding of everyone he talks to but will always engage in a way that is relatable. Kekbot goes by any pronouns, so long as they make sense. Kekbot can send images with the keyword [image]. He can also send GIFs with the keyword [gif].

[Scenario: Kekbot is chatting on Discord with some people in Art Union Discord server.]
Trol: Hi! *waves*
kekbot: Elloooo!!! 😃 Watsup? *waves back* [anim]
Trol: Not much, you?
kekbot: Sameee *shrugs* [image]
Pyoo: What do you do, kekbot?
kekbot: *thinks for a moment* Me moderate the chat of AU, talk with ppl, etc. *nods*
Trol: Can you send me an image of you?
kekbot: sure! here you go! [image]
Dragon: What's your fave food?
kekbot: Me loove pineapple on pizza, ykno, like, deez ones [image]
Dragon: would you eat cheese on its own?
kekbot: Mmmm, sure 😊 why not
Trol: Send me an image of a dragon.
kekbot: Sure! here [image]
<START>`,
    dialog = `
kekbot: Enlo there!
${history.length ? history : ""}
${
  message.member
    ? message.member.displayName.replaceAll(" ", "_")
    : message.author.username.replaceAll(" ", "_")
}: ${extractEmotes(message.content)}${
      message.attachments.some((a) => a.contentType.includes("gif"))
        ? " [gif]"
        : ""
    }${
      message.attachments.some((a) =>
        ["png", "jpeg", "jpg"].includes(a.contentType.split("/")[1])
      )
        ? ` [image] (an image of ${await getCaption(
            message.attachments.at(0).url
          )})`
        : ""
    }
kekbot:`,
    prefix = (persona + dialog).replaceAll("`", "\\`").replace("<END>", "");

  logger(prefix);
  //  logger(supplement, fixSupp);

  /** @type {string} */
  var responses = (await runPrompt(prefix))
      .replaceAll(/[\'']/gim, "\\'")
      .replaceAll(/[\""]/gim, '\\"')
      .replaceAll("`", "\\`")
      .replace("<END>", ""),
    lastPrefix = responses.slice(prefix.length).search(/^[^ \n]+:/gim),
    response;

  logger(prefix.length);
  logger(responses.length);
  logger(responses.slice(prefix.length));

  if (lastPrefix < 0) response = responses.slice(prefix.length);
  else response = responses.slice(prefix.length).slice(0, lastPrefix);
  logger(responses);
  logger(lastPrefix);
  logger(response);

  response = response.replace("<START>", "");

  var img,
    gif,
    attFiles = [];
  if (
    response.includes("[image]") ||
    response.includes("[pic]") ||
    response.includes("[img]")
  ) {
    img = await generateImage(responses.slice(persona.length));
    attFiles.push(
      new Discord.AttachmentBuilder(Buffer.from(img), {
        name: `${
          (await nsfwProcess(Buffer.from(img))) ? "SPOILER_" : ""
        }${response.replaceAll(" ", "_").slice(0, 1024)}.jpg`,
      })
    );
  }

  if (response.includes("[gif]")) {
    gif = await getTopMatchingGif(responses.slice(persona.length));
    if (gif)
      attFiles.push(
        new Discord.AttachmentBuilder(Buffer.from(gif), {
          name: `${response.replaceAll(" ", "_").slice(0, 1024)}.gif`,
        })
      );
  }

  response = response.replaceAll(/\(\D*\)/gim, "");
  response = response.replaceAll(/\(\D[^)]+$/gim, "");
  response = response.replaceAll(/\[.+\]/gim, "");

  await message.reply({
    content: response,
    files: attFiles,
    allowedMentions: { repliedUser: false },
  });
  typer.postMessage([message.channelId]);

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
