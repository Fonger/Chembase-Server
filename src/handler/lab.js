const Database = require('../database')
const Redis = require('ioredis')
// const ObjectID = require('mongodb').ObjectID
const BSON = require('../utils/bsonSerializer')
const RuleRunner = require('../rules/rule-runner')
const CompoundUtils = require('../utils/compound-utils')
const { EmailAuth, LdapAuth } = require('../auth')
const server = require('./server')
const isPlainObject = require('is-plain-object')

require('../utils/errorjson')

const redis = new Redis({
  port: 6379,
  host: '127.0.0.1',
  family: 4,
  // password: 'auth',
  db: 0
})

const globalLabMap = new Map()

class Lab {
  constructor (rawLab, rawDeveloper) {
    console.log(`    Lab id: ${rawLab.id} key: ${rawLab.apiKey}`)
    this.id = rawLab.id
    this.database = Database.MongoClient.db(rawLab.id)
    this.apiKey = rawLab.apiKey
    this.auth = rawLab.auth
    this.beakers = {}
    this.beakerIdlist = []
    this.userCollection = this.database.collection('_users')
    this.userCollection.createIndex(
      { method: 1, email: 1 },
      { partialFilterExpression: { email: { $exists: true } }, unique: true })
      .then(console.log)
      .catch(console.error)
    this.userCollection.createIndex(
      { method: 1, username: 1 },
      { partialFilterExpression: { username: { $exists: true } }, unique: true })
      .then(console.log)
      .catch(console.error)

    this.io = server.io.of(`/labs/${rawLab.id}`)
    this.io.use(this.ioMiddleware.bind(this))
    this.io.on('connection', this.onConnection.bind(this))

    this.updateAllowedOrigins(rawLab.allowOrigins)

    for (const [method, config] of Object.entries(this.auth)) {
      if (!config.enabled) continue

      switch (method) {
        case 'email':
          this.setupEmailAuth(config)
          break
        case 'ldap':
          this.setupLdapAuth(config)
          break
        default:
          throw new Error(`Unknown auth method $method`)
      }
    }

    rawLab.beakers.forEach(beaker => {
      this.newBeaker(beaker)
    })

    this.changeStreamGroups = new Map()
    globalLabMap.set(this.id, this)
  }
  setupEmailAuth (config) {
    if (this.emailAuth) {
      this.emailAuth.transporter.close()
    }
    if (config.enabled) {
      this.emailAuth = new EmailAuth(this.userCollection, config)
    }
  }
  setupLdapAuth (config) {
    if (this.ldapAuth) {
      this.ldapAuth.ldap.close()
    }
    if (config.enabled) {
      this.ldapAuth = new LdapAuth(this.userCollection, config)
    }
  }
  updateAllowedOrigins (config) {
    this.allowOrigins = config
  }
  newBeaker (rawBeaker) {
    this.beakers[rawBeaker.id] = rawBeaker
    this.beakerIdlist.push(rawBeaker.id)
  }
  updateBeaker (rawBeaker) {
    this.beakers[rawBeaker.id] = rawBeaker
  }
  deleteBeaker (rawBeaker) {
    delete this.beaker[rawBeaker.id]
    this.beakerIdlist.splice(this.beakerIdlist.indexOf(rawBeaker.id), 1)
  }
  async ioMiddleware (socket, next) {
    try {
      if (!this.allowOrigins.includes(socket.handshake.headers.origin)) {
        return next(new Error('lab origin not allowed'))
      }
      let oldSocketId = socket.handshake.query.oldSocketId
      if (oldSocketId) {
        console.log(oldSocketId + ' ===> ' + socket.id)
        try {
          let userId = await redis.hget(oldSocketId, 'userId')
          if (userId) {
            let user = await this.userCollection.findOne({ _id: BSON.ObjectId.createFromHexString(userId) })
            if (!user) return next(new Error('user not found'))
            socket.user = user
            await redis.rename(oldSocketId, socket.id)
          }
        } catch (err) {
          console.error(err)
        // ignore the error
        }
      }
      next()
    } catch (err) {
      next(err)
    }
  }
  onConnection (socket) {
    console.log('onConnection! ' + socket.id)
    socket.uniqueCounter = 0
    socket.txnSessions = new Map()
    redis.hmset(socket.id, {
      uniqueCounter: 0,
      socketId: socket.id
    })
    socket.on('register', this.register.bind(this, socket))
    socket.on('login', this.login.bind(this, socket))
    socket.on('logout', this.logout.bind(this, socket))
    socket.on('verify', this.verify.bind(this, socket))
    socket.on('changePassword', this.changePassword.bind(this, socket))
    socket.on('create', this.create.bind(this, socket))
    socket.on('find', this.find.bind(this, socket))
    socket.on('get', this.get.bind(this, socket))
    socket.on('update', this.update.bind(this, socket))
    socket.on('delete', this.delete.bind(this, socket))
    socket.on('subscribe', this.subscribe.bind(this, socket))
    socket.on('unsubscribe', this.unsubscribe.bind(this, socket))
    socket.on('txn_start', this.startTransaction.bind(this, socket))
    socket.on('txn_commit', this.commitTransaction.bind(this, socket))
    socket.on('txn_abort', this.abortTransaction.bind(this, socket))
    socket.on('disconnect', this.onDisconnect.bind(this, socket))
  }
  onDisconnect (socket, reason) {
    console.log('on disconnect', reason)
    /*
      reason may be one of the followings
      'client namespace disconnect'
      'server namespace disconnect'
      'transport error'
      'ping timeout'
      'transport close'
      'io server disconnect'
    */
    for (let txnSession of socket.txnSessions.values()) {
      txnSession.endSession()
    }
    if (socket.listeningChangeStreamMap) {
      for (let subscriptionId of socket.listeningChangeStreamMap.keys()) {
        let changeStreamGroup = socket.listeningChangeStreamMap.get(subscriptionId)
        if (changeStreamGroup && changeStreamGroup.callbackHandlers) {
          changeStreamGroup.callbackHandlers.delete(subscriptionId)
        }
      }
    }
    delete socket.user

    // expire session if offline over 60 seconds
    redis.expire(socket.id, 60, function (err) {
      console.error(err)
    })
  }
  async register (socket, data, cb) {
    console.log('register!')
    try {
      let user
      switch (data.method) {
        case 'email':
          user = await this.emailAuth.register({ email: data.email, password: data.password })
          /* TODO: email verification */
          break
        default:
          throw new Error('authentication method is under development')
      }
      socket.user = user
      redis.hset(socket.id, 'userId', user._id, function (err) {
        console.error(err)
      })
      const { password, verifyCode, ...sUser } = user
      cb(null, sUser)
    } catch (err) {
      cb(err)
    }
  }
  async login (socket, data, cb) {
    console.log('login!')
    try {
      let user
      switch (data.method) {
        case 'email':
          user = await this.emailAuth.login(data)
          break
        case 'ldap':
          user = await this.ldapAuth.login(data)
          break
        default:
          throw new Error('authentication method is under development')
      }

      socket.user = user
      redis.hset(socket.id, 'userId', user._id, function (err) {
        console.error(err)
      })
      const { password, verifyCode, ...sUser } = user
      cb(null, sUser)
    } catch (err) {
      delete socket.user
      cb(err)
    }
  }
  logout (socket, data, cb) {
    delete socket.user
    redis.hdel(socket.id, 'userId', function (err) {
      console.error(err)
    })
    cb()
  }
  async verify (socket, data, cb) {
    try {
      let user
      switch (data.method) {
        case 'email':
          user = await this.emailAuth.verify(data.id, data.verifyCode)
          const { password, verifyCode, ...sUser } = user
          cb(null, sUser)
          break
        default:
          throw new Error('unknown authentication method')
      }
    } catch (err) {
      cb(err)
    }
  }
  async changePassword (socket, data, cb) {
    try {
      if (!socket.user || !socket.user._id) {
        throw new Error('Not login')
      }
      switch (data.method) {
        case 'email':
          socket.user = await this.emailAuth.changePassword(socket.user._id, data.password)
          const { password, verifyCode, ...sUser } = socket.user
          cb(null, sUser)
          break
        default:
          throw new Error('unknown authentication method')
      }
    } catch (err) {
      cb(err)
    }
  }
  checkRequest (request) {
    if (
      request &&
      request.beakerId &&
      !this.beakerIdlist.includes(request.beakerId)
    ) {
      throw new Error('You do not has access to this beaker')
    }
  }
  async create (socket, request, cb) {
    try {
      this.checkRequest(request)
      /* TODO: rule validation */
      let collection = this.database.collection(request.beakerId)
      let compound = BSON.deserialize(Buffer.from(request.data))

      CompoundUtils.validateObject(compound)
      let ruleRunner = new RuleRunner(this.beakers[request.beakerId].rule.create)
      let passACL = await ruleRunner.run({ request: { compound, user: socket.user } })
      if (!passACL) {
        throw new Error('Access denined')
      }

      let options = {}
      if (request.txnSessionId) {
        let txnSession = socket.txnSessions.get(request.txnSessionId)
        if (!txnSession) throw new Error('Invalid txnSessionId')
        options.session = txnSession
      }

      let response = await collection.insertOne(
        compound,
        options
      ) /* insertOne has no raw option */
      if (response.result.n === 0) {
        throw new Error('Create compound failed. Write conflict?')
      }
      cb(null, {
        data: BSON.serialize(response.ops[0]) /* so we need to serialize it */
      })
    } catch (err) {
      cb(err)
    }
  }
  async find (socket, query, cb) {
    try {
      this.checkRequest(query)

      const parsedConditions = BSON.deserialize(Buffer.from(query.conditions))
      query.conditions = parsedConditions

      let ruleRunner = new RuleRunner(this.beakers[query.beakerId].rule.list)
      let passACL = await ruleRunner.run({ request: { user: socket.user, socketId: socket.id } }, query)
      if (!passACL) {
        throw new Error('Access denined')
      }

      let collection = this.database.collection(query.beakerId)

      let options = { ...query.options, raw: true }
      if (query.txnSessionId) {
        let txnSession = socket.txnSessions.get(query.txnSessionId)
        if (!txnSession) throw new Error('Invalid txnSessionId')
        options.session = txnSession
      }

      if ('fields' in options) { // fields are deprecated
        options.projection = options.fields
        delete options.fields
      }
      if (typeof options.projection !== 'object') options.projection = {}
      options.projection.__old = 0 // exclude __old from result

      let result = await collection.find(parsedConditions, options).toArray()

      cb(null, {
        data: result
      })
    } catch (err) {
      cb(err)
    }
  }
  async get (socket, request, cb) {
    try {
      this.checkRequest(request)
      let collection = this.database.collection(request.beakerId)

      let options = { raw: true }
      if (request.txnSessionId) {
        let txnSession = socket.txnSessions.get(request.txnSessionId)
        if (!txnSession) throw new Error('Invalid txnSessionId')
        options.session = txnSession
      }

      if ('fields' in options) { // fields are deprecated
        options.projection = options.fields
        delete options.fields
      }
      if (typeof options.projection !== 'object') options.projection = {}
      options.projection.__old = 0 // exclude __old from result

      let compound = await collection.findOne(
        { _id: BSON.ObjectId.createFromHexString(request._id) }, options
      )
      if (!compound) throw new Error('Compound does not exist')

      let ruleRunner = new RuleRunner(this.beakers[request.beakerId].rule.get)
      let passACL = await ruleRunner.run({ compound, request: { user: socket.user, socketId: socket.id } })
      if (!passACL) {
        throw new Error('Access denined')
      }

      /* TODO: rule validation */
      cb(null, {
        data: compound
      })
    } catch (err) {
      cb(err)
    }
  }

