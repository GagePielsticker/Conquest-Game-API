/**
 * Dependencies
 */
const express = require('express')
const router = express.Router()

module.exports = client => {
  const products = ['settler']

  router.get('/', (req, res) => {
    res.json(products)
  })

  router.use(async (req, res, next) => {
    const user = await client.database.collection('users').findOne({ uid: req.headers.user })
    if (!user) return res.json({ error: 'Invalid user' })
    req.user = user
    next()
  })
  router.post('/', (req, res) => {
    if (!products.includes(req.body.buy)) return res.json({ error: 'Invalid product' })
    switch (req.body.buy) {
      case 'settler':
        client.game.buySettler(req.user.uid)
          .then(price => res.json({ price: price }))
          .catch(err => res.json({ error: err }))
        break
    }
  })

  return router
}
