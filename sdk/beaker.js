var BSON = require('bson')
var Buffer = require('buffer').Buffer

var Query = require('./cquery')
var Compound = require('./compound')
var utils = require('./utils')
var bson = new BSON()

/* global Promise */

/**
 * Beaker constructor used for building queries.
 *
 * @param {Lab} lab
 * @param {String} beakerId
 * @api public
 */

function Beaker (lab, beakerId) {
  if (!(this instanceof Beaker)) { return new Beaker(lab, beakerId) }
  if (!lab || lab.constructor.name !== 'Lab') { throw new TypeError('Must specify a valid lab') }
  if (!beakerId) { throw new Error('Must specify beaker id') }

  this.beakerId = beakerId
  if (typeof lab.txnSessionId !== 'undefined') {
    this.txnSessionId = lab.txnSessionId
  }
  this._lab = lab
  this._subscriptionId = undefined
  this._changeHandler = undefined
  Query.call(this)
}

/*!
 * inherit cquery
 */

Beaker.prototype = utils.create(Query.prototype)
Beaker.prototype.constructor = Beaker

/**
 * Create a compound with given object.
 *
 * Passing a `callback` executes the query.
 *
 * ####Example
 *
 *     query.create({ name: 'Jennifer', age: 23 })
 *     query.create({ name: 'Jennifer', age: 23 }', callback)
 *
 * @param {Object} data compound data
 * @param {Function} [callback]
 * @return {Promise<Compound>} compound
 * @api public
 */

