const BaseAuth = require('./base')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')
const BSON = require('../utils/bsonSerializer')
const random = require('../utils/random')

const SALT_WORK_FACTOR = 10
const VALID_EMAIL_REGEX = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

class EmailAuth extends BaseAuth {
  constructor (userCollection, emailConfig) {
    super(userCollection)

    this.emailConfig = emailConfig

    this.transporter = nodemailer.createTransport({
      auth: {
        user: emailConfig.smtp.user,
        pass: emailConfig.smtp.pass
      },
      secure: emailConfig.smtp.secureMethod === 'SSL', // STARTTLS: false
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      tls: {
        rejectUnauthorized: !emailConfig.smtp.trustInvalidCertificate
      }
    })

    this.transporter.verify(function (error) {
      if (error) console.error(error)
    })
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
        password: hashedPassword,
        verifyCode: await random.generateHexString(),
        verified: false
      })

      const user = response.ops[0]

      const template = this.emailConfig.template.verify
      const verifyLink = `https://dummy.com/verify?id=${user._id.toString()}&verifyCode=${user.verifyCode}`
      /* TODO: email verification */
      let mailOptions = {
        from: this.emailConfig.sender,
        to: credential.email,
        subject: template.subject,
        text: template.content.replace('{{VERIFY_LINK}}', verifyLink)
      }
      let info = await this.transporter.sendMail(mailOptions)
      console.log('Message sent: %s', info.messageId)
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info))

      return user
    } catch (err) {
      console.error(err)
      if (err.code === 11000) throw new Error('user already exists')
      throw err
    }
  }
  async verify (id, verifyCode) {
    if (typeof id !== 'string' || typeof verifyCode !== 'string') {
      throw new TypeError('id and code must be string')
    }
    const user = await this.userCollection.findOneAndUpdate(
      { _id: BSON.ObjectId.createFromHexString(id), verifyCode },
      { $set: { verified: true }, $unset: { code: true } },
      { returnOriginal: false })

    if (!user.value) throw new Error('User not found')
    return user.value
  }
  async changePassword (_id, newPassword) {
    if (!(_id instanceof BSON.ObjectId) || typeof newPassword !== 'string') {
      throw new TypeError('id must be ObjectId and password must be string')
    }
    let hashedPassword = await bcrypt.hash(newPassword, SALT_WORK_FACTOR)

    const user = await this.userCollection.findOneAndUpdate(
      { _id },
      { $set: { password: hashedPassword } },
      { returnOriginal: false })

    if (!user.value) throw new Error('User not found')
    return user.value
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
