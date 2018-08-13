'use strict'
/* global Map Promise */

/**
 * Dependencies
 */

var slice = Array.prototype.slice.call
var utils = require('./utils')

/**
 * Query constructor used for building queries.
 *
 * ####Example:
 *
 *     var query = new Query();
 *     query.where('age').gte(21).exec(callback);
 *
 * @param {Object} [options]
 * @api public
 * @class
 */

function Query (options) {
  if (!(this instanceof Query)) { return new Query(options) }

  var proto = this.constructor.prototype

  this.op = proto.op || undefined

  this.options = {}
  this._conditions = {}

  this._path = proto._path || undefined
  this._distinct = proto._distinct || undefined
  this._collection = proto._collection || undefined
  this._traceFunction = proto._traceFunction || undefined

  if (options) {
    this.setOptions(options)
  }
}

/**
 * Specifies a `path` for use with chaining.
 *
 * ####Example
 *
 *     // instead of writing:
 *     User.find({age: {$gte: 21, $lte: 65}}, callback);
 *
 *     // we can instead write:
 *     User.where('age').gte(21).lte(65);
 *
 *     // chaining
 *     User
 *     .where('age').gte(21).lte(65)
 *     .where('name', /^vonderful/i)
 *     .exec(callback)
 *
 * @param {String} path
 * @return {Query} this
 * @api public
 */

Query.prototype.where = function (path) {
  if (!this.op) this.op = 'find'

  if (typeof path === 'string') {
    this._path = path
    return this
  }

  throw new TypeError('path must be a string')
}

/**
 * Specifies the complementary comparison value for paths specified with `where()`
 *
 * ####Example
 *
 *     User.where('age').equals(49);
 *
 * @param {Object} val
 * @return {Query} this
 * @api public
 */

Query.prototype.equals = function equals (val) {
  this._ensurePath('equals')
  var path = this._path
  this._conditions[path] = val
  return this
}

/**
 * Specifies the complementary comparison value for paths specified with `where()`
 * This is alias of `equals`
 *
 * ####Example
 *
 *     User.where('age').eq(49);
 *
 *     // is the same as
 *
 *     User.shere('age').equals(49);
 *
 *     // is the same as
 *
 *     User.where('age', 49);
 *
 * @param {Object} val
 * @return {Query} this
 * @api public
 */

Query.prototype.eq = function eq (val) {
  this._ensurePath('eq')
  var path = this._path
  this._conditions[path] = val
  return this
}

/**
 * Specifies arguments for an `$or` condition.
 *
 * ####Example
 *
 *     query.or([{ color: 'red' }, { status: 'emergency' }])
 *
 * @param {Array} array array of conditions
 * @return {Query} this
 * @api public
 */

Query.prototype.or = function or (array) {
  var or = this._conditions.$or || (this._conditions.$or = [])
  if (!utils.isArray(array)) array = [array]
  or.push.apply(or, array)
  return this
}

/**
 * Specifies arguments for a `$nor` condition.
 *
 * ####Example
 *
 *     query.nor([{ color: 'green' }, { status: 'ok' }])
 *
 * @param {Array} array array of conditions
 * @return {Query} this
 * @api public
 */

Query.prototype.nor = function nor (array) {
  var nor = this._conditions.$nor || (this._conditions.$nor = [])
  if (!utils.isArray(array)) array = [array]
  nor.push.apply(nor, array)
  return this
}

/**
 * Specifies arguments for a `$and` condition.
 *
 * ####Example
 *
 *     query.and([{ color: 'green' }, { status: 'ok' }])
 *
 * @see $and http://docs.mongodb.org/manual/reference/operator/and/
 * @param {Array} array array of conditions
 * @return {Query} this
 * @api public
 */

Query.prototype.and = function and (array) {
  var and = this._conditions.$and || (this._conditions.$and = [])
  if (!Array.isArray(array)) array = [array]
  and.push.apply(and, array)
  return this
}

