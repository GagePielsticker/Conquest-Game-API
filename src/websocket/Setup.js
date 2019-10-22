const WebsocketManager = require('./WebsocketManager.js')

module.exports = client => {
  client.ws = new WebsocketManager(client)
  console.log(`${new Date()} Websocket started`)
}
