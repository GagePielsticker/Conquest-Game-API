/**
 * Dependencies
 */
const express = require('express')
const router = express.Router()

module.exports = client => {

  /**
   * Express middleware to fetch user from database
   */
  router.use('/:user', async (req, res, next) => {
    let user
    if (req.params.user === '@me') user = req.user
    else user = await client.database.collection('users').findOne({ uid: req.params.user })
    if (!user) return res.json({ error: 'Invalid user' })
    req.ruser = user
    next()
  })

  /**
   * Gets information on a user
   * @param {Snowflake} :user User's Discord ID
   * @returns {User} User Object
   */  
  router.get('/:user', async (req, res) => {
    res.json(req.ruser)
  })

  /**
   * Gets a list of a user's cities
   * @param {Snowflake} :user User's Discord ID
   * @returns {Array<City>} Array of user's owned cities
   */
  router.get('/:user/cities', (req, res) => {
    client.game.getUserCities(req.ruser.uid)
      .then(cities => res.json(cities))
      .catch(e => res.json({ error: e }))
  })

  router.get('/:user/cities/names', (req, res) => {
    let page = req.query.page
    if (!page) page = 1
    page = Number(page)

    client.game.getUserCityNames(req.ruser.uid, page)
      .then(response => { res.json({ cities: response.cities, totalPages: response.totalPages }) })
      .catch(e => res.json({ error: e }))
  })

  /**
   * Creates a new city
   * @param {Snowflake} :user User's Discord ID
   * @param {String} name City name
   * @returns {City} New City object
   */
  router.post('/:user/cities', (req, res) => {
    if (!req.body.name) return res.json({ error: 'Missing name' })
    client.game.settleLocation(req.ruser.uid, req.body.name)
      .then(city => res.json(city))
      .catch(e => res.json({ error: e }))
  })

  /**
   * Move user
   * @param {Snowflake} user User's Discord ID
   * @param {Integer} xPos New X position
   * @param {Integer} yPos New Y position
   * @returns {Integer} Duration of journey in ms
   */
  router.post('/:user/move/:xPos/:yPos', (req, res) => {
    const xPos = Number(req.params.xPos)
    const yPos = Number(req.params.yPos)
    console.log(xPos, yPos, req.ruser.uid)
    client.game.moveUser(req.ruser.uid, xPos, yPos)
      .then(time => res.json({ time: time }))
      .catch(e => res.json({ error: e }))
  })

  /**
   * Stop user movement
   * @param {Snowflake} user User's Discord ID
   * @returns {Object}
   * @returns {Object.xPos} User's current X position
   * @returns {Object.yPos} User's current Y position
   */
  router.post('/:user/move/stop', (req, res) => {
    client.game.stopUser(req.ruser.uid)
      .then(response => res.json(response))
      .catch(e => res.json({ error: e }))
  })

  /**
   * Scout Tile
   * @param {Snowflake} user User's Discord ID
   * @returns {Object}
   * @returns {Object.time} Time required to scout the tile
   * @returns {Object.mapEntry} Tile information
   */
  router.post('/:user/scout', (req, res) => {
    client.game.scoutTile(req.ruser.uid)
      .then((response) => res.json(response))
      .catch(e => res.json({ error: e }))
  })

  /**
   * Get user's scouting time
   * @param {Snowflake} user User's Discord ID
   * @returns {Object}
   * @returns {Object.time} Time required to scout a tile
   */
  router.get('/:user/scout', (req, res) => {
    client.game.calculateScoutTime(req.ruser.uid)
      .then(time => res.json({ time: time }))
      .catch(e => res.json({ error: e }))
  })

  /**
   * Set user's flag
   * @param {Snowflake} user User's Discord ID
   * @param {String} flagUrl User's flag URL
   * @returns {Object} 
   * @returns {Object.success} Success true/false
   */
  router.post('/:user/flag', (req, res) => {
    if (!req.body.flagURL) return res.json({ error: 'Missing flag URL' })
    client.game.setFlag(req.ruser.uid, req.body.flagURL)
      .then(() => res.json({ success: true }))
      .catch(e => res.json({ error: e }))
  })

  /**
   * Set user's flag
   * @param {Snowflake} user User's Discord ID
   * @param {String} name User's empire name
   * @returns {void}
   */
  router.post('/:user/empire/name', (req, res) => {
    if (!req.body.name) return res.json({ error: 'Missing name' })
    client.game.setEmpireName(req.ruser.uid, req.body.name)
      .then(() => res.json({ success: true }))
      .catch(e => res.json({ error: e }))
  })

  /**
   * Gets user's alliance
   * @param {Snowflake} user User's Discord ID
   * @returns {Alliance} Alliance
   */
  router.get('/:user/alliance', (req, res) => {
    client.game.getAlliance(req.ruser.uid)
      .then(alliance => { 
        if (!alliance) res.json({ error: 'User is not in alliance' })
        res.json(alliance) 
      })
      .catch(e => res.json({ error: e }))
  })
  
  /**
   * Leaves user's alliance
   * @param {Snowflake} user User's Discord ID
   * @returns {void}
   */
  router.delete('/:user/alliance', (req, res) => {
    client.game.getAlliance(req.ruser.uid)
      .then(() => { res.json({success: true}) })
      .catch(e => res.json({ error: e }))
  })

  return router
}