/**
 * Specifies a $gt query condition.
 *
 * When called with one argument, the most recent path passed to `where()` is used.
 *
 * ####Example
 *
 *     Thing.find().where('age').gt(21)
 *
 *     // or
 *     Thing.find().gt('age', 21)
 *
 * @method gt
 * @memberOf Query
 * @param {String} [path]
 * @param {Number} val
 * @api public
 */

/**
 * Specifies a $gte query condition.
 *
 * When called with one argument, the most recent path passed to `where()` is used.
 *
 * @method gte
 * @memberOf Query
 * @param {String} [path]
 * @param {Number} val
 * @api public
 */

/**
 * Specifies a $lt query condition.
 *
 * When called with one argument, the most recent path passed to `where()` is used.
 *
 * @method lt
 * @memberOf Query
 * @param {String} [path]
 * @param {Number} val
 * @api public
 */

/**
 * Specifies a $lte query condition.
 *
 * When called with one argument, the most recent path passed to `where()` is used.
 *
 * @method lte
 * @memberOf Query
 * @param {String} [path]
 * @param {Number} val
 * @api public
 */

/**
 * Specifies a $ne query condition.
 *
 * When called with one argument, the most recent path passed to `where()` is used.
 *
 * @method ne
 * @memberOf Query
 * @param {String} [path]
 * @param {Number} val
 * @api public
 */

/**
 * Specifies an $in query condition.
 *
 * When called with one argument, the most recent path passed to `where()` is used.
 *
 * @method in
 * @memberOf Query
 * @param {String} [path]
 * @param {Number} val
 * @api public
 */

/**
 * Specifies an $nin query condition.
 *
 * When called with one argument, the most recent path passed to `where()` is used.
 *
 * @method nin
 * @memberOf Query
 * @param {String} [path]
 * @param {Number} val
 * @api public
 */

/**
 * Specifies an $all query condition.
 *
 * When called with one argument, the most recent path passed to `where()` is used.
 *
 * @method all
 * @memberOf Query
 * @param {String} [path]
 * @param {Number} val
 * @api public
 */

/**
 * Specifies a $size query condition.
 *
 * When called with one argument, the most recent path passed to `where()` is used.
 *
 * @method size
 * @memberOf Query
 * @param {String} [path]
 * @param {Number} val
 * @api public
 */

/**
 * Specifies a $regex query condition.
 *
 * When called with one argument, the most recent path passed to `where()` is used.
 *
 * @method regex
 * @memberOf Query
 * @param {String} [path]
 * @param {String|RegExp} val
 * @api public
 */

/**
 * Specifies a $maxDistance query condition.
 *
 * When called with one argument, the most recent path passed to `where()` is used.
 *
 * @method maxDistance
 * @memberOf Query
 * @param {String} [path]
 * @param {Number} val
 * @api public
 */

/*!
 * gt, gte, lt, lte, ne, in, nin, all, regex, size, maxDistance
 *
 *     Thing.where('type').nin(array)
 */

'gt gte lt lte ne in nin all regex size maxDistance minDistance'.split(' ').forEach(function ($conditional) {
  Query.prototype[$conditional] = function () {
    var path, val

    if (arguments.length === 1) {
      this._ensurePath($conditional)
      val = arguments[0]
      path = this._path
    } else {
      val = arguments[1]
      path = arguments[0]
    }

    var conds = this._conditions[path] === null || typeof this._conditions[path] === 'object'
      ? this._conditions[path]
      : (this._conditions[path] = {})
    conds['$' + $conditional] = val
    return this
  }
})

/**
 * Specifies a `$mod` condition
 *
 * @param {String} [path]
 * @param {Number} divisor
 * @param {Number} remainder
 * @return {Query} this
 * @api public
 */

