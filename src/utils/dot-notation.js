const isPlainObject = require('is-plain-object')

module.exports = {
  toObject: function toObj (obj) {
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
  }
}
