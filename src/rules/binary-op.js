const { PotentialMatch, CompoundCondition, ImplicitCompare } = require('./types')
const deepEqual = require('bson-fast-deep-equal')
const isPlainObject = require('is-plain-object')

const binaryOps = {
  '|': function (a, b, query) { throw new Error('Invalid operator |') },
  '^': function (a, b, query) { throw new Error('Invalid operator ^') },
  '&': function (a, b, query) { throw new Error('Invalid operator &') },
  '==': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition && b instanceof CompoundCondition) {
        return a.equals(b)
      }
      if (a instanceof CompoundCondition && !(b instanceof CompoundCondition)) {
        let condition = query.conditions[a.path]
        if (!condition) return false

        return deepEqual(condition.$eq || condition, b)
      }
      if (b instanceof CompoundCondition && !(a instanceof CompoundCondition)) {
        let condition = query.conditions[b.path]
        if (!condition) return false

        return deepEqual(condition.$eq || condition, a)
      }

      if (a instanceof PotentialMatch || b instanceof PotentialMatch) {
        return a.valueOf() === b.valueOf()
      }
    }
    if ((a === null && b === undefined) || (b === null && a === undefined)) {
      return true
    }
    return deepEqual(a, b)
  },
  '!=': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition && b instanceof CompoundCondition) {
        return !a.equals(b)
      }
      if (a instanceof CompoundCondition && !(b instanceof CompoundCondition)) {
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (condition.$ne) {
          return deepEqual(condition.$ne, b)
        }

        return !deepEqual(condition.$eq || condition, b)
      }
      if (b instanceof CompoundCondition && !(a instanceof CompoundCondition)) {
        let condition = query.conditions[b.path]
        if (!condition || !condition.$ne) return false

        return deepEqual(condition.$ne || condition, a)
      }
      if (a instanceof PotentialMatch || b instanceof PotentialMatch) {
        return a.valueOf() !== b.valueOf()
      }
    }
    if ((a === null && b === undefined) || (b === null && a === undefined)) {
      return false
    }
    return !deepEqual(a, b)
  },
  '<': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition || b instanceof CompoundCondition) {
        if (b instanceof CompoundCondition) [a, b] = [b, a]
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (isPlainObject(condition)) {
          // if condition has some other decorator e.g. $gt $lt
          // { a: { $gt: 5} }
          // || typeof query.conditions.$eq !== 'undefined'

          if (typeof condition.$eq !== 'undefined') {
            return ImplicitCompare(condition.$eq, b) < 0
          }

          if (typeof condition.$lt !== 'undefined') {
            return new PotentialMatch(ImplicitCompare(condition.$lt, b) <= 0)
          }

          if (typeof condition.$lte !== 'undefined') {
            return new PotentialMatch(ImplicitCompare(condition.$lte, b) < 0)
          }
          return new PotentialMatch(false)
        } else {
          // if condition has definite value
          // { a: 5 }
          return ImplicitCompare(condition, b) < 0
        }
      }
    }
    return ImplicitCompare(a, b) < 0
  },
  '>': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition || b instanceof CompoundCondition) {
        if (b instanceof CompoundCondition) [a, b] = [b, a]
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (isPlainObject(condition)) {
          // if condition has some other decorator e.g. $gt $lt
          // { a: { $gt: 5} }
          // || typeof query.conditions.$eq !== 'undefined'

          if (typeof condition.$eq !== 'undefined') {
            return ImplicitCompare(condition.$eq, b) > 0
          }

          if (typeof condition.$gt !== 'undefined') {
            return new PotentialMatch(ImplicitCompare(condition.$gt, b) >= 0)
          }

          if (typeof condition.$gte !== 'undefined') {
            return new PotentialMatch(ImplicitCompare(condition.$gte, b) > 0)
          }
          return new PotentialMatch(false)
        } else {
          // if condition has definite value
          // { a: 5 }
          return ImplicitCompare(condition, b) > 0
        }
      }
    }
    return ImplicitCompare(a, b) > 0
  },
  '<=': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition || b instanceof CompoundCondition) {
        if (b instanceof CompoundCondition) [a, b] = [b, a]
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (isPlainObject(condition)) {
          // if condition has some other decorator e.g. $gt $lt
          // { a: { $gt: 5} }
          // || typeof query.conditions.$eq !== 'undefined'

          if (typeof condition.$eq !== 'undefined') {
            return ImplicitCompare(condition.$eq, b) <= 0
          }

          if (typeof condition.$lt !== 'undefined') {
            return new PotentialMatch(ImplicitCompare(condition.$lt, b) <= 0)
          }

          if (typeof condition.$lte !== 'undefined') {
            return new PotentialMatch(ImplicitCompare(condition.$lte, b) <= 0)
          }
          return new PotentialMatch(false)
        } else {
          // if condition has definite value
          // { a: 5 }
          return ImplicitCompare(condition, b) <= 0
        }
      }
    }
    return ImplicitCompare(a, b) <= 0
  },
  '>=': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition || b instanceof CompoundCondition) {
        if (b instanceof CompoundCondition) [a, b] = [b, a]
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (isPlainObject(condition)) {
          // if condition has some other decorator e.g. $gt $lt
          // { a: { $gt: 5} }
          // || typeof query.conditions.$eq !== 'undefined'

          if (typeof condition.$eq !== 'undefined') {
            return ImplicitCompare(condition.$eq, b) >= 0
          }

          if (typeof condition.$gt !== 'undefined') {
            return new PotentialMatch(ImplicitCompare(condition.$gt, b) >= 0)
          }

          if (typeof condition.$gte !== 'undefined') {
            return new PotentialMatch(ImplicitCompare(condition.$gte, b) >= 0)
          }
          return new PotentialMatch(false)
        } else {
          // if condition has definite value
          // { a: 5 }
          return ImplicitCompare(condition, b) >= 0
        }
      }
    }
    return ImplicitCompare(a, b) >= 0
  },
  '<<': function (a, b, query) { return a << b },
  '>>': function (a, b, query) { return a >> b },
  '>>>': function (a, b, query) { return a >>> b },
  '+': function (a, b, query) { return a + b },
  '-': function (a, b, query) { return a - b },
  '*': function (a, b, query) { return a * b },
  '/': function (a, b, query) { return a / b },
  '%': function (a, b, query) { return a % b }
}

/**
 * execute a binary expression and return result
 *
 * @param {String} operator operator identifier
 * @param {Any} a left
 * @param {Any} b right
 * @param {Object} [query] query condition
 * @returns {Any} operation result
 */

module.exports = function (operator, a, b, query) {
  const fn = binaryOps[operator]
  if (!fn) throw new Error(`Unknown operator ${operator}`)
  return fn(a, b, query)
}