Query.prototype.mod = function () {
  var val, path

  if (arguments.length === 1) {
    this._ensurePath('mod')
    val = arguments[0]
    path = this._path
  } else if (arguments.length === 2 && !utils.isArray(arguments[1])) {
    this._ensurePath('mod')
    val = slice(arguments)
    path = this._path
  } else if (arguments.length === 3) {
    val = slice(arguments, 1)
    path = arguments[0]
  } else {
    val = arguments[1]
    path = arguments[0]
  }

  var conds = this._conditions[path] || (this._conditions[path] = {})
  conds.$mod = val
  return this
}

/**
 * Specifies an `$exists` condition
 *
 * ####Example
 *
 *     // { name: { $exists: true }}
 *     Thing.where('name').exists()
 *     Thing.where('name').exists(true)
 *     Thing.find().exists('name')
 *
 *     // { name: { $exists: false }}
 *     Thing.where('name').exists(false);
 *     Thing.find().exists('name', false);
 *
 * @param {String} [path]
 * @param {Number} val
 * @return {Query} this
 * @api public
 */

Query.prototype.exists = function () {
  var path, val

  if (arguments.length === 0) {
    this._ensurePath('exists')
    path = this._path
    val = true
  } else if (arguments.length === 1) {
    if (typeof arguments[0] === 'boolean') {
      this._ensurePath('exists')
      path = this._path
      val = arguments[0]
    } else {
      path = arguments[0]
      val = true
    }
  } else if (arguments.length === 2) {
    path = arguments[0]
    val = arguments[1]
  }

  var conds = this._conditions[path] || (this._conditions[path] = {})
  conds.$exists = val
  return this
}

/**
 * Specifies an `$elemMatch` condition
 *
 * ####Example
 *
 *     query.elemMatch('comment', { author: 'autobot', votes: {$gte: 5}})
 *
 *     query.where('comment').elemMatch({ author: 'autobot', votes: {$gte: 5}})
 *
 *     query.elemMatch('comment', function (elem) {
 *       elem.where('author').equals('autobot');
 *       elem.where('votes').gte(5);
 *     })
 *
 *     query.where('comment').elemMatch(function (elem) {
 *       elem.where({ author: 'autobot' });
 *       elem.where('votes').gte(5);
 *     })
 *
 * @param {String|Object|Function} path
 * @param {Object|Function} criteria
 * @return {Query} this
 * @api public
 */

Query.prototype.elemMatch = function () {
  if (arguments[0] == null) { throw new TypeError('Invalid argument') }

  var fn, path, criteria

  if (typeof arguments[0] === 'function') {
    this._ensurePath('elemMatch')
    path = this._path
    fn = arguments[0]
  } else if (utils.isObject(arguments[0])) {
    this._ensurePath('elemMatch')
    path = this._path
    criteria = arguments[0]
  } else if (typeof arguments[1] === 'function') {
    path = arguments[0]
    fn = arguments[1]
  } else if (arguments[1] && utils.isObject(arguments[1])) {
    path = arguments[0]
    criteria = arguments[1]
  } else {
    throw new TypeError('Invalid argument')
  }

  if (fn) {
    criteria = new Query()
    fn(criteria)
    criteria = criteria._conditions
  }

  var conds = this._conditions[path] || (this._conditions[path] = {})
  conds.$elemMatch = criteria
  return this
}

// Spatial queries

/**
 * Sugar for geo-spatial queries.
 *
 * ####Example
 *
 *     query.within().box()
 *     query.within().circle()
 *     query.within().geometry()
 *
 *     query.where('loc').within({ center: [50,50], radius: 10, unique: true, spherical: true });
 *     query.where('loc').within({ box: [[40.73, -73.9], [40.7, -73.988]] });
 *     query.where('loc').within({ polygon: [[],[],[],[]] });
 *
 *     query.where('loc').within([], [], []) // polygon
 *     query.where('loc').within([], []) // box
 *     query.where('loc').within({ type: 'LineString', coordinates: [...] }); // geometry
 *
 * ####NOTE:
 *
 * Must be used after `where()`.
 *
 * @memberOf Query
 * @return {Query} this
 * @api public
 */