  async update (socket, request, cb) {
    try {
      this.checkRequest(request)
      let collection = this.database.collection(request.beakerId)
      let queryById = { _id: BSON.ObjectId.createFromHexString(request._id) }

      let options = {}
      if (request.txnSessionId) {
        let txnSession = socket.txnSessions.get(request.txnSessionId)
        if (!txnSession) throw new Error('Invalid txnSessionId')
        options.session = txnSession
      }

      let compound = await collection.findOne(queryById, options)
      if (!compound) throw new Error('Compound does not exist')

      const newSetData = BSON.deserialize(Buffer.from(request.data)) || {}

      const newCompound = CompoundUtils.dotNotationToObject(compound, newSetData)
      CompoundUtils.validateObject(newCompound)

      const context = {
        compound,
        request: {
          user: socket.user,
          compound: newCompound,
          socketId: socket.id
        }
      }
      let ruleRunner = new RuleRunner(this.beakers[request.beakerId].rule.update)
      let passACL = await ruleRunner.run(context)
      if (!passACL) {
        throw new Error('Access denined')
      }

      /* TODO: rule validation & replace option */

      let update = {
        $set: { ...newSetData, __old: compound }
      }

      if (typeof compound.__version === 'number') {
        queryById.__version = compound.__version
        update.$inc = { __version: 1 }
      } else {
        update.$set.__version = 0
      }

      let response = await collection.updateOne(queryById, update, options)

      if (response.result.n === 0) {
        throw new Error('Compound does not exist or have write conflict')
      }

      cb(null, {
        data: { ok: true, result: response.result }
      })
    } catch (err) {
      cb(err)
    }
  }
  async delete (socket, request, cb) {
    try {
      this.checkRequest(request)
      let collection = this.database.collection(request.beakerId)
      let queryById = { _id: BSON.ObjectId.createFromHexString(request._id) }

      let options = {}
      if (request.txnSessionId) {
        let txnSession = socket.txnSessions.get(request.txnSessionId)
        if (!txnSession) throw new Error('Invalid txnSessionId')
        options.session = txnSession
      }

      let compound = await collection.findOne(queryById, options)
      if (!compound) throw new Error('Compound does not exist')

      /* TODO: rule validation */
      let ruleRunner = new RuleRunner(this.beakers[request.beakerId].rule.delete)
      let passACL = await ruleRunner.run({ compound, request: { user: socket.user, socketId: socket.id } })
      if (!passACL) {
        throw new Error('Access denined')
      }

      if (typeof compound.__version === 'number') {
        queryById.__version = compound.__version
      }

      let response = await collection.deleteOne(queryById, options)
      if (response.result.n === 0) {
        throw new Error('Compound does not exist or have write conflict')
      }
      cb(null, {
        data: { ok: true }
      })

      /*
      TODO: notify delete
      let matchSubscribeQuery = await collection.aggregate([
        { $limit: 1 },
        { $project: { '###nonexist': 0 } },
        { $addFields: compound },
        { $match: condition },
        { $count: 'n' }
      ])
      if (matchSubscribeQuery.n === 1) {
        emit delete now
      }
      */
    } catch (err) {
      cb(err)
    }
  }
  async subscribe (socket, query, cb) {
    try {
      this.checkRequest(query)

      const parsedConditions = BSON.deserialize(Buffer.from(query.conditions))
      query.conditions = parsedConditions

      let ruleRunner = new RuleRunner(this.beakers[query.beakerId].rule.list)
      let passACL = await ruleRunner.run({ request: { user: socket.user, socketId: socket.id } }, query)
      if (!passACL) {
        throw new Error('Access denined')
      }

      const changeStreamGroup = this.getChangeStream(
        query.beakerId,
        query.conditions
      )
      if (!socket.listeningChangeStreamMap) {
        socket.listeningChangeStreamMap = new Map()
      }

      const subscriptionId = changeStreamGroup.uniqueCounter
        ? ++changeStreamGroup.uniqueCounter
        : 0

      const handler = (err, changeData) => {
        socket.emit('change' + subscriptionId, err, changeData)
      }

      socket.listeningChangeStreamMap.set(subscriptionId, changeStreamGroup)
      changeStreamGroup.callbackHandlers.set(subscriptionId, handler)

      cb(null, {
        data: {
          subscriptionId: subscriptionId
        }
      })
    } catch (err) {
      cb(err)
    }
  }
  unsubscribe (socket, request, cb) {
    try {
      this.checkRequest(request)
      let subscriptionId = request.subscriptionId

      if (!socket.listeningChangeStreamMap) {
        throw new Error('No subscription')
      }
      let changeStream = socket.listeningChangeStreamMap.get(subscriptionId)
      if (!changeStream) {
        throw new Error('Invalid subscription id')
      }

      if (!changeStream.callbackHandlers.delete(subscriptionId)) {
        throw new Error('Invalid subscription id')
      }

      cb(null, {
        data: {
          removedSubscriptionId: subscriptionId
        }
      })
    } catch (err) {
      cb(err)
    }
  }
  getChangeStream (beakerId, condition) {
    const key = beakerId + JSON.stringify(condition)
    let changeStreamGroup = this.changeStreamGroups.get(key)

    if (!changeStreamGroup) {
      const entries = Object.entries(condition)
      const pipeline = []
      if (entries.length > 0) {
        const lookupCondition = Object.assign(...entries
          .map(([k, v]) => ({['fullDocument.' + k]: v})))
        pipeline.push({ $match: lookupCondition })
      }
      pipeline.push({
        $project: {
          documentKey: 0,
          ns: 0,
          clusterTime: 0
        }
      })
      const options = {
        fullDocument: 'updateLookup'
      }

      changeStreamGroup = [
        this.database
          .collection(beakerId)
          .watch(pipeline, options)
      ]

      if (entries.length > 0 &&
          !(entries.length === 1 && entries[0][0] === '_id')) {
        const lookupCondition = Object.assign({
          operationType: 'update'
        },
        ...entries.map(([k, v]) => {
          if (typeof v === 'object') {
            if (isPlainObject(v)) {
              if (!Object.keys(v).every(k => k.startsWith('$'))) {
                v = { $eq: v }
              }
            } else {
              v = { $eq: v }
            }
          } else {
            v = { $eq: v }
          }
          return {['fullDocument.' + k]: { $not: v }}
        }),
        ...entries.map(([k, v]) => ({['fullDocument.__old.' + k]: v})))

        const negativePipeline = [
          {
            $match: lookupCondition
          },
          {
            $project: {
              operationType: 'delete',
              documentKey: 1,
              fullDocument: {
                _id: '$documentKey._id'
              }
            }
          }
        ]

        changeStreamGroup.push(
          this.database
            .collection(beakerId)
            .watch(negativePipeline, options)
        )
      }

      changeStreamGroup.callbackHandlers = new Map()
      this.changeStreamGroups.set(key, changeStreamGroup)

      for (let i = 0; i < changeStreamGroup.length; i++) {
        changeStreamGroup[i].on('change', changeData => {
          if (
            changeData.operationType === 'update' &&
          changeData.updateDescription.removedFields.length === 0
          ) {
            let fields = Object.keys(changeData.updateDescription.updatedFields)
            if (fields.length === 1 && fields[0] === '__version') return
          }

          delete changeData._id
          changeData.compound = changeData.fullDocument
          changeData.type = changeData.operationType === 'insert' ? 'create' : changeData.operationType
          delete changeData.fullDocument
          delete changeData.operationType

          let changeDataRaw = BSON.serialize(changeData)
          for (let subscriptionId of changeStreamGroup.callbackHandlers.keys()) {
            let callback = changeStreamGroup.callbackHandlers.get(subscriptionId)
            if (callback) {
              setImmediate(() => callback(null, changeDataRaw))
            }
          }
        })
        changeStreamGroup[i].on('error', err => {
          console.error('ChangeStreamGroup Error', err)
          for (let subscriptionId of changeStreamGroup.callbackHandlers.keys()) {
            let callback = changeStreamGroup.callbackHandlers.get(subscriptionId)
            if (callback) {
              setImmediate(() => callback(err))
            }
          }
        })
        changeStreamGroup[i].on('close', () => {
          changeStreamGroup.callbackHandlers.clear()
          this.changeStreamGroups.delete(key)
        })
      // changeStreamGroup[i].setMaxListeners(1000);
      }
    }
    return changeStreamGroup
  }
  startTransaction (socket, request, cb) {
    try {
      let txnSession = Database.MongoClient.startSession()
      socket.txnSessions.set(++socket.uniqueCounter, txnSession)
      txnSession.startTransaction() /* no return value, no callback */
      cb(null, { txnSessionId: socket.uniqueCounter })
    } catch (err) {
      cb(err)
    }
  }
  async commitTransaction (socket, request, cb) {
    try {
      let txnSession = socket.txnSessions.get(request.txnSessionId)
      if (!txnSession) throw new Error('Invalid txnSessionId')
      let result = await txnSession.commitTransaction() /* a promise if no callback function specified */
      cb(null, { data: result })
    } catch (err) {
      cb(err)
    }
  }
  async abortTransaction (socket, request, cb) {
    try {
      let txnSession = socket.txnSessions.get(request.txnSessionId)
      if (!txnSession) throw new Error('Invalid txnSessionId')
      let result = await txnSession.abortTransaction() /* a promise if no callback function specified */

      /*
        callback is meaningless
        https://github.com/mongodb-js/mongodb-core/blob/d95a4d15eea9455dff3feea38784bbaed338488d/lib/sessions.js#L114
      */
      txnSession.endSession()
      socket.txnSessions.delete(request.txnSessionId)
      cb(null, { data: result })
    } catch (err) {
      cb(err)
    }
  }
  async cleanUp () {
    if (this.emailAuth) this.emailAuth.transporter.close()
    if (this.ldapAuth) this.ldapAuth.ldap.close()
    console.log('cleaning up database...')
    await this.database.removeUser('chembaseuser')
    await this.database.dropDatabase()
  }
}

Lab.get = labId => globalLabMap.get(labId)

module.exports = Lab
