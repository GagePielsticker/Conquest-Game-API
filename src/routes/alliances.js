/**
 * Dependencies
 */
const express = require('express')
const router = express.Router()

module.exports = client => {
  /**
   * Creates new alliance
   * @param {Snowflake} User Discord ID
   * @param {String} alliance Alliance name
   * @returns {void}
   */
  router.put('/:alliance', (req, res) => {
    if (!req.body.name) return res.json({ error: 'Missing alliance name' })
    client.game.createAlliance(req.user.uid, req.body.name)
      .then(user => { res.json({ success: true }) })
      .catch(e => res.json({ error: e }))
  })

  /**
   * Creates new alliance application
   * @param {Snowflake} User Discord ID
   * @param {String} alliance Alliance name
   * @returns {void}
   */
  router.put('/apply', (req, res) => {
    if (!req.body.name) return res.json({ error: 'Missing alliance name' })
    client.game.applyToAlliance(req.user.uid, req.body.name)
      .then(user => { res.json({ success: true }) })
      .catch(e => res.json({ error: e }))
  })

  /**
   * Cancels alliance application
   * @param {Snowflake} User Discord ID
   * @param {String} alliance Alliance name
   * @returns {void}
   */
  router.delete('/apply', (req, res) => {
    if (!req.body.name) return res.json({ error: 'Missing alliance name' })
    client.game.cancelAllianceApplication(req.user.uid, req.body.name)
      .then(user => { res.json({ success: true }) })
      .catch(e => res.json({ error: e }))
  })

  /**
   * Accepts alliance application
   * @param {Snowflake} User Alliance Owner Discord ID
   * @param {Snowflake} User Target Discord ID
   * @returns {void}
   */
  router.post('/apply/accept/:target', async (req, res) => {
    const target = await client.database.collection('users').findOne({ uid: req.params.target })
    if (!target) return res.json({ error: 'Invalid target user' })
    client.game.applyToAlliance(req.user.uid, target.uid)
      .then(() => { res.json({ success: true }) })
      .catch(e => res.json({ error: e }))
  })

  /**
   * Denies alliance application
   * @param {Snowflake} User Alliance Owner Discord ID
   * @param {Snowflake} User Target Discord ID
   * @returns {void}
   */
  router.post('/apply/deny/:target', async (req, res) => {
    const target = await client.database.collection('users').findOne({ uid: req.params.target })
    if (!target) return res.json({ error: 'Invalid target user' })
    client.game.denyFromAlliance(req.user.uid, target.uid)
      .then(() => { res.json({ success: true }) })
      .catch(e => res.json({ error: e }))
  })

  return router
}
