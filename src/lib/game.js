/* eslint-disable prefer-promise-reject-errors */

module.exports = client => {
  // get needed libraries
  const moment = require('moment')
  const nameGenerator = require('project-name-generator')
  const EasyStar = require('easystarjs')
  const easystar = new EasyStar.js() // eslint-disable-line new-cap
  const SeedRandom = require('seedrandom')

  /** @namespace */
  client.game = {

    /**
       * Contains the user id's of everyone currently traveling
       */
    movementCooldown: new Map(),
    scoutCooldown: new Map(),

    /**
        * Create a database object for the guild
        * @param {Snowflake} uid a discord user id
       */
    createUser: async (uid) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry != null) return Promise.reject('User exist in database.')

      // calculate spawn position
      let xPos
      let yPos
      let mapEntry

      const create = async () => {
        xPos = Math.floor(Math.random() * (client.settings.game.map.xMax - client.settings.game.map.xMin) + client.settings.game.map.xMin)
        yPos = Math.floor(Math.random() * (client.settings.game.map.yMax - client.settings.game.map.yMin) + client.settings.game.map.yMin)
        mapEntry = await client.game.getTile(xPos, yPos)
        if (mapEntry.hasLock) await create()
      }

      await create()

      // set default user object
      const userObject = {
        uid: uid,
        xPos: xPos,
        yPos: yPos,
        gold: 200,
        empireName: null,
        flagURL: null,
        hasSettler: true,
        scoutedTiles: []
      }

      // write object to database
      client.database.collection('users').insertOne(userObject)

      return userObject
    },

    /**
     * Gets a tiles information
     * @param {Integer} xPos Position on map grid
     * @param {Integer} yPos Position on map grid
     */
    getTile: async (xPos, yPos) => {
      let city = await client.database.collection('cities').findOne({ xPos: xPos, yPos: yPos })
      const base = {
        xPos: xPos,
        yPos: yPos,
        city: null,
        hasLock: false,
        hasWonder: false
      }
      const props = {
        hasLock: 80 / 20,
        city: 85 / 15,
        hasWonder: 95 / 5
      }
      Object.keys(props)
        .forEach(x => {
          const isTrue = (Math.floor(SeedRandom(`seedx${xPos}y${yPos}${x}`)() * (props[x] - 2)) + 1) === 1
          if (isTrue) base[x] = true
        })

      if (!city && base.city === true) {
        city = {
          level: 1,
          xPos: xPos,
          yPos: yPos,
          inStasis: false,
          owner: null,
          name: nameGenerator({ words: 2 }).dashed,
          tradeRoutes: [],
          resources: {
            stone: Math.floor(Math.random() * 11),
            maxStone: 2000,
            metal: Math.floor(Math.random() * 11),
            maxMetal: 2000,
            wood: Math.floor(Math.random() * 11),
            maxWood: 2000,
            food: Math.floor(Math.random() * 30) + 10,
            maxFood: 3000
          },
          population: {
            military: Math.floor(Math.random() * 25) + 1,
            miners: Math.floor(Math.random() * 25) + 1,
            workers: Math.floor(Math.random() * 25) + 1,
            farmers: Math.floor(Math.random() * 25) + 1,
            unemployed: 0
          }
        }

        await client.database.collection('cities').insertOne(city)
      }

      base.city = city || null

      return base
    },

    /**
       * Gets all users tiles
       * @param {Snowflake} uid User's ID
       * @returns {Array<City>} Array of cities this user owns
       */
    getUserCities: async (uid) => {
      return client.database.collection('cities').find({ owner: uid }).toArray()
    },

    /**
    * Moves user to location
    * @param {Snowflake} uid a discord user id
    */
    stopUser: async (uid) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // get the collection
      const collection = await client.game.movementCooldown.get(uid)

      // does user have collection map
      if (!collection) return Promise.reject('User is not travelling.')

      // clear interval
      clearInterval(collection.interval)

      if (collection.timeout) clearTimeout(collection.timeout)

      // remove the collection
      client.game.movementCooldown.delete(uid)

      client.database.collection('movement').removeOne({ uid: uid })
      // resolve
      return Promise.resolve({ xPos: userEntry.xPos, yPos: userEntry.yPos })
    },

    /**
    * Moves user to location
    * @param {Snowflake} uid a discord user id
    * @param {Integer} xPos position on map grid
    * @param {Integer} yPos position on map grid
    */
    moveUser: async (uid, xPos, yPos) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      if (xPos === userEntry.xOis && yPos === userEntry.yPos) return Promise.reject('Already in this location')

      // check if tile exist
      const entry = await client.game.getTile(xPos, yPos)

      // check if movelock is set
      if (entry.hasLock) return Promise.reject('That land has a natural barrier.')

      // check if user is in cooldown
      if (client.game.movementCooldown.has(uid)) return Promise.reject('User is currently Travelling.')

      // check to make sure target is in bounds
      if (xPos > client.settings.game.map.xMax || xPos < client.settings.game.map.xMin) return Promise.reject('Invalid location.')
      if (yPos > client.settings.game.map.yMax || yPos < client.settings.game.map.yMin) return Promise.reject('Invalid location.')

      // calculate distance to target
      const path = await (() => {
        return new Promise(resolve => {
          easystar.findPath(userEntry.xPos, userEntry.yPos, xPos, yPos, (e) => { resolve(e) })
        })
      })()

      // calculate travel time to target and get tiles to target
      const travelTime = await client.game.calculateTravelTime(userEntry.xPos, userEntry.yPos, xPos, yPos)
      const travelTiles = path.length || 1
      const timePerCycle = Math.ceil(travelTime / travelTiles)
      let i = 0

      // add user to movement database
      client.database.collection('movement').replaceOne({ uid: uid }, {
        uid: uid,
        xPos: xPos,
        yPos: yPos
      }, { upsert: true })

      // add user to cooldown array and setup task
      const movementInterval = setInterval(() => {
        if (!path[i]) {
          clearInterval(movementInterval)
          return client.game.stopUser(uid)
        }
        client.database.collection('users').updateOne({ uid: uid }, { $set: { xPos: path[i].x, yPos: path[i].y } })
        i++
      }, timePerCycle)

      client.game.movementCooldown.set(uid, {
        startTime: moment().unix(),
        endTime: moment().unix() + travelTime,
        interval: movementInterval,
        xPos: xPos,
        yPos: yPos
      })

      // return resolve that timeout has been set
      return Promise.resolve(travelTime)
    },

    /**
    * Calculates travel time
    * @param {Integer} x1 position on map grid
    * @param {Integer} y1 position on map grid
    * @param {Integer} x2 position on map grid
    * @param {Integer} y2 position on map grid
    * @returns {Integer} in ms
    */
    calculateTravelTime: async (x1, y1, x2, y2) => {
      // distance formula from user to target
      const a = x1 - x2
      const b = y1 - y2
      const distance = Math.sqrt(a * a + b * b)

      // calculate time from distance
      const time = distance * 10

      // return time in milleseconds
      return Promise.resolve(Math.floor(time * 1000))
    },

    /**
    * Settles location of player if settler available
    * @param {Snowflake} uid User Discord ID
    * @param {String} name City name
    * @returns {City} City object
    */
    settleLocation: async (uid, name) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // check if tile exist
      const entry = await client.game.getTile(userEntry.xPos, userEntry.yPos)

      // check if city exist on tile
      if (entry.city != null) return Promise.reject('City exist on tile already.')

      // check if user has settler available
      if (!userEntry.hasSettler) return Promise.reject('User does not have available settler.')

      // check to make sure user doesnt already have a place named that
      const userCities = await client.game.getUserCities(uid)
      if (userCities.some(x => x.name === name)) return Promise.reject('User has a city named this already.')

      const cityObject = {
        level: 1,
        xPos: userEntry.xPos,
        yPos: userEntry.yPos,
        inStasis: false,
        owner: uid,
        name: name,
        tradeRoutes: [],
        resources: {
          stone: 0,
          maxStone: 2000,
          metal: 0,
          maxMetal: 2000,
          wood: 0,
          maxWood: 2000,
          food: 200,
          maxFood: 3000
        },
        population: {
          military: 0,
          miners: 0,
          workers: 0,
          farmers: 0,
          unemployed: 100
        }
      }

      // create city in map
      await client.database.collection('cities').insertOne(cityObject)

      // remove settler from user and add city to their city array
      await client.database.collection('users').updateOne({ uid: uid }, { $set: { hasSettler: false } })

      // resolve on completion
      return cityObject
    },

    /**
     * Removes a users city - jpb sucks at documentation
     * @param {Snowflake} uid Discord id
     * @param {Integer} xPos position map
     * @param {Integer} yPos position map
     */
    destroyCity: async (uid, xPos, yPos) => {
      // Check user exist in database
      const userEntry = client.game.database.colection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // Check user tile exist in database
      const mapEntry = client.game.getTile(xPos, yPos)
      if (!mapEntry.city || !mapEntry.city.owner) return Promise.reject('User does not own city')

      // save to database
      await client.database.collection('cities').removeOne({ xPos: xPos, yPos: yPos })
      await client.database.collection('users').updateOne({ uid: uid }, { $set: { hasSettler: true } })

      // resolve
      return Promise.resolve()
    },

    /**
    * Sets the flag of a user
    * @param {Snowflake} uid a discord user id
    * @param {String} url valid image url
    */
    setFlag: async (uid, url) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // set flag and return
      return client.database.collection('users').updateOne({ uid: uid }, { $set: { flagURL: url } })
    },

    /**
        * sets empire name
        * @param {Snowflake} uid a discord user id
        * @param {String} empireName name of empire
       */
    setEmpireName: async (uid, empireName) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // set empire name and return
      return client.database.collection('users').updateOne({ uid: uid }, { $set: { empireName: empireName } })
    },

    /**
    * Changes tiles cities name
    * @param {Snowflake} executor a discord user id of who executed
    * @param {Integer} xPos position on map grid
    * @param {Integer} yPos position on map grid
    * @param {String} name name of city
    */
    setCityName: async (executor, xPos, yPos, name) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: executor })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // check if tile exist
      const mapEntry = await client.game.getTile(xPos, yPos)
      if (mapEntry == null) return Promise.reject('Map tile does not exist in database.')

      // check if city exist
      if (mapEntry.city == null) return Promise.reject('City does not exist on tile.')

      // check if user owns city
      if (mapEntry.city.owner !== executor) return Promise.reject('User does not own city.')

      // rename city on map and write both to database
      await client.database.collection('cities').updateOne({ xPos: xPos, yPos: yPos }, { $set: { name: name } })

      // resolve
      Promise.resolve()
    },

    /**
        * Calculates next city level cost
        * @param {Integer} currentLevel the current level of what you want to check
       */
    calculateLevelCost: async (currentLevel) => {
      // formula is (3760.60309(1.63068)^x) with x being level
      const power = Math.pow(1.63068, currentLevel + 1)
      const cost = Math.floor(3760.60309 * power)

      // return cost
      return cost
    },

    /**
    * Calculates next city max population @ level
    * @param {Integer} level the level to run calculation with
    */
    calculateMaxPopulation: async (level) => {
      // calculate max population
      const maxPop = level * 1000

      // return cost
      return maxPop
    },

    /**
     * levels up a users city if they can afford it
     * @param {Snowflake} uid a discord user id
     * @param {Integer} xPos position on map grid
     * @param {Integer} yPos position on map grid
     */
    levelCity: async (uid, xPos, yPos) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // check if tile exist
      const mapEntry = await client.game.getTile(xPos, yPos)
      if (mapEntry == null) return Promise.reject('Map tile does not exist in database.')

      // check if city exist
      if (mapEntry.city == null) return Promise.reject('City does not exist on tile.')

      // check if user own city
      if (mapEntry.city.owner !== uid) return Promise.reject('User does not own city.')

      // get cost
      const cost = await client.game.calculateLevelCost(mapEntry.city.level)

      // check if user can afford
      if (userEntry.gold - cost < 0) return Promise.reject('User cannot afford to level!')

      // write changes
      await client.database.collection('users').updateOne({ uid: uid }, {
        $set: {
          gold: userEntry.gold - cost
        }
      })

      await client.database.collection('cities').updateOne({ xPos: xPos, yPos: yPos }, {
        $set: {
          level: mapEntry.city.level + 1,
          'resources.maxStone': mapEntry.city.level * 1.5 * 1000,
          'resources.maxMetal': mapEntry.city.level * 1.5 * 1000,
          'resources.maxWood': mapEntry.city.level * 1.5 * 1000,
          'resources.maxFood': mapEntry.city.level * 1.5 * 1000
        }
      })

      // resolve once finished
      return Promise.resolve(mapEntry.city.level + 1)
    },

    /**
     * moves work force between jobs at a settlement
     * @param {Snowflake} uid a discord user id
     * @param {Integer} xPos position on map grid
     * @param {Integer} yPos position on map grid
     * @param {String} origin original work force you want to modify
     * @param {String} target target work force you want to move original to
     * @param {Integer} amount amount to transition
     */
    changePopulationJob: async (uid, xPos, yPos, origin, target, amount) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // check if tile exist
      const mapEntry = await client.game.getTile(xPos, yPos)
      if (mapEntry == null) return Promise.reject('Map tile does not exist in database.')

      // check if city exist
      if (mapEntry.city == null) return Promise.reject('City does not exist on tile.')

      // check if user owns city
      if (mapEntry.city.owner !== uid) return Promise.reject('User does not own city.')

      // uniformize job names
      origin = origin.toLowerCase()
      target = target.toLowerCase()

      // check to make sure job exist
      const possibleJobs = ['military', 'workers', 'farmers', 'miners', 'unemployed']

      if (!possibleJobs.includes(origin)) return Promise.reject('Origin job does not exist.')
      if (!possibleJobs.includes(target)) return Promise.reject('Target job does not exist.')

      // check to make sure there are no shenanigans going on here
      if (amount <= 0) return Promise.reject('You must enter a value greater than 0.')
      if (mapEntry.city.population[origin] - amount < 0) return Promise.reject('You do not have enough people to do this.')

      mapEntry.city.population[origin] -= amount
      mapEntry.city.population[target] += amount

      // write to db
      await client.database.collection('cities').updateOne({ xPos: xPos, yPos: yPos }, { $set: { population: mapEntry.city.population } })

      return Promise.resolve()
    },

    /**
     * Scouts the tile the user is currently on
     * @param {Snowflake} uid discord id
     */
    calculateScoutTime: async (uid) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      let time
      if (userEntry.scoutedTiles.some(x => x.xPos === userEntry.xPos && x.yPos === userEntry.yPos)) {
        time = null
      } else {
        time = 60000
      }

      return Promise.resolve(time)
    },

    /**
     * Scouts the tile the user is currently on
     * @param {Snowflake} uid a discord user id
     */
    scoutTile: async (uid) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // check if tile exist
      const mapEntry = await client.game.getTile(userEntry.xPos, userEntry.yPos)

      // check if user is on cooldown
      if (client.game.scoutCooldown.has(uid)) return Promise.reject('User is currently scouting a tile.')

      // push tile to array and write to database
      let time
      if (userEntry.scoutedTiles.some(x => x.xPos === userEntry.xPos && x.yPos === userEntry.yPos)) {
        time = null
      } else {
        time = await client.game.calculateScoutTime(uid)
        await userEntry.scoutedTiles.push({ xPos: userEntry.xPos, yPos: userEntry.yPos })
        setTimeout(() => {
          // move user in database
          client.database.collection('users').updateOne({ uid: uid }, { $set: { scoutedTiles: userEntry.scoutedTiles } })
        }, time)
      }

      // add user to cooldown array and setup task
      client.game.scoutCooldown.set(uid, {
        startTime: moment().unix(),
        endTime: moment().unix() + time
      })

      setTimeout(() => {
        // remove user from cooldown array
        client.game.scoutCooldown.delete(uid)
      }, time)

      // resolve cooldown time and map entry
      return Promise.resolve({
        time: time,
        mapEntry: mapEntry
      })
    },

    /**
     * Generates the gold in the users cities
     * @param {Snowflake} uid Users discord id
     */
    generateGold: async (uid) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      const userCities = await client.game.getUserCities(uid)

      // write user to user database
      await client.database.collection('users').updateOne({ uid: uid }, {
        $set:
            {
              gold: userEntry.gold +
              userCities.map(x => x.population.miners)
                .reduce((a, b) => a + b, 0)
            }
      })

      // resolve once complete
      return Promise.resolve()
    },

    /**
     * Generates the food in the users cities
     * @param {Snowflake} uid Users discord id
     */
    generateFood: async (uid) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // for each city
      const userCities = await client.game.getUserCities(uid)
      userCities.forEach(async cityEntry => {
        // calculate generated food
        const generatedFood = Math.ceil(cityEntry.population.farmers * 1.5)

        // if they make more food then they can store, cap it
        if (cityEntry.resources.maxFood < cityEntry.resources.food + generatedFood) cityEntry.resources.food = cityEntry.resources.maxFood
        else cityEntry.resources.food += generatedFood

        // write city to map database
        await client.database.collection('cities').updateOne({ xPos: cityEntry.xPos, yPos: cityEntry.yPos }, { $set: cityEntry })
      })

      // resolve once complete
      return Promise.resolve()
    },

    /**
     * Generates the resource in the users cities
     * @param {Snowflake} uid Users discord id
     */
    generateResource: async (uid) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      const userCities = await client.game.getUserCities(uid)
      userCities.forEach(async cityEntry => {
        // calculate growth of resource
        if (cityEntry.resources.stone + cityEntry.population.workers > cityEntry.resources.maxStone) cityEntry.resources.stone = cityEntry.resources.maxStone
        else cityEntry.resources.stone += cityEntry.population.workers

        if (cityEntry.resources.metal + cityEntry.population.workers > cityEntry.resources.maxMetal) cityEntry.resources.metal = cityEntry.resources.maxMetal
        else cityEntry.resources.metal += cityEntry.population.workers

        if (cityEntry.resources.wood + cityEntry.population.workers > cityEntry.resources.maxWood) cityEntry.resources.wood = cityEntry.resources.maxWood
        else cityEntry.resources.wood += cityEntry.population.workers

        // write city to map database
        await client.database.collection('cities').updateOne({ xPos: cityEntry.xPos, yPos: cityEntry.yPos }, { $set: cityEntry })
      })

      // resolve once complete
      return Promise.resolve()
    },

    /**
     * Consume food function
     * @param {Snowflake} uid Users discord id
     */
    consumeFood: async (uid) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      const userCities = await client.game.getUserCities(uid)
      userCities.forEach(async cityEntry => {
        // get total population
        const totalPopulation = Object.values(cityEntry.population).reduce((a, b) => a + b, 0)

        // get total food
        const food = cityEntry.resources.food

        // if there is less food then there is population, remove some population, else add population
        if (food < totalPopulation) {
          // set food to 0 since they ate it all
          cityEntry.resources.food = 0

          // calculate popualtion loss
          const populationLoss = Math.abs(food - totalPopulation)

          // calculate population loss (percent based on jobs)
          Object.keys(cityEntry.population).forEach(key => {
            cityEntry.population[key] -= Math.ceil(populationLoss * (cityEntry.population[key] / totalPopulation))
          })
        } else if (food > totalPopulation) {
          // calculate popualtion growth
          const populationGrowth = Math.ceil(Math.abs((totalPopulation - food) / 2))

          // remove eaten food
          cityEntry.resources.food -= totalPopulation

          // add unemployed citizens to the population
          cityEntry.population.unemployed += populationGrowth
        }

        // write city to map database
        await client.database.collection('cities').updateOne({ xPos: cityEntry.xPos, yPos: cityEntry.yPos }, { $set: cityEntry })
      })

      // resolve once complete
      return Promise.resolve()
    },

    /**
     * Gets user cities based on page number
     * @param {Snowflake} uid
     * @param {Integer} pageNumber
     */
    getUserCityNames: async (uid, pageNumber) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      const userCities = await client.game.getUserCities(uid)

      let i = 0
      const outputArray = userCities.map(x => {
        i++
        return {
          index: i,
          name: x.name
        }
      })
        .slice((pageNumber - 1) * 5, pageNumber * 5)

      // resolve
      return Promise.resolve({ cities: outputArray, totalPages: Math.ceil(userCities.length / 5) })
    },

    getLeaderboard: async (by, pageNumber) => {
      const tempList = []

      if (by === 'city') {
        const cities = (await client.database.collection('cities').find({}).toArray()).filter(x => x.owner)
        cities.forEach(x => {
          if (!tempList[x.city.owner]) tempList[x.city.owner] = 0
          tempList[x.city.owner]++
        })
      } else if (by === 'gold') {
        const users = await client.database.collection('users').find({}).toArray()
        users.forEach(user => {
          tempList[user.uid] = user.gold
        })
      } else if (by === 'population') {
        const cities = (await client.database.collection('cities').find({}).toArray()).filter(x => x.owner)
        cities.forEach(city => {
          if (!tempList[city.owner]) tempList[city.owner] = 0
          tempList[city.owner] += city.population.reduce((a, b) => a + Object.values(b.population).reduce((c, d) => c + d, 0), 0)
        })
      }
      const sortedList = Object.keys(tempList).sort((a, b) => {
        if (tempList[a] > tempList[b]) return -1
        else if (tempList[a] < tempList[b]) return 1
        else return 0
      })
      let i = 0
      return {
        leaderboard: sortedList.map(x => {
          i++
          return {
            index: i,
            user: x
          }
        })
          .slice((pageNumber - 1) * 5, pageNumber * 5),
        totalPages: Math.ceil(sortedList.length / 5)
      }
    },

    /**
     * Gets the city by the name
     * @param {Snowflake} uid
     * @param {String} name
     */
    getCityByName: async (uid, name) => {
      const city = await client.database.collection('cities').findOne({ name: name, owner: uid })
      if (!city) return null
      return client.game.getTile(city.xPos, city.yPos)
    },

    /**
     * Creates a user alliance
     * @param {Snowflake} uid discord id
     * @param {String} name alliance name
     */
    createAlliance: async (uid, name) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // Check to see if alliance exist
      const allianceEntry = await client.database.collection('alliances').findOne({ name: new RegExp(`^${name}$`, 'i') })
      if (allianceEntry != null) return Promise.reject('Alliance exist in database.')

      // Setup alliance object
      const obj = {
        owner: uid,
        name: name,
        gold: 0,
        pendingApproval: [],
        members: []
      }

      // write to user and alliance database
      await client.database.collection('alliances').insertOne(obj)

      // resolve
      return Promise.resolve()
    },

    /**
     * Applies to alliance
     * @param {Snowflake} uid discord id
     * @param {String} name alliance name
     */
    applyToAlliance: async (uid, name) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // Check to see if alliance exist
      const allianceEntry = await client.database.collection('alliances').findOne({ name: name })
      if (allianceEntry == null) return Promise.reject('Alliance doest not exist in database.')

      // check to see if user is already applying to one
      const userApplicationSearch = await client.database.collection('alliances').findOne({
        $or: [
          {
            pendingApproval: {
              $elemMatch: {
                $in: [uid]
              }
            }
          },
          {
            members: {
              $elemMatch: {
                $in: [uid]
              }
            }
          },
          {
            owner: uid
          }
        ]
      })
      if (userApplicationSearch != null) return Promise.reject('User already in or applied to an alliance.')

      // add user to alliance array
      allianceEntry.pendingApproval.push(uid)

      // write to database
      client.database.collection('alliances').updateOne({ name: name }, { $set: { pendingApproval: allianceEntry.pendingApproval } })

      // resolve
      return Promise.resolve()
    },

    /**
     * Cancels alliance application
     * @param {Snowflake} uid discord id
     * @param {String} name alliance name
     */
    cancelAllianceApplication: async (uid) => {
      // check if user exists
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // Check to see if alliance exists and user has applied to it
      const allianceEntry = await client.database.collection('alliances').findOne({
        pendingApproval: {
          $elemMatch: {
            $in: [uid]
          }
        }
      })
      if (allianceEntry == null) return Promise.reject('User has not applied to an alliance.')

      // filter out target
      allianceEntry.pendingApproval.filter(e => e !== uid)

      // write to database
      await client.database.collection('alliances').updateOne({ name: allianceEntry.name }, { $set: { pendingApproval: allianceEntry.pendingApproval } })

      // resolve
      return Promise.resolve()
    },

    /**
     * Accepts user into alliance
     * @param {Snowflake} uid
     * @param {Snowflake} target
     */
    acceptToAlliance: async (uid, target) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // Check to see if alliance exist and user owns
      const allianceEntry = await client.database.collection('alliances').findOne({
        pendingApproval: {
          $elemMatch: {
            $in: [target]
          }
        }
      })

      if (allianceEntry == null) return Promise.reject('Alliance doest not exist in database.')
      if (allianceEntry.owner !== uid) return Promise.reject('User does not own alliance.')

      // check to see if user exist in alliance pending
      if (!allianceEntry.pendingApproval.includes(target)) return Promise.reject('User has not applied to alliance')

      // filter out target
      allianceEntry.pendingApproval.filter(e => e !== target)
      allianceEntry.members.push(target)

      // write to database
      await client.database.collection('alliances').updateOne({ name: allianceEntry.name }, { $set: { pendingApproval: allianceEntry.pendingApproval } })
      await client.database.collection('alliances').updateOne({ name: allianceEntry.name }, { $set: { members: allianceEntry.members } })

      // resolve
      return Promise.resolve()
    },

    /**
     * Denies user from alliance
     * @param {Snowflake} uid
     * @param {Snowflake} target
     */
    denyFromAlliance: async (uid, target) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // Check to see if alliance exist and user owns
      const allianceEntry = await client.database.collection('alliances').findOne({
        pendingApproval: {
          $elemMatch: {
            $in: [target]
          }
        }
      })

      if (allianceEntry == null) return Promise.reject('Alliance doest not exist in database.')
      if (allianceEntry.owner !== uid) return Promise.reject('User does not own alliance.')

      // check to see if user exist in alliance pending
      if (!allianceEntry.pendingApproval.includes(target)) return Promise.reject('User has not applied to alliance')

      // filter out target
      allianceEntry.pendingApproval.filter(e => e !== target)

      // write to database
      await client.database.collection('alliances').updateOne({ name: allianceEntry.name }, { $set: { pendingApproval: allianceEntry.pendingApproval } })

      // resolve
      return Promise.resolve()
    },

    /**
     * Gets the users alliance object
     * @param {Snowflake} uid
     */
    getAlliance: async (uid) => {
      // Check to see if alliance exist and user owns
      const allianceEntry = await client.database.collection('alliances').findOne({
        $or: [
          {
            members: {
              $elemMatch: {
                $in: [uid]
              }
            }
          },
          {
            owner: uid
          }
        ]
      })
      if (allianceEntry == null) return Promise.reject('User not in an alliance.')

      // resolve the object
      return Promise.resolve(allianceEntry)
    },

    /**
     * Makes user leave alliance
     * @param {Snowflake} uid
     */
    leaveAlliance: async (uid) => {
      // check if user exist
      const userEntry = await client.database.collection('users').findOne({ uid: uid })
      if (userEntry == null) return Promise.reject('User does not exist in database.')

      // Check to see if alliance exist and user owns
      const allianceEntry = await client.database.collection('alliances').findOne({
        members: {
          $elemMatch: {
            $in: [uid]
          }
        }
      })
      if (allianceEntry == null) return Promise.reject('User is not in an alliance.')
      if (allianceEntry.owner === uid) return Promise.reject('User currently owns alliance, you must disband to leave.')

      // remove user from alliance
      allianceEntry.members.filter(e => e !== uid)

      // write to database
      await client.database.collection('alliances').updateOne({ name: allianceEntry.name }, { $set: { members: allianceEntry.members } })

      // resolve
      return Promise.resolve()
    }
  }
}
