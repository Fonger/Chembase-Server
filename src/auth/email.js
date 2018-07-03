const BaseAuth = require('./base')
const bcrypt = require('bcrypt')
const SALT_WORK_FACTOR = 10
const VALID_EMAIL_REGEX = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

class EmailAuth extends BaseAuth {
  constructor (userCollection, emailConfig) {
    super(userCollection)
    this.emailConfig = emailConfig
  }
  async login (credential) {
    this.validateCredential(credential)

    const user = await this.userCollection.findOne({ email: credential.email, method: 'email' })
    if (!user) throw new Error('User not found')

    let isMatch = await bcrypt.compare(credential.password, user.password)
    if (!isMatch) throw new Error('Incorrect password')

    return user
  }
  async register (credential) {
    this.validateCredential(credential)
    let hashedPassword = await bcrypt.hash(credential.password, SALT_WORK_FACTOR)
    try {
      let response = await this.userCollection.insertOne({
        method: 'email',
        email: credential.email,
        password: hashedPassword
      })
      /* TODO: email verification */
      const user = response.ops[0]
      return user
    } catch (err) {
      console.error(err)
      if (err.code === 11000) throw new Error('user already exists')
      throw err
    }
  }
  validateCredential (credential) {
    if (typeof credential !== 'object') {
      throw new TypeError('Invalid credential')
    }
    if (typeof credential.email !== 'string') {
      throw new TypeError('Invalid email')
    }
    if (!VALID_EMAIL_REGEX.test(credential.email)) {
      throw new Error('Invalid email format')
    }
    if (typeof credential.password !== 'string') {
      throw new TypeError('Invalid password')
    }
  }
}

module.exports = EmailAuth
