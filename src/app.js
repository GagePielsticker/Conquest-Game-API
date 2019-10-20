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

// engine setup and database connect
const app = express()
client.connectDb()

// middleware setup
app.use(logger('common'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))

// middleware for user
app.use(async (req, res, next) => {
  console.log(req.body)
  const user = await client.database.collection('users').findOne({ uid: req.headers.user || req.query.user })
  if (!user) return res.json({ error: 'Invalid user' })
  delete user._id
  req.user = user
  next()
})

// get and use routers
app.use('/api/tiles', require('./routes/tiles.js')(client))
app.use('/api/users', require('./routes/users.js')(client))

// catch 404 and forward to error handler
app.use((req, res, next) => next(createError(404)))

// error handler
app.use((err, req, res, next) => {
  res.locals.message = err.message
  res.status(err.status)
  res.send('error')
})

module.exports = app
