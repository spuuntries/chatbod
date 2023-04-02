require("dotenv").config();
const procenv = process.env,
  Discord = require("discord.js"),
  client = new Discord.Client({ intents: ["MessageContent"] }),
  PouchDB = require("pouchdb"),
  { exec } = require("child_process");

class PouchWrapper {
  constructor(dbName) {
    this.db = new PouchDB(dbName);
  }

  async put(id, value) {
    try {
      const doc = {
        _id: id || uuidv4(),
        value,
      };

      const result = await this.db.put(doc);
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async get(id) {
    try {
      const doc = await this.db.get(id);
      return doc;
    } catch (err) {
      console.log(err);
    }
  }

  async delete(id, rev) {
    try {
      const result = await this.db.remove(id, rev);
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async push(id, value) {
    try {
      const doc = await this.db.get(id);

      if (!Array.isArray(doc.value)) {
        throw new Error("Value is not an array");
      }

      doc.value.push(value);
      const result = await this.db.put(doc);
      return result;
    } catch (err) {
      console.log(err);
    }
  }
}

const db = new PouchWrapper("chatdb");

/**
 * @param {string} command
 * @returns {string}
 */
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 *
 * @param {string} channelId
 * @param {number} minutes
 */
async function checkDeadChannel(channelId, minutes) {
  /** @type {Discord.TextChannel} */
  const channel = await client.channels.fetch(channelId);
  if (!channel) throw new Error("Channel not found!");
  const messages = await channel.messages.fetch({ limit: 1 }),
    lastMessage = messages.first();
  if (!lastMessage) throw new Error("Channel empty!");
  const timeDiff = Date.now() - lastMessage.createdTimestamp,
    timeDiffInMinutes = Math.floor(timeDiff / 1000 / 60);
  if (timeDiffInMinutes > minutes) return true;
  else return false;
}

client.on("messageCreate", async (message) => {
  if (!(await db.get(message.channelId))) await db.put(message.channelId, []);
});

client.on("ready", () => {});

runCommand(`build/bin/main -m models/7bq/ggml-model-q4_0-ggjt.bin -p ""`)
  .then((output) => {
    console.log(output);
  })
  .catch((err) => {
    console.error(err);
  });

client.login(procenv.TOKEN);
