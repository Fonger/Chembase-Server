/* global io Promise */
if (typeof io === 'undefined') throw new Error('socket.io is required to be loaded before chembase sdk')
var Beaker = require('./beaker.js')

var Lab = function (options) {
  this.sessionId = undefined
  this.socket = io('http://localhost:8080/' + options.labId, {
    query: {
      apiKey: options.apiKey
    },
    transports: ['websocket'],
    upgrade: false
  })

  this.socket.on('reconnect_attempt', function () {
    // socket.io.opts.query.sessionId = this.sessionId;
    console.log('reconnect attempt')
  })
  this.socket.on('error', function (err) {
    console.log(err)
  })
}

Lab.prototype.login = function (data, callback) {
  console.log('login start')
  var self = this
  var promise = new Promise(function (resolve, reject) {
    self.socket.emit('login', data, function (err, result) {
      if (err) return reject(err)
      resolve(result)
      console.log('login result', result)
    })
  })
  if (callback) {
    return promise.then(function (result) {
      callback(null, result)
    }, function (err) {
      callback(err)
    })
  }
  return promise
}

Lab.prototype.register = function (data, callback) {
  console.log('register start')
  var self = this
  var promise = new Promise(function (resolve, reject) {
    self.socket.emit('register', data, function (err, result) {
      if (err) return reject(err)
      resolve(result)
      console.log('register result', result)
    })
  })
  if (callback) {
    return promise.then(function (result) {
      callback(null, result)
    }, function (err) {
      callback(err)
    })
  }
  return promise
}

Lab.prototype.beaker = function (id) {
  return new Beaker(this, id)
}
window.Chembase = {
  Lab: Lab,
  Beaker: Beaker
}
