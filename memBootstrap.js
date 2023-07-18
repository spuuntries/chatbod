(async () => {
  const memory = require("./memory.json"),
    { getSummary, getCaption } = require("./llmutils"),
    fs = require("fs");

  /**
   * @param {string} str To extract from
   */
  function extractEmotes(str) {
    var mutate = str;
    const emoteRegex = /<(a?):(\w+):(\d+)>/gim,
      matchArray = Array.from(str.matchAll(emoteRegex));

    matchArray.forEach((m) => {
      var emoteName = m[2];
      if (emoteName.includes("_")) emoteName = emoteName.split("_").pop();
      mutate = mutate.replace(m[0], `:${emoteName}:`);
    });

    return mutate;
  }

  console.log(memory["messages"].length);
  console.log(
    memory["messages"].filter(
      (m) => !m["content"].includes("!ig") && !m["content"].includes("!hig")
    ).length
  );

  const filteredMessages = memory["messages"].filter(
    (m) => !m["content"].includes("!ig") && !m["content"].includes("!hig")
  );

  function chunkArray(array, size) {
    var chunks = [];

    for (var i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }

    return chunks;
  }

  const chunkedConvos = chunkArray(filteredMessages, 20);

  console.log(chunkedConvos.length);

  const mappedConvos = chunkedConvos.map((c) =>
    c.map((m, i) => {
      let author;
      if (m.author.id != "1044973907632996372")
        if (m.author.nickname) author = m.author.nickname.replaceAll(" ", "_");
        else author = m.author.name.replaceAll(" ", "_");
      else author = "kekbot";

      const result = `${author}: ${extractEmotes(m.content)}${
        m.attachments.some((a) => a.fileName.split(".").pop().includes("gif"))
          ? " [gif]"
          : ""
      }${
        m.attachments.some((a) =>
          ["png", "jpeg", "jpg"].includes(a.fileName.split(".").pop())
        )
          ? ` [image]`
          : ""
      }`;

      return result;
    })
  );

  const summarizedConvos = await Promise.all(
    mappedConvos.map(async (c) => {
      const summ = await getSummary(c.join("\n"));
      console.log(
        `[${summ}]: ${
          c.join("\n").length > 256
            ? c.join("\n").slice(0, 256) + "..."
            : c.join("\n")
        }`
      );
      return summ;
    })
  );

  fs.writeFileSync("./bootstrapmemory", JSON.stringify(summarizedConvos));

  console.log("Bootstrap written");
})();
