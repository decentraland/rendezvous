const fs = require('fs')

const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const app = express()
app.use(cors())

/**
 * Store all connections in place
 */
const connections = []

/**
 * This middleware sets up Server-Sent Events.
 */
const sse = (req, res, next) => {
  const connection = {
    uuid: req.params.uuid,
    res: res
  }

  // SSE protocol works by setting the `content-type` to `event-stream`
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  // Enrich the response object with the ability to send packets
  res.sseSend = (data) => {
    try {
      res.write('data: ' + JSON.stringify(data) + '\n\n')
    } catch (e) {
      connections.pop(connection)
      clearInterval(res.interval)
    }
  }

  // Setup an interval to keep the connection alive
  res.interval = setInterval(() => {
    res.sseSend({
      type: 'ping'
    })
  }, 5000)

  // Store the connection
  connections.push(connection)

  next()
}

app.use(bodyParser.json())

app.post('/announce', (req, res) => {
  const uuid = req.body.uuid

  const packet = {
    type: 'announce',
    uuid: uuid
  }

  connections.forEach((c) => {
    // Don't announce to self
    if (c.uuid !== uuid) {
      c.res.sseSend(packet)
    }
  })

  res.sendStatus(200)
})

app.post('/:uuid/signal', (req, res) => {
  const uuid = req.params.uuid

  const packet = {
    type: 'signal',
    initiator: req.body.initiator,
    data: req.body.data,
    uuid: req.body.uuid
  }

  const result = connections.filter((c) => c.uuid === uuid)

  result.forEach((c) => c.res.sseSend(packet))

  res.sendStatus(result.length ? 200 : 404)
})

app.get('/:uuid/listen', sse, (req, res) => {
  res.sseSend({
    type: 'accept'
  })
})

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`Listening on port ${port}...`))
