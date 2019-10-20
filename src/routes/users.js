const express = require('express')
const router = express.Router()

module.exports = client => {
  router.get('/@me', (req, res) => {
    res.json(req.user)
  })

  return router
}
