require("dotenv").config();

const procenv = process.env,
  { parentPort, Worker } = require("worker_threads"),
  childProcess = require("child_process"),
  Discord = require("discord.js"),
  client = new Discord.Client({
    intents: ["Guilds", "GuildMessages", "MessageContent", "GuildMembers"],
  }),
  { QuickDB } = require("quick.db"),
  db = new QuickDB(),
  placeholder = procenv.PLACEHOLDER,
  {
    retrieval,
    runPrompt,
    generateImage,
    getTopMatchingGif,
    getCaption,
    getClosestQA,
    getSummary,
    nsfwProcess,
  } = require("./llmutils"),
  levDis = require("natural/lib/natural/distance/levenshtein_distance"),
  generatePaid = require("./infer-paid").generate,
  setPrompt = require("./prompt"),
  { createStore, storeString, searchEmbeddings } = require("./storeutils"),
  typer = new Worker("./typeworker.js"),
  _ = require("lodash"),
  toml = require("toml"),
  fs = require("fs"),
  modulator = require("./modulator"),
  logger = (m) => console.log(`[${new Date()}] ${m}`);

/**
 * @param {string} str To extract from
 */
function extractEmotes(str) {
  var mutate = str;
  const emoteRegex = /<(a?):(\w+):(\d+)>/gim,
    matchArray = Array.from(str.matchAll(emoteRegex));

  matchArray.forEach((m) => {
    var emoteName = m[2];
    if (emoteName.includes("_") && emoteName.split("_").length > 2)
      emoteName = emoteName.split("_").slice(1).join("_");
    mutate = mutate.replace(m[0], `:${emoteName}:`);
  });

  return mutate;
}

