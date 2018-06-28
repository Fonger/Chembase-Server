const { PotentialMatch, CompoundCondition } = require('./types')

const unOps = {
  '-': function (a, query) {
    if (query && (a instanceof PotentialMatch || a instanceof CompoundCondition)) { throw new Error('Cannot use with - operator') }
    return -a
  },
  '+': function (a, query) {
    if (query && (a instanceof PotentialMatch || a instanceof CompoundCondition)) { throw new Error('Cannot use with + operator') }
    return +a
  },
  '~': function (a, query) {
    if (query && (a instanceof PotentialMatch || a instanceof CompoundCondition)) { throw new Error('Cannot use with ~ operator') }
    return ~a
  },
  '!': function (a, query) {
    if (query && (a instanceof PotentialMatch || a instanceof CompoundCondition)) { throw new Error('Cannot use with ! operator') }
    return !a
  }
}

module.exports = function (operator, a, query) {
  const fn = unOps[operator]
  if (!fn) throw new Error(`Unknown uniary operator ${operator}`)
  return fn(a, query)
}
