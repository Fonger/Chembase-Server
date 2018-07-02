const BaseAuth = require('./base')
const bcrypt = require('bcrypt')
const SALT_WORK_FACTOR = 10

class EmailAuth extends BaseAuth {
  constructor (userCollection, emailConfig) {
    super(userCollection)
    this.emailConfig = emailConfig
  }
  async login (credential) {
    const user = await this.userCollection.findOne({ email: credential.email, method: 'email' })
    if (!user) throw new Error('User not found')

    let isMatch = await bcrypt.compare(credential.password, user.password)
    if (!isMatch) throw new Error('Incorrect password')

    return user
  }
  async register (credential) {
    let hashedPassword = await bcrypt.hash(credential.password, SALT_WORK_FACTOR)

    let response = await this.userCollection.insertOne({
      method: 'email',
      email: credential.email,
      password: hashedPassword
    })

    if (response.result.n === 0) {
      throw new Error('user already exists')
    }

    /* TODO: email verification */
    const user = response.ops[0]
    return user
  }
}

module.exports = EmailAuth
