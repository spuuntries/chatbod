require("dotenv").config();

(async () => {
  const memory = require(process.env.MEMFILE),
    { getSummary, getCaption } = require("./llmutils"),
    fs = require("fs"),
    chrono = require("chrono-node");

  function removeDates(input) {
    const parsedDates = chrono.parse(input);
    let lastEndIndex = 0;
    let output = "";

    for (const result of parsedDates) {
      const startIndex = result.index;
      const endIndex = startIndex + result.text.length;

      // Add the text from the end of the last date to the start of this date
      output += input.slice(lastEndIndex, startIndex);

      lastEndIndex = endIndex;
    }

    // Add the remaining text after the last date
    output += input.slice(lastEndIndex);

    return output.trim();
  }

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

  const chunkedConvos = chunkArray(filteredMessages, 10);

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
      let summ,
        n = 1;

      async function callSum() {
        try {
          summ = await getSummary(c.join("\n"));
        } catch (e) {
          if (n < 6) {
            console.log(`Failed to get summary ${n} times, retrying...`);
            await callSum();
            n++;
          } else
            console.log(
              `Failed to get summary of ${
                c.join("\n").length > 256
                  ? c.join("\n").slice(0, 256) + "..."
                  : c.join("\n")
              }`
            );
        }
      }
      await callSum();

      console.log(
        `[${summ}]: ${
          c.join("\n").length > 256
            ? c.join("\n").slice(0, 256) + "..."
            : c.join("\n")
        }`
      );

      try {
        summ = removeDates(summ);
      } catch (e) {
        console.log(`Date removal for [${summ}] failed.`);
      }

      return summ;
    })
  );

  fs.writeFileSync(
    `./bootstrapmemory (${new Date().toISOString().replaceAll(":", "_")})`,
    JSON.stringify(summarizedConvos.flat())
  );

  console.log("Bootstrap written");
})();