Query.prototype.within = function within () {
  // opinionated, must be used after where
  this._ensurePath('within')
  this._geoComparison = '$geoWithin'

  if (arguments.length === 0) {
    return this
  }

  if (arguments.length === 2) {
    return this.box.apply(this, arguments)
  } else if (arguments.length > 2) {
    return this.polygon.apply(this, arguments)
  }

  var area = arguments[0]

  if (!area) { throw new TypeError('Invalid argument') }

  if (area.center) { return this.circle(area) }

  if (area.box) { return this.box.apply(this, area.box) }

  if (area.polygon) { return this.polygon.apply(this, area.polygon) }

  if (area.type && area.coordinates) { return this.geometry(area) }

  throw new TypeError('Invalid argument')
}

/**
 * Specifies a $box condition
 *
 * ####Example
 *
 *     var lowerLeft = [40.73083, -73.99756]
 *     var upperRight= [40.741404,  -73.988135]
 *
 *     query.where('loc').within().box(lowerLeft, upperRight)
 *     query.box('loc', lowerLeft, upperRight )
 *
 * @see http://www.mongodb.org/display/DOCS/Geospatial+Indexing
 * @see Query#within #query_Query-within
 * @param {String} path
 * @param {Object} val
 * @return {Query} this
 * @api public
 */

Query.prototype.box = function () {
  var path, box

  if (arguments.length === 3) {
    // box('loc', [], [])
    path = arguments[0]
    box = [arguments[1], arguments[2]]
  } else if (arguments.length === 2) {
    // box([], [])
    this._ensurePath('box')
    path = this._path
    box = [arguments[0], arguments[1]]
  } else {
    throw new TypeError('Invalid argument')
  }

  var conds = this._conditions[path] || (this._conditions[path] = {})
  conds[this._geoComparison || '$geoWithin'] = { '$box': box }
  return this
}

/**
 * Specifies a $polygon condition
 *
 * ####Example
 *
 *     query.where('loc').within().polygon([10,20], [13, 25], [7,15])
 *     query.polygon('loc', [10,20], [13, 25], [7,15])
 *
 * @param {String|Array} [path]
 * @param {Array|Object} [val]
 * @return {Query} this
 * @see http://www.mongodb.org/display/DOCS/Geospatial+Indexing
 * @api public
 */

Query.prototype.polygon = function () {
  var val, path

  if (typeof arguments[0] === 'string') {
    // polygon('loc', [],[],[])
    path = arguments[0]
    val = slice(arguments, 1)
  } else {
    // polygon([],[],[])
    this._ensurePath('polygon')
    path = this._path
    val = slice(arguments)
  }

  var conds = this._conditions[path] || (this._conditions[path] = {})
  conds[this._geoComparison || '$geoWithin'] = { '$polygon': val }
  return this
}

/**
 * Specifies a $center or $centerSphere condition.
 *
 * ####Example
 *
 *     var area = { center: [50, 50], radius: 10, unique: true }
 *     query.where('loc').within().circle(area)
 *     query.center('loc', area);
 *
 *     // for spherical calculations
 *     var area = { center: [50, 50], radius: 10, unique: true, spherical: true }
 *     query.where('loc').within().circle(area)
 *     query.center('loc', area);
 *
 * @param {String} [path]
 * @param {Object} area
 * @return {Query} this
 * @see http://www.mongodb.org/display/DOCS/Geospatial+Indexing
 * @api public
 */

Query.prototype.circle = function () {
  var path, val

  if (arguments.length === 1) {
    this._ensurePath('circle')
    path = this._path
    val = arguments[0]
  } else if (arguments.length === 2) {
    path = arguments[0]
    val = arguments[1]
  } else {
    throw new TypeError('Invalid argument')
  }

  if (!('radius' in val && val.center)) { throw new Error('center and radius are required') }

  var conds = this._conditions[path] || (this._conditions[path] = {})

  var type = val.spherical
    ? '$centerSphere'
    : '$center'

  var wKey = this._geoComparison || '$geoWithin'
  conds[wKey] = {}
  conds[wKey][type] = [val.center, val.radius]

  if ('unique' in val) { conds[wKey].$uniqueDocs = !!val.unique }

  return this
}

