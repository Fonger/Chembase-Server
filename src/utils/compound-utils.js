const isPlainObject = require('is-plain-object')
const forbiddenFieldNames = ['constructor', '__proto__', 'prototype']
const cloneDeep = require('clone-deep')
const forbiddenSetFieldNames = ['__old', '__version']
const deepEqual = require('bson-fast-deep-equal')

module.exports = {
  dotNotationToObject: function (baseDocument, setNewDocument) {
    baseDocument = cloneDeep(baseDocument)
    let noOperation = true
    for (let [path, value] of Object.entries(setNewDocument)) {
      let keys = path.split('.')
      let lastKey = keys.pop()

      if (forbiddenSetFieldNames.includes[keys[0]]) {
        throw new Error(`Cannot use ${keys[0]} as field name`)
      }

      let parent = baseDocument
      for (let key of keys) {
        if (typeof parent[key] === 'undefined') parent[key] = {}

        if (isPlainObject(parent[key])) parent = parent[key]
        else throw new Error('It contains redefined path')
      }
      if (!noOperation || !deepEqual(parent[lastKey], value)) {
        parent[lastKey] = value
        noOperation = false
      }
    }
    return noOperation ? null : baseDocument
  },
  validateObject: function validateObject (document) {
    Object.keys(document).forEach(function (key) {
      if (key[0] === '$') {
        throw new Error("Field names can't start with $")
      } else if (key.indexOf('.') !== -1) {
        throw new Error('Field names cannot contain .')
      } else if (forbiddenFieldNames.includes(key)) {
        throw new Error(`Cannot use ${key} as field name`)
      } else if (isPlainObject(document[key])) {
        return validateObject(document[key])
      } else {
        return document
      }
    })
  }
}
