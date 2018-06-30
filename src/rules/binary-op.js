const { PotentialMatch, CompoundCondition } = require('./types')
const deepEqual = require('bson-fast-deep-equal')

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
      if (a instanceof CompoundCondition && typeof b === 'number') {
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (typeof condition === 'number') {
          return condition < b
        }
        if (typeof condition.$eq === 'number') {
          return condition < b
        }
        if (typeof condition.$lt === 'number') {
          return new PotentialMatch(condition.$lt <= b)
        }
        if (typeof condition.$lte === 'number') {
          return new PotentialMatch(condition.lgte < b)
        }
        return new PotentialMatch(false)
      } else if (b instanceof CompoundCondition && typeof a === 'number') {
        let condition = query.conditions[b.path]
        if (!condition) return false

        if (typeof condition === 'number') {
          return condition < a
        }
        if (typeof condition.$eq === 'number') {
          return condition < a
        }
        if (typeof condition.$lt === 'number') {
          return new PotentialMatch(condition.$lt <= a)
        }
        if (typeof condition.$lte === 'number') {
          return new PotentialMatch(condition.$lte < a)
        }
        return new PotentialMatch(false)
      }
    }
    if (typeof a !== typeof b) return false
    return a < b
  },
  '>': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition && typeof b === 'number') {
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (typeof condition === 'number') {
          return condition > b
        }
        if (typeof condition.$eq === 'number') {
          return condition > b
        }
        if (typeof condition.$gt === 'number') {
          return new PotentialMatch(condition.$gt >= b)
        }
        if (typeof condition.$gte === 'number') {
          return new PotentialMatch(condition.$gte > b)
        }
        return new PotentialMatch(false)
      } else if (b instanceof CompoundCondition && typeof a === 'number') {
        let condition = query.conditions[b.path]
        if (!condition) return false

        if (typeof condition === 'number') {
          return condition > a
        }
        if (typeof condition.$eq === 'number') {
          return condition > a
        }
        if (typeof condition.$gt === 'number') {
          return new PotentialMatch(condition.$gt >= a)
        }
        if (typeof condition.$gte === 'number') {
          return new PotentialMatch(condition.$gte > a)
        }
        return new PotentialMatch(false)
      }
    }
    if (typeof a !== typeof b) return false
    return a > b
  },
  '<=': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition && typeof b === 'number') {
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (typeof condition === 'number') {
          return condition <= b
        }
        if (typeof condition.$eq === 'number') {
          return condition <= b
        }
        if (typeof condition.$lt === 'number') {
          return new PotentialMatch(condition.$lt <= b)
        }
        if (typeof condition.$lte === 'number') {
          return new PotentialMatch(condition.$lte <= b)
        }
        return new PotentialMatch(false)
      } else if (b instanceof CompoundCondition && typeof a === 'number') {
        let condition = query.conditions[b.path]
        if (!condition) return false

        if (typeof condition === 'number') {
          return condition >= a
        }
        if (typeof condition.$eq === 'number') {
          return condition >= a
        }
        if (typeof condition.$lt === 'number') {
          return new PotentialMatch(condition.$lt <= a)
        }
        if (typeof condition.$lte === 'number') {
          return new PotentialMatch(condition.$lte <= a)
        }
        return new PotentialMatch(false)
      }
    }
    if (typeof a !== typeof b) return false
    return a <= b
  },
  '>=': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition && typeof b === 'number') {
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (typeof condition.$gt === 'number') {
          return new PotentialMatch(condition.$gt >= b)
        }
        if (typeof condition.$gte === 'number') {
          return new PotentialMatch(condition.$gte >= b)
        }
        return new PotentialMatch(false)
      } else if (b instanceof CompoundCondition && typeof a === 'number') {
        let condition = query.conditions[b.path]
        if (!condition) return false

        if (typeof condition.$gt === 'number') {
          return new PotentialMatch(condition.$gt >= a)
        }
        if (typeof condition.$gte === 'number') {
          return new PotentialMatch(condition.$gte >= a)
        }
        return new PotentialMatch(false)
      }
    }
    if (typeof a !== typeof b) return false
    return a >= b
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
