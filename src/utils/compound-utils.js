const isPlainObject = require('is-plain-object')
const forbiddenFieldNames = ['constructor', '__proto__', 'prototype']

module.exports = {
  dotNotationToObject: function toObj (obj) {
    let output = {}
    for (let [path, value] of Object.entries(obj)) {
      let keys = path.split('.')
      let lastKey = keys.pop()

      let parent = output
      for (let key of keys) {
        if (typeof parent[key] === 'undefined') parent[key] = {}

        if (isPlainObject(parent[key])) parent = parent[key]
        else throw new Error('It contains redefined path')
      }
      parent[lastKey] = value
    }
    return output
  },
  validateObject: function (document) {
    Object.keys(document).forEach(function (key) {
      if (key[0] === '$') {
        throw new Error("Field names can't start with $")
      } else if (key.indexOf('.') !== -1) {
        throw new Error('Field names cannot contain .')
      } else if (forbiddenFieldNames.includes(key)) {
        throw new Error(`Cannot use ${key} as field name`)
      } else if (isPlainObject(document[key])) {
        return this.validateObject(document[key])
      } else {
        return document
      }
    })
  }
}
