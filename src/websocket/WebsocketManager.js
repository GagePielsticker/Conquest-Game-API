const WS = require('ws')
const EventEmitter = require('events')

class WebsocketManager extends EventEmitter {
  constructor (client) {
    super()
    this.client = client
    this.clients = new Map()

    this.ws = null
    this.start()
  }

  start () {
    this.ws = new WS.Server({ port: 1000 })
    this.clients.clear()
    this.handleEvents()
  }

  handleEvents () {
    this.ws.on('connection', ws => {
      this.handleConnection(ws)
    })
  }

  handleConnection (connection) {
    const wsID = new Date().getTime()
    console.log(`${new Date()} new websocket connection, ID: ${wsID}`)
    connection.id = wsID
    this.clients.set(wsID, connection)
    connection.on('close', (code, reason) => {
      console.log(`${new Date()} websocket connection closed, ID: ${wsID}; Code: ${code}, Reason: ${reason}`)
    })
    connection.on('message', (msg) => {
      const data = JSON.parse(msg)
      this.emit('raw', data)
      this.emit(data.event, data.data)

      if (data.event === 'heartbeat') this.ack(wsID)
    })
  }

  send (wsID, event, data) {
    if (wsID) {
      this._sendData(wsID,
        JSON.stringify(
          {
            event: event,
            data: data
          }
        )
      )
    } else {
      this.clients.forEach(client => {
        this._sendData(client.id,
          JSON.stringify(
            {
              event: event,
              data: data
            }
          )
        )
      })
    }
  }

  _sendData (wsID, data) {
    this.clients.get(wsID).send(data)
  }

  ack (wsID) {
    console.log(`${new Date()} Acknowleding heartbeat on client ${wsID}`)
    this.send(wsID, 'ack', { acknowldeged: true })
  }

  kill () {
    this.ws.close(1012, 'Shutdown')
  }
}

module.exports = WebsocketManager
