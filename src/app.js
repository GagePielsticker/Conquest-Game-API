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
app.put('/api/users/:user', async (req, res) => {
  client.game.createUser(req.params.user)
    .then(user => {
      res.json(user)
    })
    .catch(e => res.json({ error: e }))
})

// routers not requiring user

// middleware for user
// app.use(async (req, res, next) => {
//   const user = await client.database.collection('users').findOne({ uid: req.headers.user || req.query.user })
//   if (!user) return res.json({ error: 'Invalid user' })
//   delete user._id
//   req.user = user
//   next()
// })

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
