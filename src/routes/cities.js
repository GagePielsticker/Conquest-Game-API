const express = require('express')
const router = express.Router()

module.exports = client => {
  router.use('/:xPos/:yPos', (req, res, next) => {
    client.game.getTile(Number(req.params.xPos), Number(req.params.yPos))
      .then(tile => {
        if (!tile.city) return res.json({ error: 'No city on this tile' })
        req.city = tile.city
        next()
      })
      .catch(e => res.json({ error: e }))
  })

  router.get('/:xPos/:yPos', (req, res) => {
    res.json(req.city)
  })

  router.delete('/:xPos/:yPos', (req, res) => {
    client.game.destroyCity(req.user.uid, req.city.xPos, req.city.yPos)
      .then(() => res.json({ success: true }))
      .catch(e => res.json({ error: e }))
  })

  router.post('/:xPos/:yPos/name', (req, res) => {
    if (!req.body.name) return res.json({ error: 'Missing name' })
    client.game.setCityName(req.user.uid, req.city.xPos, req.city.yPos, req.body.name)
      .then(() => res.json({ success: true }))
      .catch(e => res.json({ error: e }))
  })

  router.post('/:xPos/:yPos/level', (req, res) => {
    client.game.levelCity(req.user.uid, req.city.xPos, req.city.yPos)
      .then(newLevel => res.json({ level: newLevel }))
      .catch(e => res.json({ error: e }))
  })

  router.post('/:xPos/:yPos/population', (req, res) => {
    let { from, to, amount } = req.body
    if (!from) return res.json({ error: 'Missing from job' })
    if (!to) return res.json({ error: 'Missing to job' })
    if (!amount) return res.json({ error: 'Missing amount' })

    amount = Number(amount)
    client.game.changePopulationJob(req.user.uid, req.city.xPos, req.city.yPos, from, to, amount)
      .then(() => res.json({ success: true }))
      .catch(e => res.json({ error: e }))
  })

  return router
}
