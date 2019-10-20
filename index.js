const Express = require('express')
const app = Express()
const api = require('./api.js')()
const init = async () => {
  app.use('/', await api)

  app.listen(3000)
}

init()
