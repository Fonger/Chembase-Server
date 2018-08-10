const Database = require('./database')

const Lab = require('./handler/lab')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { app, io } = require('./handler/server')
const path = require('path')
const adminRoute = require('./admin/router')

io.set('transports', ['websocket'])

app.use(cors())

// parse application/x-www-form-urlencoded
// app.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
app.use(bodyParser.json())

app.get('/', function (req, res) {
  res.sendfile(path.join(__dirname, 'index.html'))
})

app.use('/sdk', express.static('sdk'))
app.use('/api/v1/admin', adminRoute)

// Use connect method to connect to the server
async function booting () {
  console.log('Booting Chembase Server ...')
  await Database.init()

  const Developer = Database.MainDB.collection('developers')
  const developers = await Developer.find({}).toArray()
  console.log(`There are ${developers.length} developer ${developers.length >= 2 ? 's' : ''}`)

  developers.forEach(developer => {
    console.log()
    console.log(`Developer ${developer.username}`)
    developer.labs.forEach(lab => new Lab(lab, developer))
  })
  console.log()
  console.log('Chembase server running successfully!')
}

booting()
