const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)

server.listen(8080)
module.exports = { app, io, server }
