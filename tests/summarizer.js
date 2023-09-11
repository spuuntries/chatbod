const { getSummary, keyword } = require("../llmutils"),
  start = Date.now(),
  prompt = `Mike: Hi kekbot
kekbot: Enlo ther!
Mike: What's up? Anything new?
kekbot: Saem old saem old, u?
Mike: Same, how's kek?
kekbot: He been gud, kinda busy wit stuff, colege n stuf, ykno?
Mike: Oof, yeah.`;

(async () => {
  const summary = await getSummary(prompt),
    sumtime = Date.now();
  console.log(`${summary}
----
Summary: ${sumtime - start}ms
----
`);

  const keywords = await keyword(summary);
  console.log(`${keywords}
----
Keywords: ${Date.now() - sumtime}ms
----`);

  process.exit();
})();
