const BaseAuth = require('./base')
const LDAP = require('ldapauth-fork')
const util = require('util')

class LdapAuth extends BaseAuth {
  constructor (userCollection, ldapConfig) {
    super(userCollection)

    let groupSearchFilterStr = ldapConfig.groupSearchFilter
    let groupSearchFilterFunc

    if (typeof groupSearchFilterStr === 'string') {
      groupSearchFilterFunc = (user) => {
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

    let tlsOptions
    switch (ldapConfig.tlsMode) {
      case 'PINNED':
        tlsOptions = {
          ca: ldapConfig.ca,
          checkServerIdentity: function (hostname, cert) {
            /* workaround for misused multiple CN */
            if (!cert.subject.CN.split(',').includes(hostname)) {
              throw new Error('CN does not match!')
            }
          }
        }
        break
      case 'IGNORE':
        tlsOptions = {rejectUnauthorized: false}
        break
      default:
        tlsOptions = {}
    }
    const ldap = new LDAP({
      url: ldapConfig.url,
      bindDN: ldapConfig.bindDN,
      bindCredentials: ldapConfig.bindPass,
      searchBase: ldapConfig.searchBase,
      searchFilter: ldapConfig.searchFilter,
      groupSearchBase: ldapConfig.groupSearchBase,
      groupSearchFilter: groupSearchFilterFunc,
      tlsOptions
    })
    ldap.on('error', function (err) {
      console.error('ldap error')
      console.error(err)
    })
    this.ldap = ldap
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
