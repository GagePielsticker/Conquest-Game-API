/**
 * Dependencies
 */
const express = require('express')
const router = express.Router()

module.exports = client => {
  router.get('/:by', (req, res) => {
    let page = req.query.page || 1
    page = Number(page)
    const by = req.params.by.toLowerCase()
    if (!['gold', 'city', 'population'].includes(by)) return res.json({ error: 'Invalid BY' })

    client.game.getLeaderboard(by, page)
      .then(leaderboard => res.json(leaderboard))
      .catch(err => res.json({ error: err }))
  })

  return router
}
