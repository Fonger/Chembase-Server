/* eslint-disable no-extend-native */
if (!('toJSON' in Error.prototype)) {
  Object.defineProperty(Error.prototype, 'toJSON', {
    value: function () {
    /* TODO: use proper error handling */
      return this.stack
    },
    configurable: true,
    writable: true
  })
}