/**
 * Specifies a `$near` or `$nearSphere` condition
 *
 * These operators return documents sorted by distance.
 *
 * ####Example
 *
 *     query.where('loc').near({ center: [10, 10] });
 *     query.where('loc').near({ center: [10, 10], maxDistance: 5 });
 *     query.where('loc').near({ center: [10, 10], maxDistance: 5, spherical: true });
 *     query.near('loc', { center: [10, 10], maxDistance: 5 });
 *     query.near({ center: { type: 'Point', coordinates: [..] }})
 *     query.near().geometry({ type: 'Point', coordinates: [..] })
 *
 * @param {String} [path]
 * @param {Object} val
 * @return {Query} this
 * @see http://www.mongodb.org/display/DOCS/Geospatial+Indexing
 * @api public
 */

Query.prototype.near = function near () {
  var path, val

  this._geoComparison = '$near'

  if (arguments.length === 0) {
    return this
  } else if (arguments.length === 1) {
    this._ensurePath('near')
    path = this._path
    val = arguments[0]
  } else if (arguments.length === 2) {
    path = arguments[0]
    val = arguments[1]
  } else {
    throw new TypeError('Invalid argument')
  }

  if (!val.center) {
    throw new Error('center is required')
  }

  var conds = this._conditions[path] || (this._conditions[path] = {})

  var type = val.spherical
    ? '$nearSphere'
    : '$near'

  // center could be a GeoJSON object or an Array
  if (Array.isArray(val.center)) {
    conds[type] = val.center

    var radius = 'maxDistance' in val
      ? val.maxDistance
      : null

    if (radius != null) {
      conds.$maxDistance = radius
    }
    if (val.minDistance != null) {
      conds.$minDistance = val.minDistance
    }
  } else {
    // GeoJSON?
    if (val.center.type !== 'Point' || !Array.isArray(val.center.coordinates)) {
      throw new Error('Invalid GeoJSON specified for ' + type)
    }
    conds[type] = { $geometry: val.center }

    // MongoDB 2.6 insists on maxDistance being in $near / $nearSphere
    if ('maxDistance' in val) {
      conds[type]['$maxDistance'] = val.maxDistance
    }
    if ('minDistance' in val) {
      conds[type]['$minDistance'] = val.minDistance
    }
  }

  return this
}

/**
 * Declares an intersects query for `geometry()`.
 *
 * ####Example
 *
 *     query.where('path').intersects().geometry({
 *         type: 'LineString'
 *       , coordinates: [[180.0, 11.0], [180, 9.0]]
 *     })
 *
 *     query.where('path').intersects({
 *         type: 'LineString'
 *       , coordinates: [[180.0, 11.0], [180, 9.0]]
 *     })
 *
 * @param {Object} [arg]
 * @return {Query} this
 * @api public
 */

Query.prototype.intersects = function intersects () {
  // opinionated, must be used after where
  this._ensurePath('intersects')

  this._geoComparison = '$geoIntersects'

  if (arguments.length === 0) {
    return this
  }

  var area = arguments[0]

  if (area != null && area.type && area.coordinates) { return this.geometry(area) }

  throw new TypeError('Invalid argument')
}

