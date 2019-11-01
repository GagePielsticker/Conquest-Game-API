/* eslint-disable prefer-promise-reject-errors */

module.exports = client => {
  /* Get dependencies */
  const moment = require('moment')

  /** @namespace */
  client.stats = {

    /**
     * Saves current guildCount to database at current time
     * @param {Integer} guildCount
     * @param {Integer} userCount
     * @param {Integer} shardCount
     */
    postStats: async (guildCount, userCount, shardCount) => {
      return client.database.collection('statistics').insertOne({
        time: moment().unix(),
        guilds: guildCount,
        users: userCount,
        shards: shardCount
      })
    },

    /**
     * Fetches Statistics from database
     * @returns {Promise<object>}
     */
    getStats: async () => {
      return client.database.collection('statistics').find().sort({ time: -1 })[0]
    }
  }
}
