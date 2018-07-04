const BSON = require('../utils/bsonSerializer')

/**
 * Given a query and a logical limit, if the operation is potentially legal or not
 *
 * @class PotentialMatch
 */
class PotentialMatch {
  /**
   *Creates an instance of PotentialMatch.
   * @param {Boolean} bool
   */
  constructor (bool) {
    this.potential = bool
  }
  valueOf () {
    return this.potential
  }
}

/**
 * This is a compound condition to store object path that does not exist in
 * the context
 *
 * @class CompoundCondition
 */
class CompoundCondition {
  /**
   * Creates an instance of CompoundCondition.
   * @param {String} baseField root of object path name
   * @param {Object} query query object
   */
  constructor (baseField, query) {
    this.path = baseField
    this.query = query
  }

  /**
   * append a field name to this
   *
   * @param {String} field
   * @memberof CompoundCondition
   */
  appendSubField (field) {
    this.path += '.' + field
  }

  valueOf () {
    if (this.query) {
      throw new Error('Cannot use this operator with compound data in Query Condition')
    }
  }

  equals (value) {
    return (value instanceof CompoundCondition) && this.path === value.path
  }
}

function ImplicitCompare (a, b) {
  if (typeof a === 'number' || a instanceof BSON.Double) {
    if (typeof b === 'number' || b instanceof BSON.Double) {
      if (a > b) return 1
      if (a < b) return -1
      return 0
    } else if (b instanceof BSON.Int32) {
      b = b.valueOf()
      if (a > b) return 1
      if (a < b) return -1
      return 0
    } else if (b instanceof BSON.Long) {
      a = BSON.Long.fromNumber(a)
      return a.compare(b)
    } else if (b instanceof BSON.Decimal128) {
      throw new TypeError('Cannot compare with decimal128 type')
    } else if (b instanceof BSON.ObjectId) {
      throw new TypeError('Cannot compare Double(number) with ObjectId')
    } else if (b instanceof Date) {
      b = b.valueOf()
      if (a > b) return 1
      if (a < b) return -1
      return 0
    } else {
      throw new TypeError('Cannot compare this value')
    }
  } else if (a instanceof BSON.Int32) {
    if (typeof b === 'number' || b instanceof BSON.Double) {
      a = a.valueOf()
      if (a > b) return 1
      if (a < b) return -1
      return 0
    } else if (b instanceof BSON.Int32) {
      a = a.valueOf()
      b = b.valueOf()
      if (a > b) return 1
      if (a < b) return -1
      return 0
    } else if (b instanceof BSON.Long) {
      a = a.valueOf()
      a = BSON.Long.fromNumber(a)
      return a.compare(b)
    } else if (b instanceof BSON.Decimal128) {
      throw new TypeError('Cannot compare with decimal128 type')
    } else if (b instanceof BSON.ObjectId) {
      throw new TypeError('Cannot compare Int32 with ObjectId')
    } else if (b instanceof Date) {
      a = a.valueOf()
      b = b.valueOf()
      if (a > b) return 1
      if (a < b) return -1
      return 0
    } else {
      throw new TypeError('Cannot compare this value')
    }
  } else if (a instanceof BSON.Long) {
    if (typeof b === 'number' || b instanceof BSON.Double) {
      b = BSON.Long.fromNumber(b.valueOf())
      return a.compare(b)
    } else if (b instanceof BSON.Int32) {
      b = BSON.Long.fromNumber(b.valueOf())
      return a.compare(b)
    } else if (b instanceof BSON.Long) {
      return a.compare(b)
    } else if (b instanceof BSON.Decimal128) {
      throw new TypeError('Cannot compare with decimal128 type')
    } else if (b instanceof BSON.ObjectId) {
      throw new TypeError('Cannot compare Long with ObjectId')
    } else if (b instanceof Date) {
      b = BSON.Long.fromNumber(b.valueOf())
      return a.compare(b)
    } else {
      throw new TypeError('Cannot compare this value')
    }
  } else if (a instanceof BSON.Decimal128) {
    throw new TypeError('Cannot compare with decimal128 type')
  } else if (a instanceof BSON.ObjectId) {
    if (b instanceof BSON.ObjectId) {
      a = a.toString()
      b = b.toString()
      if (a > b) return 1
      if (a < b) return -1
      return 0
    } else {
      throw new TypeError('ObjectId can only be compared with ObjectId')
    }
  } else if (a instanceof Date) {
    if (typeof b === 'number' || b instanceof BSON.Double) {
      a = a.valueOf()
      b = b.valueOf()
      if (a > b) return 1
      if (a < b) return -1
      return 0
    } else if (b instanceof BSON.Int32) {
      a = a.valueOf()
      b = b.valueOf()
      if (a > b) return 1
      if (a < b) return -1
      return 0
    } else if (b instanceof BSON.Long) {
      a = BSON.Long.fromNumber(a.valueOf())
      return a.compare(b)
    } else if (b instanceof BSON.Decimal128) {
      throw new TypeError('Cannot compare with decimal128 type')
    } else if (b instanceof BSON.ObjectId) {
      throw new TypeError('Cannot compare Double(number) with ObjectId')
    } else if (b instanceof Date) {
      a = a.valueOf()
      b = b.valueOf()
      if (a > b) return 1
      if (a < b) return -1
      return 0
    } else {
      throw new TypeError('Cannot compare this value')
    }
  }
  throw new TypeError('Cannot compare this value')
}

module.exports = { PotentialMatch, CompoundCondition, ImplicitCompare }
