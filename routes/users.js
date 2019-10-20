module.exports = client => {
  const Express = require('express')
  const app = Express.Router()

  app.get('/@me', (req, res) => {
    res.json(req.user)
  })

  return app
}
