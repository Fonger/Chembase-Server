const Database = require('./Controllers/Database')

const Lab = require('./Controllers/Lab')
const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const path = require('path')

server.listen(8080)

io.set('transports', ['websocket'])

app.get('/', function (req, res) {
  res.sendfile(path.join(__dirname, 'index.html'))
})

app.use('/sdk', express.static('sdk'))
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  next()
})

let labMap = new Map()

// Use connect method to connect to the server
async function booting () {
  console.log('Booting Chembase Server ...')
  const mongoClient = await Database.init()
  const Developer = Database.MainDB.collection('developers')
  const developers = await Developer.find({}).toArray()
  console.log(mongoClient)
  console.log(`There are ${developers.length} developer ${developers.length >= 2 ? 's' : ''}`)

  developers.forEach(developer => {
    console.log()
    console.log(`Developer ${developer.username}`)
    developer.labs.forEach(lab => {
      labMap.set('lab.id', new Lab(lab, developer, io))
    })
  })
  console.log()
  console.log('Chembase server running successfully!')
}

booting()
