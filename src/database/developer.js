const mongoose = require('mongoose')
const uniquePlugin = require('mongoose-unique-array')
const bcrypt = require('bcrypt')
const Schema = mongoose.Schema
const url = require('url')
const jwt = require('jsonwebtoken')
const SALT_WORK_FACTOR = 10
const JWT_SECRET = 'secret'

const customSMTPConfigRequired = function () {
  return this.auth.email.enabled
}
const customLDAPConfigRequired = function () {
  return this.auth.ldap.enabled
}
const emailValidator = {
  validator: function (v) {
    return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v)
  },
  message: '{VALUE} is not a valid email address'
}
const ldapUrlValidator = {
  validator: function (v) {
    const u = url.parse(v)
    return (u.protocol === 'ldap:' || u.protocol === 'ldaps:')
  },
  message: '{VALUE} is not a valid ldap server url'
}
const validCARegex = /^(?:(?!-{3,}(?:BEGIN|END) CERTIFICATE)[\s\S])*(-{3,}BEGIN CERTIFICATE(?:(?!-{3,}END CERTIFICATE)[\s\S])*?-{3,}END CERTIFICATE-{3,})(?![\s\S]*?-{3,}BEGIN CERTIFICATE[\s\S]+?-{3,}END CERTIFICATE[\s\S]*?$)/
const caValidator = {
  validator: function (v) { return validCARegex.test(v) },
  message: '{VALUE} is not a valid certificate'
}
const invalidLabIdRegex = /(?:[/\\. "$*<>:|?]|^$|^admin$|^config$|^local$|^test$|^main$)/i
const labIdValidator = {
  validator: function (v) {
    return v.length >= 4 && v.length <= 20 && !invalidLabIdRegex.test(v)
  },
  message: '{VALUE} is not a valid lab id'
}

const invalidBeakerIdRegex = /(?:^system\.|\$|^$)/i
const beakerIdValidator = {
  validator: function (v) {
    return v.length > 3 && v.length < 20 && !invalidBeakerIdRegex.test(v)
  },
  message: '{VALUE} is not a valid beaker id'
}

const developerSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, validate: emailValidator },
  password: { type: String, required: true },
  labs: [{
    name: { type: String, required: true },
    id: { type: String, required: true, lowercase: true, unique: true, validate: labIdValidator },
    apiKey: { type: String, required: true },
    description: { type: String },
    beakers: [{
      id: { type: String, required: true, validate: beakerIdValidator },
      rule: {
        list: { type: String, default: 'true', required: true },
        get: { type: String, default: 'true', required: true },
        update: { type: String, default: 'true', required: true },
        create: { type: String, default: 'true', required: true },
        delete: { type: String, default: 'true', required: true }
      }
    }],
    allowOrigins: [{ type: String }],
    auth: {
      email: {
        enabled: { type: Boolean, default: false },
        verification: { type: Boolean, default: true },
        smtp: {
          sender: { type: String, required: customSMTPConfigRequired, validate: emailValidator },
          host: { type: String, required: customSMTPConfigRequired },
          port: { type: Number, required: customSMTPConfigRequired },
          user: { type: String, required: customSMTPConfigRequired },
          pass: { type: String, required: customSMTPConfigRequired },
          secureMethod: { type: String, enum: ['STARTTLS', 'SSL'], required: customSMTPConfigRequired },
          tlsMode: { type: String, enum: ['DEFAULT', 'PINNED', 'IGNORE'], default: 'DEFAULT', required: customSMTPConfigRequired },
          ca: {
            type: String,
            validator: caValidator,
            required: function () {
              return this.auth.email.enabled && this.auth.email.smtp.tlsMode === 'PINNED'
            }
          }
        },
        template: {
          verify: {
            subject: {
              type: String,
              default: 'Verify request'
            },
            content: {
              type: String,
              default: 'Hi please verify your email at {{VERIFY_LINK}}'
            }
          },
          reset: {
            subject: {
              type: String,
              default: 'Forget password'
            },
            content: {
              type: String,
              default: 'Hi to reset password click {{RESET_LINK}}'
            }
          }
        }
      },
      ldap: {
        enabled: { type: Boolean, default: false, required: true },
        url: { type: String, required: customLDAPConfigRequired, validator: ldapUrlValidator },
        bindDN: { type: String },
        bindPass: { type: String },
        searchBase: { type: String, required: customLDAPConfigRequired },
        searchFilter: { type: String, required: customLDAPConfigRequired },
        groupSearchBase: { type: String },
        groupSearchFilter: { type: String },
        tlsMode: { type: String, enum: ['DEFAULT', 'PINNED', 'IGNORE'], default: 'DEFAULT', required: customLDAPConfigRequired },
        ca: {
          type: String,
          validator: caValidator,
          required: function () {
            return this.auth.ldap.enabled && this.auth.ldap.tlsMode === 'PINNED'
          }
        }
      }
    }
  }]
})

/* this plugin will check for unique lab id */
developerSchema.plugin(uniquePlugin)

developerSchema.pre('save', function (next) {
  const developer = this

  /* check for duplicate beaker id */
  if (developer.isModified('labs')) {
    this.labs.forEach((lab, i) => {
      if (!developer.isModified(`labs.${i}.beakers`)) return
      let seen = new Set()
      let hasDuplicates = lab.beakers.some(function (beaker) {
        return seen.size === seen.add(beaker.id).size
      })
      seen.clear()
      if (hasDuplicates) return next(new Error('beaker id already exist in this lab'))
    })
  }

  if (developer.isModified('password')) {
    bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
      if (err) return next(err)
      bcrypt.hash(developer.password, salt, function (err, hash) {
        if (err) return next(err)
        developer.password = hash
        next()
      })
    })
  }
  next()
})

developerSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

developerSchema.methods.getToken = function () {
  return new Promise((resolve, reject) => {
    jwt.sign({
      name: this.name,
      id: this._id.toString(),
      role: 'developer'
    }, JWT_SECRET, function (err, token) {
      if (err) return reject(err)
      resolve(token)
    })
  })
}

developerSchema.statics.findByToken = function (token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (jwtErr, decoded) => {
      if (jwtErr) return reject(jwtErr)
      this.findById(decoded.id, (err, developer) => {
        if (err) return reject(err)
        if (!developer) return reject(new Error('No such developer'))
        resolve(developer)
      })
    })
  })
}

developerSchema.index({ email: 1 }, {
  unique: true,
  collation: {
    locale: 'en_US',
    strength: 1
  }})

module.exports = mongoose.model('Developer', developerSchema)
