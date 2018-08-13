const MongoClient = require('mongodb').MongoClient
const mongoose = require('mongoose')
const url = 'mongodb://localhost:27017/main'
const mainDBName = 'main'
const options = {
  auth: {
    user: 'chembaseroot',
    password: 'chembase-root-test-germany'
  },
  authSource: 'admin',
  replicaSet: 'chembase-rs0',
  useNewUrlParser: true,
  poolSize: 1000
}

mongoose.Promise = Promise

let _mongoClient
async function init () {
  await mongoose.connect(url, options)
  _mongoClient = await MongoClient.connect(url, options)
  return _mongoClient
}

module.exports = {
  init: init,
  get MongoClient () {
    return _mongoClient
  },
  get MainDB () {
    return _mongoClient.db(mainDBName)
  },
  Developer: require('./developer')
}