/**
 * Specifies a `$geometry` condition
 *
 * ####Example
 *
 *     var polyA = [[[ 10, 20 ], [ 10, 40 ], [ 30, 40 ], [ 30, 20 ]]]
 *     query.where('loc').within().geometry({ type: 'Polygon', coordinates: polyA })
 *
 *     // or
 *     var polyB = [[ 0, 0 ], [ 1, 1 ]]
 *     query.where('loc').within().geometry({ type: 'LineString', coordinates: polyB })
 *
 *     // or
 *     var polyC = [ 0, 0 ]
 *     query.where('loc').within().geometry({ type: 'Point', coordinates: polyC })
 *
 *     // or
 *     query.where('loc').intersects().geometry({ type: 'Point', coordinates: polyC })
 *
 * ####NOTE:
 *
 * `geometry()` **must** come after either `intersects()` or `within()`.
 *
 * The `object` argument must contain `type` and `coordinates` properties.
 * - type {String}
 * - coordinates {Array}
 *
 * The most recent path passed to `where()` is used.
 *
 * @param {Object} object Must contain a `type` property which is a String and a `coordinates` property which is an Array. See the examples.
 * @return {Query} this
 * @see http://docs.mongodb.org/manual/release-notes/2.4/#new-geospatial-indexes-with-geojson-and-improved-spherical-geometry
 * @see http://www.mongodb.org/display/DOCS/Geospatial+Indexing
 * @see $geometry http://docs.mongodb.org/manual/reference/operator/geometry/
 * @api public
 */

Query.prototype.geometry = function geometry () {
  if (!(this._geoComparison === '$geoWithin' ||
        this._geoComparison === '$near' ||
        this._geoComparison === '$geoIntersects')) {
    throw new Error('geometry() must come after `within()`, `intersects()`, or `near()')
  }

  var val, path

  if (arguments.length === 1) {
    this._ensurePath('geometry')
    path = this._path
    val = arguments[0]
  } else {
    throw new TypeError('Invalid argument')
  }

  if (!(val.type && Array.isArray(val.coordinates))) {
    throw new TypeError('Invalid argument')
  }

  var conds = this._conditions[path] || (this._conditions[path] = {})
  conds[this._geoComparison] = { $geometry: val }

  return this
}

// end spatial

/**
 * Specifies which document fields to include or exclude
 *
 * ####String syntax
 *
 * When passing a string, prefixing a path with `-` will flag that path as excluded. When a path does not have the `-` prefix, it is included.
 *
 * ####Example
 *
 *     // include a and b, exclude c
 *     query.select('a b -c');
 *
 *     // or you may use object notation, useful when
 *     // you have keys already prefixed with a "-"
 *     query.select({a: 1, b: 1, c: 0});
 *
 * ####Note
 *
 * Cannot be used with `distinct()`
 *
 * @param {Object|String} arg
 * @return {Query} this
 * @see SchemaType
 * @api public
 */

Query.prototype.select = function select () {
  var arg = arguments[0]
  if (!arg) return this

  if (arguments.length !== 1) {
    throw new Error('Invalid select: select only takes 1 argument')
  }

  var fields = this._fields || (this._fields = {})
  var type = typeof arg

  if (((type === 'string' || utils.isArgumentsObject(arg)) &&
    typeof arg.length === 'number') || Array.isArray(arg)) {
    if (type === 'string') { arg = arg.split(/\s+/) }

    for (var i = 0, len = arg.length; i < len; ++i) {
      var field = arg[i]
      if (!field) continue
      var include = field[0] === '-' ? 0 : 1
      if (include === 0) field = field.substring(1)
      fields[field] = include
    }

    return this
  }

  if (utils.isObject(arg)) {
    var keys = utils.keys(arg)
    for (var j = 0; j < keys.length; ++j) {
      fields[keys[j]] = arg[keys[j]]
    }
    return this
  }

  throw new TypeError('Invalid select() argument. Must be string or object.')
}

/**
 * Sets the sort order
 *
 * If an object is passed, values allowed are 'asc', 'desc', 'ascending', 'descending', 1, and -1.
 *
 * If a string is passed, it must be a space delimited list of path names. The sort order of each path is ascending unless the path name is prefixed with `-` which will be treated as descending.
 *
 * ####Example
 *
 *     // these are equivalent
 *     query.sort({ field: 'asc', test: -1 });
 *     query.sort('field -test');
 *     query.sort([['field', 1], ['test', -1]]);
 *
 * ####Note
 *
 *  - The array syntax `.sort([['field', 1], ['test', -1]])` can only be used with [mongodb driver >= 2.0.46](https://github.com/mongodb/node-mongodb-native/blob/2.1/HISTORY.md#2046-2015-10-15).
 *  - Cannot be used with `distinct()`
 *
 * @param {Object|String|Array} arg
 * @return {Query} this
 * @api public
 */

