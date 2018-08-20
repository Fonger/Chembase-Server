const express = require('express')
const app = express()
const fs = require('fs')
const path = require('path')
const https = require('https')

var server = https.createServer({
  cert: fs.readFileSync(path.join(process.env.HOME, 'chembase-cert.pem')),
  key: fs.readFileSync(path.join(process.env.HOME, 'chembase-key.pem'))
}, app)

server.listen(8080)

const io = require('socket.io')(server)

module.exports = { app, io, server }
