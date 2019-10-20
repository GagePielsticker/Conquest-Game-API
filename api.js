module.exports = async () => {
  const Express = require('express')
  const app = Express.Router()

  const client = {
    settings: require('./settings.json')
  }
  require('./database.js')(client)
  await client.connectDb()
  require('./game.js')(client)

  app.use(async (req, res, next) => {
    const user = await client.database.collection('users').findOne({ uid: req.headers.user })
    // if (!user) return res.json({ error: 'Invalid user' })
    req.user = user
    next()
  })

  // Users
  app.use('/users', require('./routes/users.js')(client))

  // Tiles
  app.use('/tiles', require('./routes/tiles.js')(client))

  return app
}