Query.prototype.sort = function (arg) {
  if (!arg) return this
  var len

  var type = typeof arg
  var field

  // .sort([['field', 1], ['test', -1]])
  if (Array.isArray(arg)) {
    len = arg.length
    for (var i = 0; i < arg.length; ++i) {
      if (!Array.isArray(arg[i])) {
        throw new Error('Invalid sort() argument, must be array of arrays')
      }
      _pushArr(this.options, arg[i][0], arg[i][1])
    }
    return this
  }

  // .sort('field -test')
  if (arguments.length === 1 && type === 'string') {
    arg = arg.split(/\s+/)
    len = arg.length
    for (var j = 0; i < len; ++i) {
      field = arg[j]
      if (!field) continue
      var ascend = field[0] === '-' ? -1 : 1
      if (ascend === -1) field = field.substring(1)
      push(this.options, field, ascend)
    }

    return this
  }

  // .sort({ field: 1, test: -1 })
  if (utils.isObject(arg)) {
    var keys = utils.keys(arg)
    for (var k = 0; k < keys.length; ++k) {
      field = keys[k]
      push(this.options, field, arg[field])
    }

    return this
  }

  if (typeof Map !== 'undefined' && arg instanceof Map) {
    _pushMap(this.options, arg)
    return this
  }

  throw new TypeError('Invalid sort() argument. Must be a string, object, or array.')
}

/*!
 * @ignore
 */

function push (opts, field, value) {
  if (Array.isArray(opts.sort)) {
    throw new TypeError("Can't mix sort syntaxes. Use either array or object:" +
      "\n- `.sort([['field', 1], ['test', -1]])`" +
      '\n- `.sort({ field: 1, test: -1 })`')
  }

  var s

  if (value && value.$meta) {
    s = opts.sort || (opts.sort = {})
    s[field] = { $meta: value.$meta }
    return
  }

  var val = String(value || 1).toLowerCase()
  if (!/^(?:ascending|asc|descending|desc|1|-1)$/.test(val)) {
    if (utils.isArray(value)) value = '[' + value + ']'
    throw new TypeError('Invalid sort value: {' + field + ': ' + value + ' }')
  }
  // store `sort` in a sane format
  s = opts.sort || (opts.sort = {})
  var valueStr = value.toString()
    .replace('asc', '1')
    .replace('ascending', '1')
    .replace('desc', '-1')
    .replace('descending', '-1')
  s[field] = parseInt(valueStr, 10)
}

function _pushArr (opts, field, value) {
  opts.sort = opts.sort || []
  if (!Array.isArray(opts.sort)) {
    throw new TypeError("Can't mix sort syntaxes. Use either array or object:" +
      "\n- `.sort([['field', 1], ['test', -1]])`" +
      '\n- `.sort({ field: 1, test: -1 })`')
  }
  var valueStr = value.toString()
    .replace('asc', '1')
    .replace('ascending', '1')
    .replace('desc', '-1')
    .replace('descending', '-1')
  opts.sort.push([field, valueStr])
}

function _pushMap (opts, map) {
  opts.sort = opts.sort || new Map()
  if (!(opts.sort instanceof Map)) {
    throw new TypeError("Can't mix sort syntaxes. Use either array or " +
      'object or map consistently')
  }
  map.forEach(function (value, key) {
    var valueStr = value.toString()
      .replace('asc', '1')
      .replace('ascending', '1')
      .replace('desc', '-1')
      .replace('descending', '-1')
    opts.sort.set(key, valueStr)
  })
}

