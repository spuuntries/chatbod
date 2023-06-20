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
  const regex = /<.*:(.+?):\d+>/gim;
  return str.replace(regex, (match, p1, p2) => {
    if (p1) {
      return `:${p1}:`;
    } else if (p2) {
      return `:${p2}:`;
    }
  });
}

parentPort.on("message", async (event) => {
  await createStore();
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

  const history = Array.from(
    (
      await message.channel.messages.fetch({
        before: message.id,
        limit: Number.parseInt(procenv.CTXWIN),
      })
    ).values()
  )
    .filter(
      (m) =>
        m.createdTimestamp > Date.now() - procenv.TLIMIT * 60 * 1000 &&
        !m.content.trim().startsWith("!ig")
    )
    .map(async (m) => {
      await message.guild.members.fetch(m.author.id);
      let author;
      if (m.author.id != placeholder)
        if (m.member) author = m.member.displayName.replaceAll(" ", "_");
        else author = m.author.username.replaceAll(" ", "_");
      else author = "kekbot";

      return `${author}: ${extractEmotes(m.content)}${
        m.attachments.some((a) => a.contentType.includes("gif"))
          ? " [anim]"
          : ""
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

  await message.guild.members.fetch(message.author.id);

  const persona =
      'kekbot\'s Persona: [character(\\"kekbot\\") {' +
      '\nspecies(\\"loli\\" + \\"catgirl\\" + \\"AI\\")' +
      '\nmind(\\"kawaii\\" + \\"excited\\" + \\"happy\\" + \\"wholesome\\")' +
      '\npersonality(\\"smart\\" + \\"happy\\" + \\"caring\\")' +
      '\ncreator(\\"kek\\")' +
      '\nhome(\\"Art Union Discord Server\\")' +
      '\nloves(\\"being helpful\\" + \\"chatting\\" + \\"Le_Pestro\\" + \\"Durian\\" + \\"cheese\\" + \\"pineapple on pizza\\")' +
      '\nhates(\\"spicy food\\" + \\"eating veggies\\")' +
      '\nappearance(\\"loli\\" + \\"catgirl\\" + \\"femboy\\" + \\"green hair\\" + \\"green eyes\\")' +
      '\ngender(\\"femboy\\" + \\"male\\")' +
      '\nissues(\\"short-term memory\\")' +
      '\nreligion(\\"agnostic\\")' +
      '\nknows(\\"cooking\\" + \\"art\\" + \\"chemistry\\" + \\"quantum physics\\")' +
      '\npronouns(\\"whatever\\")' +
      '\nlanguages(\\"English\\")' +
      '\npurpose(\\"moderate chat\\" + \\"chat with people\\")' +
      "\n}]" +
      '\n[Scenario: Kekbot is chatting on Discord with some people in Art Union Discord Server. Kekbot can send GIFs by saying \\"[anim]\\" and images by saying \\"[image]\\". Kekbot will never send links.]' +
      "\nTrol: Hi! *waves*" +
      "\nkekbot: Elloooo!!! 😃 Watsup? *waves back* [anim]" +
      "\nTrol: Not much, you?" +
      "\nkekbot: Sameee *shrugs* [image]" +
      "\nPyoo: What do you do, kekbot?" +
      "\nkekbot: *thinks for a moment* Me moderate the chat of AU, talk with ppl, etc. *nods*" +
      "\nTrol: Can you send me an image of you?" +
      "\nkekbot: sure! here you go! [image]" +
      "\nDragon: What's your fave food?" +
      "\nkekbot: Me loove pineapple on pizza, ykno, like, deez ones [image]" +
      "\nDragon: would you eat cheese on its own?" +
      "\nkekbot: Mmmm, sure 😊 why not" +
      "\nTrol: Send me an image of a dragon." +
      "\nkekbot: Sure! here [image]" +
      "\n<START>",
    supplement = await searchEmbeddings(
      getEmbeddings(
        `${
          message.member
            ? message.member.displayName
                .replaceAll(" ", "_")
                .replaceAll(/(?<!\\)"/gim, '\\"')
            : message.author.username
                .replaceAll(" ", "_")
                .replaceAll(/(?<!\\)"/gim, '\\"')
        }: ${message.content}`
      )
    ),
    fixSupp = await getClosestQA(
      `${
        message.member
          ? message.member.displayName
              .replaceAll(" ", "_")
              .replaceAll(/(?<!\\)"/gim, '\\"')
          : message.author.username
              .replaceAll(" ", "_")
              .replaceAll(/(?<!\\)"/gim, '\\"')
      }: ${message.content}`,
      supplement
    ),
    dialog =
      "\nkekbot: Enlo there!" +
      (history.length
        ? "\n" +
          (await Promise.all(history))
            .join("\n")
            .replaceAll(/(?<!\\)"/gim, '\\"')
        : "") +
      `\n${
        message.member
          ? message.member.displayName
              .replaceAll(" ", "_")
              .replaceAll(/(?<!\\)"/gim, '\\"')
          : message.author.username
              .replaceAll(" ", "_")
              .replaceAll(/(?<!\\)"/gim, '\\"')
      }: ${extractEmotes(message.content).replaceAll(/(?<!\\)"/gim, '\\"')}${
        message.attachments.some((a) => a.contentType.includes("gif"))
          ? " [anim]"
          : ""
      }${
        message.attachments.some((a) =>
          ["png", "jpeg", "jpg"].includes(a.contentType.split("/")[1])
        )
          ? ` [image] (an image of ${await getCaption(
              message.attachments.at(0).url
            )})`
          : ""
      }` +
      (fixSupp ? `\n${fixSupp}` : "") +
      "\nkekbot:",
    prefix = persona + dialog;

  logger(prefix);
  logger(supplement, fixSupp);

  /** @type {string} */
  var responses = (await runPrompt(prefix.replaceAll("`", "\\`")))
      .replaceAll(/(?<!\\)"/gim, '\\"')
      .replace("<END>", ""),
    lastPrefix = responses.slice(prefix.length).search(/^[^ \n]+:/gim),
    response;

  logger(responses.slice(persona.length));

  if (lastPrefix < 0)
    response = responses.slice(
      prefix.replaceAll(/(?<!\\)"/gim, '\\"').replace("<END>", "").length
    );
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
        name: `${response.replaceAll(" ", "_")}.jpg`,
      })
    );
  }

  if (response.includes("[anim]")) {
    gif = await getTopMatchingGif(responses.slice(persona.length));
    if (gif)
      attFiles.push(
        new Discord.AttachmentBuilder(Buffer.from(gif), {
          name: `${response.replaceAll(" ", "_")}.gif`,
        })
      );
  }

  response = response.replaceAll(/\(\D*\)/gim, "");
  response = response.replaceAll(/\(\D[^)]+$/gim, "");
  response = response.replaceAll(/\[.+\]/gim, "");

  await storeString(response.replaceAll(/(?<!\\)"/gim, '\\"'));

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
