var Beaker = require('./beaker.js')

/* global Promise io */

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
      var txnLab = Object.assign(self, { txnSessionId: result.txnSessionId })
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