/**
 * Specifies the limit option.
 *
 * ####Example
 *
 *     query.limit(20)
 *
 * ####Note
 *
 * Cannot be used with `distinct()`
 *
 * @method limit
 * @memberOf Query
 * @param {Number} val
 * @see mongodb http://www.mongodb.org/display/DOCS/Advanced+Queries#AdvancedQueries-%7B%7Blimit%28%29%7D%7D
 * @api public
 */
/**
 * Specifies the skip option.
 *
 * ####Example
 *
 *     query.skip(100).limit(20)
 *
 * ####Note
 *
 * Cannot be used with `distinct()`
 *
 * @method skip
 * @memberOf Query
 * @param {Number} val
 * @see mongodb http://www.mongodb.org/display/DOCS/Advanced+Queries#AdvancedQueries-%7B%7Bskip%28%29%7D%7D
 * @api public
 */

;['limit', 'skip'].forEach(function (method) {
  Query.prototype[method] = function (v) {
    this.options[method] = v
    return this
  }
})

/**
 * Specifies the maxTimeMS option.
 *
 * ####Example
 *
 *     query.maxTime(100)
 *
 * @method maxTime
 * @memberOf Query
 * @param {Number} val
 * @see mongodb http://docs.mongodb.org/manual/reference/operator/meta/maxTimeMS/#op._S_maxTimeMS
 * @api public
 */

Query.prototype.maxTime = function (v) {
  this.options.maxTimeMS = v
  return this
}

/**
 * Specifies this query as a `snapshot` query.
 *
 * ####Example
 *
 *     mquery().snapshot() // true
 *     mquery().snapshot(true)
 *     mquery().snapshot(false)
 *
 * ####Note
 *
 * Cannot be used with `distinct()`
 *
 * @see mongodb http://www.mongodb.org/display/DOCS/Advanced+Queries#AdvancedQueries-%7B%7Bsnapshot%28%29%7D%7D
 * @return {Query} this
 * @api public
 */

Query.prototype.snapshot = function () {
  this.options.snapshot = arguments.length
    ? !!arguments[0]
    : true

  return this
}

/**
 * Executes the query
 *
 * ####Examples
 *
 *     query.exec();
 *     query.exec(callback);
 *     query.exec('update');
 *     query.exec('find', callback);
 *
 * @param {String|Function} [operation]
 * @param {Function} [callback]
 * @api public
 */

Query.prototype.exec = function exec (op, callback) {
  switch (typeof op) {
    case 'function':
      callback = op
      op = null
      break
    case 'string':
      this.op = op
      break
  }

  if (!this.op) throw new Error('Missing query type')

  if (this.op === 'update' || this.op === 'remove') {
    callback || (callback = true)
  }

  var self = this

  if (typeof callback === 'function') {
    this[this.op](callback)
  } else {
    return new Promise(function (resolve, reject) {
      self[self.op](function (err, val) {
        if (err) reject(err)
        else resolve(val)
        self = resolve = reject = null
      })
    })
  }
}

/**
 * Returns a thunk which when called runs this.exec()
 *
 * The thunk receives a callback function which will be
 * passed to `this.exec()`
 *
 * @return {Function}
 * @api public
 */

Query.prototype.thunk = function () {
  var self = this
  return function (cb) {
    self.exec(cb)
  }
}

/**
 * Executes the query returning a `Promise` which will be
 * resolved with either the doc(s) or rejected with the error.
 *
 * @param {Function} [resolve]
 * @param {Function} [reject]
 * @return {Promise}
 * @api public
 */

Query.prototype.then = function (resolve, reject) {
  var self = this
  var promise = new Promise(function (resolve, reject) {
    self.exec(function (err, val) {
      if (err) resolve(err)
      else reject(val)
      self = resolve = reject = null
    })
  })
  return promise.then(resolve, reject)
}

/**
 * Make sure _path is set.
 *
 * @parmam {String} method
 */

Query.prototype._ensurePath = function (method) {
  if (!this._path) {
    var msg = method + '() must be used after where() ' +
                     'when called with these arguments'
    throw new Error(msg)
  }
}

/*!
 * Exports.
 */

module.exports = exports = Query
