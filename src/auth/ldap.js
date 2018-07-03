const BaseAuth = require('./base')
const LDAP = require('ldapauth-fork')
const util = require('util')

class LdapAuth extends BaseAuth {
  constructor (userCollection, ldapConfig) {
    super(userCollection)

    const groupSearchFilterStr = ldapConfig.groupSearchFilter
    if (typeof groupSearchFilterStr === 'string') {
      ldapConfig.groupSearchFilter = (user) => {
        return groupSearchFilterStr.replace(/{{user\.([^}]+)}}/g, (match, group, offset, str) => {
          try {
            let properties = group.split('.')
            let result = user
            for (let property of properties) {
              result = result[property]
            }
            return result
          } catch (err) {
            // replace with a impossible matched value
            return '#################'
          }
        })
      }
    }
    const ldap = new LDAP(ldapConfig)
    ldap.on('error', function (err) {
      console.error('ldap error')
      console.error(err)
    })

    this.auth = util.promisify(ldap.authenticate.bind(ldap))
  }
  async login (credential) {
    this.validateCredential(credential)

    let ldapUser = await this.auth(credential.username, credential.password)

    if (ldapUser._groups) {
      ldapUser.groupCNs = ldapUser._groups.map(g => g.cn)
      ldapUser.groupDNs = ldapUser._groups.map(g => g.dn)
      ldapUser.groupGidNumbers = ldapUser._groups.map(g => g.gidNumber)
    }

    const userResult = await this.userCollection.findOneAndUpdate(
      { method: 'ldap', username: credential.username },
      { $set: { info: ldapUser }, $setOnInsert: { method: 'ldap', username: credential.username } },
      { returnOriginal: false, upsert: true })

    if (userResult.ok !== 1) throw new Error('Unknown Error')
    return userResult.value
  }
  validateCredential (credential) {
    if (typeof credential !== 'object') {
      throw new TypeError('Invalid credential')
    }
    // username is already sanitized in module
    if (typeof credential.username !== 'string') {
      throw new TypeError('Invalid email')
    }
    if (typeof credential.password !== 'string') {
      throw new TypeError('Invalid password')
    }
  }
}

module.exports = LdapAuth
