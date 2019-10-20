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

  router.post('/:xPos/:yPos', (req, res) => {
    if (!req.body.name) return res.json({ error: 'Missing name' })
    client.game.settleLocation(req.user.uid, req.body.name)
      .then(city => {
        res.json(city)
      })
      .catch(e => res.json({ error: e }))
  })

  return router
}
