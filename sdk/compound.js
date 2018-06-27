/**
 * Compound. A document
 * @constructor
 * @param {string} id - A unique identifier for this Compound.
 */

/* global Promise */

/**
 * Dependencies
 */

var Buffer = require('buffer').Buffer
var BSON = require('bson')
var bson = new BSON()

function Compound () {
  if (arguments.length === 0) {
    this._rawData = null
    throw new Error('Not implemented')
  } else if (arguments.length === 1) {
    throw new Error('Not implemented')
    /* var compound = arguments[0]
    if (typeof compound !== 'object' || compound.constructor !== Object) { throw new Error('Compoubd must be created from a plain object') }
    this._parseData = compound
    this._rawData = bson.serialize(compound) */
  } else if (arguments.length === 2) {
    if (arguments[0].constructor.name !== 'Beaker') { throw new TypeError('Must specify a valid beaker') }
    this._beaker = arguments[0]
    this._rawData = Buffer.from(arguments[1])
    this._parseData = null
  } else {
    throw new Error('Invalid construcion')
  }
}

Compound.prototype.data = function () {
  if (this._parseData) return this._parseData
  this._parseData = bson.deserialize(this._rawData)
  return this._parseData
}

Compound.prototype.update = function (compoundData, replace) {
  var self = this
  var request = {
    beakerId: this._beaker.beakerId,
    _id: this.data()._id.toHexString(),
    data: bson.serialize(compoundData),
    replace: replace || false
  }
  var promise = new Promise(function (resolve, reject) {
    self._beaker._lab.socket.emit('update', request, function (err, result) {
      if (err) return reject(err)
      if (!result.data) return reject(new Error('This compound no longer exists'))

      /* merge update data back to _rawData */

      resolve(result.data)
    })
  })
  return promise
}

module.exports = Compound
