module.exports = client => {
  /**
   * Dependencies
   */
  const MongoClient = require('mongodb').MongoClient

  /**
   * Connects mongoDB Database and appends it on client.db
   */
  client.connectDb = () => {
    return new Promise((resolve, reject) => {
      const { host, port, database, username, password } = client.settings.database
      MongoClient.connect(`mongodb://${username ? `${username}:${password}@` : ''}${host}:${port}`, { useNewUrlParser: true }, async (err, data) => {
        client.database = await data.db(database)
        if (err) return reject(`Error connecting to db: ${err}`) // eslint-disable-line prefer-promise-reject-errors
        else resolve()
      })
    })
  }
}
