// Dependencies
const createError = require('http-errors')
const express = require('express')
const logger = require('morgan')
const bodyParser = require('body-parser')
const client = {
  settings: require('./settings/settings.json')
}

// Import custom libraries
require('./lib/database.js')(client)
require('./lib/game.js')(client)
require('./lib/cronJobs.js')(client)
require('./websocket/Setup.js')(client)

// engine setup and database connect
const app = express()
client.connectDb().then(x => {
  client.game.loadMovement()
    .then(console.log)
    .catch(console.log)
})

// middleware setup
app.use(logger('common'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))

app.use((req, res, next) => {
  if (!req.headers.authorization || !(typeof req.headers.authorization === 'string')) return res.json({ error: 'No authorization code was supplied' })
  const { 0: id, 1: auth } = req.headers.authorization.split(' ')
  if (!id) return res.json({ error: 'No WS ID was supplied' })
  if (!auth) return res.json({ error: 'No WS Auth was supplied' })

  const connection = client.ws.CLIENTS.get(id)
  if (!connection) return res.json({ error: 'Invalid client ID' })
  console.log(connection.auth, auth)
  if (connection.auth !== auth) return res.json({ error: 'Invalid authorization for client' })
  
  next()
})

app.put('/api/users', async (req, res) => {
  if (!req.headers.user) return res.json({ error: 'Missing user' })
  client.game.createUser(req.headers.user)
    .then(user => {
      res.json(user)
    })
    .catch(e => res.json({ error: e }))
})

// routers requiring user
app.use('/api/tiles', require('./routes/tiles.js')(client))
app.use('/api/users', require('./routes/users.js')(client))
app.use('/api/cities', require('./routes/cities.js')(client))
app.use('/api/alliances', require('./routes/alliances.js')(client))

// catch 404 and forward to error handler
app.use((req, res, next) => next(createError(404)))

// error handler
app.use((err, req, res, next) => {
  res.locals.message = err.message
  res.status(err.status)
  res.send('error')
})

module.exports = app
