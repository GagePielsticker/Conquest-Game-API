// Dependencies
const createError = require('http-errors')
const express = require('express')
const logger = require('morgan')
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
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// get and use routers
app.use('/api', require('./routes/tiles.js')(client))
app.use('/api', require('./routes/users.js')(client))

// catch 404 and forward to error handler
app.use((req, res, next) => next(createError(404)))

// error handler
app.use((err, req, res, next) => {
  res.locals.message = err.message
  res.status(err.status)
  res.send('error')
})

module.exports = app
