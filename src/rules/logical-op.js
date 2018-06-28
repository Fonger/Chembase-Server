const { PotentialMatch } = require('./types')

const logicalOps = {
  '&&': async function (logicA, logicBthunk, query) {
    logicA = await logicA
    if (logicA instanceof PotentialMatch) {
      if (logicA.valueOf()) return logicBthunk()
      else return logicA
    } else return logicA && logicBthunk()
  },
  '||': async function (logicA, logicBthunk, query) {
    logicA = await logicA
    if (logicA instanceof PotentialMatch) {
      if (logicA.valueOf()) return logicA
      else return logicBthunk()
    } else return logicA || logicBthunk()
  }
}

/**
 * execute a logical expression and return result
 * To optimize the code, if the result and return early,
 * the right part of the logical expression will not be executed.
 *
 * @param {String} operator operator identifier
 * @param {AsyncFunction} a left: an async function that return left value
 * @param {Function} bThunk right: a thunk that return async function for right value
 * @param {Object} [query] query condition
 * @returns {Any} operation result
 */

module.exports = function (operator, a, bThunk, query) {
  const fn = logicalOps[operator]
  if (!fn) throw new Error(`Unknown logical operator ${operator}`)
  return fn(a, bThunk, query)
}
