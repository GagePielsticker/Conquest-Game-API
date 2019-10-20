const express = require('express')
const router = express.Router()

module.exports = client => {
  router.use('/:xPos/:yPos', (req, res) => {
    client.game.getTile(Number(req.params.xPos), Number(req.params.yPos))
      .then(tile => res.json(tile))
      .catch(e => res.json({ error: e }))
  })

  return router
}
