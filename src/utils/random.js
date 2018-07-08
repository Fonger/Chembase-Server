const crypto = require('crypto')

module.exports = {
  generateHexString: function (bytes = 16) {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(bytes, (err, result) => {
        if (err) return reject(err)
        resolve(result.toString('hex'))
      })
    })
  }
}
