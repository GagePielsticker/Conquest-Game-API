const express = require('express')
const router = express.Router()

module.exports = client => {
  router.use('/:xPos/:yPos', (req, res, next) => {
    client.game.getTile(Number(req.params.xPos), Number(req.params.yPos))
      .then(tile => {
        req.tile = tile
        next()
      })
      .catch(e => res.json({ error: e }))
  })

  router.get('/:xPos/:yPos', (req, res) => {
    res.json(req.tile)
  })

  return router
}