Beaker.prototype.create = function (data, callback) {
  var self = this

  var request = {
    beakerId: this.beakerId,
    data: bson.serialize(data)
  }

  if (this.txnSessionId) request.txnSessionId = this.txnSessionId
  var promise = new Promise(function (resolve, reject) {
    self._lab.socket.emit('create', request, function (err, result) {
      if (err) return reject(err)
      if (!result.data) return reject(new Error('This compound no longer exist'))
      var compound = new Compound(self, result.data)
      resolve(compound)
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

/**
 * Find compounds.
 *
 * Passing a `callback` executes the query.
 *
 * ####Example
 *
 *     query.find()
 *     query.find(callback)
 *
 * @param {Object} [criteria] mongodb selector
 * @param {Function} [callback]
 * @return {Query} this
 * @api public
 */

Beaker.prototype.find = function (callback) {
  this.op = 'find'

  if (!callback) return this

  var query = {
    beakerId: this.beakerId,
    conditions: bson.serialize(this._conditions),
    options: this.options
  }

  var self = this
  if (this.txnSessionId) query.txnSessionId = this.txnSessionId
  this._lab.socket.emit('find', query, function (err, result) {
    if (err) return callback(err)
    if (!result.data) return callback(new Error('No data'))

    var compounds = result.data.map(function (rawCompound) {
      return new Compound(self, rawCompound)
    })
    callback(null, compounds)
  })

  return this
}

/**
 * Get a compound with given id.
 *
 * Passing a `callback` executes the query.
 *
 * ####Example
 *
 *     query.get('myid')
 *     query.get('myid', callback)
 *
 * @param {String} id compound id
 * @param {Function} [callback]
 * @return {Promise<Compound>} compound
 * @api public
 */

Beaker.prototype.get = function (id, callback) {
  this.op = null

  var request = {
    beakerId: this.beakerId,
    _id: id
  }

  var self = this
  if (this.txnSessionId) request.txnSessionId = this.txnSessionId
  var promise = new Promise(function (resolve, reject) {
    self._lab.socket.emit('get', request, function (err, result) {
      if (err) return reject(err)
      if (!result.data) return callback(new Error('This compound no longer exist'))
      resolve(new Compound(self, result.data))
    })
  })

  if (callback) {
    promise.then(function (result) {
      callback(null, result)
    }, function (err) {
      callback(err)
    })
  }
  return promise
}

/**
 * Delete a compound with given id.
 *
 * Passing a `callback` executes the query.
 *
 * ####Example
 *
 *     query.delete('myid')
 *     query.delete('myid', callback)
 *
 * @param {String} id compound id
 * @param {Function} [callback]
 * @return {Promise<Compound>} compound
 * @api public
 */

Beaker.prototype.delete = function (id, callback) {
  this.op = null

  var request = {
    beakerId: this.beakerId,
    _id: id
  }

  var self = this
  if (this.txnSessionId) request.txnSessionId = this.txnSessionId
  var promise = new Promise(function (resolve, reject) {
    self._lab.socket.emit('delete', request, function (err, result) {
      if (err) return reject(err)
      if (!result.data) return callback(new Error('This compound no longer exist'))
      resolve(result.data)
    })
  })

  if (callback) {
    promise.then(function (result) {
      callback(null, result)
    }, function (err) {
      callback(err)
    })
  }
  return promise
}

/**
 * Executes the query returning a `Promise` which will be
 * resolved with either the molecular(s) or rejected with the error.
 *
 * @param {Function} [resolve]
 * @param {Function} [reject]
 * @return {Promise}
 * @api public
 */

Beaker.prototype.then = function (resolve, reject) {
  if (!this.op) throw new Error('No operation specify.')
  var self = this
  var promise = new Promise(function (resolve, reject) {
    self[self.op](function (err, result) {
      if (err) return reject(err)
      resolve(result)
    })
    self = null
  })
  return promise.then(resolve, reject)
}

/**
 * subscribe query compounds
 *
 * Passing a `callback` executes the query.
 *
 * ####Example
 *
 *     query.subscribe(callback)
 *
 * @param {Function} callback change event callback
 * @return {Promise<SubscriptionResult>} return a promise resolved with SubscriptionResult
 * @api public
 */

Beaker.prototype.subscribe = function (callback) {
  if (!callback) throw new Error('Must have a event callback')
  if (this._subscriptionId) throw new Error('This beaker has a subscription already. Only one subscription per beaker is allowed.')

  var query = {
    beakerId: this.beakerId,
    conditions: bson.serialize(this._conditions)
  }

  var self = this

  var promise = new Promise(function (resolve, reject) {
    self._lab.socket.emit('subscribe', query, function (err, result) {
      if (err) return reject(err)
      if (!result.data) return reject(new Error('No data'))

      self._subscriptionId = result.data.subscriptionId
      self._changeHandler = function (err, change) {
        if (err) return callback(err)
        callback(null, bson.deserialize(Buffer.from(change)))
      }

      self._lab.socket.on('change' + self._subscriptionId, self._changeHandler)
      resolve(result.data)
    })
  })

  return promise
}

/**
 * Unsubscribe query compounds.
 *
 * ####Example
 *
 *     query.unsubscribe()
 *     query.unsubscribe(callback)
 *     query.unsubscribe().then(...)
 *
 * @param {Object} [criteria] mongodb selector
 * @param {Function} [callback]
 * @return {Promise<UnsubscribeResult>} return a promise resolved with UnsubscriptionResult
 * @api public
 */

Beaker.prototype.unsubscribe = function (callback) {
  if (typeof this._subscriptionId === 'undefined') throw new Error('This beaker does not have a subscription')

  this.op = null

  var request = {
    beakerId: this.beakerId,
    subscriptionId: this._subscriptionId
  }

  var self = this
  self._lab.socket.removeListener('change' + self._subscriptionId, self._changeHandler)

  var promise = new Promise(function (resolve, reject) {
    self._lab.socket.emit('unsubscribe', request, function (err, result) {
      if (err) return reject(err)
      self._subscriptionId = undefined
      resolve(result)
    })
  })

  if (callback) {
    promise.then(function (result) {
      callback(null, result)
    }, function (err) {
      callback(err)
    })
  }
  return promise
}

module.exports = Beaker
