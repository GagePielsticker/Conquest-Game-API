const express = require('express')
const router = express.Router()

module.exports = client => {
  router.post('/post', (req, res) => {
    if (!req.body.guildCount) return res.json({ error: 'Missing guild count' })
    if (!req.body.userCount) return res.json({ error: 'Missing server count' })

    client.stats.postStats(req.body.guildCount, req.body.userCount)
      .then(() => res.json({ success: true }))
      .catch(e => res.json({ error: e }))
  })

  return router
}
