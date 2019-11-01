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
     */
    postStats: async (guildCount, userCount) => {
      return client.database.collection('statistics').insertOne({
        time: moment().unix(),
        guilds: guildCount,
        users: userCount
      })
    }
  }
}
