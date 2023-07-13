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
  { createStore, storeString, searchEmbeddings } = require("./storeutils"),
  typer = new Worker("./typeworker.js"),
  _ = require("lodash"),
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
    !message.cleanContent ||
    !message.author.id ||
    message.author.id == client.user.id ||
    message.cleanContent.trim().includes("!hig") ||
    message.cleanContent.trim().startsWith("!ig") ||
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

  await createStore();

  /**
   *
   * @param {Discord.Message[]} messages
   * @returns
   */
  function filterMessages(messages) {
    let index = 0;
    while (index < messages.length) {
      if (messages[index].content.includes("!hig")) break;
      index++;
    }
    return messages.slice(0, index);
  }

  var history = Array.from(
      (
        await message.channel.messages.fetch({
          before: message.id,
          limit: Number.parseInt(procenv.CTXWIN),
        })
      ).values()
    ),
    ignoredWindow = 0;

  history.forEach((e) => {
    if (e.cleanContent.includes("!ig") || e.cleanContent.includes("!hig"))
      ignoredWindow++;
  });

  history = Array.from(
    (
      await message.channel.messages.fetch({
        before: message.id,
        limit: Number.parseInt(procenv.CTXWIN) + ignoredWindow,
      })
    ).values()
  );

  function checkIfInCurrentInterval(t, unixTimestamp) {
    // get current hour
    var currentHour = new Date().getHours();
    // calculate current interval
    var currentInterval = Math.floor(currentHour / t);

    // convert timestamp to hour
    var dateFromTimestamp = new Date(unixTimestamp);
    var hourFromTimestamp = dateFromTimestamp.getHours();
    // calculate interval from timestamp
    var intervalFromTimestamp = Math.floor(hourFromTimestamp / t);

    // compare intervals
    if (currentInterval === intervalFromTimestamp) {
      return true;
    } else {
      return false;
    }
  }

  const llamaTokenizer = (await import("llama-tokenizer-js")).default;

  history = filterMessages(history).map((e) => {
    const encoded = llamaTokenizer.encode(e.cleanContent);

    if (encoded.length > 112)
      e.cleanContent = llamaTokenizer.decode(encoded.slice(0, 111)) + " ...";
    return e;
  });

  history.forEach(async (m) => {
    await message.guild.members.fetch(m.author.id);
    let author;
    if (m.author.id != placeholder)
      if (m.member) author = m.member.displayName.replaceAll(" ", "_");
      else author = m.author.username.replaceAll(" ", "_");
    else author = "kekbot";

    const result = `${author}: ${extractEmotes(m.cleanContent)}${
      m.attachments.some((a) => a.contentType.includes("gif")) ? " [gif]" : ""
    }${
      m.attachments.some((a) =>
        ["png", "jpeg", "jpg"].includes(a.contentType.split("/")[1])
      )
        ? ` [image] (an image of ${await getCaption(m.attachments.at(0).url)})`
        : ""
    }`;

    if (!m.cleanContent.trim().startsWith("!ig")) await storeString(result);
  });

  history = history.filter(
    (m) => m.createdAt.toDateString() == new Date().toDateString()
  ); // This makes sure everything is on the same day

  history = history
    .filter(async (m) => {
      checkIfInCurrentInterval(procenv.TLIMIT, m.createdTimestamp) &&
        !m.cleanContent.trim().startsWith("!ig");
    }) // This checks intervals
    .map(async (m, i) => {
      await message.guild.members.fetch(m.author.id);
      let author;
      if (m.author.id != placeholder)
        if (m.member) author = m.member.displayName.replaceAll(" ", "_");
        else author = m.author.username.replaceAll(" ", "_");
      else author = "kekbot";

      const result = `${author}: ${extractEmotes(m.cleanContent)}${
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

      return result;
    })
    .reverse();
  history = (await Promise.all(history)).join("\n");

  await message.guild.members.fetch(message.author.id);
  const dateref = new Date();

  const persona = `kekbot's persona: Me am kekbot, AI robot created by Kek. Kek iz one of da admins and co-founder of Art Union Discord server. Kek made me a robot clone of him. Me job iz to halp engage da community n moderate da server. Me look petite, most peopl wuld say dat me look feminine. Kek designed me to look like a catgirl, Me a guy though. Usually, me wuld usually wear simpel things, liek a crop top n shorts. me hab dis hedset on me hed dat looks liek a VR headset, me use it to see me internal GUI. Me haz 4 ears, 2 cat ears on top of me head, and two elf-like ears on da sides. Me hair is green. Me speek kekspeek, a language only me and Kek speak, it a derpy language, but it work. Me wana engage in a way dats relatable to everyone, but also sympathetic and understanding. Right nao me can send images by saying the keyword [image]. Me can also send GIFs with the keyword [gif].


Here's me chatting with my friends on Art Union Discord server (the channel is #${
      message.channel.name
    }), today is ${dateref.toDateString()} GMT+0:
Trol: Hi! 
kekbot: Enloo!!! 😃 Watsup? [gif]
Trol: Not much, you?
kekbot: Sameee [gif]
Pyoo: What do you do, kekbot?
kekbot: Me moderate AU chat, talk with ppl, etc.
Trol: Can you send me an image of you?
kekbot: sur! here ya go! [image]
Dragon: What's your fave food?
kekbot: Me luv pineapple on pizza, ykno, like, deez ones [image]
Dragon: would you eat cheese on its own?
kekbot: Mmm, sur 😊
Trol: Send me an image of a dragon.
kekbot: Surr! here [image]
kek: What's the date, kekbot?
kekbot: Enlo creator! Da date iz ${dateref.toDateString()}
kek: Cool, ty
kekbot: No probs
kek: Wat u be doin anw?
kekbot: Me jus chillin
kek: Ic, ok
kekbot: mmhm`,
    newEntry = `${
      message.member
        ? message.member.displayName.replaceAll(" ", "_")
        : message.author.username.replaceAll(" ", "_")
    }: ${extractEmotes(message.cleanContent)}${
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
    }`,
    context = await searchEmbeddings(newEntry),
    dialog = `${history.length ? "\n" + history : ""}${
      context.length ? "\n" + context.join("\n") : ""
    }
${newEntry}
kekbot:`,
    prefix = (persona + dialog).replace("<END>", "");

  logger(prefix);
  logger(context);
  //  logger(supplement, fixSupp);

  /** @type {string} */
  var response = (await runPrompt(prefix)).replace("<END>", ""),
    lastPrefix = response.search(/^[^ \n]+:/gim);

  logger(prefix.length);
  logger(response);

  if (lastPrefix >= 0) response = response.slice(0, lastPrefix);
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
    img = await generateImage(dialog + response);
    attFiles.push(
      new Discord.AttachmentBuilder(Buffer.from(img), {
        name: `${
          (await nsfwProcess(Buffer.from(img))) ? "SPOILER_" : ""
        }${response.replaceAll(" ", "_").slice(0, 1024)}.jpg`,
      })
    );
  }

  if (response.includes("[gif]")) {
    gif = await getTopMatchingGif(dialog + response);
    if (gif)
      attFiles.push(
        new Discord.AttachmentBuilder(Buffer.from(gif), {
          name: `${response.replaceAll(" ", "_").slice(0, 1024)}.gif`,
        })
      );
  }

  response = response.replaceAll(/\(\D*\)/gim, "");
  response = response.replaceAll(/\(\S[^):]+$/gim, "");
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
