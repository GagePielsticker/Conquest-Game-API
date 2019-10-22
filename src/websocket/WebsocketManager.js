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
    this.ws = new WS.Server({ port: this.client.settings.ws.port })
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
    connection.hello = false
    this.clients.set(wsID, connection)
    connection.on('close', (code, reason) => {
      console.log(`${new Date()} websocket connection closed, ID: ${wsID}; Code: ${code}, Reason: ${reason}`)
      this.clients.delete(wsID)
    })
    connection.on('error', () => {
      this.clients.delete(wsID)
    })
    connection.on('message', (msg) => {
      const data = JSON.parse(msg)
      this.emit('raw', data)
      this.emit(data.event, data.data)

      if (data.event === 'hello') {
        const newConnect = this.clients.get(wsID)
        newConnect.hello = true
        this.clients.set(wsID, newConnect)
      }
      if (data.event === 'heartbeat') this.ack(wsID)
    })
    this.handleHello(connection)
  }

  handleHello (connection) {
    this.send(connection.id, 'hello', {
      id: connection.id,
      hb: this.client.settings.ws.heartbeat_interval
    })
    setTimeout(() => {
      const con = this.clients.get(connection.id)
      if (!con || !con.hello) {
        console.log(`${new Date()} Never received hello on ${connection.id}. Closed.`)
        connection.close()
      } else {
        console.log(`${new Date()} received hello event on ${connection.id}. Connecting finished.`)
      }
    }, 5000)
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
    console.log(`${new Date()} Acknowledging heartbeat on client ${wsID}`)
    this.send(wsID, 'ack', { acknowldeged: true })
  }

  kill () {
    this.ws.close(1012, 'Shutdown')
  }
}

module.exports = WebsocketManager
