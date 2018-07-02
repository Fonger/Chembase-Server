'use strict'

/*!
 * ignore
 */

/**
 * Object.prototype.toString.call helper
 */

var _toString = Object.prototype.toString
exports.toString = function (arg) {
  return _toString.call(arg)
}

/**
 * Determines if `arg` is an object.
 *
 * @param {Object|Array|String|Function|RegExp|any} arg
 * @return {Boolean}
 */

exports.isObject = function (arg) {
  return exports.toString(arg) === '[object Object]'
}

/**
 * Determines if `arg` is an array.
 *
 * @param {Object}
 * @return {Boolean}
 * @see nodejs utils
 */

exports.isArray = function (arg) {
  return Array.isArray(arg) ||
    (typeof arg === 'object' && exports.toString(arg) === '[object Array]')
}

/**
 * Object.keys helper
 */

exports.keys = Object.keys || function (obj) {
  var keys = []
  for (var k in obj) {
    if (obj.hasOwnProperty(k)) {
      keys.push(k)
    }
  }
  return keys
}

/**
 * Basic Object.create polyfill.
 * Only one argument is supported.
 *
 * Based on https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/create
 */

exports.create = typeof Object.create === 'function'
  ? Object.create
  : create

function create (proto) {
  if (arguments.length > 1) {
    throw new Error('Adding properties is not supported')
  }

  function F () {}
  F.prototype = proto
  return new F()
}

/**
 * inheritance
 */

exports.inherits = function (ctor, superCtor) {
  ctor.prototype = exports.create(superCtor.prototype)
  ctor.prototype.constructor = ctor
}

/**
 * Object.assign polyfill
 */

exports.assign = typeof Object.assign === 'function'
  ? Object.assign
  : assign

function assign (target, varArgs) {
  if (target == null) {
    throw new TypeError('Cannot convert undefined or null to object')
  }

  var to = Object(target)

  for (var index = 1; index < arguments.length; index++) {
    var nextSource = arguments[index]

    if (nextSource != null) {
      for (var nextKey in nextSource) {
        if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
          to[nextKey] = nextSource[nextKey]
        }
      }
    }
  }
  return to
}

/**
 * Check if this object is an arguments object
 *
 * @param {Any} v
 * @return {Boolean}
 */

exports.isArgumentsObject = function (v) {
  return Object.prototype.toString.call(v) === '[object Arguments]'
}
