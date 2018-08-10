var Beaker = require('./beaker.js')
var utils = require('./utils')

/* global Promise io */

var Lab = function (options) {
  this.sessionId = undefined
  var socket = io('http://localhost:8080/labs/' + options.labId, {
    query: {
      apiKey: options.apiKey
    },
    transports: ['websocket'],
    upgrade: false,
    reconnectionDelay: 6000,
    reconnectionAttempts: 10
  })
  this.socketId = undefined
  var self = this
  socket.on('connect', function () {
    self.socketId = socket.id
  })
  socket.on('reconnect_attempt', function () {
    socket.io.opts.query.oldSocketId = self.socketId
    console.log('reconnect attempt')
  })
  socket.on('reconnecting', function (attemptNumber) {
    console.log('reconnecting...', attemptNumber)
  })
  socket.on('reconnect', function () {
    console.log('reconnect success', socket.id)
  })
  socket.on('disconnect', function (reason) {
    console.log('disconnect reason', reason)
  })
  socket.on('reconnect_error', function (err) {
    console.error(err)
  })
  socket.on('reconnect_failed', function () {
    console.error('reconnect failed. give up.')
  })
  socket.on('ping', function () {
    console.log('ping!')
  })
  socket.on('pong', function (ms) {
    console.log('pong!', ms)
  })
  socket.on('error', function (err) {
    console.log(err)
  })
  this.socket = socket
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

Lab.prototype.logout = function (data, callback) {
  console.log('logout start')
  var self = this
  var promise = new Promise(function (resolve, reject) {
    self.socket.emit('logout', data, function (err, result) {
      if (err) return reject(err)
      resolve(result)
      console.log('logout result', result)
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

Lab.prototype.verify = function (id, verifyCode, callback) {
  var self = this
  var promise = new Promise(function (resolve, reject) {
    self.socket.emit('verify', { id: id, method: 'email', verifyCode: verifyCode }, function (err, user) {
      if (err) return reject(err)
      resolve(user)
      console.log('verify user', user)
    })
  })
  if (callback) {
    return promise.then(function (user) {
      callback(null, user)
    }, function (err) {
      callback(err)
    })
  }
  return promise
}

Lab.prototype.changePassword = function (newPassword, callback) {
  var self = this
  var promise = new Promise(function (resolve, reject) {
    self.socket.emit('changePassword', { method: 'email', password: newPassword }, function (err, user) {
      if (err) return reject(err)
      resolve(user)
      console.log('change password', user)
    })
  })
  if (callback) {
    return promise.then(function (user) {
      callback(null, user)
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

Lab.prototype.synthesize = function (txnFunc) {
  var self = this
  var promise = new Promise(function (resolve, reject) {
    self.socket.emit('txn_start', {}, function (err, result) {
      if (err) return reject(err)
      // TODO polyfill
      var txnLab = utils.assign(self, { txnSessionId: result.txnSessionId })
      txnFunc(txnLab)
        .then(function (customResult) {
          self.socket.emit('txn_commit', { txnSessionId: txnLab.txnSessionId }, function (err, result) {
            if (err) return reject(err)
            console.log('txn commit result', result)
            resolve(customResult)
          })
        })
        .catch(function (customError) {
          self.socket.emit('txn_abort', { txnSessionId: txnLab.txnSessionId }, function (err, result) {
            if (err) console.log(err)
            else console.log('txn abort result', result)
            reject(customError)
          })
        })
    })
  })
  return promise
}

module.exports = Lab