function chunkArray(array, size) {
  var chunks = [];

  for (var i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
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
    message.cleanContent.trim().startsWith("!kig") ||
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

  if (!(await db.get("contextCounter"))) await db.set("contextCounter", {});
  const contextCounter = await db.get("contextCounter");

  var history = Array.from(
      (
        await message.channel.messages.fetch({
          limit: Number.parseInt(procenv.CTXWIN),
        })
      ).values()
    ),
    ignoredWindow = 0;

  history.forEach((e) => {
    if (
      e.cleanContent.includes("!ig") ||
      e.cleanContent.includes("!hig") ||
      e.cleanContent.includes("!kig")
    )
      ignoredWindow++;
  });

  history = Array.from(
    (
      await message.channel.messages.fetch({
        limit:
          Number.parseInt(procenv.CTXWIN) + ignoredWindow > 100
            ? 100
            : Number.parseInt(procenv.CTXWIN) + ignoredWindow,
      })
    ).values()
  );

  const llamaTokenizer = (await import("llama-tokenizer-js")).default,
    generationConfig = toml.parse(
      fs.readFileSync(procenv.LLMCONFIG).toString()
    ),
    afterMessage = history.findIndex(
      (m) => m.id === contextCounter[message.channelId]
    );

  if (afterMessage != -1) {
    // The +1 is to start slicing from the message *after* the found message.
    history = history.slice(0, afterMessage);
  }

  history = filterMessages(history);

  history = history.map((e) => {
    const encoded = llamaTokenizer.encode(e.cleanContent);

    if (encoded.length > generationConfig["gen"]["max_tokens"])
      e.cleanContent =
        llamaTokenizer.decode(
          encoded.slice(0, generationConfig["gen"]["max_tokens"] - 1)
        ) + " ...";
    return e;
  });

  history = history.filter(
    (m) =>
      !m.cleanContent.trim().startsWith("!ig") &&
      !m.cleanContent.trim().startsWith("!kig")
  ); // This checks !igs and !kigs

  const interimHistory = history;

  history = history
    .map(async (m, i) => {
      await message.guild.members.fetch(m.author.id);
      let author;
      if (m.author.id != placeholder)
        author = m.author.username.replaceAll(" ", "_");
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
  history = await Promise.all(history);

  if (interimHistory.length + 1 >= procenv.CTXWIN) {
    logger("Performing summarization");
    const memoryToCommit = chunkArray(
      history,
      Number.parseInt(procenv.SLICEWIN)
    );

    for (const convoChunk of memoryToCommit) {
      const historyToCommit = convoChunk.join("\n");

      logger(`Summarizing ... ${historyToCommit.slice(-1024)}`);

      const summarizedHistory = await getSummary(historyToCommit);

      await storeString(summarizedHistory);
    }

    await db.set(
      `contextCounter.${message.channelId}`,
      interimHistory.shift().id
    );
    logger(
      `Success, set lastFetched to ${await db.get(
        `contextCounter.${message.channelId}`
      )}`
    );
  }

  history = history.join("\n");

  await message.guild.members.fetch(message.author.id);
  const dateref = new Date(),
    emojis = (
      await Promise.all(
        client.guilds.cache.map(async (g) =>
          Array.from((await g.emojis.fetch()).values())
        )
      )
    ).flat();

  // ANCHOR: Persona Prompt.
  const newEntry = `${extractEmotes(message.cleanContent)}${
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
    context = await searchEmbeddings(newEntry, 20),
    prefix = setPrompt([
      message.channel.name,
      dateref.toDateString(),
      childProcess.execSync("git log -3 --pretty=%B").toString().trim(),
      context.length
        ? "\n" + context.map((c) => `- ${c}`).join("\n")
        : "No relevant long-term memory found.",
      message.guild.name,
      (await retrieval(message.cleanContent))
        .map((s, i) => `${i + 1}.) ${s}`)
        .join("\n"),
      history.length ? "\n" + history : "", // Chat history
      [...new Set(emojis.map((e) => `:${e.name}:`))].join(", "),
    ]);

  logger(prefix);
  logger(context);
  //  logger(supplement, fixSupp);

  /** @type {string} */
  var response = (await runPrompt(prefix)).replace("<END>", ""),
    lastPrefix = response.search(/^ *[^ \n]+:|^ *\[[^\]]*\]:/gim);

  /**
   * @param {string} resp
   * @param {number} mIndex
   * @returns
   */
  async function catchRep(resp, mIndex = 0) {
    if (mIndex >= 2) return;
    if (
      interimHistory.find(
        (m) =>
          levDis.DamerauLevenshteinDistanceSearch(resp, m.cleanContent)
            .distance < 5
      )
    ) {
      response = (
        await generatePaid(prefix, 0, {
          models: [
            (generationConfig?.paid?.models
              ? generationConfig?.paid?.models
              : [
                  "neversleep/noromaid-mixtral-8x7b-instruct",
                  "alpindale/goliath-120b",
                  "koboldai/psyfighter-13b-2",
                ])[mIndex],
          ],
        })
      ).replace("<END>", "");
      lastPrefix = response.search(/^ *[^ \n]+:|^ *\[[^\]]*\]:/gim);
      if (lastPrefix >= 0) response = response.slice(0, lastPrefix);
      logger(
        `Caught repetition, regenerated with ${[
          (generationConfig?.paid?.models
            ? generationConfig?.paid?.models
            : [
                "neversleep/noromaid-mixtral-8x7b-instruct",
                "alpindale/goliath-120b",
                "koboldai/psyfighter-13b-2",
              ])[mIndex],
        ].toString()}`
      );
      logger(lastPrefix);
      logger(response);
      return await catchRep(response, ++mIndex);
    }
    return;
  }

  logger(prefix.length);
  logger(response);

  if (lastPrefix >= 0) response = response.slice(0, lastPrefix);
  logger(lastPrefix);
  logger(response);

  await catchRep(response);

  response = response.replace("<START>", "");

  var img,
    gif,
    attFiles = [];
  if (
    response.includes("[image]") ||
    response.includes("[pic]") ||
    response.includes("[img]")
  ) {
    img = await generateImage(
      `${dialog.split("\n").slice(-2).join("\n")}${response}`
    );
    attFiles.push(
      new Discord.AttachmentBuilder(Buffer.from(img), {
        name: `${
          (await nsfwProcess(Buffer.from(img))) ? "SPOILER_" : ""
        }${response.replaceAll(" ", "_").slice(0, 1024)}.jpg`,
      })
    );
  }

  if (response.includes("[gif]")) {
    gif = await getTopMatchingGif(`kekbot:${response}`);
    if (gif)
      attFiles.push(
        new Discord.AttachmentBuilder(Buffer.from(gif), {
          name: `${response.replaceAll(" ", "_").slice(0, 1024)}.gif`,
        })
      );
  }

  if (response.match(/\[[\w]+=[\w]+]/gim)) {
    let respCommands = response.match(/\[[\w]+=[\w]+]/gim);

    respCommands.map(async (e) => {
      let cmd = e.split("="),
        users = history.map((m) => m.member),
        command = cmd[0].toLowerCase().trim(),
        arg = cmd[1].toLowerCase().trim();

      switch (command) {
        case "mute":
          if (users.map((u) => u.user.username).includes(arg)) {
            let reason;

            async function generateReasonMute(arg, dialog, rmIndex = 0) {
              let res = await generatePaid(
                `### Instruction:
Given a chatlog, provide a reason why ${arg} needs to be muted in one sentence. Enclose your responses with quotation marks.

### Input:
${dialog}

### Response:
${arg} needs to be muted because: "`,
                0
              );

              if (!res.includes('"')) {
                if (rmIndex > 1) return res.split('"')[0];
                return generateReasonMute(arg, dialog, ++rmIndex);
              }
              return res.split('"')[0];
            }

            reason = generateReasonMute(arg, dialog);

            users
              .find((u) => u.user.username == arg)
              .timeout(Number.parseInt(procenv.TIMEOUTDUR), reason);
          }
          break;

        default:
          break;
      }
      response = response.replace(e, "");
    });
  }

  if (response.match(/:[\w\d ]+:/gim)) {
    let respEmotes = response.match(/:[\w\d ]+:/gim);

    respEmotes.map((e) => {
      let emote = emojis.find(
        (em) =>
          e.trim().toLowerCase().includes(em.name.toLowerCase()) ||
          em.name.toLowerCase().includes(e.trim().toLowerCase()) ||
          levDis.DamerauLevenshteinDistance(
            e.trim().toLowerCase(),
            em.name.toLowerCase()
          ).distance <= 4
      );
      if (emote)
        response = response.replace(
          e,
          `<${emote.animated ? "a" : ""}:${emote.name}:${emote.id}>`
        );
      else response = response.replace(e, "");
    });
  }

  response = response.replaceAll(/\(\D*\)/gim, "");
  response = response.replaceAll(/\(\S[^):]+$/gim, "");
  response = response.replaceAll(/\[.+\]/gim, "");
  if (_.inRange(_.random(1, 10), 1, 8))
    response = modulator.transform(response);
  logger(response);

  try {
    await message.reply({
      content: response,
      files: attFiles,
      allowedMentions: { repliedUser: false },
    });
  } catch (error) {
    logger(`Failed to reply, attempting normal message.`);
    try {
      await message.channel.send({ content: response, files: attFiles });
    } catch (error) {
      logger(`Failed to reply with both methods, cancelling entirely`);
    }
  }
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
