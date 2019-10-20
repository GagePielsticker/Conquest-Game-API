module.exports = client => {
  const Express = require('express')
  const app = Express.Router()

  app.use('/:xPos/:yPos', (req, res, next) => {
    client.game.getTile(Number(req.params.xPos), Number(req.params.yPos))
      .then(tile => {
        req.tile = tile
        next()
      })
      .catch(e => res.json({ error: e }))
  })

  app.get('/:xPos/:yPos', (req, res) => {
    res.json(req.tile)
  })

  return app
}
