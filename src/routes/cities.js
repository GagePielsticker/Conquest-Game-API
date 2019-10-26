const express = require('express')
const router = express.Router()

module.exports = client => {
  /**
   * Calculate how much to level up a city
   * @param {Integer} currentLevel Current level of the city
   * @returns {Object<cost: Integer>}
   */
  router.get('/level/:currentLevel', (req, res) => {
    client.game.calculateLevelCost(Number(req.params.currentLevel))
      .then(cost => { res.json({ cost: cost }) })
      .catch(e => res.json({ error: e }))
  })

  router.get('/maxpop/:currentLevel', (req, res) => {
    client.game.calculateLevelCost(Number(req.params.currentLevel))
      .then(max => { res.json({ max: max }) })
      .catch(e => res.json({ error: e }))
  })

  router.use(async (req, res, next) => {
    const user = await client.database.collection('users').findOne({ uid: req.headers.user })
    if (!user) return res.json({ error: 'Invalid user' })
    req.user = user
    next()
  })

  router.use('/:xPos/:yPos', (req, res, next) => {
    client.game.getTile(Number(req.params.xPos), Number(req.params.yPos))
      .then(tile => {
        if (!tile.city) return res.json({ error: 'No city on this tile' })
        if (tile.city.owner !== req.user.uid) return res.json({ error: 'User doesn\'t own city' })
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
    client.game.setCityName(req.city.xPos, req.city.yPos, req.body.name)
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
    client.game.changePopulationJob(req.city.xPos, req.city.yPos, from, to, amount)
      .then(() => res.json({ success: true }))
      .catch(e => res.json({ error: e }))
  })

  return router
}
