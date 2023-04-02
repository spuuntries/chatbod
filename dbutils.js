const { nanoid } = require("nanoid"),
  PouchDB = require("pouchdb");

/**
 * A wrapper class for PouchDB.
 */
class PouchWrapper {
  /**
   * Creates a new instance of PouchWrapper.
   * @param {string} dbName - The name of the database.
   */
  constructor(dbName) {
    this.db = new PouchDB(dbName);
  }

  /**
   * Adds a document to the database.
   * @async
   * @param {string} [id] - The ID of the document.
   * @param {Object} value - The value of the document.
   * @returns {Promise<Object>} The result of the operation.
   */
  async put(id, value) {
    try {
      const doc = {
        _id: id || nanoid(),
        value,
      };

      const result = await this.db.put(doc);
      return await this.get(result.id);
    } catch (err) {
      console.log(err);
    }
  }

  /**
   * Retrieves a document from the database by its ID.
   * @async
   * @param {string} id - The ID of the document to retrieve.
   * @returns {Promise<Object>} The retrieved document.
   */
  async get(id) {
    try {
      const doc = await this.db.get(id);
      return doc;
    } catch (err) {
      return undefined;
    }
  }

  /**
   * Deletes a document from the database by its ID and revision.
   * @async
   * @param {string} id - The ID of the document to delete.
   * @param {string} rev - The revision of the document to delete.
   * @returns {Promise<Object>} The result of the operation.
   */
  async delete(id, rev) {
    try {
      const result = await this.db.remove(id, rev);
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  /**
   * Pushes a value to an array field in a document in the database.
   * @async
   * @param {string} id - The ID of the document to update.
   * @param {*} value - The value to push to the array field.
   * @returns {Promise<Object>} The result of the operation.
   */
  async push(id, value) {
    try {
      const doc = await this.db.get(id);

      if (!Array.isArray(doc.value)) {
        throw new Error("Value is not an array");
      }

      doc.value.push(value);
      const result = await this.db.put(doc);
      return await this.get(result.id);
    } catch (err) {
      console.log(err);
    }
  }
}

module.exports = { PouchWrapper };
