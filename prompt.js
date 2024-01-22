require("dotenv").config();
const fs = require("fs"),
  procenv = process.env;

/**
 *
 * @param {string[]} arr
 */
function setPrompt(arr) {
  let template = fs.readFileSync(procenv.PROMPTFILE).toString().trim();
  for (const [i, e] of arr.entries()) {
    template = template.replaceAll(`{${i}}`, e);
  }
  return template;
}

module.exports = setPrompt;
