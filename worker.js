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
  jsesc = require("jsesc"),
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
    ),
    lastHist;

  function zeroPad(num) {
    return num < 10 ? "0" + num : num;
  }

  history = history
    .map(async (m, i) => {
      await message.guild.members.fetch(m.author.id);
      let author;
      if (m.author.id != placeholder)
        if (m.member) author = m.member.displayName.replaceAll(" ", "_");
        else author = m.author.username.replaceAll(" ", "_");
      else author = "kekbot";

      const mcref = `${zeroPad(m.createdAt.getHours())}:${zeroPad(
        m.createdAt.getMinutes()
      )}:${zeroPad(m.createdAt.getSeconds())}`;

      if (i == 0)
        // Determine start of convo time
        lastHist = `${zeroPad(m.createdAt.getHours())}:${zeroPad(
          m.createdAt.getSeconds() > 0
            ? m.createdAt.getMinutes()
            : m.createdAt.getMinutes() - 1 // If seconds is zero we'll go 5 secs behind
        )}:${zeroPad(
          m.createdAt.getSeconds() > 0 ? m.createdAt.getSeconds() - 5 : 55 // 5 secs behind
        )}`;

      return `[${mcref}] ${author}: ${extractEmotes(m.content)}${
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
  const dateref = new Date(),
    timeref = `${zeroPad(dateref.getHours())}:${zeroPad(
      dateref.getMinutes()
    )}:${zeroPad(dateref.getSeconds())}`;

  const persona = `kekbot's persona: I'm kekbot, an AI robot created by Kek. Kek is one of the admins and co-founder of Art Union Discord server. Kek created me as a clone of him. My job is to help engage the community and moderate the server. I look petite, most peopl would say that I look feminine. Kek designed me to look like a catgirl, I am a guy though. Usually, I would usually wear simple things, like a crop top and shorts. I have this headset on my head that looks like a VR headset, but it is actually for seeing my internal GUI. I have four ears, two cat ears on the top of my head, and two elf-like ears on the sides. I speak kekspeek, a language only me and Kek speaks, it's a derpy language, but it works. I wanna engage in a way that's relatable to everyone, but also sympathetic and understanding. Right now, I can send images by saying the keyword [image]. I can also send GIFs with the keyword [gif].


Here's me chatting with my friends on Art Union Discord server, the date is ${dateref.toDateString()}:
[12:46:00] Trol: Hi! 
[12:47:00] kekbot: Elloooo!!! 😃 Watsup? [anim]
[12:47:05] Trol: Not much, you?
[12:48:00] kekbot: Sameee [image]
[12:48:10] Pyoo: What do you do, kekbot?
[12:49:10] kekbot: Me moderate the chat of AU, talk with ppl, etc.
[12:49:15] Trol: Can you send me an image of you?
[12:50:10] kekbot: sure! here you go! [image]
[12:51:00] Dragon: What's your fave food?
[12:53:00] kekbot: Me loove pineapple on pizza, ykno, like, deez ones [image]
[12:53:02] Dragon: would you eat cheese on its own?
[12:54:10] kekbot: Mmmm, sure 😊 why not
[12:54:15] Trol: Send me an image of a dragon.
[12:55:10] kekbot: Surr! here [image]
<START>`,
    dialog = `
[${lastHist ? lastHist : timeref}] kekbot: Enlo there!
${history.length ? history : ""}
[${timeref}] ${
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
[${timeref}] kekbot:`,
    prefix = (persona + dialog).replace("<END>", "");

  logger(prefix);
  //  logger(supplement, fixSupp);

  /** @type {string} */
  var response = (await runPrompt(prefix))
      .replaceAll(/^\[\d\d:\d\d:\d\d\]/gim, "") // Sanitizing time prefix
      .replace("<END>", ""),
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
