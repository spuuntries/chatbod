const compromise = require("compromise");
/** @type {compromise.default} */
const nlp = require("compromise"),
  _ = require("lodash");
nlp.plugin(require("compromise-speech"));

function transform(str) {
  let res = nlp(str);

  res = nlp(
    (() => {
      let result = "";

      const matches = res.text().match(/(\w+)|(\s+)|([!-\/:-@[-`{-~])/gi);
      for (let i = 0; i < matches.length; i++) {
        if (matches[i].trim() !== "") {
          if (_.inRange(_.random(1, 10), 1, 5)) {
            result += matches[i];
            continue;
          }
          let old = matches[i].trim(),
            inter = nlp(matches[i].trim().toLowerCase());
          inter = inter.replace("not", "nut", { keepTags: false });
          inter = inter.text().replaceAll(/ight$/g, "ite");
          inter = nlp(inter).soundsLike()[0][0];
          inter = inter
            .replaceAll("ea", "ee")
            .replaceAll("is", "iz")
            .replaceAll("ike", "iek")
            .replaceAll("but", "butt")
            .replaceAll(/^i$/g, "me")
            .replaceAll(/oes$/g, "oez")
            .replaceAll(/ork$/g, "oek")
            .replaceAll("that", "dat")
            .replaceAll(/air$/g, "aer")
            .replaceAll(/^the$/g, "da")
            .replaceAll(/([a])the/g, "$1thu")
            .replaceAll(/([io])the/g, "$1de")
            .replaceAll(/a[l]+$/g, "ol");
          if (inter.split("").filter((char) => char == "e").length > 1) {
            /** @type {string} */
            let eswap = inter;
            inter = eswap
              .split("")
              .map((e, i) =>
                i > 1 && e == "e" ? (Math.random() >= 0.8 ? "u" : e) : e
              )
              .join("");
          }
          if (old.match(/[^aiueo]+y$/gi)) inter += "i";
          if (old.match(/[aiueo]+y$/gi)) inter += "e";
          if (old.match(/day$/gi))
            inter = inter.slice(0, inter.length - 3) + "dae";
          if (old.match(/[aiueo]ve$/gi))
            inter = inter.slice(0, inter.length - 2) + "be";
          if (old.match(/[y]+s$/gi))
            inter = inter.slice(0, inter.length - 1) + "es";
          if (old == "does") inter = "doez";
          if (old.at(0).toUpperCase() == old.at(0) && inter)
            inter = inter.at(0).toUpperCase() + inter.slice(1);
          result += inter;
        } else {
          result += matches[i];
        }
      }

      return result;
    })()
  );

  return res.text();
}

module.exports = { transform };
