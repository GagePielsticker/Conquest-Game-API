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

  router.get('/:xPos/:yPos/time/:xPos2/:yPos2', (req, res) => {
    client.game.calculateTravelTime(req.tile.xPos, req.tile.yPos, Number(req.params.xPos2), Number(req.params.yPos2))
      .then(time => { res.json({ time: time }) })
      .catch(e => res.json({ error: e }))
  })

  return router
}
