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

module.exports = { PotentialMatch, CompoundCondition }
